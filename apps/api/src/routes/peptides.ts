import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { PeptideSearchSchema } from '@biopoint/shared';

export async function peptidesRoutes(app: FastifyInstance) {
    // GET /peptides — public, no auth required
    app.get('/', async (request, reply) => {
        const params = PeptideSearchSchema.parse(request.query);
        const { query, category, goal, page, limit } = params;

        const skip = (page - 1) * limit;

        const where: Parameters<typeof prisma.peptideCompound.findMany>[0]['where'] = {};

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

        const data = compounds.map((c) => ({
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
        }));

        return {
            data,
            total,
            page,
            limit,
            hasMore: skip + compounds.length < total,
        };
    });

    // GET /peptides/:id — public, no auth required
    app.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

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

        return {
            id: compound.id,
            name: compound.name,
            aliases: compound.aliases,
            category: compound.category,
            goals: compound.goals,
            typicalDose: {
                min: compound.typicalDoseMin,
                max: compound.typicalDoseMax,
                unit: compound.typicalDoseUnit,
            },
            halfLife: compound.halfLife,
            route: compound.route,
            frequency: compound.frequency,
            cycleProtocol: compound.cycleProtocol,
            stackingNotes: compound.stackingNotes,
            citations: compound.citations,
            iuConversion: compound.iuConversion,
            description: compound.description,
        };
    });
}
