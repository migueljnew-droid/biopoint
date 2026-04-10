import { prisma } from '@biopoint/db';
import type { BadgeId } from '@biopoint/shared';

function computeStreak(dates: Date[]): number {
    if (dates.length === 0) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateSet = new Set(dates.map(d => {
        const copy = new Date(d);
        copy.setHours(0, 0, 0, 0);
        return copy.getTime();
    }));

    // Start from today if logged, otherwise from yesterday (streak still alive)
    let checkDate = new Date(today);
    if (!dateSet.has(checkDate.getTime())) {
        checkDate.setDate(checkDate.getDate() - 1);
        if (!dateSet.has(checkDate.getTime())) return 0;
    }

    let streak = 0;
    while (dateSet.has(checkDate.getTime())) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
    }

    return streak;
}

export async function computeUserStats(userId: string) {
    const [labCount, templateCount, recentScore, logs, complianceCount, stackCount] = await Promise.all([
        prisma.labReport.count({ where: { userId } }),
        prisma.stackTemplate.count({ where: { createdById: userId } }),
        prisma.bioPointScore.findFirst({ where: { userId }, orderBy: { date: 'desc' }, select: { score: true } }),
        prisma.dailyLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 90, select: { date: true } }),
        prisma.complianceEvent.count({ where: { userId, takenAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
        prisma.stack.count({ where: { userId, isActive: true } }),
    ]);

    const currentStreak = computeStreak(logs.map(l => l.date));

    const badges: BadgeId[] = [];
    if (labCount >= 3) badges.push('lab_verified');
    if (complianceCount >= 30) badges.push('thirty_day_stack');
    if (currentStreak >= 30) badges.push('data_driven');
    if (templateCount > 0) badges.push('protocol_publisher');
    if (recentScore && recentScore.score >= 80) badges.push('bio_optimized');

    // Preserve longest streak from existing record
    const existingStats = await prisma.userStats.findUnique({ where: { userId }, select: { longestStreak: true } });
    const longestStreak = Math.max(currentStreak, existingStats?.longestStreak ?? 0);

    const stats = {
        currentStreak,
        longestStreak,
        totalDaysLogged: logs.length,
        totalStacksActive: stackCount,
        totalLabsUploaded: labCount,
        badgesJson: JSON.stringify(badges),
        computedAt: new Date(),
    };

    // Cache in UserStats
    await prisma.userStats.upsert({
        where: { userId },
        update: stats,
        create: { userId, ...stats },
    });

    return { badges, ...stats };
}

export async function getUserStatsOrCompute(userId: string) {
    const cached = await prisma.userStats.findUnique({ where: { userId } });

    // Recompute if stale (> 1 hour)
    if (!cached || (Date.now() - cached.computedAt.getTime()) > 3600000) {
        return computeUserStats(userId);
    }

    return {
        ...cached,
        badges: JSON.parse(cached.badgesJson as string) as BadgeId[],
    };
}
