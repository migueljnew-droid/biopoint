import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@biopoint/db';

/**
 * Middleware to check if an S3 presigned URL has been revoked
 * This should be called before serving any S3 content
 */
export async function checkUrlRevocation(
    request: FastifyRequest,
    _reply: FastifyReply,
    url: string
): Promise<boolean> {
    try {
        const revokedUrl = await prisma.revokedUrl.findUnique({
            where: { url }
        });

        if (revokedUrl) {
            request.log.warn({ url, revokedAt: revokedUrl.revokedAt }, 'Access attempted to revoked S3 URL');
            return false; // URL is revoked
        }

        return true; // URL is not revoked
    } catch (error) {
        request.log.error({ url, error }, 'Error checking URL revocation status');
        // Fail closed - if we can't check, assume it's revoked for security
        return false;
    }
}

/**
 * Log a download attempt for security monitoring
 */
export async function logDownloadAttempt(
    request: FastifyRequest,
    userId: string | null,
    url: string,
    s3Key: string,
    success: boolean,
    error?: string
): Promise<void> {
    try {
        await prisma.downloadLog.create({
            data: {
                userId,
                url,
                s3Key,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
                success,
                error,
            }
        });
    } catch (logError) {
        request.log.error({ url, s3Key, error: logError }, 'Failed to log download attempt');
    }
}

/**
 * Detect suspicious download patterns
 */
export async function detectSuspiciousActivity(
    request: FastifyRequest,
    s3Key: string,
    userId: string | null
): Promise<void> {
    try {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        // Check for multiple downloads of the same file by different users
        const recentDownloads = await prisma.downloadLog.findMany({
            where: {
                s3Key,
                downloadedAt: {
                    gte: fiveMinutesAgo
                },
                success: true
            },
            select: {
                userId: true,
                ipAddress: true,
                downloadedAt: true
            }
        });

        const uniqueUsers = new Set(recentDownloads.map(d => d.userId));

        // Alert if multiple users are downloading the same file in a short timeframe
        if (uniqueUsers.size > 2 && recentDownloads.length > 3) {
            request.log.warn({
                s3Key,
                userCount: uniqueUsers.size,
                downloadCount: recentDownloads.length,
                timeWindow: '5 minutes'
            }, 'Suspicious activity detected: Multiple users downloading same file');
        }

        // Alert if same user is downloading from multiple IPs
        if (userId) {
            const userDownloads = recentDownloads.filter(d => d.userId === userId);
            const userIps = new Set(userDownloads.map(d => d.ipAddress));
            if (userIps.size > 2) {
                request.log.warn({
                    userId,
                    s3Key,
                    ipCount: userIps.size,
                    downloadCount: userDownloads.length
                }, 'Suspicious activity detected: User downloading from multiple IPs');
            }
        }

        // Check for high volume of download requests
        const hourlyDownloads = await prisma.downloadLog.count({
            where: {
                downloadedAt: {
                    gte: oneHourAgo
                },
                success: true
            }
        });

        if (hourlyDownloads > 100) {
            request.log.warn({
                hourlyDownloads,
                timeWindow: '1 hour'
            }, 'Suspicious activity detected: High volume of download requests');
        }

    } catch (error) {
        request.log.error({ s3Key, error }, 'Error during suspicious activity detection');
    }
}