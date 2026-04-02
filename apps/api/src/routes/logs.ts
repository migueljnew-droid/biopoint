import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { DailyLogSchema } from '@biopoint/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/auditLog.js';
import { recalculateBioPointScore } from '../services/scoreCalculator.js';

export async function logsRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    // Create or update daily log
    app.post('/', async (request) => {
        const userId = request.userId;
        const body = DailyLogSchema.parse(request.body);

        const date = new Date(body.date);

        const log = await prisma.dailyLog.upsert({
            where: {
                userId_date: {
                    userId,
                    date,
                },
            },
            update: {
                weightKg: body.weightKg,
                sleepHours: body.sleepHours,
                sleepQuality: body.sleepQuality,
                energyLevel: body.energyLevel,
                focusLevel: body.focusLevel,
                moodLevel: body.moodLevel,
                notes: body.notes,
            },
            create: {
                userId,
                date,
                weightKg: body.weightKg,
                sleepHours: body.sleepHours,
                sleepQuality: body.sleepQuality,
                energyLevel: body.energyLevel,
                focusLevel: body.focusLevel,
                moodLevel: body.moodLevel,
                notes: body.notes,
            },
        });

        // Auto-recalculate BioPoint score after every log save
        await recalculateBioPointScore(userId).catch(console.error);

        return {
            id: log.id,
            date: log.date.toISOString(),
            weightKg: log.weightKg,
            sleepHours: log.sleepHours,
            sleepQuality: log.sleepQuality,
            energyLevel: log.energyLevel,
            focusLevel: log.focusLevel,
            moodLevel: log.moodLevel,
            notes: log.notes,
        };
    });

    // Get logs (paginated)
    app.get('/', async (request) => {
        const userId = request.userId;
        const query = request.query as { page?: string; limit?: string };
        const page = parseInt(query.page || '1');
        const limit = parseInt(query.limit || '30');
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            prisma.dailyLog.findMany({
                where: { userId },
                orderBy: { date: 'desc' },
                skip,
                take: limit,
            }),
            prisma.dailyLog.count({ where: { userId } }),
        ]);

        // Audit log for daily logs list access (SEC-04: log unconditionally, including empty results)
        await createAuditLog(request, {
            action: 'READ',
            entityType: 'DailyLog',
            entityId: 'list',
            metadata: { resultCount: logs.length, page, limit },
        });

        return {
            data: logs.map((log) => ({
                id: log.id,
                date: log.date.toISOString(),
                weightKg: log.weightKg,
                sleepHours: log.sleepHours,
                sleepQuality: log.sleepQuality,
                energyLevel: log.energyLevel,
                focusLevel: log.focusLevel,
                moodLevel: log.moodLevel,
                notes: log.notes,
            })),
            total,
            page,
            limit,
            hasMore: skip + logs.length < total,
        };
    });

    // Get log by date
    app.get('/:date', async (request, reply) => {
        const userId = request.userId;
        const { date } = request.params as { date: string };

        const log = await prisma.dailyLog.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: new Date(date),
                },
            },
        });

        if (!log) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Log not found for this date',
            });
        }

        // Audit log for daily log access
        await createAuditLog(request, {
            action: 'READ',
            entityType: 'DailyLog',
            entityId: log.id,
            metadata: { date: log.date.toISOString() },
        });

        return {
            id: log.id,
            date: log.date.toISOString(),
            weightKg: log.weightKg,
            sleepHours: log.sleepHours,
            sleepQuality: log.sleepQuality,
            energyLevel: log.energyLevel,
            focusLevel: log.focusLevel,
            moodLevel: log.moodLevel,
            notes: log.notes,
        };
    });
}
