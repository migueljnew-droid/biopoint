import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export function errorHandler(
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
) {
    const requestId = request.id;
    const logger = request.log;
    
    logger.error({
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
            statusCode: error.statusCode,
        },
        request: {
            method: request.method,
            url: request.url,
            ip: request.ip,
        }
    }, 'Request error occurred');

    // Zod validation errors
    if (error instanceof ZodError) {
        return reply.status(400).send({
            statusCode: 400,
            error: 'Validation Error',
            message: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
            issues: error.errors,
        });
    }

    // JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: error.message,
        });
    }

    // Prisma errors
    if (error.name === 'PrismaClientKnownRequestError') {
        const prismaError = error as FastifyError & { code?: string };
        if (prismaError.code === 'P2002') {
            return reply.status(409).send({
                statusCode: 409,
                error: 'Conflict',
                message: 'A record with this value already exists',
            });
        }
        if (prismaError.code === 'P2025') {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Record not found',
            });
        }
    }

    // Default error response
    const statusCode = error.statusCode || 500;
    const response = {
        statusCode,
        error: error.name || 'Internal Server Error',
        message: statusCode === 500 ? 'An unexpected error occurred' : error.message,
        requestId: requestId || 'unknown',
    };
    
    // Include request ID in error response for debugging
    if (requestId) {
        reply.header('x-request-id', requestId);
    }
    
    return reply.status(statusCode).send(response);
}
