import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { ProfileUpdateSchema, ConsentUpdateSchema, OnboardingSchema } from '@biopoint/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/auditLog.js';
import { sanitizationMiddleware } from '../middleware/sanitization.js';

export async function profileRoutes(app: FastifyInstance) {
    // Apply auth to all routes
    app.addHook('preHandler', authMiddleware);
    // Apply input sanitization to profile updates
    app.addHook('preHandler', sanitizationMiddleware);

    // Get profile
    app.get('/', async (request) => {
        const userId = request.userId;

        const profile = await prisma.profile.findUnique({
            where: { userId },
        });

        // Audit log for profile access (even if no profile exists)
        if (profile) {
            await createAuditLog(request, {
                action: 'READ',
                entityType: 'Profile',
                entityId: profile.id,
            });
        }

        if (!profile) {
            return {
                id: null,
                userId,
                sex: null,
                dateOfBirth: null,
                heightCm: null,
                baselineWeightKg: null,
                goals: [],
                dietStyle: null,
                currentInterventions: null,
                consentNotMedical: false,
                consentDataStorage: false,
                consentResearch: false,
                consentResearchAt: null,
                onboardingComplete: false,
            };
        }

        return {
            id: profile.id,
            userId: profile.userId,
            sex: profile.sex,
            dateOfBirth: profile.dateOfBirth?.toISOString() ?? null,
            heightCm: profile.heightCm,
            baselineWeightKg: profile.baselineWeightKg,
            goals: profile.goals,
            dietStyle: profile.dietStyle,
            currentInterventions: profile.currentInterventions,
            consentNotMedical: profile.consentNotMedical,
            consentDataStorage: profile.consentDataStorage,
            consentResearch: profile.consentResearch,
            consentResearchAt: profile.consentResearchAt?.toISOString() ?? null,
            onboardingComplete: profile.onboardingComplete,
        };
    });

    // Update profile
    app.put('/', async (request) => {
        const userId = request.userId;
        const body = ProfileUpdateSchema.parse(request.body);

        const profile = await prisma.profile.upsert({
            where: { userId },
            update: {
                sex: body.sex,
                dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
                heightCm: body.heightCm,
                baselineWeightKg: body.baselineWeightKg,
                goals: body.goals,
                dietStyle: body.dietStyle,
                currentInterventions: body.currentInterventions,
            },
            create: {
                userId,
                sex: body.sex,
                dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
                heightCm: body.heightCm,
                baselineWeightKg: body.baselineWeightKg,
                goals: body.goals ?? [],
                dietStyle: body.dietStyle,
                currentInterventions: body.currentInterventions,
            },
        });

        return {
            id: profile.id,
            userId: profile.userId,
            sex: profile.sex,
            dateOfBirth: profile.dateOfBirth?.toISOString() ?? null,
            heightCm: profile.heightCm,
            baselineWeightKg: profile.baselineWeightKg,
            goals: profile.goals,
            dietStyle: profile.dietStyle,
            currentInterventions: profile.currentInterventions,
            onboardingComplete: profile.onboardingComplete,
        };
    });

    // Update consent
    app.put('/consent', async (request) => {
        const userId = request.userId;
        const body = ConsentUpdateSchema.parse(request.body);

        const profile = await prisma.profile.upsert({
            where: { userId },
            update: {
                consentNotMedical: body.consentNotMedical,
                consentDataStorage: body.consentDataStorage,
                consentResearch: body.consentResearch,
                consentResearchAt: body.consentResearch ? new Date() : null,
            },
            create: {
                userId,
                consentNotMedical: body.consentNotMedical,
                consentDataStorage: body.consentDataStorage,
                consentResearch: body.consentResearch ?? false,
                consentResearchAt: body.consentResearch ? new Date() : null,
            },
        });

        return {
            consentNotMedical: profile.consentNotMedical,
            consentDataStorage: profile.consentDataStorage,
            consentResearch: profile.consentResearch,
            consentResearchAt: profile.consentResearchAt?.toISOString() ?? null,
        };
    });

    // Complete onboarding
    app.put('/onboarding', async (request) => {
        const userId = request.userId;
        const body = OnboardingSchema.parse(request.body);

        const profile = await prisma.profile.upsert({
            where: { userId },
            update: {
                sex: body.sex,
                dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
                heightCm: body.heightCm,
                baselineWeightKg: body.baselineWeightKg,
                goals: body.goals,
                dietStyle: body.dietStyle,
                currentInterventions: body.currentInterventions,
                consentNotMedical: body.consentNotMedical,
                consentDataStorage: body.consentDataStorage,
                consentResearch: body.consentResearch,
                consentResearchAt: body.consentResearch ? new Date() : null,
                onboardingComplete: true,
            },
            create: {
                userId,
                sex: body.sex,
                dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
                heightCm: body.heightCm,
                baselineWeightKg: body.baselineWeightKg,
                goals: body.goals,
                dietStyle: body.dietStyle,
                currentInterventions: body.currentInterventions,
                consentNotMedical: body.consentNotMedical,
                consentDataStorage: body.consentDataStorage,
                consentResearch: body.consentResearch,
                consentResearchAt: body.consentResearch ? new Date() : null,
                onboardingComplete: true,
            },
        });

        return {
            success: true,
            onboardingComplete: profile.onboardingComplete,
        };
    });
}
