import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { prisma } from '@biopoint/db';
import { createAuditLog } from './middleware/auditLog.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { createPrismaRequestMiddleware, setPrismaRequestContext, clearPrismaRequestContext } from './middleware/prismaRequestId.js';
import { createRequestLogger, logRequest, logResponse } from './utils/logger.js';
import { registerRateLimits } from './middleware/rateLimit.js';
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
import { authMiddleware } from './middleware/auth.js';

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

async function registerRoutesForPrefix(app: any, prefix: string) {
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

    // BioPoint history endpoint
    app.get(withPrefix('/biopoint/history'), { preHandler: authMiddleware }, async (request: any, reply: any) => {
        const userId = request.userId;
        const scores = await prisma.bioPointScore.findMany({
            where: { userId },
            orderBy: { date: 'desc' },
            take: 30,
        });

        // SEC-04: log unconditionally, including empty results
        await createAuditLog(request, {
            action: 'READ',
            entityType: 'BioPointScore',
            entityId: 'history',
            metadata: { resultCount: scores.length },
        });

        return scores;
    });

    // Lab marker endpoints
    app.get(withPrefix('/markers'), { preHandler: authMiddleware }, async (request: any, reply: any) => {
        const userId = request.userId;
        const markers = await prisma.labMarker.findMany({
            where: { userId },
            orderBy: { recordedAt: 'desc' },
        });

        // SEC-04: log unconditionally, including empty results
        await createAuditLog(request, {
            action: 'READ',
            entityType: 'LabMarker',
            entityId: 'list',
            metadata: { resultCount: markers.length },
        });

        return markers;
    });

    app.get(withPrefix('/markers/trends'), { preHandler: authMiddleware }, async (request: any, reply: any) => {
        const userId = request.userId;
        const markers = await prisma.labMarker.findMany({
            where: { userId },
            orderBy: { recordedAt: 'asc' },
        });

        // SEC-04: log unconditionally, including empty results
        await createAuditLog(request, {
            action: 'READ',
            entityType: 'LabMarker',
            entityId: 'trends',
            metadata: { resultCount: markers.length },
        });

        const trends: Record<string, any> = {};
        for (const marker of markers) {
            if (!trends[marker.name]) {
                trends[marker.name] = {
                    markerName: marker.name,
                    unit: marker.unit,
                    dataPoints: [],
                };
            }
            trends[marker.name].dataPoints.push({
                date: marker.recordedAt.toISOString(),
                value: marker.value,
                refRangeLow: marker.refRangeLow,
                refRangeHigh: marker.refRangeHigh,
            });
        }

        return Object.values(trends);
    });
}

export async function createServer(options: CreateServerOptions = {}) {
    const env = (process.env.NODE_ENV || 'development') as keyof typeof envToLogger;
    const logger = options.logger ?? (envToLogger[env] ?? true);

    const app = Fastify({
        logger,
        // Respect X-Forwarded-For in request.ip so rate limiting and auditing work correctly behind proxies.
        trustProxy: true,
        genReqId: (req) => (req.headers['x-request-id'] as string) || undefined,
        // 10MB to support base64 food photo uploads for AI analysis
        bodyLimit: 10 * 1024 * 1024,
    });

    // Register request ID middleware
    app.addHook('onRequest', requestIdMiddleware);

    // Register global input sanitization middleware
    app.addHook('preHandler', sanitizationMiddleware);

    // Register Prisma request middleware
    prisma.$use(createPrismaRequestMiddleware(prisma));

    // Request logging hook
    app.addHook('onRequest', async (request, reply) => {
        const loggerInstance = createRequestLogger(app.log, request);
        (request as any).log = loggerInstance;
        setPrismaRequestContext(prisma, request, loggerInstance);
        logRequest(loggerInstance, request, reply);
    });

    // Response logging hook
    app.addHook('onResponse', async (request, reply) => {
        const startTime = (request as any).startTime || Date.now();
        const responseTime = Math.max(1, Date.now() - startTime);
        const loggerInstance = (request as any).log || app.log;

        logResponse(loggerInstance, request, reply, responseTime);
        clearPrismaRequestContext(prisma);
    });

    // Set start time for response time calculation
    app.addHook('onRequest', async (request) => {
        (request as any).startTime = Date.now();
    });

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

    // We implement our own route-aware rate limiting in `registerRateLimits`.
    // Keep @fastify/rate-limit registered (for potential per-route use) but disable global behavior
    // so it doesn't override our headers or limits.
    await app.register(rateLimit, {
        global: false,
        addHeaders: {
            'x-ratelimit-limit': false,
            'x-ratelimit-remaining': false,
            'x-ratelimit-reset': false,
            'retry-after': false,
        },
        addHeadersOnExceeding: {
            'x-ratelimit-limit': false,
            'x-ratelimit-remaining': false,
            'x-ratelimit-reset': false,
        },
    });

    if (!options.disableRateLimit) {
        await registerRateLimits(app);
    }

    // Error handler
    app.setErrorHandler(errorHandler);

    // Not found handler (include requestId for tracing)
    app.setNotFoundHandler((request, reply) => {
        const requestId = (request as any).id as string | undefined;
        reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Route not found',
            requestId: requestId || 'unknown',
        });
    });

    const prefixes = options.prefixes ?? ['', '/api'];
    for (const prefix of prefixes) {
        await registerRoutesForPrefix(app, prefix);
    }

    return app;
}
