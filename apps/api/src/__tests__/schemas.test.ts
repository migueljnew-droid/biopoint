import { describe, it, expect } from 'vitest';
import {
    RegisterSchema,
    LoginSchema,
    ProfileUpdateSchema,
    OnboardingSchema,
    DailyLogSchema,
    CreateStackSchema,
    CreateStackItemSchema,
    CreateLabReportSchema,
    CreateLabMarkerSchema,
} from '@biopoint/shared';

describe('Zod Schemas', () => {
    describe('RegisterSchema', () => {
        it('should accept valid registration', () => {
            const result = RegisterSchema.safeParse({
                email: 'test@example.com',
                password: 'ValidPass1',
            });
            expect(result.success).toBe(true);
        });

        it('should reject invalid email', () => {
            const result = RegisterSchema.safeParse({
                email: 'invalid-email',
                password: 'ValidPass1',
            });
            expect(result.success).toBe(false);
        });

        it('should reject weak password', () => {
            const result = RegisterSchema.safeParse({
                email: 'test@example.com',
                password: 'weak',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('DailyLogSchema', () => {
        it('should accept valid log', () => {
            const result = DailyLogSchema.safeParse({
                date: '2024-01-15',
                sleepHours: 7.5,
                sleepQuality: 8,
                energyLevel: 7,
                focusLevel: 8,
                moodLevel: 9,
                weightKg: 75.5,
            });
            expect(result.success).toBe(true);
        });

        it('should reject invalid date format', () => {
            const result = DailyLogSchema.safeParse({
                date: 'January 15, 2024',
            });
            expect(result.success).toBe(false);
        });

        it('should reject out-of-range values', () => {
            const result = DailyLogSchema.safeParse({
                date: '2024-01-15',
                sleepQuality: 15, // max is 10
            });
            expect(result.success).toBe(false);
        });
    });

    describe('CreateStackItemSchema', () => {
        it('should accept valid stack item', () => {
            const result = CreateStackItemSchema.safeParse({
                name: 'Vitamin D3',
                dose: 5000,
                unit: 'IU',
                frequency: 'Daily',
                route: 'Oral',
                timing: 'Morning',
            });
            expect(result.success).toBe(true);
        });

        it('should accept valid route enum', () => {
            const routes = ['SubQ', 'IM', 'IV', 'Oral', 'Sublingual', 'Transdermal', 'Nasal', 'Other'];
            for (const route of routes) {
                const result = CreateStackItemSchema.safeParse({
                    name: 'Test',
                    dose: 100,
                    unit: 'mg',
                    frequency: 'Daily',
                    route,
                });
                expect(result.success).toBe(true);
            }
        });
    });

    describe('OnboardingSchema', () => {
        it('should require consent flags', () => {
            const result = OnboardingSchema.safeParse({
                sex: 'male',
                consentNotMedical: false, // must be true
                consentDataStorage: true,
            });
            expect(result.success).toBe(false);
        });

        it('should accept valid onboarding', () => {
            const result = OnboardingSchema.safeParse({
                sex: 'female',
                heightCm: 165,
                baselineWeightKg: 60,
                goals: ['optimize_health'],
                consentNotMedical: true,
                consentDataStorage: true,
                consentResearch: false,
            });
            expect(result.success).toBe(true);
        });
    });
});
