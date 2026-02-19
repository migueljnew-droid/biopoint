import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { CreateLabReportSchema, CreateLabMarkerSchema, PresignUploadSchema } from '@biopoint/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/auditLog.js';
import { generateUploadPresignedUrl, generateDownloadPresignedUrl, generateLegacyDownloadPresignedUrl, generateS3Key, getFileBuffer } from '../utils/s3.js';
import { logDownloadAttempt, detectSuspiciousActivity } from '../middleware/s3Security.js';
import { analyzeLabReport } from '../services/analysis.js';
import { featureFlags } from '../config/featureFlags.js';

export async function labsRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    // Get presigned upload URL
    app.post('/presign', async (request) => {
        const userId = (request as any).userId;
        const body = PresignUploadSchema.parse(request.body);

        const s3Key = generateS3Key(userId, 'labs', body.filename);
        const { uploadUrl, expiresIn } = await generateUploadPresignedUrl(s3Key, body.contentType, 'labs');

        return {
            uploadUrl,
            s3Key,
            expiresIn,
        };
    });

    // List lab reports
    app.get('/', async (request) => {
        const userId = (request as any).userId;

        const reports = await prisma.labReport.findMany({
            where: { userId },
            include: {
                markers: {
                    orderBy: { name: 'asc' },
                },
            },
            orderBy: { uploadedAt: 'desc' },
        });

        // Audit log for lab reports list access (SEC-04: log unconditionally, including empty results)
        await createAuditLog(request, {
            action: 'READ',
            entityType: 'LabReport',
            entityId: 'list',
            metadata: { resultCount: reports.length },
        });

        return Promise.all(reports.map(async (report) => {
            // Generate presigned URL with download tracking for HIPAA compliance
            const { url: downloadUrl, expiresIn } = await generateDownloadPresignedUrl(report.s3Key, 'labs');
            
            // Log download attempt for security monitoring
            await logDownloadAttempt(request, userId, downloadUrl, report.s3Key, true);
            await detectSuspiciousActivity(request, report.s3Key, userId);
            
            return {
                id: report.id,
                filename: report.filename,
                s3Key: report.s3Key,
                downloadUrl,
                expiresIn,
                uploadedAt: report.uploadedAt.toISOString(),
                reportDate: report.reportDate?.toISOString() ?? null,
                notes: report.notes,
                markers: report.markers.map((m) => ({
                    id: m.id,
                    labReportId: m.labReportId,
                    name: m.name,
                    value: m.value,
                    unit: m.unit,
                    refRangeLow: m.refRangeLow,
                    refRangeHigh: m.refRangeHigh,
                    recordedAt: m.recordedAt.toISOString(),
                    notes: m.notes,
                    isInRange:
                        m.refRangeLow !== null && m.refRangeHigh !== null
                            ? m.value >= m.refRangeLow && m.value <= m.refRangeHigh
                            : null,
                })),
            };
        }));
    });

    // Create lab report
    app.post('/', async (request) => {
        const userId = (request as any).userId;
        const body = CreateLabReportSchema.parse(request.body);

        const report = await prisma.labReport.create({
            data: {
                userId,
                filename: body.filename,
                s3Key: body.s3Key,
                reportDate: body.reportDate ? new Date(body.reportDate) : null,
                notes: body.notes,
            },
        });

        await createAuditLog(request, {
            action: 'CREATE',
            entityType: 'LabReport',
            entityId: report.id,
            metadata: { filename: body.filename },
        });

        // Generate presigned URL with download tracking for HIPAA compliance
        const { url: downloadUrl, expiresIn } = await generateDownloadPresignedUrl(report.s3Key, 'labs');
        
        // Log download attempt for security monitoring
        await logDownloadAttempt(request, userId, downloadUrl, report.s3Key, true);
        await detectSuspiciousActivity(request, report.s3Key, userId);
        
        return {
            id: report.id,
            filename: report.filename,
            s3Key: report.s3Key,
            downloadUrl,
            expiresIn,
            uploadedAt: report.uploadedAt.toISOString(),
            reportDate: report.reportDate?.toISOString() ?? null,
            notes: report.notes,
            markers: [],
        };
    });

    // Get biomarker trends
    app.get('/trends', async (request) => {
        const userId = (request as any).userId;

        const allMarkers = await prisma.labMarker.findMany({
            where: { userId },
            orderBy: { recordedAt: 'asc' },
            select: {
                id: true,
                name: true,
                value: true,
                unit: true,
                recordedAt: true,
                refRangeLow: true,
                refRangeHigh: true,
            },
        });

        // Audit log for biomarker trends access (SEC-04: log unconditionally, including empty results)
        await createAuditLog(request, {
            action: 'READ',
            entityType: 'LabMarker',
            entityId: 'trends',
            metadata: { resultCount: allMarkers.length },
        });

        // Group by normalized name
        const groups: Record<string, typeof allMarkers> = {};
        for (const m of allMarkers) {
            // Normalize name: lowercase and trim
            const normalizedName = m.name.trim().toLowerCase();

            // Map common variations if needed (e.g., "hgb" -> "hemoglobin")
            // For now just simple case insensitivity

            if (!groups[normalizedName]) groups[normalizedName] = [];
            groups[normalizedName].push(m);
        }

        // Format for frontend
        const trends = Object.keys(groups)
            .map((key) => {
                const history = groups[key];

                // Sort by date
                history.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

                // Use the name from the most recent record as the display name
                const displayName = history[history.length - 1].name;

                return {
                    name: displayName,
                    unit: history[0].unit,
                    history: history.map((h) => ({
                        id: h.id,
                        value: h.value,
                        date: h.recordedAt.toISOString(),
                        refLow: h.refRangeLow,
                        refHigh: h.refRangeHigh,
                    })),
                };
            })
            // Filter out non-numeric values if any
            .filter(t => t.history.length > 0);

        return trends;
    });

    // Get lab report by ID
    app.get('/:id', async (request, reply) => {
        const userId = (request as any).userId;
        const { id } = request.params as { id: string };

        const report = await prisma.labReport.findFirst({
            where: { id, userId },
            include: {
                markers: {
                    orderBy: { name: 'asc' },
                },
            },
        });

        if (!report) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Lab report not found',
            });
        }

        await createAuditLog(request, {
            action: 'READ',
            entityType: 'LabReport',
            entityId: report.id,
        });

        // Generate presigned URL with download tracking for HIPAA compliance
        const { url: downloadUrl, expiresIn } = await generateDownloadPresignedUrl(report.s3Key, 'labs');
        
        // Log download attempt for security monitoring
        await logDownloadAttempt(request, userId, downloadUrl, report.s3Key, true);
        await detectSuspiciousActivity(request, report.s3Key, userId);
        
        return {
            id: report.id,
            filename: report.filename,
            s3Key: report.s3Key,
            downloadUrl,
            expiresIn,
            uploadedAt: report.uploadedAt.toISOString(),
            reportDate: report.reportDate?.toISOString() ?? null,
            notes: report.notes,
            markers: report.markers.map((m) => ({
                id: m.id,
                labReportId: m.labReportId,
                name: m.name,
                value: m.value,
                unit: m.unit,
                refRangeLow: m.refRangeLow,
                refRangeHigh: m.refRangeHigh,
                recordedAt: m.recordedAt.toISOString(),
                notes: m.notes,
                isInRange:
                    m.refRangeLow !== null && m.refRangeHigh !== null
                        ? m.value >= m.refRangeLow && m.value <= m.refRangeHigh
                        : null,
            })),
        };
    });

    // Analyze lab report (SEC-01: gated behind feature flag -- Gemini lacks BAA)
    app.post('/:id/analyze', async (request, reply) => {
        if (!featureFlags.geminiLabAnalysis) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Lab analysis feature is not currently available',
            });
        }

        const userId = (request as any).userId;
        const { id } = request.params as { id: string };

        const report = await prisma.labReport.findFirst({
            where: { id, userId },
        });

        if (!report) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Lab report not found',
            });
        }

        try {
            // Get file from S3
            const buffer = await getFileBuffer(report.s3Key);

            // Determine mime type (simple check based on extension)
            const isPdf = report.filename.toLowerCase().endsWith('.pdf');
            const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';

            // Analyze
            const analysis = await analyzeLabReport(buffer, mimeType);

            // Save markers to database
            const reportDate = report.reportDate || report.uploadedAt || new Date();

            // Clear existing markers for this report to avoid duplicates on re-analysis
            await prisma.labMarker.deleteMany({ where: { labReportId: report.id } });

            for (const m of analysis.markers) {
                // Parse range string (e.g., "13.5-17.5" or "13.5 - 17.5")
                let low: number | null = null;
                let high: number | null = null;
                const rangeMatch = m.range.match(/([\d.]+)\s*-\s*([\d.]+)/);
                if (rangeMatch) {
                    low = parseFloat(rangeMatch[1]);
                    high = parseFloat(rangeMatch[2]);
                }

                await prisma.labMarker.create({
                    data: {
                        labReportId: report.id,
                        userId,
                        name: m.name,
                        value: m.value,
                        unit: m.unit,
                        refRangeLow: low,
                        refRangeHigh: high,
                        recordedAt: reportDate,
                        notes: `${m.flag}: ${m.insight}`,
                    },
                });
            }

            await createAuditLog(request, {
                action: 'UPDATE',
                entityType: 'LabReport',
                entityId: report.id,
                metadata: { action: 'analyze', markerCount: analysis.markers.length },
            });

            return analysis;
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({
                statusCode: 500,
                error: 'Internal Server Error',
                message: 'Failed to analyze lab report',
            });
        }
    });

    // Delete lab report
    app.delete('/:id', async (request, reply) => {
        const userId = (request as any).userId;
        const { id } = request.params as { id: string };

        const report = await prisma.labReport.findFirst({
            where: { id, userId },
        });

        if (!report) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Lab report not found',
            });
        }

        await prisma.labReport.delete({ where: { id } });

        await createAuditLog(request, {
            action: 'DELETE',
            entityType: 'LabReport',
            entityId: id,
        });

        return { success: true };
    });

    // Add marker to lab report
    app.post('/:id/markers', async (request, reply) => {
        const userId = (request as any).userId;
        const { id } = request.params as { id: string };
        const body = CreateLabMarkerSchema.parse(request.body);

        const report = await prisma.labReport.findFirst({
            where: { id, userId },
        });

        if (!report) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Lab report not found',
            });
        }

        const marker = await prisma.labMarker.create({
            data: {
                labReportId: id,
                userId,
                name: body.name,
                value: body.value,
                unit: body.unit,
                refRangeLow: body.refRangeLow,
                refRangeHigh: body.refRangeHigh,
                recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
                notes: body.notes,
            },
        });

        await createAuditLog(request, {
            action: 'CREATE',
            entityType: 'LabMarker',
            entityId: marker.id,
            metadata: { name: body.name },
        });

        return {
            id: marker.id,
            labReportId: marker.labReportId,
            name: marker.name,
            value: marker.value,
            unit: marker.unit,
            refRangeLow: marker.refRangeLow,
            refRangeHigh: marker.refRangeHigh,
            recordedAt: marker.recordedAt.toISOString(),
            notes: marker.notes,
            isInRange:
                marker.refRangeLow !== null && marker.refRangeHigh !== null
                    ? marker.value >= marker.refRangeLow && marker.value <= marker.refRangeHigh
                    : null,
        };
    });
}
