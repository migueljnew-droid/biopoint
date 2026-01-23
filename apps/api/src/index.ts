import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { prisma } from '@biopoint/db';

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
import { errorHandler } from './middleware/errorHandler.js';

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
    test: false,
};

const env = (process.env.NODE_ENV || 'development') as keyof typeof envToLogger;

const app = Fastify({
    logger: envToLogger[env] ?? true,
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

await app.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
});

// Error handler
app.setErrorHandler(errorHandler);

// Health check
app.get('/health', async () => {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    };
});

// API Routes
await app.register(authRoutes, { prefix: '/auth' });
await app.register(profileRoutes, { prefix: '/profile' });
await app.register(dashboardRoutes, { prefix: '/dashboard' });
await app.register(logsRoutes, { prefix: '/logs' });
await app.register(stacksRoutes, { prefix: '/stacks' });
await app.register(labsRoutes, { prefix: '/labs' });
await app.register(photosRoutes, { prefix: '/photos' });
await app.register(communityRoutes, { prefix: '/community' });
await app.register(remindersRoutes, { prefix: '/reminders' });
await app.register(researchRoutes, { prefix: '/research' });

// BioPoint history endpoint
app.get('/biopoint/history', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }

    const scores = await prisma.bioPointScore.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 30,
    });

    return scores;
});

// Markers endpoints
app.get('/markers', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }

    const markers = await prisma.labMarker.findMany({
        where: { userId },
        orderBy: { recordedAt: 'desc' },
    });

    return markers;
});

app.get('/markers/trends', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }

    const markers = await prisma.labMarker.findMany({
        where: { userId },
        orderBy: { recordedAt: 'asc' },
    });

    // Group by marker name
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

// Graceful shutdown
const shutdown = async () => {
    app.log.info('Shutting down...');
    await prisma.$disconnect();
    await app.close();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const port = parseInt(process.env.PORT || '3000');
const host = process.env.HOST || '0.0.0.0';

try {
    await app.listen({ port, host });
    app.log.info(`🚀 BioPoint API running at http://${host}:${port}`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
