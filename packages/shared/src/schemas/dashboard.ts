import { z } from 'zod';

// ============ Daily Log Schemas ============

export const DailyLogSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
    weightKg: z.number().min(20).max(500).optional(),
    sleepHours: z.number().min(0).max(24).optional(),
    sleepQuality: z.number().int().min(1).max(10).optional(),
    energyLevel: z.number().int().min(1).max(10).optional(),
    focusLevel: z.number().int().min(1).max(10).optional(),
    moodLevel: z.number().int().min(1).max(10).optional(),
    notes: z.string().max(2000).optional(),
});

export type DailyLogInput = z.infer<typeof DailyLogSchema>;

// ============ Dashboard Response Types ============

export interface DailyLogResponse {
    id: string;
    date: string;
    weightKg: number | null;
    sleepHours: number | null;
    sleepQuality: number | null;
    energyLevel: number | null;
    focusLevel: number | null;
    moodLevel: number | null;
    notes: string | null;
}

export interface BioPointBreakdown {
    sleep: number;
    energy: number;
    focus: number;
    mood: number;
    weight: number;
}

export interface BioPointScoreResponse {
    score: number;
    breakdown: BioPointBreakdown;
    date: string;
}

export interface DashboardResponse {
    bioPointScore: BioPointScoreResponse | null;
    todayLog: DailyLogResponse | null;
    recentLogs: DailyLogResponse[];
    weeklyTrend: number | null;
}
