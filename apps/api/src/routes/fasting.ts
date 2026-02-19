import type { FastifyInstance } from 'fastify';
import { prisma, Prisma } from '@biopoint/db';
import { CreateCustomProtocolSchema, StartFastingSchema, EndFastingSchema } from '@biopoint/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/auditLog.js';

// Metabolic zone definitions (science-backed)
const FASTING_ZONES = [
    { name: 'Anabolic', startHour: 0, color: '#6b7280', icon: 'nutrition-outline', description: 'Body digesting last meal. Insulin high, glucose as fuel.' },
    { name: 'Catabolic', startHour: 4, color: '#8b5cf6', icon: 'trending-down-outline', description: 'Blood sugar dropping. Insulin falling. Glycogen tapped.' },
    { name: 'Fat Burning', startHour: 8, color: '#f59e0b', icon: 'flame-outline', description: 'Glycogen depleting. Body switching to fat for fuel.' },
    { name: 'Ketosis', startHour: 12, color: '#3b82f6', icon: 'flash-outline', description: 'Liver producing ketones. Brain using ketones. Mental clarity.' },
    { name: 'Deep Ketosis', startHour: 18, color: '#06b6d4', icon: 'sparkles-outline', description: 'Strong ketone levels. Autophagy beginning. Cellular cleanup starting.' },
    { name: 'Autophagy', startHour: 24, color: '#4ade80', icon: 'leaf-outline', description: 'Peak cellular recycling. Old proteins broken down. HGH surge (up to 5x).' },
    { name: 'Deep Autophagy', startHour: 48, color: '#10b981', icon: 'shield-checkmark-outline', description: 'Stem cell activation. Immune system renewal beginning.' },
    { name: 'Immune Reset', startHour: 72, color: '#f472b6', icon: 'heart-outline', description: 'Full immune system regeneration. Stem cell-based renewal.' },
];

function getZoneForElapsed(elapsedHours: number) {
    let current = FASTING_ZONES[0]!;
    for (const zone of FASTING_ZONES) {
        if (elapsedHours >= zone.startHour) {
            current = zone;
        } else {
            break;
        }
    }
    return current;
}

function getNextZone(elapsedHours: number) {
    for (const zone of FASTING_ZONES) {
        if (zone.startHour > elapsedHours) {
            return {
                name: zone.name,
                hoursUntil: Math.round((zone.startHour - elapsedHours) * 10) / 10,
                startsAtHour: zone.startHour,
            };
        }
    }
    return null;
}

function getZonesReached(startedAt: Date, endAt: Date) {
    const elapsedHours = (endAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
    const reached: Array<{ zone: string; reachedAt: string }> = [];
    for (const zone of FASTING_ZONES) {
        if (elapsedHours >= zone.startHour) {
            const reachedAt = new Date(startedAt.getTime() + zone.startHour * 60 * 60 * 1000);
            reached.push({ zone: zone.name, reachedAt: reachedAt.toISOString() });
        }
    }
    return reached;
}

export async function fastingRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    // GET /protocols - List all protocols (system + user custom)
    app.get('/protocols', async (request) => {
        const userId = request.userId;

        const protocols = await prisma.fastingProtocol.findMany({
            where: {
                OR: [{ isSystem: true }, { userId }],
            },
            orderBy: [{ isSystem: 'desc' }, { fastingHours: 'asc' }],
        });

        return protocols.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            fastingHours: p.fastingHours,
            eatingHours: p.eatingHours,
            description: p.description,
            icon: p.icon,
            isSystem: p.isSystem,
        }));
    });

    // POST /protocols - Create custom protocol
    app.post('/protocols', async (request) => {
        const userId = request.userId;
        const body = CreateCustomProtocolSchema.parse(request.body);

        const slug = `custom-${body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

        const protocol = await prisma.fastingProtocol.create({
            data: {
                userId,
                name: body.name,
                slug,
                fastingHours: body.fastingHours,
                eatingHours: body.eatingHours,
                description: body.description,
                isSystem: false,
            },
        });

        await createAuditLog(request, {
            action: 'CREATE',
            entityType: 'FastingProtocol',
            entityId: protocol.id,
            metadata: { name: protocol.name },
        });

        return {
            id: protocol.id,
            name: protocol.name,
            slug: protocol.slug,
            fastingHours: protocol.fastingHours,
            eatingHours: protocol.eatingHours,
            description: protocol.description,
            icon: protocol.icon,
            isSystem: protocol.isSystem,
        };
    });

    // GET /active - Get currently active fasting session
    app.get('/active', async (request) => {
        const userId = request.userId;

        const session = await prisma.fastingSession.findFirst({
            where: { userId, status: 'ACTIVE' },
            include: { protocol: true },
        });

        if (!session) return null;

        const now = new Date();
        const elapsedMs = now.getTime() - session.startedAt.getTime();
        const elapsedHours = elapsedMs / (1000 * 60 * 60);
        const totalMs = session.targetEndAt.getTime() - session.startedAt.getTime();
        const progress = Math.min(1, elapsedMs / totalMs);

        const currentZoneData = getZoneForElapsed(elapsedHours);
        const nextZone = getNextZone(elapsedHours);
        const zonesReached = getZonesReached(session.startedAt, now);

        return {
            id: session.id,
            protocolId: session.protocolId,
            protocolName: session.protocol.name,
            protocolSlug: session.protocol.slug,
            status: session.status,
            startedAt: session.startedAt.toISOString(),
            targetEndAt: session.targetEndAt.toISOString(),
            endedAt: null,
            durationMins: null,
            notes: session.notes,
            moodBefore: session.moodBefore,
            energyBefore: session.energyBefore,
            moodAfter: null,
            energyAfter: null,
            zonesReached,
            breakingMealId: session.breakingMealId,
            elapsedHours: Math.round(elapsedHours * 10) / 10,
            progress: Math.round(progress * 1000) / 1000,
            currentZone: {
                name: currentZoneData.name,
                color: currentZoneData.color,
                icon: currentZoneData.icon,
                description: currentZoneData.description,
            },
            nextZone,
        };
    });

    // POST /start - Start a fasting session
    app.post('/start', async (request, reply) => {
        const userId = request.userId;
        const body = StartFastingSchema.parse(request.body);

        // Check for active session
        const activeSession = await prisma.fastingSession.findFirst({
            where: { userId, status: 'ACTIVE' },
        });

        if (activeSession) {
            return reply.status(400).send({
                statusCode: 400,
                error: 'Bad Request',
                message: 'You already have an active fasting session. End or cancel it first.',
            });
        }

        // Find protocol
        const protocol = await prisma.fastingProtocol.findUnique({
            where: { slug: body.protocolSlug },
        });

        if (!protocol) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Fasting protocol not found.',
            });
        }

        const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
        const targetEndAt = new Date(startedAt.getTime() + protocol.fastingHours * 60 * 60 * 1000);

        const session = await prisma.fastingSession.create({
            data: {
                userId,
                protocolId: protocol.id,
                startedAt,
                targetEndAt,
                notes: body.notes,
                moodBefore: body.moodBefore,
                energyBefore: body.energyBefore,
            },
            include: { protocol: true },
        });

        await createAuditLog(request, {
            action: 'CREATE',
            entityType: 'FastingSession',
            entityId: session.id,
            metadata: { protocol: protocol.name },
        });

        return {
            id: session.id,
            protocolId: session.protocolId,
            protocolName: session.protocol.name,
            protocolSlug: session.protocol.slug,
            status: session.status,
            startedAt: session.startedAt.toISOString(),
            targetEndAt: session.targetEndAt.toISOString(),
            endedAt: null,
            durationMins: null,
            notes: session.notes,
            moodBefore: session.moodBefore,
            energyBefore: session.energyBefore,
            moodAfter: null,
            energyAfter: null,
            zonesReached: [],
            breakingMealId: null,
            elapsedHours: 0,
            progress: 0,
            currentZone: { name: 'Anabolic', color: '#6b7280', icon: 'nutrition-outline', description: 'Body digesting last meal. Insulin high, glucose as fuel.' },
            nextZone: { name: 'Catabolic', hoursUntil: 4, startsAtHour: 4 },
        };
    });

    // POST /:id/end - Complete a fast
    app.post('/:id/end', async (request, reply) => {
        const userId = request.userId;
        const { id } = request.params as { id: string };
        const body = EndFastingSchema.parse(request.body);

        const session = await prisma.fastingSession.findFirst({
            where: { id, userId, status: 'ACTIVE' },
            include: { protocol: true },
        });

        if (!session) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Active fasting session not found.',
            });
        }

        const endedAt = new Date();
        const durationMins = Math.round((endedAt.getTime() - session.startedAt.getTime()) / (1000 * 60));
        const zonesReached = getZonesReached(session.startedAt, endedAt);

        const updated = await prisma.fastingSession.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                endedAt,
                durationMins,
                notes: body.notes ?? session.notes,
                moodAfter: body.moodAfter,
                energyAfter: body.energyAfter,
                zonesReached,
                breakingMealId: body.breakingMealId,
            },
            include: { protocol: true },
        });

        await createAuditLog(request, {
            action: 'UPDATE',
            entityType: 'FastingSession',
            entityId: id,
            metadata: { action: 'completed', durationMins },
        });

        return {
            id: updated.id,
            protocolId: updated.protocolId,
            protocolName: updated.protocol.name,
            protocolSlug: updated.protocol.slug,
            status: updated.status,
            startedAt: updated.startedAt.toISOString(),
            targetEndAt: updated.targetEndAt.toISOString(),
            endedAt: updated.endedAt?.toISOString() ?? null,
            durationMins: updated.durationMins,
            notes: updated.notes,
            moodBefore: updated.moodBefore,
            energyBefore: updated.energyBefore,
            moodAfter: updated.moodAfter,
            energyAfter: updated.energyAfter,
            zonesReached: (updated.zonesReached as Prisma.JsonArray) ?? [],
            breakingMealId: updated.breakingMealId,
        };
    });

    // POST /:id/cancel - Cancel a fast
    app.post('/:id/cancel', async (request, reply) => {
        const userId = request.userId;
        const { id } = request.params as { id: string };

        const session = await prisma.fastingSession.findFirst({
            where: { id, userId, status: 'ACTIVE' },
        });

        if (!session) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Active fasting session not found.',
            });
        }

        const endedAt = new Date();
        const durationMins = Math.round((endedAt.getTime() - session.startedAt.getTime()) / (1000 * 60));
        const zonesReached = getZonesReached(session.startedAt, endedAt);

        await prisma.fastingSession.update({
            where: { id },
            data: { status: 'CANCELLED', endedAt, durationMins, zonesReached },
        });

        await createAuditLog(request, {
            action: 'UPDATE',
            entityType: 'FastingSession',
            entityId: id,
            metadata: { action: 'cancelled', durationMins },
        });

        return { success: true };
    });

    // GET /history - Paginated completed sessions
    app.get('/history', async (request) => {
        const userId = request.userId;
        const query = request.query as { page?: string; limit?: string };
        const page = parseInt(query.page || '1');
        const limit = parseInt(query.limit || '20');
        const skip = (page - 1) * limit;

        const [sessions, total] = await Promise.all([
            prisma.fastingSession.findMany({
                where: { userId, status: { not: 'ACTIVE' } },
                include: { protocol: true },
                orderBy: { startedAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.fastingSession.count({
                where: { userId, status: { not: 'ACTIVE' } },
            }),
        ]);

        return {
            data: sessions.map((s) => ({
                id: s.id,
                protocolId: s.protocolId,
                protocolName: s.protocol.name,
                protocolSlug: s.protocol.slug,
                status: s.status,
                startedAt: s.startedAt.toISOString(),
                targetEndAt: s.targetEndAt.toISOString(),
                endedAt: s.endedAt?.toISOString() ?? null,
                durationMins: s.durationMins,
                notes: s.notes,
                moodBefore: s.moodBefore,
                energyBefore: s.energyBefore,
                moodAfter: s.moodAfter,
                energyAfter: s.energyAfter,
                zonesReached: (s.zonesReached as Prisma.JsonArray) ?? [],
                breakingMealId: s.breakingMealId,
            })),
            total,
            page,
            limit,
            hasMore: skip + sessions.length < total,
        };
    });

    // GET /stats - Fasting statistics
    app.get('/stats', async (request) => {
        const userId = request.userId;

        const allSessions = await prisma.fastingSession.findMany({
            where: { userId, status: { not: 'ACTIVE' } },
            orderBy: { startedAt: 'desc' },
            select: { status: true, durationMins: true, startedAt: true },
        });

        const completed = allSessions.filter((s) => s.status === 'COMPLETED');
        const cancelled = allSessions.filter((s) => s.status === 'CANCELLED');
        const totalHours = completed.reduce((sum, s) => sum + (s.durationMins || 0), 0) / 60;

        // Calculate streak (consecutive days with a completed fast)
        let currentStreak = 0;
        let bestStreak = 0;
        if (completed.length > 0) {
            const fastDates = new Set(completed.map((s) => s.startedAt.toISOString().split('T')[0]));
            const today = new Date();
            let checkDate = new Date(today);
            checkDate.setHours(0, 0, 0, 0);

            // Count backwards from today
            let streak = 0;
            for (let i = 0; i < 365; i++) {
                const dateStr = checkDate.toISOString().split('T')[0]!;
                if (fastDates.has(dateStr)) {
                    streak++;
                } else if (i > 0) {
                    break; // Streak broken
                }
                checkDate.setDate(checkDate.getDate() - 1);
            }
            currentStreak = streak;

            // Best streak calculation
            const sortedDates = [...fastDates].sort();
            let tempStreak = 1;
            bestStreak = 1;
            for (let i = 1; i < sortedDates.length; i++) {
                const prev = new Date(sortedDates[i - 1]!);
                const curr = new Date(sortedDates[i]!);
                const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
                if (diffDays === 1) {
                    tempStreak++;
                    bestStreak = Math.max(bestStreak, tempStreak);
                } else {
                    tempStreak = 1;
                }
            }
        }

        return {
            totalFasts: allSessions.length,
            completedFasts: completed.length,
            cancelledFasts: cancelled.length,
            totalHoursFasted: Math.round(totalHours * 10) / 10,
            averageDurationHours: completed.length > 0 ? Math.round((totalHours / completed.length) * 10) / 10 : 0,
            longestFastHours: completed.length > 0 ? Math.round((Math.max(...completed.map((s) => s.durationMins || 0)) / 60) * 10) / 10 : 0,
            currentStreak,
            bestStreak,
            completionRate: allSessions.length > 0 ? Math.round((completed.length / allSessions.length) * 100) / 100 : 0,
        };
    });

    // GET /:id - Single session detail
    app.get('/:id', async (request, reply) => {
        const userId = request.userId;
        const { id } = request.params as { id: string };

        const session = await prisma.fastingSession.findFirst({
            where: { id, userId },
            include: { protocol: true },
        });

        if (!session) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Fasting session not found.',
            });
        }

        return {
            id: session.id,
            protocolId: session.protocolId,
            protocolName: session.protocol.name,
            protocolSlug: session.protocol.slug,
            status: session.status,
            startedAt: session.startedAt.toISOString(),
            targetEndAt: session.targetEndAt.toISOString(),
            endedAt: session.endedAt?.toISOString() ?? null,
            durationMins: session.durationMins,
            notes: session.notes,
            moodBefore: session.moodBefore,
            energyBefore: session.energyBefore,
            moodAfter: session.moodAfter,
            energyAfter: session.energyAfter,
            zonesReached: (session.zonesReached as Prisma.JsonArray) ?? [],
            breakingMealId: session.breakingMealId,
        };
    });
}
