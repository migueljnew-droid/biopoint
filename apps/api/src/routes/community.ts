import type { FastifyInstance } from 'fastify';
import { prisma, Prisma } from '@biopoint/db';
import { CreateGroupSchema, CreatePostSchema, ForkTemplateSchema } from '@biopoint/shared';
import { authMiddleware } from '../middleware/auth.js';

function getUserHandle(userId: string): string {
    const suffix = userId.slice(-6);
    return `user_${suffix}`;
}

function getUserAvatar(userId: string): string {
    const char = userId.slice(0, 1) || 'U';
    return char.toUpperCase();
}

export async function communityRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    // Get leaderboard
    app.get('/leaderboard', async (request) => {
        const userId = request.userId;

        // 1. Get real top scores
        const recentScores = await prisma.bioPointScore.findMany({
            orderBy: { score: 'desc' },
            take: 50,
            select: { userId: true, score: true },
        });

        const uniqueLeaders = new Map();
        for (const s of recentScores) {
            if (!uniqueLeaders.has(s.userId)) {
                uniqueLeaders.set(s.userId, {
                    id: s.userId,
                    name: getUserHandle(s.userId),
                    score: s.score,
                    trend: '+0',
                    avatar: getUserAvatar(s.userId),
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
                select: { userId: true, score: true },
            });

            if (userLastScore) {
                leaderboard.push({
                    id: userId,
                    name: getUserHandle(userId),
                    score: userLastScore.score,
                    trend: '+0',
                    avatar: getUserAvatar(userId),
                    elite: userLastScore.score >= 90,
                    isUser: true
                });
            }
        }

        // Sort
        return leaderboard.sort((a, b) => b.score - a.score);
    });

    // List groups
    app.get('/groups', async (request) => {
        const userId = request.userId;
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
        const userId = request.userId;
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
        const userId = request.userId;
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
        const userId = request.userId;
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
        const userId = request.userId;
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
            orderBy: { createdAt: 'desc' },
        });

        return posts.map((p) => ({
            id: p.id, groupId: p.groupId, userId: p.userId, authorHandle: getUserHandle(p.userId), content: p.content, createdAt: p.createdAt.toISOString(),
        }));
    });

    // Create post
    app.post('/groups/:id/posts', async (request, reply) => {
        const userId = request.userId;
        const { id } = request.params as { id: string };
        const body = CreatePostSchema.parse(request.body);

        const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: id, userId } } });
        if (!member) return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Must be a member to post' });

        const post = await prisma.post.create({
            data: { groupId: id, userId, content: body.content },
        });

        return { id: post.id, groupId: post.groupId, userId: post.userId, authorHandle: getUserHandle(post.userId), content: post.content, createdAt: post.createdAt.toISOString() };
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
        const userId = request.userId;
        const { id } = request.params as { id: string };
        const body = ForkTemplateSchema.parse(request.body);

        const template = await prisma.stackTemplate.findUnique({ where: { id } });
        if (!template) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Template not found' });

        interface TemplateItem { name: string; dose: number; unit: string; route?: string; frequency: string; timing?: string; }
        const rawItems = (template.itemsJson as Prisma.JsonArray) ?? [];
        const typedItems = rawItems.map((item) => {
            const i = item as Record<string, unknown>;
            return {
                name: String(i['name'] ?? ''),
                dose: Number(i['dose'] ?? 0),
                unit: String(i['unit'] ?? ''),
                route: i['route'] !== undefined ? String(i['route']) : undefined,
                frequency: String(i['frequency'] ?? 'Daily'),
                timing: i['timing'] !== undefined ? String(i['timing']) : undefined,
            } satisfies TemplateItem;
        });
        const stack = await prisma.stack.create({
            data: {
                userId, name: body.stackName || template.name, goal: template.goal,
                items: { create: typedItems },
            },
            include: { items: true },
        });

        await prisma.stackTemplate.update({ where: { id }, data: { forkCount: { increment: 1 } } });

        return { id: stack.id, name: stack.name, goal: stack.goal, items: stack.items };
    });
}
