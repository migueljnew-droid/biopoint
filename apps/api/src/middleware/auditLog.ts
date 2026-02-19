import type { FastifyRequest } from 'fastify';
import { prisma, Prisma } from '@biopoint/db';
import type { RequestLogger } from '../utils/logger.js';

type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'SANITIZE';
type PhiEntityType =
    | 'LabReport'
    | 'LabMarker'
    | 'ProgressPhoto'
    | 'Profile'
    | 'DailyLog'
    | 'BioPointScore'
    | 'FastingProtocol'
    | 'FastingSession'
    | 'MealEntry'
    | 'FoodLog'
    | 'Request'
    | 'DataExport'
    | 'ExportNotifications'
    | 'AccountDeletionRequest'
    | 'BreachIncident'
    | 'ComplianceAudit'
    | 'ConsentWithdrawal'
    | 'DisclosureLog'
    | 'S3Url'
    | 'Stack'
    | 'CommunityPost'
    | 'Reminder'
    | 'UserAccount'
    | 'ConsentPreferences';

interface AuditContext {
    action: AuditAction;
    entityType: PhiEntityType;
    entityId: string;
    metadata?: Record<string, unknown>;
}

export async function createAuditLog(
    request: FastifyRequest,
    context: AuditContext
): Promise<void> {
    const userId = request.userId as string | undefined;
    const requestId = request.id as string | undefined;
    const logger = request.log as RequestLogger | undefined;

    // Redact sensitive fields from metadata
    const redactedMetadata = context.metadata
        ? redactSensitiveFields(context.metadata)
        : undefined;

    // Add request ID to metadata if available
    const enrichedMetadata = redactedMetadata || requestId
        ? {
            ...(redactedMetadata || {}),
            ...(requestId && { reqId: requestId }),
        }
        : undefined;

    try {
        await prisma.auditLog.create({
            data: {
                userId,
                action: context.action,
                entityType: context.entityType,
                entityId: context.entityId,
                metadata: enrichedMetadata as Prisma.InputJsonValue,
                ipAddress: getClientIp(request),
            },
        });

        // Log audit event if logger is available
        if (logger) {
            logger.info({
                audit: {
                    action: context.action,
                    entityType: context.entityType,
                    entityId: context.entityId,
                    userId,
                    metadata: enrichedMetadata,
                }
            }, 'Audit log created');
        }
    } catch (error) {
        // Don't fail the request if audit logging fails
        if (logger) {
            logger.error({ error, context }, 'Failed to create audit log');
        } else {
            request.log.error({ error, context }, 'Failed to create audit log');
        }
    }
}

function redactSensitiveFields(
    obj: Record<string, unknown>
): Record<string, unknown> {
    const sensitiveKeys = ['password', 'passwordHash', 'token', 'secret', 's3Key'];
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
            redacted[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            redacted[key] = redactSensitiveFields(value as Record<string, unknown>);
        } else {
            redacted[key] = value;
        }
    }

    return redacted;
}

function getClientIp(request: FastifyRequest): string | undefined {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
        return forwardedFor.split(',')[0]?.trim();
    }
    return request.ip;
}
