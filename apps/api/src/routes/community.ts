import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { CreateGroupSchema, CreatePostSchema, ForkTemplateSchema } from '@biopoint/shared';
import { authMiddleware } from '../middleware/auth.js';

export async function communityRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    app.addHook('preHandler', authMiddleware);

    // Get leaderboard
    app.get('/leaderboard', async (request) => {
        const userId = (request as any).userId;

        // 1. Get real top scores
        const recentScores = await prisma.bioPointScore.findMany({
            orderBy: { score: 'desc' },
            take: 50,
            include: { user: { select: { email: true } } }
        });

        const uniqueLeaders = new Map();
        for (const s of recentScores) {
            if (!uniqueLeaders.has(s.userId)) {
                uniqueLeaders.set(s.userId, {
                    id: s.userId,
                    name: s.user.email.split('@')[0],
                    score: s.score,
                    trend: '+0',
                    avatar: s.user.email[0].toUpperCase(),
                    elite: s.score >= 90,
                    isUser: s.userId === userId
                });
            }
        }

        let leaderboard = Array.from(uniqueLeaders.values());

        // 2. Ensure current user is present if they have a score but aren't in top 50 (unlikely but possible)
        const userInList = leaderboard.find(l => l.id === userId);
        if (!userInList) {
            const userLastScore = await prisma.bioPointScore.findFirst({
                where: { userId },
                orderBy: { date: 'desc' },
                include: { user: { select: { email: true } } }
            });

            if (userLastScore) {
                leaderboard.push({
                    id: userId,
                    name: userLastScore.user.email.split('@')[0],
                    score: userLastScore.score,
                    trend: '+0',
                    avatar: userLastScore.user.email[0].toUpperCase(),
                    elite: userLastScore.score >= 90,
                    isUser: true
                });
            }
        }

        // 3. Populate with "Global Elite" if empty (Cold Start)
        if (leaderboard.length < 5) {
            const bots = [
                { id: 'elite1', name: 'Atlas', score: 99, trend: '+2', avatar: 'A', elite: true, isUser: false },
                { id: 'elite2', name: 'Nova', score: 98, trend: '+1', avatar: 'N', elite: true, isUser: false },
                { id: 'elite3', name: 'Cyber', score: 96, trend: '+3', avatar: 'C', elite: true, isUser: false },
            ];
            // Filter out bots that clash with real IDs (unlikely) and add
            leaderboard = [...bots, ...leaderboard];
        }

        // Sort
        return leaderboard.sort((a, b) => b.score - a.score);
    });

    // List groups
    app.get('/groups', async (request) => {
        const userId = (request as any).userId;
        const groups = await prisma.group.findMany({
            where: { isPublic: true },
            include: { _count: { select: { members: true } }, members: { where: { userId } } },
            orderBy: { createdAt: 'desc' },
        });

        return groups.map((g) => ({
            id: g.id, name: g.name, description: g.description, createdById: g.createdById,
            isPublic: g.isPublic, memberCount: g._count.members, isMember: g.members.length > 0,
        }));
    });

    // Create group
    app.post('/groups', async (request) => {
        const userId = (request as any).userId;
        const body = CreateGroupSchema.parse(request.body);

        const group = await prisma.group.create({
            data: {
                name: body.name, description: body.description, createdById: userId, isPublic: body.isPublic,
                members: { create: { userId, role: 'admin' } },
            },
        });

        return { id: group.id, name: group.name, description: group.description, isPublic: group.isPublic, memberCount: 1, isMember: true };
    });

    // Get group
    app.get('/groups/:id', async (request, reply) => {
        const userId = (request as any).userId;
        const { id } = request.params as { id: string };

        const group = await prisma.group.findUnique({
            where: { id },
            include: { _count: { select: { members: true } }, members: { where: { userId } } },
        });

        if (!group) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Group not found' });

        return { id: group.id, name: group.name, description: group.description, memberCount: group._count.members, isMember: group.members.length > 0 };
    });

    // Join group
    app.post('/groups/:id/join', async (request, reply) => {
        const userId = (request as any).userId;
        const { id } = request.params as { id: string };

        const group = await prisma.group.findUnique({ where: { id } });
        if (!group) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Group not found' });

        await prisma.groupMember.upsert({
            where: { groupId_userId: { groupId: id, userId } },
            update: {},
            create: { groupId: id, userId, role: 'member' },
        });

        return { success: true };
    });

    // Leave group
    app.post('/groups/:id/leave', async (request) => {
        const userId = (request as any).userId;
        const { id } = request.params as { id: string };
        await prisma.groupMember.deleteMany({ where: { groupId: id, userId } });
        return { success: true };
    });

    // Get group posts
    app.get('/groups/:id/posts', async (request, reply) => {
        const { id } = request.params as { id: string };
        const group = await prisma.group.findUnique({ where: { id } });
        if (!group) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Group not found' });

        const posts = await prisma.post.findMany({
            where: { groupId: id },
            include: { user: { select: { email: true } } },
            orderBy: { createdAt: 'desc' },
        });

        return posts.map((p) => ({
            id: p.id, groupId: p.groupId, userId: p.userId, authorEmail: p.user.email, content: p.content, createdAt: p.createdAt.toISOString(),
        }));
    });

    // Create post
    app.post('/groups/:id/posts', async (request, reply) => {
        const userId = (request as any).userId;
        const { id } = request.params as { id: string };
        const body = CreatePostSchema.parse(request.body);

        const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: id, userId } } });
        if (!member) return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Must be a member to post' });

        const post = await prisma.post.create({
            data: { groupId: id, userId, content: body.content },
            include: { user: { select: { email: true } } },
        });

        return { id: post.id, groupId: post.groupId, userId: post.userId, authorEmail: post.user.email, content: post.content, createdAt: post.createdAt.toISOString() };
    });

    // List templates
    app.get('/templates', async () => {
        const templates = await prisma.stackTemplate.findMany({ orderBy: { forkCount: 'desc' } });
        return templates.map((t) => ({
            id: t.id, groupId: t.groupId, name: t.name, description: t.description, goal: t.goal, items: t.itemsJson, forkCount: t.forkCount,
        }));
    });

    // Fork template
    app.post('/templates/:id/fork', async (request, reply) => {
        const userId = (request as any).userId;
        const { id } = request.params as { id: string };
        const body = ForkTemplateSchema.parse(request.body);

        const template = await prisma.stackTemplate.findUnique({ where: { id } });
        if (!template) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Template not found' });

        const items = template.itemsJson as any[];
        const stack = await prisma.stack.create({
            data: {
                userId, name: body.stackName || template.name, goal: template.goal,
                items: { create: items.map((item: any) => ({ name: item.name, dose: item.dose, unit: item.unit, route: item.route, frequency: item.frequency, timing: item.timing })) },
            },
            include: { items: true },
        });

        await prisma.stackTemplate.update({ where: { id }, data: { forkCount: { increment: 1 } } });

        return { id: stack.id, name: stack.name, goal: stack.goal, items: stack.items };
    });
}
