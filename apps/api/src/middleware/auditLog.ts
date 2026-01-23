import type { FastifyRequest } from 'fastify';
import { prisma } from '@biopoint/db';

type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
type PhiEntityType = 'LabReport' | 'LabMarker' | 'ProgressPhoto';

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
    const userId = (request as any).userId as string | undefined;

    // Redact sensitive fields from metadata
    const redactedMetadata = context.metadata
        ? redactSensitiveFields(context.metadata)
        : undefined;

    try {
        await prisma.auditLog.create({
            data: {
                userId,
                action: context.action,
                entityType: context.entityType,
                entityId: context.entityId,
                metadata: redactedMetadata as any,
                ipAddress: getClientIp(request),
            },
        });
    } catch (error) {
        // Don't fail the request if audit logging fails
        request.log.error({ error, context }, 'Failed to create audit log');
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
