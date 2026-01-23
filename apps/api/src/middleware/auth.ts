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

export async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Missing or invalid authorization header',
        });
    }

    const token = authHeader.substring(7);

    try {
        const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

        // Verify user still exists
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, email: true, role: true },
        });

        if (!user) {
            return reply.status(401).send({
                statusCode: 401,
                error: 'Unauthorized',
                message: 'User not found',
            });
        }

        // Attach user info to request
        (request as any).userId = user.id;
        (request as any).userEmail = user.email;
        (request as any).userRole = user.role;
    } catch (error) {
        return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid or expired token',
        });
    }
}

export async function adminMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    await authMiddleware(request, reply);

    if (reply.sent) return;

    if ((request as any).userRole !== 'ADMIN') {
        return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: 'Admin access required',
        });
    }
}
