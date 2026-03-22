import pino from 'pino';

/**
 * Module-level structured logger for services and middleware that don't have
 * access to a Fastify request context. Uses pino for consistent log format
 * with the Fastify-managed request loggers.
 */
export const appLogger = pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
    ...(process.env.NODE_ENV === 'development'
        ? {
            transport: {
                target: 'pino-pretty',
                options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
            },
        }
        : {}),
});
