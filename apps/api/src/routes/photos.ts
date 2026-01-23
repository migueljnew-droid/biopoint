import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { CreatePhotoSchema, PhotoPresignSchema } from '@biopoint/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/auditLog.js';
import { generateUploadPresignedUrl, generateDownloadPresignedUrl, generateS3Key } from '../utils/s3.js';

export async function photosRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    app.post('/presign', async (request) => {
        const userId = (request as any).userId;
        const body = PhotoPresignSchema.parse(request.body);
        const s3Key = generateS3Key(userId, 'photos', body.filename);
        const { uploadUrl } = await generateUploadPresignedUrl(s3Key, body.contentType);
        return { uploadUrl, s3Key, expiresIn: 3600 };
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

        return Promise.all(photos.map(async (photo) => ({
            id: photo.id,
            originalS3Key: photo.originalS3Key,
            originalUrl: await generateDownloadPresignedUrl(photo.originalS3Key),
            alignedS3Key: photo.alignedS3Key,
            alignedUrl: photo.alignedS3Key ? await generateDownloadPresignedUrl(photo.alignedS3Key) : null,
            category: photo.category,
            capturedAt: photo.capturedAt.toISOString(),
            weightKg: photo.weightKg,
            notes: photo.notes,
            alignmentStatus: photo.alignmentStatus,
        })));
    });

    app.post('/', async (request) => {
        const userId = (request as any).userId;
        const body = CreatePhotoSchema.parse(request.body);

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

        return {
            id: photo.id,
            originalS3Key: photo.originalS3Key,
            originalUrl: await generateDownloadPresignedUrl(photo.originalS3Key),
            alignedS3Key: null,
            alignedUrl: null,
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

        return {
            id: photo.id,
            originalS3Key: photo.originalS3Key,
            originalUrl: await generateDownloadPresignedUrl(photo.originalS3Key),
            alignedS3Key: photo.alignedS3Key,
            alignedUrl: photo.alignedS3Key ? await generateDownloadPresignedUrl(photo.alignedS3Key) : null,
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
