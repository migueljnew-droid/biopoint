import { z } from 'zod';

// ============ Fasting Schemas ============

export const CreateCustomProtocolSchema = z.object({
    name: z.string().min(1).max(100),
    fastingHours: z.number().min(1).max(168),
    eatingHours: z.number().min(0).max(24),
    description: z.string().max(500).optional(),
});

export type CreateCustomProtocolInput = z.infer<typeof CreateCustomProtocolSchema>;

export const StartFastingSchema = z.object({
    protocolSlug: z.string().min(1),
    startedAt: z.string().datetime().optional(),
    notes: z.string().max(500).optional(),
    moodBefore: z.number().int().min(1).max(10).optional(),
    energyBefore: z.number().int().min(1).max(10).optional(),
});

export type StartFastingInput = z.infer<typeof StartFastingSchema>;

export const EndFastingSchema = z.object({
    notes: z.string().max(500).optional(),
    moodAfter: z.number().int().min(1).max(10).optional(),
    energyAfter: z.number().int().min(1).max(10).optional(),
    breakingMealId: z.string().optional(),
});

export type EndFastingInput = z.infer<typeof EndFastingSchema>;

// ============ Meal Schemas ============

export const CreateMealEntrySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
    mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
    name: z.string().min(1).max(200),
    calories: z.number().int().min(0).max(10000),
    proteinG: z.number().min(0).max(1000).optional(),
    carbsG: z.number().min(0).max(1000).optional(),
    fatG: z.number().min(0).max(1000).optional(),
    fiberG: z.number().min(0).max(1000).optional(),
    servingSize: z.string().max(100).optional(),
});

export type CreateMealEntryInput = z.infer<typeof CreateMealEntrySchema>;

export const UpdateMealEntrySchema = z.object({
    mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']).optional(),
    name: z.string().min(1).max(200).optional(),
    calories: z.number().int().min(0).max(10000).optional(),
    proteinG: z.number().min(0).max(1000).optional(),
    carbsG: z.number().min(0).max(1000).optional(),
    fatG: z.number().min(0).max(1000).optional(),
    fiberG: z.number().min(0).max(1000).optional(),
    servingSize: z.string().max(100).optional(),
});

export type UpdateMealEntryInput = z.infer<typeof UpdateMealEntrySchema>;

export const AnalyzeFoodPhotoSchema = z.object({
    imageBase64: z.string().min(1),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
});

export type AnalyzeFoodPhotoInput = z.infer<typeof AnalyzeFoodPhotoSchema>;

// ============ Response Types ============

export interface FastingProtocolResponse {
    id: string;
    name: string;
    slug: string;
    fastingHours: number;
    eatingHours: number;
    description: string | null;
    icon: string | null;
    isSystem: boolean;
}

export interface FastingZone {
    name: string;
    color: string;
    icon: string;
    description: string;
    startedAt?: string;
}

export interface FastingSessionResponse {
    id: string;
    protocolId: string;
    protocolName: string;
    protocolSlug: string;
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    startedAt: string;
    targetEndAt: string;
    endedAt: string | null;
    durationMins: number | null;
    notes: string | null;
    moodBefore: number | null;
    energyBefore: number | null;
    moodAfter: number | null;
    energyAfter: number | null;
    zonesReached: Array<{ zone: string; reachedAt: string }>;
    breakingMealId: string | null;
    // Computed fields for active sessions
    elapsedHours?: number;
    progress?: number;
    currentZone?: FastingZone | null;
    nextZone?: { name: string; hoursUntil: number; startsAtHour: number } | null;
}

export interface FastingStatsResponse {
    totalFasts: number;
    completedFasts: number;
    cancelledFasts: number;
    totalHoursFasted: number;
    averageDurationHours: number;
    longestFastHours: number;
    currentStreak: number;
    bestStreak: number;
    completionRate: number;
}

export interface MealEntryResponse {
    id: string;
    mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
    name: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    servingSize: string | null;
    photoUrl: string | null;
    aiAnalyzed: boolean;
    aiConfidence: number | null;
    createdAt: string;
}

export interface DailyNutritionSummaryResponse {
    date: string;
    totalCalories: number;
    totalProteinG: number;
    totalCarbsG: number;
    totalFatG: number;
    totalFiberG: number;
    mealCount: number;
    meals: MealEntryResponse[];
    targets: {
        calories: number | null;
        proteinG: number | null;
        carbsG: number | null;
        fatG: number | null;
    };
}

export interface FoodAnalysisItem {
    name: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    servingSize: string;
}

export interface FoodAnalysisResult {
    name: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    items: FoodAnalysisItem[];
    confidence: number;
}
