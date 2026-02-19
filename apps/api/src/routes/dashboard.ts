import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { authMiddleware } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/auditLog.js';

export async function dashboardRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    // Get dashboard data
    app.get('/', async (request) => {
        const userId = request.userId;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get today's BioPoint score
        const bioPointScore = await prisma.bioPointScore.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today,
                },
            },
        });

        // Get today's log
        const todayLog = await prisma.dailyLog.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today,
                },
            },
        });

        // Get recent logs (last 7 days)
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const recentLogs = await prisma.dailyLog.findMany({
            where: {
                userId,
                date: {
                    gte: weekAgo,
                },
            },
            orderBy: { date: 'desc' },
            take: 7,
        });

        // Calculate weekly trend
        let weeklyTrend: number | null = null;
        const scoreHistoryData = await prisma.bioPointScore.findMany({
            where: {
                userId,
                date: {
                    gte: weekAgo,
                },
            },
            orderBy: { date: 'asc' },
        });

        if (scoreHistoryData.length >= 2) {
            const first = scoreHistoryData[0]!.score;
            const last = scoreHistoryData[scoreHistoryData.length - 1]!.score;
            weeklyTrend = last - first;
        }

        // Get active stacks count
        const activeStacks = await prisma.stack.count({
            where: { userId, isActive: true },
        });

        // Get recent compliance rate
        const complianceEvents = await prisma.complianceEvent.count({
            where: {
                userId,
                takenAt: {
                    gte: weekAgo,
                },
            },
        });

        // Get active fasting session
        const activeFasting = await prisma.fastingSession.findFirst({
            where: { userId, status: 'ACTIVE' },
            include: { protocol: { select: { name: true } } },
        });

        // Get today's nutrition summary
        const todayFoodLog = await prisma.foodLog.findUnique({
            where: { userId_date: { userId, date: today } },
        });

        // Audit log for dashboard access (contains PHI data)
        await createAuditLog(request, {
            action: 'READ',
            entityType: 'BioPointScore',
            entityId: 'dashboard',
            metadata: {
                hasBioPointScore: !!bioPointScore,
                hasTodayLog: !!todayLog,
                recentLogsCount: recentLogs.length,
                scoreHistoryCount: scoreHistoryData.length,
                activeStacks,
                weeklyComplianceEvents: complianceEvents,
            },
        });

        return {
            bioPointScore: bioPointScore
                ? {
                    score: bioPointScore.score,
                    breakdown: bioPointScore.breakdown as Record<string, number>,
                    date: bioPointScore.date.toISOString(),
                }
                : null,
            todayLog: todayLog
                ? {
                    id: todayLog.id,
                    date: todayLog.date.toISOString(),
                    weightKg: todayLog.weightKg,
                    sleepHours: todayLog.sleepHours,
                    sleepQuality: todayLog.sleepQuality,
                    energyLevel: todayLog.energyLevel,
                    focusLevel: todayLog.focusLevel,
                    moodLevel: todayLog.moodLevel,
                    notes: todayLog.notes,
                }
                : null,
            recentLogs: recentLogs.map((log) => ({
                id: log.id,
                date: log.date.toISOString(),
                weightKg: log.weightKg,
                sleepHours: log.sleepHours,
                sleepQuality: log.sleepQuality,
                energyLevel: log.energyLevel,
                focusLevel: log.focusLevel,
                moodLevel: log.moodLevel,
                notes: log.notes,
            })),
            weeklyTrend,
            scoreHistory: scoreHistoryData.map(s => ({ date: s.date.toISOString(), score: s.score })),
            activeStacks,
            weeklyComplianceEvents: complianceEvents,
            activeFasting: activeFasting
                ? {
                    id: activeFasting.id,
                    protocolName: activeFasting.protocol.name,
                    startedAt: activeFasting.startedAt.toISOString(),
                    targetEndAt: activeFasting.targetEndAt.toISOString(),
                }
                : null,
            todayNutrition: todayFoodLog
                ? {
                    totalCalories: todayFoodLog.totalCalories,
                    mealCount: todayFoodLog.mealCount,
                }
                : null,
        };
    });

    // Calculate and store BioPoint score
    app.post('/calculate', async (request) => {
        const userId = request.userId;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get today's log
        const log = await prisma.dailyLog.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today,
                },
            },
        });

        // Get active stack items count
        const activeItemCount = await prisma.stackItem.count({
            where: {
                stack: {
                    userId,
                    isActive: true,
                },
                isActive: true,
            },
        });

        // Get today's compliance events count
        const complianceCount = await prisma.complianceEvent.count({
            where: {
                userId,
                takenAt: {
                    gte: today,
                    lt: tomorrow,
                },
            },
        });

        // Calculate Compliance Score (0-16)
        let complianceScore = 0;
        if (activeItemCount === 0) {
            complianceScore = 16;
        } else {
            const ratio = Math.min(1, complianceCount / activeItemCount);
            complianceScore = Math.round(ratio * 16);
        }

        // Fasting Score (0-9): 0 if no fast, 5 if active, 9 if completed today
        let fastingScore = 0;
        const completedFastToday = await prisma.fastingSession.findFirst({
            where: {
                userId,
                status: 'COMPLETED',
                endedAt: { gte: today, lt: tomorrow },
            },
        });
        const activeFastSession = await prisma.fastingSession.findFirst({
            where: { userId, status: 'ACTIVE' },
        });
        if (completedFastToday) {
            fastingScore = 9;
        } else if (activeFastSession) {
            fastingScore = 5;
        }

        // Nutrition Score (0-9): scaled by meals logged today
        let nutritionScore = 0;
        const todayFoodLog = await prisma.foodLog.findUnique({
            where: { userId_date: { userId, date: today } },
        });
        if (todayFoodLog) {
            if (todayFoodLog.mealCount >= 3) nutritionScore = 9;
            else if (todayFoodLog.mealCount === 2) nutritionScore = 6;
            else if (todayFoodLog.mealCount === 1) nutritionScore = 3;
        }

        // Calculate score: sleep(18) + energy(16) + focus(16) + mood(16) + compliance(16) + fasting(9) + nutrition(9) = 100
        const breakdown = {
            sleep: calculateSleepScore(log?.sleepHours ?? null, log?.sleepQuality ?? null),
            energy: Math.round((log?.energyLevel ?? 5) * 1.6),
            focus: Math.round((log?.focusLevel ?? 5) * 1.6),
            mood: Math.round((log?.moodLevel ?? 5) * 1.6),
            compliance: complianceScore,
            fasting: fastingScore,
            nutrition: nutritionScore,
        };

        const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));

        const bioPointScore = await prisma.bioPointScore.upsert({
            where: {
                userId_date: {
                    userId,
                    date: today,
                },
            },
            update: {
                score,
                breakdown,
            },
            create: {
                userId,
                date: today,
                score,
                breakdown,
            },
        });

        return {
            score: bioPointScore.score,
            breakdown: bioPointScore.breakdown,
            date: bioPointScore.date.toISOString(),
        };
    });
}

function calculateSleepScore(hours: number | null, quality: number | null): number {
    if (!hours && !quality) return 9; // Neutral

    let score = 0;

    // Hours score (0-9)
    if (hours) {
        if (hours >= 7 && hours <= 9) {
            score += 9;
        } else if (hours >= 6 || hours <= 10) {
            score += 6;
        } else {
            score += 3;
        }
    } else {
        score += 4;
    }

    // Quality score (0-9)
    if (quality) {
        score += Math.round(quality * 0.9);
    } else {
        score += 4;
    }

    return Math.min(18, score);
}
