/**
 * Input Sanitization Middleware for BioPoint API
 * 
 * HIPAA Compliance: §164.312(a)(1) Access controls, §164.312(c)(1) Integrity
 * 
 * This middleware applies comprehensive input sanitization to all incoming requests
 * to prevent various injection attacks and ensure data integrity.
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { sanitizeInput, sanitizeFilePath } from '../utils/sanitization.js';
import { createAuditLog } from './auditLog.js';

/**
 * Configuration for sanitization middleware
 */
interface SanitizationConfig {
    enabled: boolean;
    logSanitization: boolean;
    rejectOnValidationFailure: boolean;
    maxInputLength: number;
}

const DEFAULT_CONFIG: SanitizationConfig = {
    enabled: true,
    logSanitization: true,
    rejectOnValidationFailure: true,
    maxInputLength: 10000,
};

/** Routes that carry binary/base64 payloads and must skip body sanitization. */
const BODY_SANITIZATION_SKIP_ROUTES = [
    '/nutrition/analyze-photo',
    '/api/nutrition/analyze-photo',
];

/**
 * Sanitizes request body based on content type
 */
function sanitizeRequestBody(body: any, _contentType?: string): any {
    if (!body || !DEFAULT_CONFIG.enabled) {
        return body;
    }

    try {
        if (typeof body === 'string') {
            // Handle string bodies (JSON, text, etc.)
            if (body.length > DEFAULT_CONFIG.maxInputLength) {
                throw new Error('Request body exceeds maximum length');
            }

            // Try to parse as JSON first
            try {
                const parsed = JSON.parse(body);
                return JSON.stringify(sanitizeObject(parsed));
            } catch {
                // If not JSON, treat as plain text
                return sanitizeInput(body, 'text');
            }
        }

        if (typeof body === 'object') {
            return sanitizeObject(body);
        }

        return body;
    } catch (error) {
        if (DEFAULT_CONFIG.rejectOnValidationFailure) {
            throw error;
        }
        return body;
    }
}

/**
 * Recursively sanitizes objects
 */
function sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    if (typeof obj === 'string') {
        return sanitizeInput(obj, 'text');
    }

    if (typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
            // Sanitize both keys and values
            const sanitizedKey = sanitizeInput(key, 'text');
            sanitized[sanitizedKey] = sanitizeObject(value);
        }
        return sanitized;
    }

    return obj;
}

/**
 * Sanitizes URL parameters
 */
function sanitizeParams(params: any): any {
    if (!params || !DEFAULT_CONFIG.enabled) {
        return params;
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(params)) {
        const sanitizedKey = sanitizeInput(key, 'text');
        if (typeof value === 'string') {
            // Special handling for IDs and common parameter types
            if (key.toLowerCase().includes('id') || key.toLowerCase().includes('uuid')) {
                // Validate UUID format
                if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
                    throw new Error(`Invalid ${key} format`);
                }
                sanitized[sanitizedKey] = value;
            } else {
                sanitized[sanitizedKey] = sanitizeInput(value, 'text');
            }
        } else {
            sanitized[sanitizedKey] = value;
        }
    }

    return sanitized;
}

/**
 * Sanitizes query parameters
 */
function sanitizeQuery(query: any): any {
    if (!query || !DEFAULT_CONFIG.enabled) {
        return query;
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(query)) {
        const sanitizedKey = sanitizeInput(key, 'text');
        if (typeof value === 'string') {
            sanitized[sanitizedKey] = sanitizeInput(value, 'text');
        } else if (Array.isArray(value)) {
            sanitized[sanitizedKey] = value.map(v =>
                typeof v === 'string' ? sanitizeInput(v, 'text') : v
            );
        } else {
            sanitized[sanitizedKey] = value;
        }
    }

    return sanitized;
}

/**
 * Sanitizes headers (selectively)
 */
function sanitizeHeaders(headers: any): any {
    if (!headers || !DEFAULT_CONFIG.enabled) {
        return headers;
    }

    const sanitized = { ...headers };

    // Sanitize common user-controlled headers
    const userControlledHeaders = [
        'user-agent',
        'referer',
        'origin',
        'content-type',
        'accept-language',
        'accept-encoding'
    ];

    userControlledHeaders.forEach(header => {
        if (sanitized[header] && typeof sanitized[header] === 'string') {
            sanitized[header] = sanitizeInput(sanitized[header], 'text');
        }
    });

    return sanitized;
}

/**
 * Main sanitization middleware
 */
export function sanitizationMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
): void {
    if (!DEFAULT_CONFIG.enabled) {
        return done();
    }

    try {
        // Skip body sanitization for routes that carry binary/base64 data
        const skipBody = BODY_SANITIZATION_SKIP_ROUTES.some(r => request.url.startsWith(r));

        // Log original request for audit purposes (if enabled)
        if (DEFAULT_CONFIG.logSanitization) {
            const originalBody = request.body;
            const originalParams = request.params;
            const originalQuery = request.query;

            // Apply sanitization
            if (request.body && !skipBody) {
                request.body = sanitizeRequestBody(request.body, request.headers['content-type']);
            }

            if (request.params) {
                request.params = sanitizeParams(request.params);
            }

            if (request.query) {
                request.query = sanitizeQuery(request.query);
            }

            // Sanitize headers
            request.headers = sanitizeHeaders(request.headers);

            // Log sanitization events for security monitoring
            const hasChanges =
                JSON.stringify(originalBody) !== JSON.stringify(request.body) ||
                JSON.stringify(originalParams) !== JSON.stringify(request.params) ||
                JSON.stringify(originalQuery) !== JSON.stringify(request.query);

            if (hasChanges) {
                createAuditLog(request, {
                    action: 'SANITIZE',
                    entityType: 'Request',
                    entityId: 'input_sanitization',
                    metadata: {
                        url: request.url,
                        method: request.method,
                        sanitizedFields: getSanitizedFields(originalBody, request.body, originalParams, request.params, originalQuery, request.query)
                    }
                }).catch(error => {
                    // Don't fail the request if audit logging fails
                    // Avoid noisy stderr in the test suite; enable via VITEST_DEBUG_LOGS if needed.
                    if (process.env.NODE_ENV !== 'test' || process.env.VITEST_DEBUG_LOGS) {
                        console.error('Failed to log sanitization:', error);
                    }
                });
            }
        } else {
            // Apply sanitization without logging
            if (request.body && !skipBody) {
                request.body = sanitizeRequestBody(request.body, request.headers['content-type']);
            }

            if (request.params) {
                request.params = sanitizeParams(request.params);
            }

            if (request.query) {
                request.query = sanitizeQuery(request.query);
            }

            request.headers = sanitizeHeaders(request.headers);
        }

        done();
    } catch (error) {
        // Log the full validation error for debugging
        // Avoid noisy stderr in the test suite; enable via VITEST_DEBUG_LOGS if needed.
        if (process.env.NODE_ENV !== 'test' || process.env.VITEST_DEBUG_LOGS) {
            console.error('SANITIZATION ERROR:', error);
        }

        if (DEFAULT_CONFIG.rejectOnValidationFailure) {
            reply.status(400).send({
                statusCode: 400,
                error: 'Validation Error',
                message: 'Request validation failed',
                details: error instanceof Error ? error.message : 'Invalid input detected'
            });
        } else {
            // Continue with original data if validation fails and rejectOnValidationFailure is false
            done();
        }
    }
}

/**
 * Helper function to identify which fields were sanitized
 */
function getSanitizedFields(
    originalBody: any,
    sanitizedBody: any,
    originalParams: any,
    sanitizedParams: any,
    originalQuery: any,
    sanitizedQuery: any
): string[] {
    const sanitizedFields: string[] = [];

    // Check body changes
    if (originalBody && sanitizedBody) {
        findChanges('', originalBody, sanitizedBody, sanitizedFields);
    }

    // Check params changes
    if (originalParams && sanitizedParams) {
        findChanges('params.', originalParams, sanitizedParams, sanitizedFields);
    }

    // Check query changes
    if (originalQuery && sanitizedQuery) {
        findChanges('query.', originalQuery, sanitizedQuery, sanitizedFields);
    }

    return sanitizedFields;
}

/**
 * Recursively find changes between original and sanitized data
 */
function findChanges(prefix: string, original: any, sanitized: any, changes: string[]): void {
    if (typeof original === 'string' && typeof sanitized === 'string' && original !== sanitized) {
        changes.push(prefix || 'body');
        return;
    }

    if (typeof original === 'object' && typeof sanitized === 'object' && original !== null && sanitized !== null) {
        for (const key in original) {
            if (key in sanitized) {
                findChanges(`${prefix}${key}.`, original[key], sanitized[key], changes);
            }
        }
    }
}

/**
 * Specialized middleware for file upload sanitization
 */
export function fileUploadSanitizationMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
): void {
    if (!DEFAULT_CONFIG.enabled) {
        return done();
    }

    try {
        // Sanitize filename-related fields
        if (request.body && typeof request.body === 'object') {
            const body = request.body as Record<string, unknown>;

            // Sanitize filename fields
            const filenameFields = ['filename', 'fileName', 'name'];
            filenameFields.forEach(field => {
                if (body[field] && typeof body[field] === 'string') {
                    body[field] = sanitizeFilePath(body[field]);
                }
            });

            // Validate content type
            if (body.contentType && typeof body.contentType === 'string') {
                const allowedContentTypes = [
                    'image/jpeg',
                    'image/jpg',
                    'image/png',
                    'image/webp',
                    'image/heic',
                    'application/pdf',
                    'text/csv',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                ];

                if (!allowedContentTypes.includes(body.contentType)) {
                    throw new Error(`Invalid content type: ${body.contentType}`);
                }
            }
        }

        done();
    } catch (error) {
        reply.status(400).send({
            statusCode: 400,
            error: 'Validation Error',
            message: 'File upload validation failed',
            details: error instanceof Error ? error.message : 'Invalid file upload data'
        });
    }
}

/**
 * Specialized middleware for S3 key generation with validation
 */
export function s3KeyValidationMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
): void {
    if (!DEFAULT_CONFIG.enabled) {
        return done();
    }

    try {
        if (request.body && typeof request.body === 'object') {
            const body = request.body as Record<string, unknown>;

            // Validate and sanitize S3 keys
            if (body.s3Key && typeof body.s3Key === 'string') {
                // Ensure S3 key doesn't contain path traversal patterns
                const sanitizedKey = sanitizeFilePath(body.s3Key);
                if (sanitizedKey !== body.s3Key) {
                    throw new Error('S3 key contains invalid path sequences');
                }
                body.s3Key = sanitizedKey;
            }

            // Validate filename for S3 key generation
            if (body.filename && typeof body.filename === 'string') {
                const sanitizedFilename = sanitizeFilePath(body.filename);
                if (!sanitizedFilename || sanitizedFilename.length === 0) {
                    throw new Error('Invalid filename provided');
                }
                body.filename = sanitizedFilename;
            }
        }

        done();
    } catch (error) {
        reply.status(400).send({
            statusCode: 400,
            error: 'Validation Error',
            message: 'S3 key validation failed',
            details: error instanceof Error ? error.message : 'Invalid S3 key data'
        });
    }
}

/**
 * Configuration update function
 */
export function updateSanitizationConfig(newConfig: Partial<SanitizationConfig>): void {
    Object.assign(DEFAULT_CONFIG, newConfig);
}

/**
 * Get current sanitization configuration
 */
export function getSanitizationConfig(): SanitizationConfig {
    return { ...DEFAULT_CONFIG };
}
