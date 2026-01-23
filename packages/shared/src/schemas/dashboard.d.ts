import { z } from 'zod';
export declare const DailyLogSchema: z.ZodObject<{
    date: z.ZodString;
    weightKg: z.ZodOptional<z.ZodNumber>;
    sleepHours: z.ZodOptional<z.ZodNumber>;
    sleepQuality: z.ZodOptional<z.ZodNumber>;
    energyLevel: z.ZodOptional<z.ZodNumber>;
    focusLevel: z.ZodOptional<z.ZodNumber>;
    moodLevel: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date: string;
    weightKg?: number | undefined;
    sleepHours?: number | undefined;
    sleepQuality?: number | undefined;
    energyLevel?: number | undefined;
    focusLevel?: number | undefined;
    moodLevel?: number | undefined;
    notes?: string | undefined;
}, {
    date: string;
    weightKg?: number | undefined;
    sleepHours?: number | undefined;
    sleepQuality?: number | undefined;
    energyLevel?: number | undefined;
    focusLevel?: number | undefined;
    moodLevel?: number | undefined;
    notes?: string | undefined;
}>;
export type DailyLogInput = z.infer<typeof DailyLogSchema>;
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
//# sourceMappingURL=dashboard.d.ts.map