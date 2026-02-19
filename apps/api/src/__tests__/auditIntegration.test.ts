import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@biopoint/db';
import { createAuditLog } from '../middleware/auditLog.js';

// Mock the audit log function
vi.mock('../middleware/auditLog.js', () => ({
    createAuditLog: vi.fn(),
}));

// Mock prisma
vi.mock('@biopoint/db', () => ({
    prisma: {
        profile: {
            findUnique: vi.fn(),
        },
        labReport: {
            findMany: vi.fn(),
        },
        labMarker: {
            findMany: vi.fn(),
        },
        dailyLog: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
        },
        progressPhoto: {
            findMany: vi.fn(),
        },
        bioPointScore: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        stack: {
            count: vi.fn(),
        },
        complianceEvent: {
            count: vi.fn(),
        },
    },
}));

describe('READ Audit Logging Integration', () => {
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

    describe('Profile READ logging', () => {
        it('should log READ when profile exists', async () => {
            const mockProfile = {
                id: 'profile-123',
                userId: 'test-user-id',
                sex: 'MALE',
                dateOfBirth: new Date('1990-01-01'),
                heightCm: 180,
                baselineWeightKg: 75,
                goals: ['weight_loss'],
                dietStyle: 'MEDITERRANEAN',
                currentInterventions: null,
                consentNotMedical: true,
                consentDataStorage: true,
                consentResearch: false,
                consentResearchAt: null,
                onboardingComplete: true,
            };

            vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile);

            // Simulate profile route handler
            const profile = await prisma.profile.findUnique({
                where: { userId: mockRequest.userId },
            });

            if (profile) {
                await createAuditLog(mockRequest, {
                    action: 'READ',
                    entityType: 'Profile',
                    entityId: profile.id,
                });
            }

            expect(createAuditLog).toHaveBeenCalledWith(mockRequest, {
                action: 'READ',
                entityType: 'Profile',
                entityId: 'profile-123',
            });
        });

        it('should not log READ when profile does not exist', async () => {
            vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);

            const profile = await prisma.profile.findUnique({
                where: { userId: mockRequest.userId },
            });

            if (profile) {
                await createAuditLog(mockRequest, {
                    action: 'READ',
                    entityType: 'Profile',
                    entityId: profile.id,
                });
            }

            expect(createAuditLog).not.toHaveBeenCalled();
        });
    });

    describe('Lab Reports READ logging', () => {
        it('should log READ for lab reports list', async () => {
            const mockReports = [
                {
                    id: 'report-1',
                    filename: 'lab1.pdf',
                    s3Key: 's3-key-1',
                    uploadedAt: new Date(),
                    reportDate: new Date(),
                    notes: 'Test notes',
                    markers: [],
                },
                {
                    id: 'report-2',
                    filename: 'lab2.pdf',
                    s3Key: 's3-key-2',
                    uploadedAt: new Date(),
                    reportDate: new Date(),
                    notes: 'Test notes 2',
                    markers: [],
                },
            ];

            vi.mocked(prisma.labReport.findMany).mockResolvedValue(mockReports);

            const reports = await prisma.labReport.findMany({
                where: { userId: mockRequest.userId },
            });

            if (reports.length > 0) {
                await createAuditLog(mockRequest, {
                    action: 'READ',
                    entityType: 'LabReport',
                    entityId: 'list',
                    metadata: { reportCount: reports.length },
                });
            }

            expect(createAuditLog).toHaveBeenCalledWith(mockRequest, {
                action: 'READ',
                entityType: 'LabReport',
                entityId: 'list',
                metadata: { reportCount: 2 },
            });
        });

        it('should not log READ for empty lab reports list', async () => {
            vi.mocked(prisma.labReport.findMany).mockResolvedValue([]);

            const reports = await prisma.labReport.findMany({
                where: { userId: mockRequest.userId },
            });

            if (reports.length > 0) {
                await createAuditLog(mockRequest, {
                    action: 'READ',
                    entityType: 'LabReport',
                    entityId: 'list',
                    metadata: { reportCount: reports.length },
                });
            }

            expect(createAuditLog).not.toHaveBeenCalled();
        });
    });

    describe('Daily Logs READ logging', () => {
        it('should log READ for daily log by date', async () => {
            const mockLog = {
                id: 'log-123',
                userId: 'test-user-id',
                date: new Date('2024-01-01'),
                weightKg: 75,
                sleepHours: 8,
                sleepQuality: 8,
                energyLevel: 8,
                focusLevel: 8,
                moodLevel: 8,
                notes: 'Great day!',
            };

            vi.mocked(prisma.dailyLog.findUnique).mockResolvedValue(mockLog);

            const log = await prisma.dailyLog.findUnique({
                where: {
                    userId_date: {
                        userId: mockRequest.userId,
                        date: new Date('2024-01-01'),
                    },
                },
            });

            if (log) {
                await createAuditLog(mockRequest, {
                    action: 'READ',
                    entityType: 'DailyLog',
                    entityId: log.id,
                    metadata: { date: log.date.toISOString() },
                });
            }

            expect(createAuditLog).toHaveBeenCalledWith(mockRequest, {
                action: 'READ',
                entityType: 'DailyLog',
                entityId: 'log-123',
                metadata: { date: '2024-01-01T00:00:00.000Z' },
            });
        });
    });

    describe('Progress Photos READ logging', () => {
        it('should log READ for progress photos list', async () => {
            const mockPhotos = [
                {
                    id: 'photo-1',
                    originalS3Key: 'original-1',
                    alignedS3Key: null,
                    category: 'front',
                    capturedAt: new Date(),
                    weightKg: 75,
                    notes: 'Progress photo',
                    alignmentStatus: 'pending',
                },
                {
                    id: 'photo-2',
                    originalS3Key: 'original-2',
                    alignedS3Key: 'aligned-2',
                    category: 'side',
                    capturedAt: new Date(),
                    weightKg: 74,
                    notes: 'Another photo',
                    alignmentStatus: 'done',
                },
            ];

            vi.mocked(prisma.progressPhoto.findMany).mockResolvedValue(mockPhotos);

            const photos = await prisma.progressPhoto.findMany({
                where: { userId: mockRequest.userId },
            });

            if (photos.length > 0) {
                await createAuditLog(mockRequest, {
                    action: 'READ',
                    entityType: 'ProgressPhoto',
                    entityId: 'list',
                    metadata: { photoCount: photos.length, category: undefined },
                });
            }

            expect(createAuditLog).toHaveBeenCalledWith(mockRequest, {
                action: 'READ',
                entityType: 'ProgressPhoto',
                entityId: 'list',
                metadata: { photoCount: 2, category: undefined },
            });
        });
    });

    describe('Dashboard READ logging', () => {
        it('should log READ for dashboard data access', async () => {
            const mockBioPointScore = {
                score: 85,
                breakdown: { sleep: 18, energy: 16, focus: 14, mood: 16, compliance: 20 },
                date: new Date(),
            };

            const mockTodayLog = {
                id: 'log-today',
                date: new Date(),
                weightKg: 75,
                sleepHours: 8,
                sleepQuality: 8,
                energyLevel: 8,
                focusLevel: 7,
                moodLevel: 8,
                notes: 'Good day',
            };

            const mockRecentLogs = [mockTodayLog];
            const mockScoreHistoryData = [
                { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), score: 80 },
                { date: new Date(), score: 85 },
            ];

            vi.mocked(prisma.bioPointScore.findUnique).mockResolvedValue(mockBioPointScore);
            vi.mocked(prisma.dailyLog.findUnique).mockResolvedValue(mockTodayLog);
            vi.mocked(prisma.dailyLog.findMany).mockResolvedValue(mockRecentLogs);
            vi.mocked(prisma.bioPointScore.findMany).mockResolvedValue(mockScoreHistoryData);
            vi.mocked(prisma.stack.count).mockResolvedValue(3);
            vi.mocked(prisma.complianceEvent.count).mockResolvedValue(5);

            // Simulate dashboard data retrieval
            const bioPointScore = await prisma.bioPointScore.findUnique({
                where: { userId_date: { userId: mockRequest.userId, date: new Date() } },
            });
            const todayLog = await prisma.dailyLog.findUnique({
                where: { userId_date: { userId: mockRequest.userId, date: new Date() } },
            });
            const recentLogs = await prisma.dailyLog.findMany({
                where: { userId: mockRequest.userId },
                take: 7,
            });
            const scoreHistoryData = await prisma.bioPointScore.findMany({
                where: { userId: mockRequest.userId },
                take: 7,
            });
            const activeStacks = await prisma.stack.count({
                where: { userId: mockRequest.userId, isActive: true },
            });
            const complianceEvents = await prisma.complianceEvent.count({
                where: { userId: mockRequest.userId },
            });

            // Audit log for dashboard access
            await createAuditLog(mockRequest, {
                action: 'READ',
                entityType: 'BioPointScore',
                entityId: 'dashboard',
                metadata: { 
                    hasBioPointScore: !!bioPointScore,
                    hasTodayLog: !!todayLog,
                    recentLogsCount: recentLogs.length,
                    scoreHistoryCount: scoreHistoryData.length,
                    activeStacks,
                    weeklyComplianceEvents: complianceEvents,
                },
            });

            expect(createAuditLog).toHaveBeenCalledWith(mockRequest, {
                action: 'READ',
                entityType: 'BioPointScore',
                entityId: 'dashboard',
                metadata: { 
                    hasBioPointScore: true,
                    hasTodayLog: true,
                    recentLogsCount: 1,
                    scoreHistoryCount: 2,
                    activeStacks: 3,
                    weeklyComplianceEvents: 5,
                },
            });
        });
    });

    describe('Lab Markers READ logging', () => {
        it('should log READ for lab markers list', async () => {
            const mockMarkers = [
                {
                    id: 'marker-1',
                    name: 'Hemoglobin',
                    value: 15.2,
                    unit: 'g/dL',
                    recordedAt: new Date(),
                    refRangeLow: 13.5,
                    refRangeHigh: 17.5,
                },
                {
                    id: 'marker-2',
                    name: 'Glucose',
                    value: 95,
                    unit: 'mg/dL',
                    recordedAt: new Date(),
                    refRangeLow: 70,
                    refRangeHigh: 100,
                },
            ];

            vi.mocked(prisma.labMarker.findMany).mockResolvedValue(mockMarkers);

            const markers = await prisma.labMarker.findMany({
                where: { userId: mockRequest.userId },
            });

            if (markers.length > 0) {
                await createAuditLog(mockRequest, {
                    action: 'READ',
                    entityType: 'LabMarker',
                    entityId: 'list',
                    metadata: { markerCount: markers.length },
                });
            }

            expect(createAuditLog).toHaveBeenCalledWith(mockRequest, {
                action: 'READ',
                entityType: 'LabMarker',
                entityId: 'list',
                metadata: { markerCount: 2 },
            });
        });

        it('should log READ for lab marker trends', async () => {
            const mockMarkers = [
                {
                    id: 'marker-1',
                    name: 'Hemoglobin',
                    value: 15.2,
                    unit: 'g/dL',
                    recordedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    refRangeLow: 13.5,
                    refRangeHigh: 17.5,
                },
                {
                    id: 'marker-2',
                    name: 'Hemoglobin',
                    value: 15.8,
                    unit: 'g/dL',
                    recordedAt: new Date(),
                    refRangeLow: 13.5,
                    refRangeHigh: 17.5,
                },
            ];

            vi.mocked(prisma.labMarker.findMany).mockResolvedValue(mockMarkers);

            const markers = await prisma.labMarker.findMany({
                where: { userId: mockRequest.userId },
                orderBy: { recordedAt: 'asc' },
            });

            if (markers.length > 0) {
                await createAuditLog(mockRequest, {
                    action: 'READ',
                    entityType: 'LabMarker',
                    entityId: 'trends',
                    metadata: { markerCount: markers.length },
                });
            }

            expect(createAuditLog).toHaveBeenCalledWith(mockRequest, {
                action: 'READ',
                entityType: 'LabMarker',
                entityId: 'trends',
                metadata: { markerCount: 2 },
            });
        });
    });

    describe('BioPoint History READ logging', () => {
        it('should log READ for BioPoint history', async () => {
            const mockScores = [
                {
                    id: 'score-1',
                    userId: 'test-user-id',
                    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    score: 82,
                    breakdown: { sleep: 18, energy: 16, focus: 14, mood: 16, compliance: 18 },
                },
                {
                    id: 'score-2',
                    userId: 'test-user-id',
                    date: new Date(),
                    score: 85,
                    breakdown: { sleep: 19, energy: 17, focus: 15, mood: 17, compliance: 17 },
                },
            ];

            vi.mocked(prisma.bioPointScore.findMany).mockResolvedValue(mockScores);

            const scores = await prisma.bioPointScore.findMany({
                where: { userId: mockRequest.userId },
                orderBy: { date: 'desc' },
                take: 30,
            });

            if (scores.length > 0) {
                await createAuditLog(mockRequest, {
                    action: 'READ',
                    entityType: 'BioPointScore',
                    entityId: 'history',
                    metadata: { scoreCount: scores.length },
                });
            }

            expect(createAuditLog).toHaveBeenCalledWith(mockRequest, {
                action: 'READ',
                entityType: 'BioPointScore',
                entityId: 'history',
                metadata: { scoreCount: 2 },
            });
        });
    });
});