import { prisma } from '@biopoint/db';

/**
 * Recalculates the BioPoint score for a user for today.
 * Called automatically after: daily log save, compliance event, fasting event, nutrition log.
 */
export async function recalculateBioPointScore(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [log, activeItemCount, complianceCount, completedFastToday, activeFastSession, todayFoodLog] = await Promise.all([
        prisma.dailyLog.findUnique({
            where: { userId_date: { userId, date: today } },
        }),
        prisma.stackItem.count({
            where: { stack: { userId, isActive: true }, isActive: true },
        }),
        prisma.complianceEvent.count({
            where: { userId, takenAt: { gte: today, lt: tomorrow } },
        }),
        prisma.fastingSession.findFirst({
            where: { userId, status: 'COMPLETED', endedAt: { gte: today, lt: tomorrow } },
        }),
        prisma.fastingSession.findFirst({
            where: { userId, status: 'ACTIVE' },
        }),
        prisma.foodLog.findUnique({
            where: { userId_date: { userId, date: today } },
        }),
    ]);

    // Compliance Score (0-16)
    let complianceScore = 0;
    if (activeItemCount === 0) {
        complianceScore = 16;
    } else {
        const ratio = Math.min(1, complianceCount / activeItemCount);
        complianceScore = Math.round(ratio * 16);
    }

    // Fasting Score (0-9)
    let fastingScore = 0;
    if (completedFastToday) {
        fastingScore = 9;
    } else if (activeFastSession) {
        fastingScore = 5;
    }

    // Nutrition Score (0-9)
    let nutritionScore = 0;
    if (todayFoodLog) {
        if (todayFoodLog.mealCount >= 3) nutritionScore = 9;
        else if (todayFoodLog.mealCount === 2) nutritionScore = 6;
        else if (todayFoodLog.mealCount === 1) nutritionScore = 3;
    }

    // sleep(18) + energy(16) + focus(16) + mood(16) + compliance(16) + fasting(9) + nutrition(9) = 100
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
        where: { userId_date: { userId, date: today } },
        update: { score, breakdown },
        create: { userId, date: today, score, breakdown },
    });

    return {
        score: bioPointScore.score,
        breakdown: bioPointScore.breakdown,
        date: bioPointScore.date.toISOString(),
    };
}

function calculateSleepScore(hours: number | null, quality: number | null): number {
    if (!hours && !quality) return 0;
    let score = 0;
    if (hours) {
        if (hours >= 7 && hours <= 9) score += 12;
        else if (hours >= 6) score += 8;
        else if (hours >= 5) score += 4;
        else score += 2;
    }
    if (quality) {
        score += Math.round((quality / 10) * 6);
    }
    return Math.min(18, score);
}
