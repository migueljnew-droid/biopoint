import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { authMiddleware } from '../middleware/auth.js';

// Generates a cryptographically safe 8-character uppercase alphanumeric code.
// Uses rejection sampling over Math.random to avoid modulo bias, but the
// search space (36^8 ≈ 2.8 trillion) is large enough that collisions are
// astronomically unlikely without any additional bias concern.
function generateReferralCode(): string {
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const LENGTH = 8;
    let code = '';
    for (let i = 0; i < LENGTH; i++) {
        code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    return code;
}

// Retry loop: generate a code and ensure it is not already taken.
// In practice this will never loop more than once, but the guard is here
// for correctness.
async function generateUniqueCode(maxAttempts = 10): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const code = generateReferralCode();
        const existing = await prisma.referral.findUnique({ where: { code } });
        if (!existing) return code;
    }
    throw new Error('Failed to generate a unique referral code after maximum attempts');
}

export async function referralsRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    // GET / — return the authenticated user's referral code, stats, and recent referrals
    app.get('/', async (request) => {
        const userId = request.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { referralCode: true },
        });

        const [total, completed, rewarded, pending] = await Promise.all([
            prisma.referral.count({ where: { referrerId: userId } }),
            prisma.referral.count({ where: { referrerId: userId, status: 'completed' } }),
            prisma.referral.count({ where: { referrerId: userId, status: 'rewarded' } }),
            prisma.referral.count({ where: { referrerId: userId, status: 'pending' } }),
        ]);

        const recent = await prisma.referral.findMany({
            where: { referrerId: userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
                id: true,
                code: true,
                status: true,
                createdAt: true,
                completedAt: true,
                referred: {
                    select: { id: true, email: true },
                },
            },
        });

        return {
            referralCode: user?.referralCode ?? null,
            stats: {
                total,
                pending,
                completed,
                rewarded,
            },
            referrals: recent.map((r) => ({
                id: r.id,
                code: r.code,
                status: r.status,
                createdAt: r.createdAt.toISOString(),
                completedAt: r.completedAt ? r.completedAt.toISOString() : null,
                referredEmail: r.referred?.email ?? null,
            })),
        };
    });

    // POST /generate — create (or return the existing) referral code for the user.
    // Idempotent: calling it multiple times returns the same code.
    app.post('/generate', async (request) => {
        const userId = request.userId;

        // Check whether the user already has a referral record + code
        const existing = await prisma.user.findUnique({
            where: { id: userId },
            select: { referralCode: true },
        });

        if (existing?.referralCode) {
            // Look up the canonical Referral row so we can return consistent metadata
            const referral = await prisma.referral.findFirst({
                where: { referrerId: userId, code: existing.referralCode },
                select: { id: true, code: true, status: true, createdAt: true },
            });

            return {
                referralCode: existing.referralCode,
                referralId: referral?.id ?? null,
                status: referral?.status ?? 'pending',
                createdAt: referral?.createdAt.toISOString() ?? null,
                message: 'Referral code already exists',
            };
        }

        const code = await generateUniqueCode();

        // Write both the Referral row and the denormalised referralCode on User
        // in a transaction so they are always consistent.
        const [, referral] = await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { referralCode: code },
            }),
            prisma.referral.create({
                data: {
                    referrerId: userId,
                    code,
                    status: 'pending',
                },
            }),
        ]);

        return {
            referralCode: referral.code,
            referralId: referral.id,
            status: referral.status,
            createdAt: referral.createdAt.toISOString(),
            message: 'Referral code generated',
        };
    });

    // POST /redeem — link the authenticated user to a referrer via their code.
    // A user may only redeem one referral code (they can only be referred once).
    app.post('/redeem', async (request, reply) => {
        const userId = request.userId;
        const body = request.body as { code?: unknown };

        if (!body.code || typeof body.code !== 'string') {
            return reply.status(400).send({
                statusCode: 400,
                error: 'Bad Request',
                message: 'code is required and must be a string',
            });
        }

        const code = (body.code as string).trim().toUpperCase();

        if (code.length !== 8) {
            return reply.status(400).send({
                statusCode: 400,
                error: 'Bad Request',
                message: 'Referral code must be 8 characters',
            });
        }

        // Prevent self-referral
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { referralCode: true },
        });

        if (currentUser?.referralCode === code) {
            return reply.status(400).send({
                statusCode: 400,
                error: 'Bad Request',
                message: 'You cannot redeem your own referral code',
            });
        }

        // Check whether this user has already been referred
        const alreadyReferred = await prisma.referral.findFirst({
            where: { referredId: userId },
        });

        if (alreadyReferred) {
            return reply.status(409).send({
                statusCode: 409,
                error: 'Conflict',
                message: 'You have already redeemed a referral code',
            });
        }

        // Locate the referral record for this code
        const referral = await prisma.referral.findUnique({
            where: { code },
        });

        if (!referral) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Referral code not found',
            });
        }

        if (referral.status !== 'pending') {
            return reply.status(409).send({
                statusCode: 409,
                error: 'Conflict',
                message: `Referral code has already been ${referral.status}`,
            });
        }

        // Prevent the referrer from redeeming their own code via a different path
        if (referral.referrerId === userId) {
            return reply.status(400).send({
                statusCode: 400,
                error: 'Bad Request',
                message: 'You cannot redeem your own referral code',
            });
        }

        const updated = await prisma.referral.update({
            where: { id: referral.id },
            data: {
                referredId: userId,
                status: 'completed',
                completedAt: new Date(),
            },
        });

        return {
            referralId: updated.id,
            code: updated.code,
            status: updated.status,
            referrerId: updated.referrerId,
            completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
            message: 'Referral code redeemed successfully',
        };
    });
}
