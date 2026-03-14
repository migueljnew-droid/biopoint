import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { PeptideSearchSchema } from '@biopoint/shared';
import { z } from 'zod';

const IdParamSchema = z.object({ id: z.string().min(1).max(128) });

function toCompoundResponse(c: {
    id: string;
    name: string;
    aliases: string[];
    category: string;
    goals: string[];
    typicalDoseMin: number;
    typicalDoseMax: number;
    typicalDoseUnit: string;
    halfLife: string;
    route: string;
    frequency: string;
    cycleProtocol: string;
    stackingNotes: string;
    citations: unknown;
    iuConversion: number | null;
    description: string;
}) {
    return {
        id: c.id,
        name: c.name,
        aliases: c.aliases,
        category: c.category,
        goals: c.goals,
        typicalDose: {
            min: c.typicalDoseMin,
            max: c.typicalDoseMax,
            unit: c.typicalDoseUnit,
        },
        halfLife: c.halfLife,
        route: c.route,
        frequency: c.frequency,
        cycleProtocol: c.cycleProtocol,
        stackingNotes: c.stackingNotes,
        citations: c.citations,
        iuConversion: c.iuConversion,
        description: c.description,
    };
}

export async function peptidesRoutes(app: FastifyInstance) {
    // GET /peptides — public, no auth required
    app.get('/', async (request, reply) => {
        const result = PeptideSearchSchema.safeParse(request.query);
        if (!result.success) {
            return reply.status(400).send({
                statusCode: 400,
                error: 'Bad Request',
                message: 'Invalid query parameters',
            });
        }

        const { query, category, goal, page, limit } = result.data;
        const skip = (page - 1) * limit;

        const where: NonNullable<Parameters<typeof prisma.peptideCompound.findMany>[0]>['where'] = {};

        if (query) {
            where.OR = [
                { name: { contains: query, mode: 'insensitive' } },
                { aliases: { has: query } },
            ];
        }

        if (category) {
            where.category = category;
        }

        if (goal) {
            where.goals = { has: goal };
        }

        const [compounds, total] = await Promise.all([
            prisma.peptideCompound.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: 'asc' },
            }),
            prisma.peptideCompound.count({ where }),
        ]);

        return {
            data: compounds.map(toCompoundResponse),
            total,
            page,
            limit,
            hasMore: skip + compounds.length < total,
        };
    });

    // GET /peptides/:id — public, no auth required
    app.get('/:id', async (request, reply) => {
        const paramResult = IdParamSchema.safeParse(request.params);
        if (!paramResult.success) {
            return reply.status(400).send({
                statusCode: 400,
                error: 'Bad Request',
                message: 'Invalid compound ID',
            });
        }

        const { id } = paramResult.data;

        const compound = await prisma.peptideCompound.findUnique({
            where: { id },
        });

        if (!compound) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Peptide compound not found',
            });
        }

        return toCompoundResponse(compound);
    });
}
