"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingSchema = exports.ConsentUpdateSchema = exports.ProfileUpdateSchema = void 0;
const zod_1 = require("zod");
// ============ Profile Schemas ============
exports.ProfileUpdateSchema = zod_1.z.object({
    sex: zod_1.z.enum(['male', 'female', 'other']).optional(),
    dateOfBirth: zod_1.z.string().datetime().optional(),
    heightCm: zod_1.z.number().min(50).max(300).optional(),
    baselineWeightKg: zod_1.z.number().min(20).max(500).optional(),
    goals: zod_1.z.array(zod_1.z.string()).optional(),
    dietStyle: zod_1.z.string().optional(),
    currentInterventions: zod_1.z.string().optional(),
});
exports.ConsentUpdateSchema = zod_1.z.object({
    consentNotMedical: zod_1.z.boolean(),
    consentDataStorage: zod_1.z.boolean(),
    consentResearch: zod_1.z.boolean().optional(),
});
exports.OnboardingSchema = zod_1.z.object({
    sex: zod_1.z.enum(['male', 'female', 'other']),
    dateOfBirth: zod_1.z.string().datetime().optional(),
    heightCm: zod_1.z.number().min(50).max(300).optional(),
    baselineWeightKg: zod_1.z.number().min(20).max(500).optional(),
    goals: zod_1.z.array(zod_1.z.string()).default([]),
    dietStyle: zod_1.z.string().optional(),
    currentInterventions: zod_1.z.string().optional(),
    consentNotMedical: zod_1.z.literal(true, {
        errorMap: () => ({ message: 'You must acknowledge this is not medical advice' }),
    }),
    consentDataStorage: zod_1.z.literal(true, {
        errorMap: () => ({ message: 'You must consent to data storage for self-tracking' }),
    }),
    consentResearch: zod_1.z.boolean().default(false),
});
//# sourceMappingURL=profile.js.map