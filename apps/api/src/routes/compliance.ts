import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { authMiddleware } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/auditLog.js';
import {
    createBreachIncident,
    updateBreachIncident,
    listBreachIncidents,
    getBreachIncident,
    checkNotificationDeadlines,
    getBreachStats,
} from '../services/breachNotification.js';

/**
 * Compliance Routes
 * - HIPAA §164.528: Accounting of Disclosures
 * - HIPAA §164.400-414: Breach Notification
 * - GDPR Art. 33/34: Breach Notification
 * - SOC 2 / ISO 27001: Compliance Audit Tracking
 */
export async function complianceRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    // ==========================================
    // HIPAA §164.528 - Accounting of Disclosures
    // ==========================================

    // POST /disclosures - Log a PHI disclosure
    app.post('/disclosures', async (request, reply) => {
        const userId = request.userId;
        const body = request.body as {
            recipientName: string;
            recipientType: string;
            purpose: string;
            dataDisclosed: string;
            legalBasis: string;
            method?: string;
            requestedBy?: string;
            approvedBy?: string;
            notes?: string;
        };

        if (!body.recipientName || !body.purpose || !body.dataDisclosed || !body.legalBasis) {
            return reply.status(400).send({
                statusCode: 400,
                error: 'Bad Request',
                message: 'recipientName, purpose, dataDisclosed, and legalBasis are required.',
            });
        }

        const disclosure = await prisma.disclosureLog.create({
            data: {
                userId,
                recipientName: body.recipientName,
                recipientType: body.recipientType || 'other',
                purpose: body.purpose,
                dataDisclosed: body.dataDisclosed,
                legalBasis: body.legalBasis,
                method: body.method,
                requestedBy: body.requestedBy,
                approvedBy: body.approvedBy,
                notes: body.notes,
            },
        });

        await createAuditLog(request, {
            action: 'CREATE',
            entityType: 'DisclosureLog',
            entityId: disclosure.id,
            metadata: { recipientType: body.recipientType, purpose: body.purpose },
        });

        return disclosure;
    });

    // GET /disclosures - List disclosures for current user (HIPAA right to accounting)
    app.get('/disclosures', async (request) => {
        const userId = request.userId;
        const query = request.query as { page?: string; limit?: string; from?: string; to?: string };
        const page = parseInt(query.page || '1');
        const limit = parseInt(query.limit || '50');
        const skip = (page - 1) * limit;

        const where: any = { userId };
        if (query.from || query.to) {
            where.dateOfDisclosure = {};
            if (query.from) where.dateOfDisclosure.gte = new Date(query.from);
            if (query.to) where.dateOfDisclosure.lte = new Date(query.to);
        }

        const [disclosures, total] = await Promise.all([
            prisma.disclosureLog.findMany({
                where,
                orderBy: { dateOfDisclosure: 'desc' },
                skip,
                take: limit,
            }),
            prisma.disclosureLog.count({ where }),
        ]);

        await createAuditLog(request, {
            action: 'READ',
            entityType: 'DisclosureLog',
            entityId: 'list',
            metadata: { count: disclosures.length },
        });

        return {
            data: disclosures,
            total,
            page,
            limit,
            hasMore: skip + disclosures.length < total,
        };
    });

    // ==========================================
    // Breach Notification (HIPAA + GDPR)
    // ==========================================

    // POST /breaches - Report a new breach
    app.post('/breaches', async (request, reply) => {
        const userId = request.userId;
        const body = request.body as {
            title: string;
            description: string;
            severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
            dataTypesAffected: string[];
            individualsAffected?: number;
        };

        if (!body.title || !body.description || !body.severity) {
            return reply.status(400).send({
                statusCode: 400,
                error: 'Bad Request',
                message: 'title, description, and severity are required.',
            });
        }

        const incident = await createBreachIncident({
            reportedById: userId,
            title: body.title,
            description: body.description,
            severity: body.severity,
            dataTypesAffected: body.dataTypesAffected || [],
            individualsAffected: body.individualsAffected,
        }, request);

        return incident;
    });

    // GET /breaches - List all breach incidents
    app.get('/breaches', async (request) => {
        const query = request.query as { status?: string; severity?: string };
        const incidents = await listBreachIncidents({
            status: query.status,
            severity: query.severity,
        });

        await createAuditLog(request, {
            action: 'READ',
            entityType: 'BreachIncident',
            entityId: 'list',
            metadata: { count: incidents.length },
        });

        return incidents;
    });

    // GET /breaches/stats - Breach statistics
    app.get('/breaches/stats', async () => {
        return getBreachStats();
    });

    // GET /breaches/deadlines - Check notification deadlines
    app.get('/breaches/deadlines', async () => {
        return checkNotificationDeadlines();
    });

    // GET /breaches/:id - Get single breach
    app.get('/breaches/:id', async (request) => {
        const { id } = request.params as { id: string };
        return getBreachIncident(id);
    });

    // PUT /breaches/:id - Update breach status/details
    app.put('/breaches/:id', async (request, _reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as {
            status?: 'DETECTED' | 'INVESTIGATING' | 'CONTAINED' | 'NOTIFIED' | 'RESOLVED' | 'CLOSED';
            containedAt?: string;
            rootCause?: string;
            remediationSteps?: string;
            lessonsLearned?: string;
            individualsAffected?: number;
            hhsNotifiedAt?: string;
            dpaNotifiedAt?: string;
            individualsNotifiedAt?: string;
        };

        const input: any = { ...body };
        // Convert string dates to Date objects
        if (body.containedAt) input.containedAt = new Date(body.containedAt);
        if (body.hhsNotifiedAt) input.hhsNotifiedAt = new Date(body.hhsNotifiedAt);
        if (body.dpaNotifiedAt) input.dpaNotifiedAt = new Date(body.dpaNotifiedAt);
        if (body.individualsNotifiedAt) input.individualsNotifiedAt = new Date(body.individualsNotifiedAt);

        const updated = await updateBreachIncident(id, input, request);
        return updated;
    });

    // ==========================================
    // Compliance Audit Tracking (SOC 2, ISO 27001)
    // ==========================================

    // POST /audits - Create/update a compliance control assessment
    app.post('/audits', async (request, reply) => {
        const userId = request.userId;
        const body = request.body as {
            framework: 'HIPAA' | 'GDPR' | 'SOC2' | 'ISO27001';
            controlId: string;
            controlName: string;
            status: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'NOT_ASSESSED';
            findings?: string;
            evidence?: string;
            remediationPlan?: string;
            dueDate?: string;
        };

        if (!body.framework || !body.controlId || !body.controlName) {
            return reply.status(400).send({
                statusCode: 400,
                error: 'Bad Request',
                message: 'framework, controlId, and controlName are required.',
            });
        }

        // Upsert: update if control already assessed, create otherwise
        const audit = await prisma.complianceAudit.upsert({
            where: {
                framework_controlId: {
                    framework: body.framework,
                    controlId: body.controlId,
                },
            },
            update: {
                status: body.status,
                findings: body.findings,
                evidence: body.evidence,
                remediationPlan: body.remediationPlan,
                dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
                completedAt: body.status === 'COMPLIANT' ? new Date() : undefined,
                auditedById: userId,
            },
            create: {
                framework: body.framework,
                controlId: body.controlId,
                controlName: body.controlName,
                status: body.status,
                findings: body.findings,
                evidence: body.evidence,
                remediationPlan: body.remediationPlan,
                dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
                completedAt: body.status === 'COMPLIANT' ? new Date() : undefined,
                auditedById: userId,
            },
        });

        await createAuditLog(request, {
            action: 'CREATE',
            entityType: 'ComplianceAudit',
            entityId: audit.id,
            metadata: { framework: body.framework, controlId: body.controlId, status: body.status },
        });

        return audit;
    });

    // GET /audits - List compliance controls by framework
    app.get('/audits', async (request) => {
        const query = request.query as { framework?: string; status?: string };
        const where: any = {};
        if (query.framework) where.framework = query.framework;
        if (query.status) where.status = query.status;

        const audits = await prisma.complianceAudit.findMany({
            where,
            orderBy: [{ framework: 'asc' }, { controlId: 'asc' }],
        });

        return audits;
    });

    // ==========================================
    // Compliance Dashboard (aggregated status)
    // ==========================================

    // GET /dashboard - Full compliance status across all frameworks
    app.get('/dashboard', async () => {
        // Framework compliance scores
        const frameworks = ['HIPAA', 'GDPR', 'SOC2', 'ISO27001'] as const;
        const frameworkStatus: Record<string, {
            total: number;
            compliant: number;
            partial: number;
            nonCompliant: number;
            notAssessed: number;
            score: number;
        }> = {};

        for (const fw of frameworks) {
            const [total, compliant, partial, nonCompliant] = await Promise.all([
                prisma.complianceAudit.count({ where: { framework: fw } }),
                prisma.complianceAudit.count({ where: { framework: fw, status: 'COMPLIANT' } }),
                prisma.complianceAudit.count({ where: { framework: fw, status: 'PARTIAL' } }),
                prisma.complianceAudit.count({ where: { framework: fw, status: 'NON_COMPLIANT' } }),
            ]);
            const notAssessed = total - compliant - partial - nonCompliant;
            const score = total > 0
                ? Math.round(((compliant + partial * 0.5) / total) * 100)
                : 0;

            frameworkStatus[fw] = { total, compliant, partial, nonCompliant, notAssessed, score };
        }

        // Breach summary
        const breachStats = await getBreachStats();
        const deadlines = await checkNotificationDeadlines();

        // Recent disclosures count (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentDisclosures = await prisma.disclosureLog.count({
            where: { dateOfDisclosure: { gte: thirtyDaysAgo } },
        });

        // Recent audit log count
        const recentAuditLogs = await prisma.auditLog.count({
            where: { createdAt: { gte: thirtyDaysAgo } },
        });

        // Consent statistics
        const totalUsers = await prisma.user.count();
        const usersWithConsent = await prisma.consentRecord.groupBy({
            by: ['userId'],
        });

        // Pending deletion requests
        const pendingDeletions = await prisma.deletionRequest.count({
            where: { status: 'PENDING' },
        });

        return {
            frameworks: frameworkStatus,
            breaches: {
                ...breachStats,
                overdueHipaa: deadlines.hipaaOverdue.length,
                overdueGdpr: deadlines.gdprOverdue.length,
            },
            disclosures: {
                last30Days: recentDisclosures,
            },
            auditActivity: {
                logsLast30Days: recentAuditLogs,
            },
            dataSubjectRights: {
                totalUsers,
                usersWithConsentRecords: usersWithConsent.length,
                pendingDeletionRequests: pendingDeletions,
            },
            lastUpdated: new Date().toISOString(),
        };
    });
}
