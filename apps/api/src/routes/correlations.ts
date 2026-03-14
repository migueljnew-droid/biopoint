import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { authMiddleware } from '../middleware/auth.js';
import { classifyChange } from '../utils/markerMeta.js';

export async function correlationsRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    // GET /stacks/:id/correlate
    // Returns biomarker changes correlated against the stack's start date
    app.get('/:id/correlate', async (request, reply) => {
        const userId = request.userId;
        const { id } = request.params as { id: string };

        // 1. Fetch stack and verify ownership
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

        const startDate = stack.startDate;

        // 2. Fetch ALL lab markers for this user ordered by recordedAt ascending
        const allMarkers = await prisma.labMarker.findMany({
            where: { userId },
            orderBy: { recordedAt: 'asc' },
            select: {
                id: true,
                name: true,
                value: true,
                unit: true,
                recordedAt: true,
            },
        });

        // 3. Group markers by normalized name (lowercase, trimmed)
        const groups: Record<
            string,
            {
                displayName: string;
                unit: string;
                entries: { value: number | null; recordedAt: Date }[];
            }
        > = {};

        for (const m of allMarkers) {
            const key = m.name.trim().toLowerCase();
            if (!groups[key]) {
                groups[key] = {
                    displayName: m.name,
                    unit: m.unit,
                    entries: [],
                };
            }
            // Update displayName to the most recent record's name (entries are ascending so last wins)
            groups[key]!.displayName = m.name;
            groups[key]!.entries.push({ value: m.value, recordedAt: m.recordedAt });
        }

        const totalMarkersTracked = Object.keys(groups).length;

        // 4. Compute correlations for markers that have data both before and after startDate
        type Correlation = {
            markerName: string;
            unit: string;
            beforeValue: number;
            beforeDate: string;
            afterValue: number;
            afterDate: string;
            percentChange: number | null;
            direction: ReturnType<typeof classifyChange>;
            dataPoints: { value: number; date: string }[];
        };

        const correlations: Correlation[] = [];

        for (const [normalizedName, group] of Object.entries(groups)) {
            const { displayName, unit, entries } = group;

            // Split into before/after, keeping only entries with a non-null numeric value
            const before = entries.filter(
                (e): e is { value: number; recordedAt: Date } =>
                    e.value !== null && e.recordedAt < startDate,
            );
            const after = entries.filter(
                (e): e is { value: number; recordedAt: Date } =>
                    e.value !== null && e.recordedAt >= startDate,
            );

            // Need at least one data point on each side
            if (before.length === 0 || after.length === 0) continue;

            // Most recent value before startDate (entries are ASC so last in array is most recent)
            const beforeEntry = before[before.length - 1]!;
            // Most recent value after startDate (last in ascending array)
            const afterEntry = after[after.length - 1]!;

            const beforeValue = beforeEntry.value;
            const afterValue = afterEntry.value;

            // Compute percent change; guard against zero-division
            let percentChange: number | null = null;
            if (beforeValue !== 0) {
                percentChange = ((afterValue - beforeValue) / beforeValue) * 100;
            }

            const direction =
                percentChange !== null
                    ? classifyChange(normalizedName, percentChange)
                    : 'changed';

            // Build dataPoints from all entries with non-null values (for charting)
            const dataPoints = entries
                .filter((e): e is { value: number; recordedAt: Date } => e.value !== null)
                .map((e) => ({
                    value: e.value,
                    date: e.recordedAt.toISOString(),
                }));

            correlations.push({
                markerName: displayName,
                unit,
                beforeValue,
                beforeDate: beforeEntry.recordedAt.toISOString(),
                afterValue,
                afterDate: afterEntry.recordedAt.toISOString(),
                percentChange:
                    percentChange !== null
                        ? Math.round(percentChange * 10) / 10
                        : null,
                direction,
                dataPoints,
            });
        }

        // 5. Sort by absolute percentChange descending (biggest movers first)
        //    Markers with null percentChange (beforeValue was 0) go to the end
        correlations.sort((a, b) => {
            if (a.percentChange === null && b.percentChange === null) return 0;
            if (a.percentChange === null) return 1;
            if (b.percentChange === null) return -1;
            return Math.abs(b.percentChange) - Math.abs(a.percentChange);
        });

        return {
            stackName: stack.name,
            stackStartDate: startDate.toISOString().split('T')[0],
            correlations,
            totalMarkersTracked,
            markersWithCorrelation: correlations.length,
            disclaimer:
                'Correlation does not imply causation. Changes may be due to other factors.',
        };
    });
}
