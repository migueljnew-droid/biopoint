import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from '@biopoint/shared';
import {
    hashPassword,
    verifyPassword,
    generateAccessToken,
    createRefreshToken,
    verifyRefreshToken,
    rotateRefreshToken,
    revokeRefreshToken,
    parseAccessTokenExpiry,
} from '../utils/auth.js';
import { authMiddleware } from '../middleware/auth.js';

export async function authRoutes(app: FastifyInstance) {
    // Register
    app.post('/register', async (request, reply) => {
        const body = RegisterSchema.parse(request.body);

        // Check if user exists
        const existing = await prisma.user.findUnique({
            where: { email: body.email },
        });

        if (existing) {
            return reply.status(409).send({
                statusCode: 409,
                error: 'Conflict',
                message: 'User with this email already exists',
            });
        }

        // Create user
        const passwordHash = await hashPassword(body.password);
        const user = await prisma.user.create({
            data: {
                email: body.email,
                passwordHash,
                profile: {
                    create: {},
                },
            },
            select: {
                id: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });

        // Generate tokens
        const accessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        const refreshToken = await createRefreshToken(user.id);

        return reply.status(201).send({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt.toISOString(),
            },
            tokens: {
                accessToken,
                refreshToken,
                expiresIn: parseAccessTokenExpiry(),
            },
        });
    });

    // Login
    app.post('/login', async (request, reply) => {
        const body = LoginSchema.parse(request.body);

        const user = await prisma.user.findUnique({
            where: { email: body.email },
            select: {
                id: true,
                email: true,
                passwordHash: true,
                role: true,
                createdAt: true,
            },
        });

        if (!user) {
            return reply.status(401).send({
                statusCode: 401,
                error: 'Unauthorized',
                message: 'Invalid email or password',
            });
        }

        const validPassword = await verifyPassword(body.password, user.passwordHash);
        if (!validPassword) {
            return reply.status(401).send({
                statusCode: 401,
                error: 'Unauthorized',
                message: 'Invalid email or password',
            });
        }

        // Generate tokens
        const accessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        const refreshToken = await createRefreshToken(user.id);

        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt.toISOString(),
            },
            tokens: {
                accessToken,
                refreshToken,
                expiresIn: parseAccessTokenExpiry(),
            },
        };
    });

    // Refresh token
    app.post('/refresh', async (request, reply) => {
        const body = RefreshTokenSchema.parse(request.body);

        const tokenData = await verifyRefreshToken(body.refreshToken);
        if (!tokenData) {
            return reply.status(401).send({
                statusCode: 401,
                error: 'Unauthorized',
                message: 'Invalid or expired refresh token',
            });
        }

        const user = await prisma.user.findUnique({
            where: { id: tokenData.userId },
            select: { id: true, email: true, role: true },
        });

        if (!user) {
            return reply.status(401).send({
                statusCode: 401,
                error: 'Unauthorized',
                message: 'User not found',
            });
        }

        // Rotate refresh token
        const newRefreshToken = await rotateRefreshToken(tokenData.tokenId, user.id);
        const accessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });

        return {
            tokens: {
                accessToken,
                refreshToken: newRefreshToken,
                expiresIn: parseAccessTokenExpiry(),
            },
        };
    });

    // Logout
    app.post('/logout', async (request, reply) => {
        const body = RefreshTokenSchema.parse(request.body);
        await revokeRefreshToken(body.refreshToken);
        return { success: true };
    });

    // Get current user
    app.get('/me', { preHandler: authMiddleware }, async (request) => {
        const userId = (request as any).userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                role: true,
                createdAt: true,
                profile: {
                    select: {
                        onboardingComplete: true,
                    },
                },
            },
        });

        return {
            id: user!.id,
            email: user!.email,
            role: user!.role,
            createdAt: user!.createdAt.toISOString(),
            onboardingComplete: user!.profile?.onboardingComplete ?? false,
        };
    });
}
