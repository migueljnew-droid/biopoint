import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@biopoint/db';
import { createAuditLog } from '../middleware/auditLog.js';
import { authMiddleware } from '../middleware/auth.js';

interface MarkerTrend {
    markerName: string;
    unit: string | null;
    dataPoints: {
        date: string;
        value: number | null;
        refRangeLow: number | null;
        refRangeHigh: number | null;
    }[];
}

export async function biopointRoutes(app: FastifyInstance) {
    // BioPoint history
    app.get('/history', { preHandler: authMiddleware }, async (request: FastifyRequest, _reply: FastifyReply) => {
        const userId = request.userId;
        const scores = await prisma.bioPointScore.findMany({
            where: { userId },
            orderBy: { date: 'desc' },
            take: 30,
        });

        // SEC-04: log unconditionally, including empty results
        await createAuditLog(request, {
            action: 'READ',
            entityType: 'BioPointScore',
            entityId: 'history',
            metadata: { resultCount: scores.length },
        });

        return scores;
    });

    // Lab markers list
    app.get('/markers', { preHandler: authMiddleware }, async (request: FastifyRequest, _reply: FastifyReply) => {
        const userId = request.userId;
        const markers = await prisma.labMarker.findMany({
            where: { userId },
            orderBy: { recordedAt: 'desc' },
        });

        // SEC-04: log unconditionally, including empty results
        await createAuditLog(request, {
            action: 'READ',
            entityType: 'LabMarker',
            entityId: 'list',
            metadata: { resultCount: markers.length },
        });

        return markers;
    });

    // Lab marker trends
    app.get('/markers/trends', { preHandler: authMiddleware }, async (request: FastifyRequest, _reply: FastifyReply) => {
        const userId = request.userId;
        const markers = await prisma.labMarker.findMany({
            where: { userId },
            orderBy: { recordedAt: 'asc' },
        });

        // SEC-04: log unconditionally, including empty results
        await createAuditLog(request, {
            action: 'READ',
            entityType: 'LabMarker',
            entityId: 'trends',
            metadata: { resultCount: markers.length },
        });

        const trends: Record<string, MarkerTrend> = {};
        for (const marker of markers) {
            if (!trends[marker.name]) {
                trends[marker.name] = {
                    markerName: marker.name,
                    unit: marker.unit,
                    dataPoints: [],
                };
            }
            trends[marker.name]!.dataPoints.push({
                date: marker.recordedAt.toISOString(),
                value: marker.value,
                refRangeLow: marker.refRangeLow,
                refRangeHigh: marker.refRangeHigh,
            });
        }

        return Object.values(trends);
    });
}
