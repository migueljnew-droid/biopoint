import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
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

    // Social auth (Google/Apple) — user already verified by Supabase
    // Mobile app calls supabase.auth.signInWithIdToken() first, then hits this endpoint
    // to sync user into our Prisma users table and get our custom JWT tokens
    app.post('/social', async (request, reply) => {
        const { provider, fullName } = request.body as { provider: string; fullName?: string };

        // Get the Supabase access token from the Authorization header
        // The mobile app sends the Supabase session token
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            return reply.status(401).send({ message: 'No authorization token provided' });
        }

        // Verify the Supabase token by calling Supabase's user endpoint
        const supabaseUrl = process.env.SUPABASE_URL || 'https://iygpnvihbhjkwbkkkwvq.supabase.co';
        const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5Z3BudmloYmhqa3dia2trd3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjY3NzQsImV4cCI6MjA5MDQwMjc3NH0.pSG9_QJsqR9afv8efmHcqBhUkg_QgfPH0_QmICyDnvo';

        try {
            const supabaseResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
                headers: {
                    'Authorization': authHeader,
                    'apikey': supabaseKey,
                },
            });

            if (!supabaseResponse.ok) {
                return reply.status(401).send({ message: 'Invalid social auth token' });
            }

            const supabaseUser = await supabaseResponse.json();
            const email = supabaseUser.email;

            if (!email) {
                return reply.status(400).send({ message: 'No email from social auth provider' });
            }

            // Find or create user in our Prisma database
            let user = await prisma.user.findUnique({
                where: { email },
                select: { id: true, email: true, role: true, createdAt: true },
            });

            if (!user) {
                // Create new user — no password needed for social auth
                const randomHash = await hashPassword(crypto.randomUUID());
                user = await prisma.user.create({
                    data: {
                        email,
                        passwordHash: randomHash,
                        profile: {
                            create: {
                                ...(fullName ? { displayName: fullName } : {}),
                            },
                        },
                    },
                    select: { id: true, email: true, role: true, createdAt: true },
                });
            }

            // Generate our custom tokens
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
                    onboardingComplete: false,
                },
                tokens: {
                    accessToken,
                    refreshToken,
                    expiresIn: parseAccessTokenExpiry(),
                },
            };
        } catch (error: any) {
            console.error('Social auth error:', error?.message, error?.code, error?.stack?.split('\n')[0]);
            // Distinguish between transient vs permanent failures
            if (error?.code === 'P2002') {
                // Unique constraint — user already exists, try to find them
                const email = (request.body as any)?.email;
                return reply.status(409).send({ message: 'Account already exists. Try signing in instead.' });
            }
            if (error?.code?.startsWith?.('P')) {
                // Prisma/database error — likely transient
                return reply.status(503).send({ message: 'Service temporarily unavailable. Please try again.' });
            }
            return reply.status(500).send({ message: 'Social authentication failed. Please try again.' });
        }
    });

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
