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
import { createNotificationService } from '../services/notificationService.js';
import { authMiddleware } from '../middleware/auth.js';
import { sanitizationMiddleware } from '../middleware/sanitization.js';
import { recordFailedLogin, recordSuccessfulLogin, getAccountLockoutInfo } from '../middleware/rateLimit.js';

export async function authRoutes(app: FastifyInstance) {
    const notificationService = createNotificationService();
    // Apply input sanitization to all auth routes
    app.addHook('preHandler', sanitizationMiddleware);

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
        const clientIp = request.ip;
        const lockoutConfig = {
            maxAttempts: 5,
            lockoutDurationMs: 15 * 60 * 1000,
            progressiveDelays: [0, 1, 2, 4, 8],
        };

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
            // Record failed login attempt for account lockout
            const attemptCount = await recordFailedLogin(body.email, clientIp, lockoutConfig);

            // Under high concurrency, multiple requests can pass the preHandler lockout check
            // before the lock is set. Once we're beyond the allowed attempts, return a lockout
            // response immediately (without waiting for a subsequent request).
            if (attemptCount > lockoutConfig.maxAttempts) {
                const lockoutInfo = await getAccountLockoutInfo(body.email);
                if (lockoutInfo.isLocked) {
                    const remainingTime = Math.ceil((lockoutInfo.remainingTime || 0) / 1000);
                    reply.header('Retry-After', remainingTime);
                    return reply.status(429).send({
                        error: 'Account Temporarily Locked',
                        message: 'Account temporarily locked due to multiple failed login attempts.',
                        retryAfter: remainingTime,
                        lockedUntil: lockoutInfo.lockedUntil,
                    });
                }
            }

            return reply.status(401).send({
                statusCode: 401,
                error: 'Unauthorized',
                message: 'Invalid email or password',
            });
        }

        const validPassword = await verifyPassword(body.password, user.passwordHash);
        if (!validPassword) {
            // Record failed login attempt for account lockout
            const attemptCount = await recordFailedLogin(body.email, clientIp, lockoutConfig);

            if (attemptCount > lockoutConfig.maxAttempts) {
                const lockoutInfo = await getAccountLockoutInfo(body.email);
                if (lockoutInfo.isLocked) {
                    const remainingTime = Math.ceil((lockoutInfo.remainingTime || 0) / 1000);
                    reply.header('Retry-After', remainingTime);
                    return reply.status(429).send({
                        error: 'Account Temporarily Locked',
                        message: 'Account temporarily locked due to multiple failed login attempts.',
                        retryAfter: remainingTime,
                        lockedUntil: lockoutInfo.lockedUntil,
                    });
                }
            }

            // Check if account is now locked and send notification
            const lockoutInfo = await prisma.accountLockout.findUnique({
                where: { identifier: body.email },
            });

            if (lockoutInfo?.lockedUntil && lockoutInfo.lockedUntil > new Date()) {
                // Send account lockout notification
                await notificationService.sendAccountLockoutNotification({
                    type: 'account_lockout',
                    email: body.email,
                    userId: user.id,
                    ipAddress: clientIp,
                    timestamp: new Date(),
                    metadata: {
                        failedAttempts: 5,
                        lockoutDuration: 15,
                    },
                });

                // Log security event
                await notificationService.logSecurityEvent({
                    type: 'account_lockout',
                    email: body.email,
                    userId: user.id,
                    ipAddress: clientIp,
                    timestamp: new Date(),
                });
            }

            return reply.status(401).send({
                statusCode: 401,
                error: 'Unauthorized',
                message: 'Invalid email or password',
            });
        }

        // Record successful login (resets failed attempts)
        await recordSuccessfulLogin(body.email);

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
    app.post('/logout', { preHandler: authMiddleware }, async (request, _reply) => {
        const body = RefreshTokenSchema.parse(request.body);
        await revokeRefreshToken(body.refreshToken);
        return { success: true };
    });

    // Get current user
    app.get('/me', { preHandler: authMiddleware }, async (request) => {
        const userId = request.userId;

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
