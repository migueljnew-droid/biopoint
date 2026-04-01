import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { setDbRequestContext, clearDbRequestContext } from '@biopoint/db';
import { requestIdMiddleware } from './middleware/requestId.js';
import { createRequestLogger, logRequest, logResponse } from './utils/logger.js';
import { registerRateLimits, redisClient } from './middleware/rateLimit.js';
import { adminRoutes } from './routes/admin.js';
import { adminS3Routes } from './routes/admin-s3.js';
import { authRoutes } from './routes/auth.js';
import { profileRoutes } from './routes/profile.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { logsRoutes } from './routes/logs.js';
import { stacksRoutes } from './routes/stacks.js';
import { labsRoutes } from './routes/labs.js';
import { photosRoutes } from './routes/photos.js';
import { communityRoutes } from './routes/community.js';
import { remindersRoutes } from './routes/reminders.js';
import { researchRoutes } from './routes/research.js';
import { healthRoutes } from './routes/health.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sanitizationMiddleware } from './middleware/sanitization.js';
import { dataExportRoutes } from './routes/user/data-export.js';
import { accountDeletionRoutes } from './routes/user/account-deletion.js';
import { fastingRoutes } from './routes/fasting.js';
import { nutritionRoutes } from './routes/nutrition.js';
import { complianceRoutes } from './routes/compliance.js';
import { peptidesRoutes } from './routes/peptides.js';
import { correlationsRoutes } from './routes/correlations.js';
import { biopointRoutes } from './routes/biopoint.js';
import { oracleRoutes } from './routes/oracle.js';

const envToLogger = {
    development: {
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            },
        },
    },
    production: true,
    test: { level: 'silent' },
};

export interface CreateServerOptions {
    logger?: boolean | object;
    disableRateLimit?: boolean;
    prefixes?: string[];
}

async function registerRoutesForPrefix(app: FastifyInstance, prefix: string) {
    const base = prefix === '/' ? '' : prefix;
    const withPrefix = (path: string) => `${base}${path}`;

    await app.register(authRoutes, { prefix: withPrefix('/auth') });
    await app.register(profileRoutes, { prefix: withPrefix('/profile') });
    await app.register(dashboardRoutes, { prefix: withPrefix('/dashboard') });
    await app.register(logsRoutes, { prefix: withPrefix('/logs') });
    await app.register(stacksRoutes, { prefix: withPrefix('/stacks') });
    await app.register(labsRoutes, { prefix: withPrefix('/labs') });
    await app.register(photosRoutes, { prefix: withPrefix('/photos') });
    await app.register(communityRoutes, { prefix: withPrefix('/community') });
    await app.register(remindersRoutes, { prefix: withPrefix('/reminders') });
    await app.register(researchRoutes, { prefix: withPrefix('/research') });
    await app.register(healthRoutes, { prefix: base });
    await app.register(adminRoutes, { prefix: withPrefix('/admin') });
    await app.register(adminS3Routes, { prefix: withPrefix('/admin/s3') });
    await app.register(fastingRoutes, { prefix: withPrefix('/fasting') });
    await app.register(nutritionRoutes, { prefix: withPrefix('/nutrition') });
    await app.register(complianceRoutes, { prefix: withPrefix('/compliance') });
    await app.register(dataExportRoutes, { prefix: withPrefix('/user') });
    await app.register(accountDeletionRoutes, { prefix: withPrefix('/user') });
    await app.register(peptidesRoutes, { prefix: withPrefix('/peptides') });
    await app.register(correlationsRoutes, { prefix: withPrefix('/correlations') });
    await app.register(biopointRoutes, { prefix: withPrefix('/biopoint') });
    await app.register(oracleRoutes, { prefix: withPrefix('/oracle') });
}

export async function createServer(options: CreateServerOptions = {}) {
    const env = (process.env.NODE_ENV || 'development') as keyof typeof envToLogger;
    const logger = options.logger ?? (envToLogger[env] ?? true);

    const app = Fastify({
        logger,
        // Respect X-Forwarded-For in request.ip so rate limiting and auditing work correctly behind proxies.
        trustProxy: true,
        genReqId: (req) => (req.headers['x-request-id'] as string) || '',
        // 10MB to support base64 food photo uploads for AI analysis
        bodyLimit: 10 * 1024 * 1024,
    });

    // Register custom request properties for runtime safety (Fastify requires decorateRequest
    // before accessing custom properties on the request object in hooks/handlers).
    app.decorateRequest('userId', '');
    app.decorateRequest('userEmail', '');
    app.decorateRequest('userRole', 'USER');
    app.decorateRequest('startTime', 0);

    // Register request ID middleware
    app.addHook('onRequest', requestIdMiddleware);

    // Register global input sanitization middleware
    app.addHook('preHandler', sanitizationMiddleware);

    // Request logging hook (DB query tracing is handled by $extends in @biopoint/db)
    app.addHook('onRequest', async (request, reply) => {
        const loggerInstance = createRequestLogger(request.log, request);
        // Override Fastify's default request.log with the request-scoped child logger.
        // FastifyBaseLogger is the shared base; we use unknown cast for the narrowing.
        (request as unknown as { log: typeof loggerInstance }).log = loggerInstance;
        setDbRequestContext(request, loggerInstance);
        logRequest(loggerInstance, request, reply);
    });

    // Response logging hook
    app.addHook('onResponse', async (request, reply) => {
        const startTime = request.startTime || Date.now();
        const responseTime = Math.max(1, Date.now() - startTime);
        const loggerInstance = request.log as import('./utils/logger.js').RequestLogger;

        logResponse(loggerInstance, request, reply, responseTime);
        clearDbRequestContext();
    });

    // Set start time for response time calculation
    app.addHook('onRequest', async (request) => {
        request.startTime = Date.now();
    });

    // Warn if CORS_ORIGIN is not configured in production — requests from web clients will be blocked.
    if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
        app.log.warn('CORS_ORIGIN is not set in production. All cross-origin requests will be rejected.');
    }

    // Register plugins
    await app.register(cors, {
        origin: (origin, callback) => {
            const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean) || [];
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`CORS not allowed for origin: ${origin}`), false);
            }
        },
        credentials: true,
    });

    await app.register(helmet, {
        contentSecurityPolicy: false,
    });

    // Global rate limiting via Redis (replaces DatabaseRateLimitStore for request-level limits).
    // When REDIS_HOST is set, state persists across restarts/deploys so attackers cannot bypass
    // auth rate limits by triggering a redeploy. Falls back to in-memory when Redis is not configured.
    await app.register(rateLimit, {
        global: true,
        max: 100,
        timeWindow: '1 minute',
        // Redis store when available; falls back to in-memory when Redis not configured
        ...(redisClient ? {
            redis: redisClient,
            nameSpace: 'biopoint-rl-',
        } : {}),
        skipOnError: true,        // Fail-open if Redis is unreachable (don't block requests)
        keyGenerator: (request) => request.ip,
        // Per-route config overrides use route-level config.rateLimit
    });

    // Apply per-prefix rate limit overrides via onRoute hook.
    // login: 20/min — low ceiling at transport layer, account lockout is the primary defense
    // other auth: 5/15min — brute-force prevention for registration/refresh/etc
    // health/public: 1000/hr — generous for monitoring systems
    // PHI endpoints (labs/photos/profile): 200/min — per-user clinical data throughput
    // presign: 50/hr — S3 upload URL generation
    app.addHook('onRoute', (routeOptions) => {
        const url = routeOptions.url;

        if (url.startsWith('/auth/login') || url.startsWith('/api/auth/login')) {
            routeOptions.config = {
                ...routeOptions.config,
                rateLimit: { max: 20, timeWindow: '1 minute' },
            };
        } else if (url.startsWith('/auth') || url.startsWith('/api/auth')) {
            routeOptions.config = {
                ...routeOptions.config,
                rateLimit: { max: 5, timeWindow: '15 minutes' },
            };
        } else if (url.startsWith('/health') || url.startsWith('/api/health')) {
            routeOptions.config = {
                ...routeOptions.config,
                rateLimit: { max: 1000, timeWindow: '1 hour' },
            };
        } else if (url.startsWith('/labs') || url.startsWith('/api/labs') || url.startsWith('/photos') || url.startsWith('/api/photos') || url.startsWith('/profile') || url.startsWith('/api/profile')) {
            routeOptions.config = {
                ...routeOptions.config,
                rateLimit: { max: 200, timeWindow: '1 minute' },
            };
        } else if (url.startsWith('/presign') || url.startsWith('/api/presign')) {
            routeOptions.config = {
                ...routeOptions.config,
                rateLimit: { max: 50, timeWindow: '1 hour' },
            };
        }
    });

    if (!options.disableRateLimit) {
        await registerRateLimits(app);
    }

    // Error handler
    app.setErrorHandler(errorHandler);

    // Not found handler (include requestId for tracing)
    app.setNotFoundHandler((request, reply) => {
        reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Route not found',
            requestId: request.id || 'unknown',
        });
    });

    const prefixes = options.prefixes ?? ['', '/api'];
    for (const prefix of prefixes) {
        await registerRoutesForPrefix(app, prefix);
    }

    return app;
}
