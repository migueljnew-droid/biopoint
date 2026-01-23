import { z } from 'zod';

// ============ Profile Schemas ============

export const ProfileUpdateSchema = z.object({
    sex: z.enum(['male', 'female', 'other']).optional(),
    dateOfBirth: z.string().datetime().optional(),
    heightCm: z.number().min(50).max(300).optional(),
    baselineWeightKg: z.number().min(20).max(500).optional(),
    goals: z.array(z.string()).optional(),
    dietStyle: z.string().optional(),
    currentInterventions: z.string().optional(),
});

export const ConsentUpdateSchema = z.object({
    consentNotMedical: z.boolean(),
    consentDataStorage: z.boolean(),
    consentResearch: z.boolean().optional(),
});

export const OnboardingSchema = z.object({
    sex: z.enum(['male', 'female', 'other']),
    dateOfBirth: z.string().datetime().optional(),
    heightCm: z.number().min(50).max(300).optional(),
    baselineWeightKg: z.number().min(20).max(500).optional(),
    goals: z.array(z.string()).default([]),
    dietStyle: z.string().optional(),
    currentInterventions: z.string().optional(),
    consentNotMedical: z.literal(true, {
        errorMap: () => ({ message: 'You must acknowledge this is not medical advice' }),
    }),
    consentDataStorage: z.literal(true, {
        errorMap: () => ({ message: 'You must consent to data storage for self-tracking' }),
    }),
    consentResearch: z.boolean().default(false),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
export type ConsentUpdateInput = z.infer<typeof ConsentUpdateSchema>;
export type OnboardingInput = z.infer<typeof OnboardingSchema>;

// ============ Profile Response Types ============

export interface ProfileResponse {
    id: string;
    userId: string;
    sex: string | null;
    dateOfBirth: string | null;
    heightCm: number | null;
    baselineWeightKg: number | null;
    goals: string[];
    dietStyle: string | null;
    currentInterventions: string | null;
    consentNotMedical: boolean;
    consentDataStorage: boolean;
    consentResearch: boolean;
    consentResearchAt: string | null;
    onboardingComplete: boolean;
}
