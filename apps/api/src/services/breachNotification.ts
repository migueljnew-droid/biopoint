import { prisma } from '@biopoint/db';
import type { BreachSeverity } from '@biopoint/db';
import { createAuditLog } from '../middleware/auditLog.js';

/**
 * Breach Notification Service
 * HIPAA §164.400-414 + GDPR Articles 33/34
 *
 * HIPAA Requirements:
 *   - Notify affected individuals within 60 days of discovery
 *   - Notify HHS if >=500 individuals affected (immediate media notice too)
 *   - Notify HHS annually for <500 individuals
 *
 * GDPR Requirements:
 *   - Notify supervisory authority within 72 hours of awareness
 *   - Notify affected individuals "without undue delay" if high risk
 */

export interface CreateBreachInput {
  reportedById: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dataTypesAffected: string[];
  individualsAffected?: number;
}

export interface UpdateBreachInput {
  status?: 'DETECTED' | 'INVESTIGATING' | 'CONTAINED' | 'NOTIFIED' | 'RESOLVED' | 'CLOSED';
  containedAt?: Date;
  rootCause?: string;
  remediationSteps?: string;
  lessonsLearned?: string;
  individualsAffected?: number;
  hhsNotifiedAt?: Date;
  dpaNotifiedAt?: Date;
  individualsNotifiedAt?: Date;
}

/**
 * Create a new breach incident
 */
export async function createBreachIncident(
  input: CreateBreachInput,
  request?: any,
): Promise<any> {
  const incident = await prisma.breachIncident.create({
    data: {
      reportedById: input.reportedById,
      title: input.title,
      description: input.description,
      severity: input.severity,
      dataTypesAffected: input.dataTypesAffected,
      individualsAffected: input.individualsAffected ?? 0,
      status: 'DETECTED',
      discoveredAt: new Date(),
    },
  });

  if (request) {
    await createAuditLog(request, {
      action: 'CREATE',
      entityType: 'BreachIncident',
      entityId: incident.id,
      metadata: {
        severity: input.severity,
        dataTypes: input.dataTypesAffected,
      },
    });
  }

  return incident;
}

/**
 * Update a breach incident (status transitions, notification timestamps)
 */
export async function updateBreachIncident(
  id: string,
  input: UpdateBreachInput,
  request?: any,
): Promise<any> {
  const existing = await prisma.breachIncident.findUnique({ where: { id } });
  if (!existing) throw new Error('Breach incident not found');

  const data: any = { ...input };
  if (input.status === 'CLOSED') {
    data.closedAt = new Date();
  }

  const updated = await prisma.breachIncident.update({
    where: { id },
    data,
  });

  if (request) {
    await createAuditLog(request, {
      action: 'UPDATE',
      entityType: 'BreachIncident',
      entityId: id,
      metadata: {
        previousStatus: existing.status,
        newStatus: input.status ?? existing.status,
      },
    });
  }

  return updated;
}

/**
 * Get all breach incidents with optional filters
 */
export async function listBreachIncidents(filters?: {
  status?: string;
  severity?: string;
}): Promise<any[]> {
  const where: any = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.severity) where.severity = filters.severity;

  return prisma.breachIncident.findMany({
    where,
    orderBy: { discoveredAt: 'desc' },
  });
}

/**
 * Get a single breach incident by ID
 */
export async function getBreachIncident(id: string): Promise<any> {
  const incident = await prisma.breachIncident.findUnique({ where: { id } });
  if (!incident) throw new Error('Breach incident not found');
  return incident;
}

/**
 * Check notification deadlines and return overdue items
 */
export async function checkNotificationDeadlines(): Promise<{
  hipaaOverdue: any[];
  gdprOverdue: any[];
}> {
  const now = new Date();

  // HIPAA: 60 days from discovery
  const hipaaDeadline = new Date(now);
  hipaaDeadline.setDate(hipaaDeadline.getDate() - 60);

  const hipaaOverdue = await prisma.breachIncident.findMany({
    where: {
      discoveredAt: { lt: hipaaDeadline },
      individualsNotifiedAt: null,
      status: { notIn: ['CLOSED', 'RESOLVED'] },
    },
    orderBy: { discoveredAt: 'asc' },
  });

  // GDPR: 72 hours from discovery
  const gdprDeadline = new Date(now);
  gdprDeadline.setHours(gdprDeadline.getHours() - 72);

  const gdprOverdue = await prisma.breachIncident.findMany({
    where: {
      discoveredAt: { lt: gdprDeadline },
      dpaNotifiedAt: null,
      status: { notIn: ['CLOSED', 'RESOLVED'] },
    },
    orderBy: { discoveredAt: 'asc' },
  });

  return { hipaaOverdue, gdprOverdue };
}

/**
 * Get breach statistics summary
 */
export async function getBreachStats(): Promise<{
  total: number;
  open: number;
  closed: number;
  bySeverity: Record<string, number>;
  avgResolutionDays: number | null;
}> {
  const [total, open, closed] = await Promise.all([
    prisma.breachIncident.count(),
    prisma.breachIncident.count({ where: { status: { notIn: ['CLOSED', 'RESOLVED'] } } }),
    prisma.breachIncident.count({ where: { status: { in: ['CLOSED', 'RESOLVED'] } } }),
  ]);

  const bySeverity: Record<string, number> = {};
  for (const sev of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) {
    bySeverity[sev] = await prisma.breachIncident.count({
      where: { severity: sev as BreachSeverity },
    });
  }

  // Average resolution time for closed incidents
  const resolved = await prisma.breachIncident.findMany({
    where: { closedAt: { not: null } },
    select: { discoveredAt: true, closedAt: true },
  });

  let avgResolutionDays: number | null = null;
  if (resolved.length > 0) {
    const totalDays = resolved.reduce((sum, r) => {
      const diff = (r.closedAt!.getTime() - r.discoveredAt.getTime()) / (1000 * 60 * 60 * 24);
      return sum + diff;
    }, 0);
    avgResolutionDays = Math.round((totalDays / resolved.length) * 10) / 10;
  }

  return { total, open, closed, bySeverity, avgResolutionDays };
}
