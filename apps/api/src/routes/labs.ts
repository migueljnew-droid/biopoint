import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { CreateLabReportSchema, CreateLabMarkerSchema, PresignUploadSchema } from '@biopoint/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/auditLog.js';
import { generateUploadPresignedUrl, generateDownloadPresignedUrl, generateS3Key, getFileBuffer } from '../utils/s3.js';
import { logDownloadAttempt, detectSuspiciousActivity } from '../middleware/s3Security.js';
import { analyzeLabReport } from '../services/analysis.js';
import { analyzeLabForSuggestions } from '../services/protocolSuggestions.js';
import { featureFlags } from '../config/featureFlags.js';

export async function labsRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    // Get presigned upload URL
    app.post('/presign', async (request) => {
        const userId = request.userId;
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
        const userId = request.userId;

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
                        m.refRangeLow !== null && m.refRangeHigh !== null && m.value !== null
                            ? m.value >= m.refRangeLow && m.value <= m.refRangeHigh
                            : null,
                })),
            };
        }));
    });

    // Create lab report
    app.post('/', async (request) => {
        const userId = request.userId;
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
        const userId = request.userId;

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
                if (!history) return null;

                // Sort by date
                history.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

                // Use the name from the most recent record as the display name
                const lastEntry = history[history.length - 1];
                const firstEntry = history[0];
                if (!lastEntry || !firstEntry) return null;
                const displayName = lastEntry.name;

                return {
                    name: displayName,
                    unit: firstEntry.unit,
                    history: history.map((h) => ({
                        id: h.id,
                        value: h.value,
                        date: h.recordedAt.toISOString(),
                        refLow: h.refRangeLow,
                        refHigh: h.refRangeHigh,
                    })),
                };
            })
            // Filter out non-numeric values and null entries
            .filter((t): t is NonNullable<typeof t> => t !== null && t.history.length > 0);

        return trends;
    });

    // Get lab report by ID
    app.get('/:id', async (request, reply) => {
        const userId = request.userId;
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
                    m.refRangeLow !== null && m.refRangeHigh !== null && m.value !== null
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

        const userId = request.userId;
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
            const body = request.body as { imageBase64?: string; imageMimeType?: string } | undefined;
            let buffer: Buffer;
            let mimeType: string;

            if (body?.imageBase64) {
                // Use image sent directly from mobile (bypasses R2)
                buffer = Buffer.from(body.imageBase64, 'base64');
                mimeType = body.imageMimeType || 'image/jpeg';
            } else {
                // Fallback: get file from S3
                buffer = await getFileBuffer(report.s3Key);
                // Detect mime type from file magic bytes
                mimeType = 'image/jpeg';
                if (buffer[0] === 0x25 && buffer[1] === 0x50) mimeType = 'application/pdf';
                else if (buffer[0] === 0x89 && buffer[1] === 0x50) mimeType = 'image/png';
                else if (buffer[0] === 0xFF && buffer[1] === 0xD8) mimeType = 'image/jpeg';
            }

            // Reject empty/corrupt files
            if (!buffer || buffer.length < 100) {
                return reply.status(400).send({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: `File appears empty or corrupted (${buffer?.length || 0} bytes). Please re-upload.`,
                });
            }

            request.log.info({ mimeType, fileSize: buffer.length, filename: report.filename }, 'Analyzing lab report');

            // Analyze
            const analysis = await analyzeLabReport(buffer, mimeType);

            // Save markers to database
            const reportDate = report.reportDate || report.uploadedAt || new Date();

            // Parse markers and batch insert atomically
            const markerData = analysis.markers.map((m: any) => {
                let low: number | null = null;
                let high: number | null = null;
                const rangeMatch = String(m.range || '').match(/([\d.]+)\s*-\s*([\d.]+)/);
                if (rangeMatch) {
                    low = parseFloat(rangeMatch[1] ?? '0');
                    high = parseFloat(rangeMatch[2] ?? '0');
                }
                // Force value to number — Gemini may return number, string, or null
                let val: number | null = null;
                if (m.value !== null && m.value !== undefined && m.value !== '') {
                    const parsed = Number(m.value);
                    if (!isNaN(parsed)) val = parsed;
                }
                return {
                    labReportId: report.id,
                    userId,
                    name: String(m.name || 'Unknown'),
                    value: val,
                    unit: String(m.unit || ''),
                    refRangeLow: low,
                    refRangeHigh: high,
                    recordedAt: reportDate,
                    notes: `${m.flag || 'NORMAL'}: ${m.insight || ''}`,
                };
            });

            // Log first 3 markers for debugging
            request.log.info({ sampleMarkers: markerData.slice(0, 3).map(m => ({ name: m.name, value: m.value, type: typeof m.value })) }, 'Saving markers');

            await prisma.$transaction([
                prisma.labMarker.deleteMany({ where: { labReportId: report.id } }),
                prisma.labMarker.createMany({ data: markerData }),
            ]);

            // Verify save worked
            const savedCount = await prisma.labMarker.count({ where: { labReportId: report.id, value: { not: null } } });
            request.log.info({ savedWithValues: savedCount, total: markerData.length }, 'Markers saved');

            await createAuditLog(request, {
                action: 'UPDATE',
                entityType: 'LabReport',
                entityId: report.id,
                metadata: { action: 'analyze', markerCount: analysis.markers.length, savedWithValues: savedCount },
            });

            return { ...analysis, _debug: { savedMarkers: markerData.length, savedWithValues: savedCount } };
        } catch (error: any) {
            request.log.error(error);
            return reply.status(500).send({
                statusCode: 500,
                error: 'Internal Server Error',
                message: error?.message || 'Failed to analyze lab report',
            });
        }
    });

    // AI protocol suggestions (AI-PROTO-01: gated behind feature flag -- requires Vertex AI BAA)
    app.post('/:id/suggest', async (request, reply) => {
        if (!featureFlags.geminiProtocolSuggestions) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Feature not available',
            });
        }

        // TODO: Add server-side premium verification via RevenueCat REST API once
        // backend entitlement validation is scoped. Currently gated client-side via
        // isPremium (subscriptionStore) before this endpoint is called.

        const userId = request.userId;
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

        const markers = await prisma.labMarker.findMany({
            where: { labReportId: report.id },
            orderBy: { name: 'asc' },
        });

        const markerInputs = markers.map((m) => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            refRangeLow: m.refRangeLow,
            refRangeHigh: m.refRangeHigh,
        }));

        try {
            const result = await analyzeLabForSuggestions(markerInputs);

            await createAuditLog(request, {
                action: 'READ',
                entityType: 'LabReport',
                entityId: report.id,
                metadata: { action: 'suggest', analyzedMarkers: result.analyzedMarkers, flaggedMarkers: result.flaggedMarkers },
            });

            return result;
        } catch (error) {
            request.log.error(error);
            return reply.status(503).send({
                statusCode: 503,
                error: 'Service Unavailable',
                message: 'Failed to generate protocol suggestions',
            });
        }
    });

    // Delete lab report
    app.delete('/:id', async (request, reply) => {
        const userId = request.userId;
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
        const userId = request.userId;
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
                marker.refRangeLow !== null && marker.refRangeHigh !== null && marker.value !== null
                    ? marker.value >= marker.refRangeLow && marker.value <= marker.refRangeHigh
                    : null,
        };
    });
}
