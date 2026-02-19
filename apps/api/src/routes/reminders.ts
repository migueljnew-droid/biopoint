import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { CreateReminderSchema, UpdateReminderSchema } from '@biopoint/shared';
import { authMiddleware } from '../middleware/auth.js';

export async function remindersRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    app.get('/', async (request) => {
        const userId = request.userId;
        const reminders = await prisma.reminderSchedule.findMany({
            where: { userId },
            include: { stackItem: { select: { name: true } } },
            orderBy: { time: 'asc' },
        });

        return reminders.map((r) => ({
            id: r.id, stackItemId: r.stackItemId, stackItemName: r.stackItem.name,
            time: r.time, daysOfWeek: r.daysOfWeek, isActive: r.isActive,
        }));
    });

    app.post('/', async (request) => {
        const userId = request.userId;
        const body = CreateReminderSchema.parse(request.body);

        const reminder = await prisma.reminderSchedule.create({
            data: { userId, stackItemId: body.stackItemId, time: body.time, daysOfWeek: body.daysOfWeek, isActive: body.isActive },
            include: { stackItem: { select: { name: true } } },
        });

        return { id: reminder.id, stackItemId: reminder.stackItemId, stackItemName: reminder.stackItem.name, time: reminder.time, daysOfWeek: reminder.daysOfWeek, isActive: reminder.isActive };
    });

    app.put('/:id', async (request, reply) => {
        const userId = request.userId;
        const { id } = request.params as { id: string };
        const body = UpdateReminderSchema.parse(request.body);

        const existing = await prisma.reminderSchedule.findFirst({ where: { id, userId } });
        if (!existing) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Reminder not found' });

        const reminder = await prisma.reminderSchedule.update({
            where: { id },
            data: { time: body.time, daysOfWeek: body.daysOfWeek, isActive: body.isActive },
            include: { stackItem: { select: { name: true } } },
        });

        return { id: reminder.id, stackItemId: reminder.stackItemId, stackItemName: reminder.stackItem.name, time: reminder.time, daysOfWeek: reminder.daysOfWeek, isActive: reminder.isActive };
    });

    app.delete('/:id', async (request, reply) => {
        const userId = request.userId;
        const { id } = request.params as { id: string };

        const existing = await prisma.reminderSchedule.findFirst({ where: { id, userId } });
        if (!existing) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Reminder not found' });

        await prisma.reminderSchedule.delete({ where: { id } });
        return { success: true };
    });
}
