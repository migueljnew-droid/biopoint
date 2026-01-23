import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { adminMiddleware } from '../middleware/auth.js';

const MIN_COHORT_SIZE = 50;

export async function researchRoutes(app: FastifyInstance) {
    // Admin-only research aggregates
    app.get('/aggregates', { preHandler: adminMiddleware }, async (request, reply) => {
        // Count research participants
        const participantCount = await prisma.profile.count({
            where: { consentResearch: true },
        });

        if (participantCount < MIN_COHORT_SIZE) {
            return reply.status(403).send({
                statusCode: 403,
                error: 'Forbidden',
                message: `Minimum cohort size of ${MIN_COHORT_SIZE} not met. Current: ${participantCount}`,
            });
        }

        // Aggregate BioPoint scores (no identifiers)
        const bioPointAgg = await prisma.bioPointScore.aggregate({
            where: {
                user: { profile: { consentResearch: true } },
            },
            _avg: { score: true },
            _min: { score: true },
            _max: { score: true },
            _count: true,
        });

        // Aggregate daily logs (no identifiers)
        const dailyLogAgg = await prisma.dailyLog.aggregate({
            where: {
                user: { profile: { consentResearch: true } },
            },
            _avg: {
                sleepHours: true,
                sleepQuality: true,
                energyLevel: true,
                focusLevel: true,
                moodLevel: true,
            },
        });

        // Active stack items distribution (no identifiers)
        const stackItemCounts = await prisma.stackItem.groupBy({
            by: ['name'],
            where: {
                isActive: true,
                stack: { user: { profile: { consentResearch: true } } },
            },
            _count: true,
            orderBy: { _count: { name: 'desc' } },
            take: 20,
        });

        return {
            cohortSize: participantCount,
            bioPointScore: {
                average: bioPointAgg._avg.score,
                min: bioPointAgg._min.score,
                max: bioPointAgg._max.score,
                totalRecords: bioPointAgg._count,
            },
            dailyMetrics: {
                avgSleepHours: dailyLogAgg._avg.sleepHours,
                avgSleepQuality: dailyLogAgg._avg.sleepQuality,
                avgEnergyLevel: dailyLogAgg._avg.energyLevel,
                avgFocusLevel: dailyLogAgg._avg.focusLevel,
                avgMoodLevel: dailyLogAgg._avg.moodLevel,
            },
            topStackItems: stackItemCounts.map((i) => ({
                name: i.name,
                count: i._count,
            })),
        };
    });
}
