import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import {
    CreateStackSchema,
    UpdateStackSchema,
    CreateStackItemSchema,
    UpdateStackItemSchema,
    ComplianceEventSchema,
    CreateReminderSchema,
} from '@biopoint/shared';
import { authMiddleware } from '../middleware/auth.js';

export async function stacksRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    // List stacks
    app.get('/', async (request) => {
        const userId = request.userId;

        const stacks = await prisma.stack.findMany({
            where: { userId },
            include: {
                items: {
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return stacks.map((stack) => ({
            id: stack.id,
            userId: stack.userId,
            name: stack.name,
            goal: stack.goal,
            startDate: stack.startDate.toISOString(),
            isActive: stack.isActive,
            items: stack.items.map((item) => ({
                id: item.id,
                stackId: item.stackId,
                name: item.name,
                dose: item.dose,
                unit: item.unit,
                route: item.route,
                frequency: item.frequency,
                scheduleDays: (item as any).scheduleDays ?? [],
                timing: item.timing,
                cycleJson: item.cycleJson,
                notes: item.notes,
                isActive: item.isActive,
            })),
        }));
    });

    // Create stack
    app.post('/', async (request) => {
        const userId = request.userId;
        const body = CreateStackSchema.parse(request.body);

        const stack = await prisma.stack.create({
            data: {
                userId,
                name: body.name,
                goal: body.goal,
                startDate: body.startDate ? new Date(body.startDate) : new Date(),
            },
            include: { items: true },
        });

        return {
            id: stack.id,
            userId: stack.userId,
            name: stack.name,
            goal: stack.goal,
            startDate: stack.startDate.toISOString(),
            isActive: stack.isActive,
            items: [],
        };
    });

    // Get stack by ID
    app.get('/:id', async (request, reply) => {
        const userId = request.userId;
        const { id } = request.params as { id: string };

        const stack = await prisma.stack.findFirst({
            where: { id, userId },
            include: {
                items: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!stack) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Stack not found',
            });
        }

        return {
            id: stack.id,
            userId: stack.userId,
            name: stack.name,
            goal: stack.goal,
            startDate: stack.startDate.toISOString(),
            isActive: stack.isActive,
            items: stack.items.map((item) => ({
                id: item.id,
                stackId: item.stackId,
                name: item.name,
                dose: item.dose,
                unit: item.unit,
                route: item.route,
                frequency: item.frequency,
                scheduleDays: (item as any).scheduleDays ?? [],
                timing: item.timing,
                cycleJson: item.cycleJson,
                notes: item.notes,
                isActive: item.isActive,
            })),
        };
    });

    // Update stack
    app.put('/:id', async (request, reply) => {
        const userId = request.userId;
        const { id } = request.params as { id: string };
        const body = UpdateStackSchema.parse(request.body);

        const existing = await prisma.stack.findFirst({
            where: { id, userId },
        });

        if (!existing) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Stack not found',
            });
        }

        const stack = await prisma.stack.update({
            where: { id },
            data: {
                name: body.name,
                goal: body.goal,
                isActive: body.isActive,
            },
            include: { items: true },
        });

        return {
            id: stack.id,
            userId: stack.userId,
            name: stack.name,
            goal: stack.goal,
            startDate: stack.startDate.toISOString(),
            isActive: stack.isActive,
            items: stack.items.map((item) => ({
                id: item.id,
                stackId: item.stackId,
                name: item.name,
                dose: item.dose,
                unit: item.unit,
                route: item.route,
                frequency: item.frequency,
                scheduleDays: (item as any).scheduleDays ?? [],
                timing: item.timing,
                cycleJson: item.cycleJson,
                notes: item.notes,
                isActive: item.isActive,
            })),
        };
    });

    // Delete stack
    app.delete('/:id', async (request, reply) => {
        const userId = request.userId;
        const { id } = request.params as { id: string };

        const existing = await prisma.stack.findFirst({
            where: { id, userId },
        });

        if (!existing) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Stack not found',
            });
        }

        await prisma.stack.delete({ where: { id } });

        return { success: true };
    });

    // Add item to stack
    app.post('/:id/items', async (request, reply) => {
        const userId = request.userId;
        const { id } = request.params as { id: string };
        const body = CreateStackItemSchema.parse(request.body);

        const stack = await prisma.stack.findFirst({
            where: { id, userId },
        });

        if (!stack) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Stack not found',
            });
        }

        const item = await prisma.stackItem.create({
            data: {
                stackId: id,
                name: body.name,
                dose: body.dose,
                unit: body.unit,
                route: body.route,
                frequency: body.frequency,
                scheduleDays: body.scheduleDays || [],
                timing: body.timing,
                cycleJson: body.cycleJson,
                notes: body.notes,
                isActive: body.isActive,
            },
        });

        return {
            id: item.id,
            stackId: item.stackId,
            name: item.name,
            dose: item.dose,
            unit: item.unit,
            route: item.route,
            frequency: item.frequency,
            timing: item.timing,
            cycleJson: item.cycleJson,
            notes: item.notes,
            isActive: item.isActive,
        };
    });

    // Update stack item
    app.put('/:id/items/:itemId', async (request, reply) => {
        const userId = request.userId;
        const { id, itemId } = request.params as { id: string; itemId: string };
        const body = UpdateStackItemSchema.parse(request.body);

        const stack = await prisma.stack.findFirst({
            where: { id, userId },
        });

        if (!stack) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Stack not found',
            });
        }

        const item = await prisma.stackItem.update({
            where: { id: itemId },
            data: {
                name: body.name,
                dose: body.dose,
                unit: body.unit,
                route: body.route,
                frequency: body.frequency,
                scheduleDays: body.scheduleDays || [],
                timing: body.timing,
                cycleJson: body.cycleJson,
                notes: body.notes,
                isActive: body.isActive,
            },
        });

        return {
            id: item.id,
            stackId: item.stackId,
            name: item.name,
            dose: item.dose,
            unit: item.unit,
            route: item.route,
            frequency: item.frequency,
            scheduleDays: (item as any).scheduleDays || [],
            timing: item.timing,
            cycleJson: item.cycleJson,
            notes: item.notes,
            isActive: item.isActive,
        };
    });

    // Delete stack item
    app.delete('/:id/items/:itemId', async (request, reply) => {
        const userId = request.userId;
        const { id, itemId } = request.params as { id: string; itemId: string };

        const stack = await prisma.stack.findFirst({
            where: { id, userId },
        });

        if (!stack) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Stack not found',
            });
        }

        await prisma.stackItem.delete({ where: { id: itemId } });

        return { success: true };
    });

    // Log compliance event
    app.post('/compliance', async (request) => {
        const userId = request.userId;
        const body = ComplianceEventSchema.parse(request.body);

        const event = await prisma.complianceEvent.create({
            data: {
                userId,
                stackItemId: body.stackItemId,
                takenAt: body.takenAt ? new Date(body.takenAt) : new Date(),
                notes: body.notes,
            },
            include: {
                stackItem: {
                    select: { name: true },
                },
            },
        });

        return {
            id: event.id,
            stackItemId: event.stackItemId,
            stackItemName: event.stackItem.name,
            takenAt: event.takenAt.toISOString(),
            notes: event.notes,
        };
    });

    // Get compliance history
    app.get('/compliance', async (request) => {
        const userId = request.userId;
        const query = request.query as { days?: string };
        const days = parseInt(query.days || '7');

        const since = new Date();
        since.setDate(since.getDate() - days);

        const events = await prisma.complianceEvent.findMany({
            where: {
                userId,
                takenAt: { gte: since },
            },
            include: {
                stackItem: {
                    select: { name: true },
                },
            },
            orderBy: { takenAt: 'desc' },
        });

        return events.map((event) => ({
            id: event.id,
            stackItemId: event.stackItemId,
            stackItemName: event.stackItem.name,
            takenAt: event.takenAt.toISOString(),
            notes: event.notes,
        }));
    });
    // List reminders for an item
    app.get('/items/:itemId/reminders', async (request) => {
        const userId = request.userId;
        const { itemId } = request.params as { itemId: string };

        const reminders = await prisma.reminderSchedule.findMany({
            where: {
                userId,
                stackItemId: itemId,
            },
        });

        return reminders;
    });

    // Create reminder
    app.post('/items/:itemId/reminders', async (request, reply) => {
        const userId = request.userId;
        const { itemId } = request.params as { itemId: string };
        const body = CreateReminderSchema.omit({ stackItemId: true }).parse(request.body);

        const stackItem = await prisma.stackItem.findFirst({
            where: { id: itemId, stack: { userId } },
        });

        if (!stackItem) {
            return reply.status(404).send({ message: 'Stack item not found' });
        }

        const reminder = await prisma.reminderSchedule.create({
            data: {
                userId,
                stackItemId: itemId,
                time: body.time,
                daysOfWeek: body.daysOfWeek,
                isActive: true,
            },
        });

        return reminder;
    });

    // Delete reminder
    app.delete('/items/:itemId/reminders/:id', async (request, reply) => {
        const userId = request.userId;
        const { id } = request.params as { id: string };

        const reminder = await prisma.reminderSchedule.findFirst({
            where: { id, userId },
        });

        if (!reminder) {
            return reply.status(404).send({ message: 'Reminder not found' });
        }

        await prisma.reminderSchedule.delete({ where: { id } });

        return { success: true };
    });
}
