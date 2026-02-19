import type { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

/**
 * Request ID middleware for distributed tracing
 * Generates unique request IDs and attaches them to requests for log correlation
 */
export async function requestIdMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    // Generate or use existing request ID.
    // Note: Fastify's genReqId option already sets request.id from x-request-id headers,
    // but we ensure a UUID fallback here and propagate to the response header.
    const requestId = (request.headers['x-request-id'] as string) || randomUUID();

    // Fastify's request.id is read-only by default; the value comes from genReqId in createServer.
    // We only update it here if genReqId did not produce an id (i.e. no x-request-id header was sent).
    if (!request.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (request as unknown as { id: string }).id = requestId;
    }

    // Add request ID to response headers
    reply.header('x-request-id', request.id || requestId);

    // Create child logger with request ID if parent logger exists
    if (request.log) {
        (request as { log: ReturnType<typeof request.log.child> }).log = request.log.child({ reqId: request.id || requestId });
    }
}

/**
 * Fastify plugin for request ID middleware
 */
export async function registerRequestIdPlugin(app: import('fastify').FastifyInstance) {
    app.addHook('onRequest', requestIdMiddleware);
}