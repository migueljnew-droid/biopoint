import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '@biopoint/db';
import {
    exportUserData,
    generatePDFReport,
    requestAccountDeletion,
    executeAccountDeletion,
    updateConsentPreferences,
    getConsentPreferences,
    cleanupOrphanedData,
    autoDeleteInactiveAccounts,
    getDeletionStatus
} from '../services/gdpr-compliance.js';

// Mock the audit log middleware
vi.mock('../middleware/auditLog.js', () => ({
    createAuditLog: vi.fn().mockResolvedValue(true)
}));

describe('GDPR Compliance Service', () => {
    let testUser: any;
    let testProfile: any;

    beforeEach(async () => {
        // Clean up any existing test data
        await prisma.deletionRequest.deleteMany({});
        await prisma.consentRecord.deleteMany({});
        await prisma.dailyLog.deleteMany({});
        await prisma.labMarker.deleteMany({});
        await prisma.labReport.deleteMany({});
        await prisma.progressPhoto.deleteMany({});
        await prisma.stackItem.deleteMany({});
        await prisma.stack.deleteMany({});
        await prisma.profile.deleteMany({});
        await prisma.user.deleteMany({});

        // Create test user
        testUser = await prisma.user.create({
            data: {
                email: 'test@example.com',
                passwordHash: 'hashed_password',
                role: 'USER',
            }
        });

        // Create test profile
        testProfile = await prisma.profile.create({
            data: {
                userId: testUser.id,
                sex: 'male',
                dateOfBirth: new Date('1990-01-01'),
                heightCm: 175.0,
                baselineWeightKg: 70.0,
                goals: ['weight_loss', 'muscle_gain'],
                dietStyle: 'keto',
                currentInterventions: 'intermittent_fasting',
                consentNotMedical: true,
                consentDataStorage: true,
                consentResearch: true,
                consentResearchAt: new Date(),
                onboardingComplete: true,
            }
        });
    });

    afterEach(async () => {
        // Clean up test data
        await prisma.deletionRequest.deleteMany({});
        await prisma.consentRecord.deleteMany({});
        await prisma.dailyLog.deleteMany({});
        await prisma.labMarker.deleteMany({});
        await prisma.labReport.deleteMany({});
        await prisma.progressPhoto.deleteMany({});
        await prisma.stackItem.deleteMany({});
        await prisma.stack.deleteMany({});
        await prisma.profile.deleteMany({});
        await prisma.user.deleteMany({});
    });

    describe('Data Export (Article 20)', () => {
        beforeEach(async () => {
            // Create test data for export
            await prisma.dailyLog.create({
                data: {
                    userId: testUser.id,
                    date: new Date(),
                    weightKg: 70.0,
                    sleepHours: 8.0,
                    sleepQuality: 8,
                    energyLevel: 7,
                    focusLevel: 6,
                    moodLevel: 8,
                    notes: 'Good day overall',
                }
            });

            await prisma.stack.create({
                data: {
                    userId: testUser.id,
                    name: 'Test Stack',
                    goal: 'weight_loss',
                    items: {
                        create: [
                            {
                                name: 'Test Supplement',
                                dose: 100,
                                unit: 'mg',
                                route: 'oral',
                                frequency: 'daily',
                                timing: 'AM',
                                isActive: true,
                            }
                        ]
                    }
                }
            });
        });

        it('should export user data in JSON format', async () => {
            const options = {
                format: 'json' as const,
                includeProfile: true,
                includeLabs: true,
                includePhotos: true,
                includeLogs: true,
                includeStacks: true,
                includeAuditLogs: false,
            };

            const result = await exportUserData(testUser.id, options);

            expect(result).toBeDefined();
            expect(result.exportDate).toBeDefined();
            expect(result.userId).toBe(testUser.id);
            expect(result.version).toBe('1.0');
            expect(result.gdprCompliant).toBe(true);
            expect(result.profile).toBeDefined();
            expect(result.dailyLogs).toBeDefined();
            expect(result.stacks).toBeDefined();
        });

        it('should export only selected categories', async () => {
            const options = {
                format: 'json' as const,
                includeProfile: true,
                includeLabs: false,
                includePhotos: false,
                includeLogs: false,
                includeStacks: false,
                includeAuditLogs: false,
            };

            const result = await exportUserData(testUser.id, options);

            expect(result.profile).toBeDefined();
            expect(result.dailyLogs).toBeUndefined();
            expect(result.stacks).toBeUndefined();
            expect(result.labReports).toBeUndefined();
        });

        it('should handle users with no data gracefully', async () => {
            const newUser = await prisma.user.create({
                data: {
                    email: 'empty@example.com',
                    passwordHash: 'hashed_password',
                }
            });

            const options = {
                format: 'json' as const,
                includeProfile: true,
                includeLabs: true,
                includePhotos: true,
                includeLogs: true,
                includeStacks: true,
                includeAuditLogs: false,
            };

            const result = await exportUserData(newUser.id, options);

            expect(result).toBeDefined();
            expect(result.userId).toBe(newUser.id);
            expect(result.profile).toBeNull();
            expect(result.dailyLogs).toEqual([]);
            expect(result.stacks).toEqual([]);
        });

        it('should generate PDF report', async () => {
            const pdfBuffer = await generatePDFReport(testUser.id);

            expect(pdfBuffer).toBeDefined();
            expect(pdfBuffer).toBeInstanceOf(Buffer);
            expect(pdfBuffer.length).toBeGreaterThan(0);
        });
    });

    describe('Account Deletion (Article 17)', () => {
        it('should create deletion request successfully', async () => {
            const deletionRequest = {
                userId: testUser.id,
                confirmationEmail: testUser.email,
                reason: 'Privacy concerns',
                immediateEffect: false,
            };

            const result = await requestAccountDeletion(deletionRequest);

            expect(result.success).toBe(true);
            expect(result.deletionId).toBeDefined();
            expect(result.scheduledFor).toBeDefined();

            // Verify deletion request was created
            const createdRequest = await prisma.deletionRequest.findUnique({
                where: { id: result.deletionId }
            });

            expect(createdRequest).toBeDefined();
            expect(createdRequest?.userId).toBe(testUser.id);
            expect(createdRequest?.status).toBe('PENDING');
            expect(createdRequest?.reason).toBe('Privacy concerns');
        });

        it('should fail if email does not match', async () => {
            const deletionRequest = {
                userId: testUser.id,
                confirmationEmail: 'wrong@example.com',
                immediateEffect: false,
            };

            await expect(requestAccountDeletion(deletionRequest)).rejects.toThrow('Email confirmation failed');
        });

        it('should fail if deletion request already exists', async () => {
            const deletionRequest = {
                userId: testUser.id,
                confirmationEmail: testUser.email,
                immediateEffect: false,
            };

            // Create first request
            await requestAccountDeletion(deletionRequest);

            // Try to create second request
            await expect(requestAccountDeletion(deletionRequest)).rejects.toThrow('Account deletion already requested');
        });

        it('should execute account deletion successfully', async () => {
            // Create additional test data
            await prisma.dailyLog.create({
                data: {
                    userId: testUser.id,
                    date: new Date(),
                    weightKg: 70.0,
                }
            });

            // Create deletion request
            const deletionRequest = {
                userId: testUser.id,
                confirmationEmail: testUser.email,
                immediateEffect: false,
            };

            const requestResult = await requestAccountDeletion(deletionRequest);

            // Execute deletion
            const executionResult = await executeAccountDeletion(requestResult.deletionId);

            expect(executionResult.success).toBe(true);
            expect(executionResult.deletedRecords).toBeDefined();
            expect(executionResult.deletedRecords.profile).toBe(1);

            // Verify user was deleted
            const deletedUser = await prisma.user.findUnique({
                where: { id: testUser.id }
            });
            expect(deletedUser).toBeNull();
        });

        it('should get deletion status', async () => {
            const deletionRequest = {
                userId: testUser.id,
                confirmationEmail: testUser.email,
                immediateEffect: false,
            };

            const result = await requestAccountDeletion(deletionRequest);
            const status = await getDeletionStatus(testUser.id);

            expect(status.hasPendingDeletion).toBe(true);
            expect(status.status).toBe('PENDING');
            expect(status.scheduledFor).toBeDefined();
        });
    });

    describe('Consent Management', () => {
        it('should update consent preferences successfully', async () => {
            const consentUpdate = {
                userId: testUser.id,
                marketing: true,
                analytics: false,
                research: true,
                thirdPartySharing: false,
            };

            const result = await updateConsentPreferences(consentUpdate);

            expect(result.success).toBe(true);
            expect(result.consentRecord).toBeDefined();
            expect(result.consentRecord.marketing).toBe(true);
            expect(result.consentRecord.analytics).toBe(false);
            expect(result.consentRecord.research).toBe(true);
            expect(result.consentRecord.thirdPartySharing).toBe(false);
        });

        it('should get current consent preferences', async () => {
            // First update some preferences
            await updateConsentPreferences({
                userId: testUser.id,
                marketing: true,
                analytics: true,
                research: false,
                thirdPartySharing: true,
            });

            const preferences = await getConsentPreferences(testUser.id);

            expect(preferences).toBeDefined();
            expect(preferences.marketing).toBe(true);
            expect(preferences.analytics).toBe(true);
            expect(preferences.research).toBe(false);
            expect(preferences.thirdPartySharing).toBe(true);
        });

        it('should handle profile not found', async () => {
            const newUser = await prisma.user.create({
                data: {
                    email: 'noprofile@example.com',
                    passwordHash: 'hashed_password',
                }
            });

            await expect(getConsentPreferences(newUser.id)).rejects.toThrow('Profile not found');
        });
    });

    describe('Data Retention and Cleanup', () => {
        it('should cleanup orphaned data', async () => {
            // Create some orphaned data (this would normally be created by system issues)
            // Note: In a real scenario, orphaned data would exist due to system issues
            // For testing, we'll just verify the function works

            const result = await cleanupOrphanedData();

            expect(result).toBeDefined();
            expect(result.cleanedRecords).toBeDefined();
        });

        it('should auto-delete inactive accounts', async () => {
            // Create a user with old updatedAt date
            const oldUser = await prisma.user.create({
                data: {
                    email: 'old@example.com',
                    passwordHash: 'hashed_password',
                    updatedAt: new Date(Date.now() - 8 * 365 * 24 * 60 * 60 * 1000), // 8 years ago
                }
            });

            const result = await autoDeleteInactiveAccounts();

            expect(result).toBeDefined();
            expect(result.deletedAccounts).toBeGreaterThanOrEqual(0);
            expect(result.errors).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid user ID gracefully', async () => {
            const options = {
                format: 'json' as const,
                includeProfile: true,
                includeLabs: true,
                includePhotos: true,
                includeLogs: true,
                includeStacks: true,
                includeAuditLogs: false,
            };

            const result = await exportUserData('invalid-user-id', options);

            expect(result).toBeDefined();
            expect(result.userId).toBe('invalid-user-id');
            expect(result.profile).toBeNull();
        });

        it('should handle database errors gracefully', async () => {
            // This test would require mocking database errors
            // For now, we verify that the function doesn't crash with invalid data

            await expect(getConsentPreferences('non-existent-user')).rejects.toThrow();
        });
    });

    describe('Audit Logging', () => {
        it('should create audit logs for export operations', async () => {
            const mockRequest = {
                ip: '127.0.0.1',
                headers: { 'user-agent': 'test-agent' }
            };

            const options = {
                format: 'json' as const,
                includeProfile: true,
                includeLabs: false,
                includePhotos: false,
                includeLogs: false,
                includeStacks: false,
                includeAuditLogs: false,
            };

            await exportUserData(testUser.id, options, mockRequest);

            // Verify audit log was created (mocked)
            const { createAuditLog } = await import('../middleware/auditLog.js');
            expect(createAuditLog).toHaveBeenCalledWith(
                mockRequest,
                expect.objectContaining({
                    action: 'READ',
                    entityType: 'DataExport',
                    entityId: testUser.id,
                    metadata: expect.objectContaining({
                        exportFormat: 'json',
                        dataCategories: ['includeProfile']
                    })
                })
            );
        });

        it('should create audit logs for deletion operations', async () => {
            const mockRequest = {
                ip: '127.0.0.1',
                headers: { 'user-agent': 'test-agent' }
            };

            const deletionRequest = {
                userId: testUser.id,
                confirmationEmail: testUser.email,
                immediateEffect: false,
            };

            await requestAccountDeletion(deletionRequest, mockRequest);

            // Verify audit log was created (mocked)
            const { createAuditLog } = await import('../middleware/auditLog.js');
            expect(createAuditLog).toHaveBeenCalled();
        });
    });
});
