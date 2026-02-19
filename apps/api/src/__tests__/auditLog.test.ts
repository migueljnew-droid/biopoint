import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@biopoint/db';
import { createAuditLog } from '../middleware/auditLog.js';

// Mock prisma
vi.mock('@biopoint/db', () => ({
    prisma: {
        auditLog: {
            create: vi.fn(),
        },
    },
}));

describe('Audit Logging', () => {
    let mockRequest: any;

    beforeEach(() => {
        mockRequest = {
            userId: 'test-user-id',
            headers: {
                'x-forwarded-for': '192.168.1.1',
            },
            ip: '127.0.0.1',
            log: {
                error: vi.fn(),
            },
        };
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createAuditLog', () => {
        it('should create audit log for READ operation', async () => {
            const context = {
                action: 'READ' as const,
                entityType: 'LabReport' as const,
                entityId: 'test-report-id',
                metadata: { filename: 'test.pdf' },
            };

            await createAuditLog(mockRequest, context);

            expect(prisma.auditLog.create).toHaveBeenCalledWith({
                data: {
                    userId: 'test-user-id',
                    action: 'READ',
                    entityType: 'LabReport',
                    entityId: 'test-report-id',
                    metadata: { filename: 'test.pdf' },
                    ipAddress: '192.168.1.1',
                },
            });
        });

        it('should create audit log for Profile READ operation', async () => {
            const context = {
                action: 'READ' as const,
                entityType: 'Profile' as const,
                entityId: 'test-profile-id',
            };

            await createAuditLog(mockRequest, context);

            expect(prisma.auditLog.create).toHaveBeenCalledWith({
                data: {
                    userId: 'test-user-id',
                    action: 'READ',
                    entityType: 'Profile',
                    entityId: 'test-profile-id',
                    metadata: undefined,
                    ipAddress: '192.168.1.1',
                },
            });
        });

        it('should create audit log for DailyLog READ operation', async () => {
            const context = {
                action: 'READ' as const,
                entityType: 'DailyLog' as const,
                entityId: 'test-log-id',
                metadata: { date: '2024-01-01' },
            };

            await createAuditLog(mockRequest, context);

            expect(prisma.auditLog.create).toHaveBeenCalledWith({
                data: {
                    userId: 'test-user-id',
                    action: 'READ',
                    entityType: 'DailyLog',
                    entityId: 'test-log-id',
                    metadata: { date: '2024-01-01' },
                    ipAddress: '192.168.1.1',
                },
            });
        });

        it('should create audit log for BioPointScore READ operation', async () => {
            const context = {
                action: 'READ' as const,
                entityType: 'BioPointScore' as const,
                entityId: 'dashboard',
                metadata: { 
                    hasBioPointScore: true,
                    hasTodayLog: true,
                    recentLogsCount: 7,
                },
            };

            await createAuditLog(mockRequest, context);

            expect(prisma.auditLog.create).toHaveBeenCalledWith({
                data: {
                    userId: 'test-user-id',
                    action: 'READ',
                    entityType: 'BioPointScore',
                    entityId: 'dashboard',
                    metadata: { 
                        hasBioPointScore: true,
                        hasTodayLog: true,
                        recentLogsCount: 7,
                    },
                    ipAddress: '192.168.1.1',
                },
            });
        });

        it('should handle audit log creation failure gracefully', async () => {
            const context = {
                action: 'READ' as const,
                entityType: 'LabReport' as const,
                entityId: 'test-report-id',
            };

            const error = new Error('Database error');
            vi.mocked(prisma.auditLog.create).mockRejectedValue(error);

            // Should not throw
            await expect(createAuditLog(mockRequest, context)).resolves.toBeUndefined();

            expect(mockRequest.log.error).toHaveBeenCalledWith(
                { error, context },
                'Failed to create audit log'
            );
        });

        it('should redact sensitive metadata fields', async () => {
            const context = {
                action: 'READ' as const,
                entityType: 'LabReport' as const,
                entityId: 'test-report-id',
                metadata: {
                    filename: 'test.pdf',
                    password: 'secret123',
                    userData: {
                        token: 'bearer-token',
                        s3Key: 'private-key',
                        normalField: 'normal-value',
                    },
                },
            };

            await createAuditLog(mockRequest, context);

            expect(prisma.auditLog.create).toHaveBeenCalledWith({
                data: {
                    userId: 'test-user-id',
                    action: 'READ',
                    entityType: 'LabReport',
                    entityId: 'test-report-id',
                    metadata: {
                        filename: 'test.pdf',
                        password: '[REDACTED]',
                        userData: {
                            token: '[REDACTED]',
                            s3Key: '[REDACTED]',
                            normalField: 'normal-value',
                        },
                    },
                    ipAddress: '192.168.1.1',
                },
            });
        });

        it('should handle missing userId', async () => {
            mockRequest.userId = undefined;

            const context = {
                action: 'READ' as const,
                entityType: 'LabReport' as const,
                entityId: 'test-report-id',
            };

            await createAuditLog(mockRequest, context);

            expect(prisma.auditLog.create).toHaveBeenCalledWith({
                data: {
                    userId: undefined,
                    action: 'READ',
                    entityType: 'LabReport',
                    entityId: 'test-report-id',
                    metadata: undefined,
                    ipAddress: '192.168.1.1',
                },
            });
        });

        it('should handle missing IP address', async () => {
            mockRequest.headers['x-forwarded-for'] = undefined;
            mockRequest.ip = undefined;

            const context = {
                action: 'READ' as const,
                entityType: 'LabReport' as const,
                entityId: 'test-report-id',
            };

            await createAuditLog(mockRequest, context);

            expect(prisma.auditLog.create).toHaveBeenCalledWith({
                data: {
                    userId: 'test-user-id',
                    action: 'READ',
                    entityType: 'LabReport',
                    entityId: 'test-report-id',
                    metadata: undefined,
                    ipAddress: undefined,
                },
            });
        });

        it('should extract first IP from x-forwarded-for header', async () => {
            mockRequest.headers['x-forwarded-for'] = '192.168.1.1, 10.0.0.1, 172.16.0.1';

            const context = {
                action: 'READ' as const,
                entityType: 'LabReport' as const,
                entityId: 'test-report-id',
            };

            await createAuditLog(mockRequest, context);

            expect(prisma.auditLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    ipAddress: '192.168.1.1',
                }),
            });
        });
    });
});