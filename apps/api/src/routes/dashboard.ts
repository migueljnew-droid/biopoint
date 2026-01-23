import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { authMiddleware } from '../middleware/auth.js';

export async function dashboardRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    // Get dashboard data
    app.get('/', async (request) => {
        const userId = (request as any).userId;
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
        };
    });

    // Calculate and store BioPoint score
    app.post('/calculate', async (request) => {
        const userId = (request as any).userId;
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

        // Calculate Compliance Score (0-20)
        // If no active items, full points (or 0? Let's give full points for maintenance if nothing to take, or maybe neutral 10? Let's go with 20 for perfect adherence to "nothing")
        // But if they have items, it's ratio * 20.
        let complianceScore = 0;
        if (activeItemCount === 0) {
            complianceScore = 20;
        } else {
            // Cap at 100% (in case of double logging bugs or extra credit)
            const ratio = Math.min(1, complianceCount / activeItemCount);
            complianceScore = Math.round(ratio * 20);
        }

        // Calculate score (max 20 points each category)
        const breakdown = {
            sleep: calculateSleepScore(log?.sleepHours ?? null, log?.sleepQuality ?? null),
            energy: (log?.energyLevel ?? 5) * 2,
            focus: (log?.focusLevel ?? 5) * 2,
            mood: (log?.moodLevel ?? 5) * 2,
            compliance: complianceScore,
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
    if (!hours && !quality) return 10; // Neutral

    let score = 0;

    // Hours score (0-10)
    if (hours) {
        if (hours >= 7 && hours <= 9) {
            score += 10;
        } else if (hours >= 6 || hours <= 10) {
            score += 7;
        } else {
            score += 4;
        }
    } else {
        score += 5;
    }

    // Quality score (0-10)
    if (quality) {
        score += quality;
    } else {
        score += 5;
    }

    return Math.min(20, score);
}
