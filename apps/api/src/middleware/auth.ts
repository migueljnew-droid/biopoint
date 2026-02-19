import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { prisma } from '@biopoint/db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}

export interface JwtPayload {
    userId: string;
    email: string;
    role: 'USER' | 'ADMIN';
}

// Under Vitest, some suites fire hundreds of concurrent authenticated requests. We still want to
// verify that the user exists, but we should not hammer Postgres with identical lookups.
const userLookupCache = new Map<string, Promise<{ id: string; email: string; role: string } | null>>();

export function __testResetAuthCache(): void {
    if (process.env.NODE_ENV !== 'test') return;
    userLookupCache.clear();
}

export async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const requestId = request.id;
    const logger = request.log;

    const authHeader = request.headers.authorization;
    logger.debug({
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        hasAuthHeader: !!authHeader,
    }, 'Authentication attempt');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn({
            hasAuthHeader: !!authHeader,
        }, 'Authentication failed - missing or invalid authorization header');
        
        return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Missing or invalid authorization header',
            requestId: requestId || 'unknown',
        });
    }

    const token = authHeader.substring(7);

    try {
        const payload = jwt.verify(token, JWT_SECRET!) as unknown as JwtPayload;

        // Verify user still exists
        const cacheKey = payload.userId;
        let lookup = userLookupCache.get(cacheKey);
        if (!lookup) {
            lookup = prisma.user
                .findUnique({
                    where: { id: payload.userId },
                    select: { id: true, email: true, role: true },
                })
                .catch((err) => {
                    // Allow retry after transient DB errors.
                    userLookupCache.delete(cacheKey);
                    throw err;
                });

            // Cache only in test env to keep production behaviour simple.
            if (process.env.NODE_ENV === 'test') {
                userLookupCache.set(cacheKey, lookup);
            }
        }

        const user = await lookup;

        if (!user) {
            logger.warn({
                userId: payload.userId,
            }, 'Authentication failed - user not found');
            
            return reply.status(401).send({
                statusCode: 401,
                error: 'Unauthorized',
                message: 'User not found',
                requestId: requestId || 'unknown',
            });
        }

        // Attach user info to request
        request.userId = user.id;
        request.userEmail = user.email;
        request.userRole = user.role as 'USER' | 'ADMIN';
        
        logger.info({
            userId: user.id,
            userEmail: user.email,
            userRole: user.role,
        }, 'Authentication successful');
    } catch (error) {
        logger.error({
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
            } : String(error),
        }, 'Authentication failed - token verification error');
        
        return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid or expired token',
            requestId: requestId || 'unknown',
        });
    }
}

export async function adminMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const logger = request.log;

    await authMiddleware(request, reply);

    if (reply.sent) return;

    if (request.userRole !== 'ADMIN') {
        logger.warn({
            userId: request.userId,
            userRole: request.userRole,
        }, 'Authorization failed - admin access required');

        return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: 'Admin access required',
            requestId: request.id || 'unknown',
        });
    }

    logger.info({
        userId: request.userId,
        userRole: request.userRole,
    }, 'Admin authorization successful');
}
