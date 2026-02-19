import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { CreatePhotoSchema, PhotoPresignSchema } from '@biopoint/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/auditLog.js';
import { generateUploadPresignedUrl, generateDownloadPresignedUrl, generateLegacyDownloadPresignedUrl, generateS3Key } from '../utils/s3.js';
import { logDownloadAttempt, detectSuspiciousActivity } from '../middleware/s3Security.js';

import { fileUploadSanitizationMiddleware, s3KeyValidationMiddleware } from '../middleware/sanitization.js';
import { validateUploadedFileType } from '../middleware/s3Validation.js';

export async function photosRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);
    // Apply file upload sanitization to photo-related endpoints
    app.addHook('preHandler', fileUploadSanitizationMiddleware);
    app.addHook('preHandler', s3KeyValidationMiddleware);

    app.post('/presign', async (request) => {
        const userId = (request as any).userId;
        const body = PhotoPresignSchema.parse(request.body);
        const s3Key = generateS3Key(userId, 'photos', body.filename);
        const { uploadUrl, expiresIn } = await generateUploadPresignedUrl(s3Key, body.contentType, 'photos');
        return { uploadUrl, s3Key, expiresIn };
    });

    app.get('/', async (request) => {
        const userId = (request as any).userId;
        const query = request.query as { category?: string };
        const where: any = { userId };
        if (query.category) where.category = query.category;

        const photos = await prisma.progressPhoto.findMany({
            where,
            orderBy: { capturedAt: 'desc' },
        });

        // Audit log for progress photos list access (SEC-04: log unconditionally, including empty results)
        await createAuditLog(request, {
            action: 'READ',
            entityType: 'ProgressPhoto',
            entityId: 'list',
            metadata: { resultCount: photos.length, category: query.category },
        });

        return Promise.all(photos.map(async (photo) => {
            // Generate presigned URLs with download tracking
            const { url: originalUrl, expiresIn: originalExpiresIn } = await generateDownloadPresignedUrl(photo.originalS3Key, 'photos');
            const alignedUrlData = photo.alignedS3Key ? await generateDownloadPresignedUrl(photo.alignedS3Key, 'photos') : null;

            // Log bulk access for security monitoring
            await logDownloadAttempt(request, userId, originalUrl, photo.originalS3Key, true);
            await detectSuspiciousActivity(request, photo.originalS3Key, userId);

            if (photo.alignedS3Key && alignedUrlData) {
                await logDownloadAttempt(request, userId, alignedUrlData.url, photo.alignedS3Key, true);
                await detectSuspiciousActivity(request, photo.alignedS3Key, userId);
            }

            return {
                id: photo.id,
                originalS3Key: photo.originalS3Key,
                originalUrl,
                originalExpiresIn,
                alignedS3Key: photo.alignedS3Key,
                alignedUrl: alignedUrlData?.url || null,
                alignedExpiresIn: alignedUrlData?.expiresIn || null,
                category: photo.category,
                capturedAt: photo.capturedAt.toISOString(),
                weightKg: photo.weightKg,
                notes: photo.notes,
                alignmentStatus: photo.alignmentStatus,
            };
        }));
    });

    app.post('/', async (request, reply) => {
        const userId = (request as any).userId;
        const body = CreatePhotoSchema.parse(request.body);

        // SEC-07: Validate uploaded file by magic bytes before accepting
        const { S3Client } = await import('@aws-sdk/client-s3');
        const s3Client = new S3Client({
            region: process.env.AWS_REGION || 'auto',
            endpoint: process.env.S3_ENDPOINT,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
        });
        const bucket = process.env.S3_BUCKET || 'biopoint-uploads';
        const validation = await validateUploadedFileType(s3Client, bucket, body.originalS3Key);
        if (!validation.valid) {
            return reply.status(400).send({
                statusCode: 400,
                error: 'Bad Request',
                message: `Uploaded file type is not allowed. Detected: ${validation.detectedType ?? 'unknown'}`,
            });
        }

        const photo = await prisma.progressPhoto.create({
            data: {
                userId,
                originalS3Key: body.originalS3Key,
                category: body.category,
                capturedAt: body.capturedAt ? new Date(body.capturedAt) : new Date(),
                weightKg: body.weightKg,
                notes: body.notes,
                alignmentStatus: 'pending',
            },
        });

        await createAuditLog(request, {
            action: 'CREATE',
            entityType: 'ProgressPhoto',
            entityId: photo.id,
        });

        // Generate presigned URL with download tracking
        const { url: originalUrl, expiresIn: originalExpiresIn } = await generateDownloadPresignedUrl(photo.originalS3Key, 'photos');

        // Log download attempt for security monitoring
        await logDownloadAttempt(request, userId, originalUrl, photo.originalS3Key, true);
        await detectSuspiciousActivity(request, photo.originalS3Key, userId);

        return {
            id: photo.id,
            originalS3Key: photo.originalS3Key,
            originalUrl,
            originalExpiresIn,
            alignedS3Key: null,
            alignedUrl: null,
            alignedExpiresIn: null,
            category: photo.category,
            capturedAt: photo.capturedAt.toISOString(),
            weightKg: photo.weightKg,
            notes: photo.notes,
            alignmentStatus: photo.alignmentStatus,
        };
    });

    app.get('/:id', async (request, reply) => {
        const userId = (request as any).userId;
        const { id } = request.params as { id: string };
        const photo = await prisma.progressPhoto.findFirst({ where: { id, userId } });

        if (!photo) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Photo not found' });
        }

        await createAuditLog(request, { action: 'READ', entityType: 'ProgressPhoto', entityId: photo.id });

        // Generate presigned URLs with download tracking
        const { url: originalUrl, expiresIn: originalExpiresIn } = await generateDownloadPresignedUrl(photo.originalS3Key, 'photos');
        const alignedUrlData = photo.alignedS3Key ? await generateDownloadPresignedUrl(photo.alignedS3Key, 'photos') : null;

        // Log download attempt for security monitoring
        await logDownloadAttempt(request, userId, originalUrl, photo.originalS3Key, true);
        await detectSuspiciousActivity(request, photo.originalS3Key, userId);

        if (photo.alignedS3Key && alignedUrlData) {
            await logDownloadAttempt(request, userId, alignedUrlData.url, photo.alignedS3Key, true);
            await detectSuspiciousActivity(request, photo.alignedS3Key, userId);
        }

        return {
            id: photo.id,
            originalS3Key: photo.originalS3Key,
            originalUrl,
            originalExpiresIn,
            alignedS3Key: photo.alignedS3Key,
            alignedUrl: alignedUrlData?.url || null,
            alignedExpiresIn: alignedUrlData?.expiresIn || null,
            category: photo.category,
            capturedAt: photo.capturedAt.toISOString(),
            weightKg: photo.weightKg,
            notes: photo.notes,
            alignmentStatus: photo.alignmentStatus,
        };
    });

    app.delete('/:id', async (request, reply) => {
        const userId = (request as any).userId;
        const { id } = request.params as { id: string };
        const photo = await prisma.progressPhoto.findFirst({ where: { id, userId } });

        if (!photo) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Photo not found' });
        }

        await prisma.progressPhoto.delete({ where: { id } });
        await createAuditLog(request, { action: 'DELETE', entityType: 'ProgressPhoto', entityId: id });
        return { success: true };
    });

    app.post('/:id/align', async (request, reply) => {
        const userId = (request as any).userId;
        const { id } = request.params as { id: string };
        const photo = await prisma.progressPhoto.findFirst({ where: { id, userId } });

        if (!photo) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Photo not found' });
        }

        await prisma.progressPhoto.update({ where: { id }, data: { alignmentStatus: 'processing' } });

        // MVP: Simple deterministic alignment (simulate async)
        setTimeout(async () => {
            await prisma.progressPhoto.update({
                where: { id },
                data: { alignedS3Key: photo.originalS3Key, alignmentStatus: 'done' },
            });
        }, 1000);

        return { status: 'processing', message: 'Alignment job started' };
    });
}
