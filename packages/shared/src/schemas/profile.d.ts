import { z } from 'zod';
export declare const ProfileUpdateSchema: z.ZodObject<{
    sex: z.ZodOptional<z.ZodEnum<["male", "female", "other"]>>;
    dateOfBirth: z.ZodOptional<z.ZodString>;
    heightCm: z.ZodOptional<z.ZodNumber>;
    baselineWeightKg: z.ZodOptional<z.ZodNumber>;
    goals: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dietStyle: z.ZodOptional<z.ZodString>;
    currentInterventions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    sex?: "other" | "male" | "female" | undefined;
    dateOfBirth?: string | undefined;
    heightCm?: number | undefined;
    baselineWeightKg?: number | undefined;
    goals?: string[] | undefined;
    dietStyle?: string | undefined;
    currentInterventions?: string | undefined;
}, {
    sex?: "other" | "male" | "female" | undefined;
    dateOfBirth?: string | undefined;
    heightCm?: number | undefined;
    baselineWeightKg?: number | undefined;
    goals?: string[] | undefined;
    dietStyle?: string | undefined;
    currentInterventions?: string | undefined;
}>;
export declare const ConsentUpdateSchema: z.ZodObject<{
    consentNotMedical: z.ZodBoolean;
    consentDataStorage: z.ZodBoolean;
    consentResearch: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    consentNotMedical: boolean;
    consentDataStorage: boolean;
    consentResearch?: boolean | undefined;
}, {
    consentNotMedical: boolean;
    consentDataStorage: boolean;
    consentResearch?: boolean | undefined;
}>;
export declare const OnboardingSchema: z.ZodObject<{
    sex: z.ZodEnum<["male", "female", "other"]>;
    dateOfBirth: z.ZodOptional<z.ZodString>;
    heightCm: z.ZodOptional<z.ZodNumber>;
    baselineWeightKg: z.ZodOptional<z.ZodNumber>;
    goals: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    dietStyle: z.ZodOptional<z.ZodString>;
    currentInterventions: z.ZodOptional<z.ZodString>;
    consentNotMedical: z.ZodLiteral<true>;
    consentDataStorage: z.ZodLiteral<true>;
    consentResearch: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    sex: "other" | "male" | "female";
    goals: string[];
    consentNotMedical: true;
    consentDataStorage: true;
    consentResearch: boolean;
    dateOfBirth?: string | undefined;
    heightCm?: number | undefined;
    baselineWeightKg?: number | undefined;
    dietStyle?: string | undefined;
    currentInterventions?: string | undefined;
}, {
    sex: "other" | "male" | "female";
    consentNotMedical: true;
    consentDataStorage: true;
    dateOfBirth?: string | undefined;
    heightCm?: number | undefined;
    baselineWeightKg?: number | undefined;
    goals?: string[] | undefined;
    dietStyle?: string | undefined;
    currentInterventions?: string | undefined;
    consentResearch?: boolean | undefined;
}>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
export type ConsentUpdateInput = z.infer<typeof ConsentUpdateSchema>;
export type OnboardingInput = z.infer<typeof OnboardingSchema>;
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
//# sourceMappingURL=profile.d.ts.map