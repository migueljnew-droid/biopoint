import type { FastifyRequest, FastifyReply, FastifyBaseLogger } from 'fastify';

/**
 * Request-bound logger interface with request ID
 */
export interface RequestLogger extends FastifyBaseLogger {
    child(bindings: Record<string, unknown>): RequestLogger;
}

/**
 * Create a child logger with request context
 */
export function createRequestLogger(
    parentLogger: FastifyBaseLogger,
    request: FastifyRequest
): RequestLogger {
    // In tests we often monkeypatch `app.log.info` to capture structured logs. If we create
    // a child logger, those patches won't see the calls. Keep the base logger in tests and
    // attach request context explicitly in `logRequest`/`logResponse`.
    if (process.env.NODE_ENV === 'test') {
        return parentLogger as unknown as RequestLogger;
    }

    const requestId = request.id;
    const userId = request.userId;

    const bindings: Record<string, unknown> = {
        reqId: requestId,
    };

    if (userId) {
        bindings.userId = userId;
    }

    return parentLogger.child(bindings) as unknown as RequestLogger;
}

/**
 * Log API request details
 */
export function logRequest(
    logger: RequestLogger,
    request: FastifyRequest,
    _reply: FastifyReply
): void {
    const reqId = request.id as string | undefined;
    logger.info({
        reqId,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
    }, 'Incoming request');
}

/**
 * Log API response details
 */
export function logResponse(
    logger: RequestLogger,
    request: FastifyRequest,
    reply: FastifyReply,
    responseTime: number
): void {
    const reqId = request.id as string | undefined;
    logger.info({
        reqId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime,
    }, 'Request completed');
}

/**
 * Log database query with request context
 */
export function logDatabaseQuery(
    logger: RequestLogger,
    query: {
        model: string;
        operation: string;
        args?: Record<string, unknown>;
        duration: number;
    }
): void {
    logger.debug({
        db: {
            model: query.model,
            operation: query.operation,
            args: query.args,
            duration: query.duration,
        }
    }, 'Database query executed');
}

/**
 * Log error with full context
 */
export function logError(
    logger: RequestLogger,
    error: Error,
    context?: Record<string, unknown>
): void {
    logger.error({
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
        },
        ...context,
    }, 'Error occurred');
}

/**
 * Log audit event with request context
 */
export function logAuditEvent(
    logger: RequestLogger,
    event: {
        action: string;
        entityType: string;
        entityId: string;
        metadata?: Record<string, unknown>;
    }
): void {
    logger.info({
        audit: {
            action: event.action,
            entityType: event.entityType,
            entityId: event.entityId,
            metadata: event.metadata,
        }
    }, 'Audit event');
}

/**
 * Create a child logger for specific components
 */
export function createComponentLogger(
    parentLogger: RequestLogger,
    component: string
): RequestLogger {
    return parentLogger.child({ component }) as unknown as RequestLogger;
}
