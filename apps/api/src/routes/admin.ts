import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@biopoint/db';
import { adminMiddleware } from '../middleware/auth.js';
import { adminPerformanceRoutes } from './admin-performance.js';

/**
 * Admin routes for request tracing and system management
 */
export async function adminRoutes(app: FastifyInstance) {
    // Apply admin middleware to all routes in this plugin
    app.addHook('preHandler', adminMiddleware);

    /**
     * Get request trace by request ID
     * Aggregates logs from multiple sources (API, database, audit)
     */
    app.get('/request/:requestId/logs', async (request: FastifyRequest, _reply: FastifyReply) => {
        const { requestId } = request.params as { requestId: string };
        
        // Get audit logs for this request
        const auditLogs = await prisma.auditLog.findMany({
            where: { 
                metadata: {
                    path: ['reqId'],
                    equals: requestId
                }
            },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                userId: true,
                action: true,
                entityType: true,
                entityId: true,
                metadata: true,
                createdAt: true,
                ipAddress: true,
            }
        });

        // Get any database operations that might be logged
        // Note: This would require additional logging infrastructure
        // For now, we'll return audit logs and any request-specific data

        // Get request metadata if available
        const requestMetadata = {
            requestId,
            timestamp: new Date().toISOString(),
            // Additional metadata could be stored in a logging system
        };

        return {
            requestId,
            metadata: requestMetadata,
            auditLogs: auditLogs.map(log => ({
                id: log.id,
                userId: log.userId,
                action: log.action,
                entityType: log.entityType,
                entityId: log.entityId,
                metadata: log.metadata,
                timestamp: log.createdAt,
                ipAddress: log.ipAddress,
            })),
            // Placeholder for other log types
            apiLogs: [],
            databaseLogs: [],
            totalLogs: auditLogs.length,
        };
    });

    /**
     * Get recent requests with filtering
     */
    app.get('/requests', async (request: FastifyRequest, _reply: FastifyReply) => {
        const query = request.query as Record<string, unknown>;
        const limit = Math.max(1, parseInt(String(query.limit ?? 100), 10) || 100);
        const offset = Math.max(0, parseInt(String(query.offset ?? 0), 10) || 0);
        const userId = query.userId ? String(query.userId) : undefined;
        const action = query.action ? String(query.action) : undefined;
        const entityType = query.entityType ? String(query.entityType) : undefined;

        const where: any = {};
        if (userId) where.userId = userId;
        if (action) where.action = action;
        if (entityType) where.entityType = entityType;

        const [requests, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    userId: true,
                    action: true,
                    entityType: true,
                    entityId: true,
                    createdAt: true,
                    ipAddress: true,
                    metadata: true,
                }
            }),
            prisma.auditLog.count({ where })
        ]);

        return {
            requests: requests.map(req => ({
                id: req.id,
                userId: req.userId,
                action: req.action,
                entityType: req.entityType,
                entityId: req.entityId,
                timestamp: req.createdAt,
                ipAddress: req.ipAddress,
                // Extract request ID from metadata if available
                requestId: (req.metadata as Record<string, unknown> | null)?.['reqId'] as string | null || null,
            })),
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            }
        };
    });

    /**
     * Get system health and metrics
     */
    app.get('/health/detailed', async (_request: FastifyRequest, _reply: FastifyReply) => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Get request counts for different time periods
        const [requestsLastHour, requestsLastDay, totalRequests] = await Promise.all([
            prisma.auditLog.count({
                where: {
                    createdAt: {
                        gte: oneHourAgo
                    }
                }
            }),
            prisma.auditLog.count({
                where: {
                    createdAt: {
                        gte: oneDayAgo
                    }
                }
            }),
            prisma.auditLog.count()
        ]);

        // Get unique users
        const uniqueUsersLastHour = await prisma.auditLog.findMany({
            where: {
                createdAt: {
                    gte: oneHourAgo
                }
            },
            select: {
                userId: true
            },
            distinct: ['userId']
        });

        const uniqueUsersLastDay = await prisma.auditLog.findMany({
            where: {
                createdAt: {
                    gte: oneDayAgo
                }
            },
            select: {
                userId: true
            },
            distinct: ['userId']
        });

        return {
            timestamp: now.toISOString(),
            uptime: process.uptime(),
            requests: {
                lastHour: requestsLastHour,
                lastDay: requestsLastDay,
                total: totalRequests,
                uniqueUsers: {
                    lastHour: uniqueUsersLastHour.length,
                    lastDay: uniqueUsersLastDay.length
                }
            },
            system: {
                memory: process.memoryUsage(),
                version: process.version,
                platform: process.platform,
            }
        };
    });

    // Register performance monitoring routes
    await adminPerformanceRoutes(app);
}
