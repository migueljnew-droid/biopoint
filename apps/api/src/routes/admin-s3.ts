import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@biopoint/db';
import { adminMiddleware } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/auditLog.js';
import { checkUrlRevocation } from '../middleware/s3Security.js';

/**
 * Admin S3 security management routes
 * Handles URL revocation, download tracking, and security monitoring
 */
export async function adminS3Routes(app: FastifyInstance) {
    // Apply admin middleware to all routes in this plugin
    app.addHook('preHandler', adminMiddleware);

    /**
     * Revoke an S3 presigned URL
     * POST /admin/s3/revoke
     */
    app.post('/revoke', async (request: FastifyRequest, reply: FastifyReply) => {
        const { url, reason } = request.body as { url: string; reason?: string };
        const adminId = request.userId;

        if (!url) {
            return reply.status(400).send({
                statusCode: 400,
                error: 'Bad Request',
                message: 'URL is required'
            });
        }

        try {
            // Check if URL is already revoked
            const existingRevocation = await prisma.revokedUrl.findUnique({
                where: { url }
            });

            if (existingRevocation) {
                return reply.status(409).send({
                    statusCode: 409,
                    error: 'Conflict',
                    message: 'URL is already revoked'
                });
            }

            // Create revocation record
            const revokedUrl = await prisma.revokedUrl.create({
                data: {
                    url,
                    revokedBy: adminId,
                    reason: reason || 'Security revocation'
                }
            });

            // Audit log for revocation
            await createAuditLog(request, {
                action: 'UPDATE',
                entityType: 'S3Url',
                entityId: url,
                metadata: { action: 'revoke', reason, revokedBy: adminId }
            });

            return {
                success: true,
                revokedUrl: {
                    url: revokedUrl.url,
                    revokedAt: revokedUrl.revokedAt,
                    revokedBy: revokedUrl.revokedBy,
                    reason: revokedUrl.reason
                }
            };

        } catch (error) {
            request.log.error({ url, error }, 'Failed to revoke S3 URL');
            return reply.status(500).send({
                statusCode: 500,
                error: 'Internal Server Error',
                message: 'Failed to revoke URL'
            });
        }
    });

    /**
     * List all revoked URLs
     * GET /admin/s3/revoked
     */
    app.get('/revoked', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = request.query as Record<string, unknown>;
        const limit = Math.max(1, parseInt(String(query.limit ?? 50), 10) || 50);
        const offset = Math.max(0, parseInt(String(query.offset ?? 0), 10) || 0);
        const startDate = query.startDate ? String(query.startDate) : undefined;
        const endDate = query.endDate ? String(query.endDate) : undefined;

        try {
            const where: any = {};
            
            // Add date filters if provided
            if (startDate || endDate) {
                where.revokedAt = {};
                if (startDate) where.revokedAt.gte = new Date(startDate);
                if (endDate) where.revokedAt.lte = new Date(endDate);
            }

            const [revokedUrls, total] = await Promise.all([
                prisma.revokedUrl.findMany({
                    where,
                    orderBy: { revokedAt: 'desc' },
                    take: limit,
                    skip: offset,
                    include: {
                        revokedByUser: {
                            select: {
                                id: true,
                                email: true,
                                profile: {
                                    select: {
                                        id: true,
                                        // Add any profile fields needed for display
                                    }
                                }
                            }
                        }
                    }
                }),
                prisma.revokedUrl.count({ where })
            ]);

            return {
                revokedUrls: revokedUrls.map(url => ({
                    id: url.id,
                    url: url.url,
                    revokedAt: url.revokedAt,
                    revokedBy: url.revokedBy,
                    revokedByEmail: url.revokedByUser?.email,
                    reason: url.reason
                })),
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + limit < total
                }
            };

        } catch (error) {
            request.log.error({ error }, 'Failed to fetch revoked URLs');
            return reply.status(500).send({
                statusCode: 500,
                error: 'Internal Server Error',
                message: 'Failed to fetch revoked URLs'
            });
        }
    });

    /**
     * Get download logs with filtering and pagination
     * GET /admin/downloads
     */
    app.get('/downloads', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = request.query as Record<string, unknown>;
        const limit = Math.max(1, parseInt(String(query.limit ?? 50), 10) || 50);
        const offset = Math.max(0, parseInt(String(query.offset ?? 0), 10) || 0);
        const userId = query.userId ? String(query.userId) : undefined;
        const startDate = query.startDate ? String(query.startDate) : undefined;
        const endDate = query.endDate ? String(query.endDate) : undefined;
        const success = query.success ? String(query.success) : undefined;
        const s3Key = query.s3Key ? String(query.s3Key) : undefined;

        try {
            const where: any = {};
            
            // Add filters
            if (userId) where.userId = userId;
            if (s3Key) where.s3Key = s3Key;
            if (success !== undefined) where.success = success === 'true';
            
            // Add date filters if provided
            if (startDate || endDate) {
                where.downloadedAt = {};
                if (startDate) where.downloadedAt.gte = new Date(startDate);
                if (endDate) where.downloadedAt.lte = new Date(endDate);
            }

            const [downloadLogs, total] = await Promise.all([
                prisma.downloadLog.findMany({
                    where,
                    orderBy: { downloadedAt: 'desc' },
                    take: limit,
                    skip: offset,
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                profile: {
                                    select: {
                                        id: true,
                                        // Add profile fields as needed
                                    }
                                }
                            }
                        }
                    }
                }),
                prisma.downloadLog.count({ where })
            ]);

            return {
                downloads: downloadLogs.map(log => ({
                    id: log.id,
                    userId: log.userId,
                    userEmail: log.user?.email,
                    url: log.url,
                    s3Key: log.s3Key,
                    downloadedAt: log.downloadedAt,
                    ipAddress: log.ipAddress,
                    userAgent: log.userAgent,
                    success: log.success,
                    error: log.error
                })),
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + limit < total
                }
            };

        } catch (error) {
            request.log.error({ error }, 'Failed to fetch download logs');
            return reply.status(500).send({
                statusCode: 500,
                error: 'Internal Server Error',
                message: 'Failed to fetch download logs'
            });
        }
    });

    /**
     * Get security analytics and suspicious activity reports
     * GET /admin/s3/security-analytics
     */
    app.get('/security-analytics', async (request: FastifyRequest, reply: FastifyReply) => {
        const { timeRange = '24h' } = request.query as { timeRange?: string };
        
        try {
            const now = new Date();
            let startDate: Date;
            
            switch (timeRange) {
                case '1h':
                    startDate = new Date(now.getTime() - 60 * 60 * 1000);
                    break;
                case '24h':
                default:
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
            }

            // Get download statistics
            const downloadStats = await prisma.downloadLog.groupBy({
                by: ['success'],
                where: {
                    downloadedAt: {
                        gte: startDate
                    }
                },
                _count: {
                    id: true
                }
            });

            // Get top downloaded files
            const topFiles = await prisma.downloadLog.groupBy({
                by: ['s3Key'],
                where: {
                    downloadedAt: {
                        gte: startDate
                    },
                    success: true
                },
                _count: {
                    id: true
                },
                orderBy: {
                    _count: {
                        id: 'desc'
                    }
                },
                take: 10
            });

            // Get unique user downloads
            const uniqueUserDownloads = await prisma.downloadLog.groupBy({
                by: ['userId'],
                where: {
                    downloadedAt: {
                        gte: startDate
                    },
                    success: true
                },
                _count: {
                    id: true
                },
                orderBy: {
                    _count: {
                        id: 'desc'
                    }
                },
                take: 10
            });

            // Get geographic distribution (based on IP addresses)
            const geographicData = await prisma.downloadLog.groupBy({
                by: ['ipAddress'],
                where: {
                    downloadedAt: {
                        gte: startDate
                    },
                    success: true
                },
                _count: {
                    id: true
                }
            });

            return {
                timeRange,
                downloadStats: {
                    successful: downloadStats.find(s => s.success === true)?._count.id || 0,
                    failed: downloadStats.find(s => s.success === false)?._count.id || 0,
                    total: downloadStats.reduce((sum, s) => sum + (s._count.id || 0), 0)
                },
                topFiles: topFiles.map(f => ({
                    s3Key: f.s3Key,
                    downloadCount: f._count.id
                })),
                topUsers: uniqueUserDownloads.map(u => ({
                    userId: u.userId,
                    downloadCount: u._count.id
                })),
                geographicData: geographicData.map(g => ({
                    ipAddress: g.ipAddress,
                    downloadCount: g._count.id
                })),
                revokedUrls: await prisma.revokedUrl.count({
                    where: {
                        revokedAt: {
                            gte: startDate
                        }
                    }
                })
            };

        } catch (error) {
            request.log.error({ error }, 'Failed to generate security analytics');
            return reply.status(500).send({
                statusCode: 500,
                error: 'Internal Server Error',
                message: 'Failed to generate security analytics'
            });
        }
    });

    /**
     * Check if a specific URL is revoked
     * GET /admin/s3/check-revocation/:url
     */
    app.get('/check-revocation/:url', async (request: FastifyRequest, reply: FastifyReply) => {
        const { url } = request.params as { url: string };
        
        try {
            // URL decode the parameter
            const decodedUrl = decodeURIComponent(url);
            const isRevoked = await checkUrlRevocation(request, reply, decodedUrl);
            
            return {
                url: decodedUrl,
                isRevoked: !isRevoked // checkUrlRevocation returns true if NOT revoked
            };

        } catch (error) {
            request.log.error({ url, error }, 'Failed to check URL revocation status');
            return reply.status(500).send({
                statusCode: 500,
                error: 'Internal Server Error',
                message: 'Failed to check URL revocation status'
            });
        }
    });
}
