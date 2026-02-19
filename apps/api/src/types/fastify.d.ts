/**
 * FastifyRequest augmentation via TypeScript declaration merging.
 *
 * This is the official Fastify TypeScript pattern for extending the request object:
 * https://fastify.dev/docs/latest/Reference/TypeScript/
 *
 * Properties declared here are:
 *  - Set by runtime middleware (auth.ts, app.ts, etc.)
 *  - Registered via `app.decorateRequest()` in createServer() for Fastify runtime safety
 *  - Typed at compile time so all route handlers can access them without `as any` casts
 */
declare module 'fastify' {
    interface FastifyRequest {
        /** Authenticated user's ID — set by middleware/auth.ts */
        userId: string;

        /** Authenticated user's email address — set by middleware/auth.ts */
        userEmail: string;

        /** Authenticated user's role — set by middleware/auth.ts */
        userRole: 'USER' | 'ADMIN';

        /** Request start timestamp (ms since epoch) — set by app.ts onRequest hook */
        startTime: number;

        /** Session ID for automatic logoff tracking — set by middleware/automaticLogoff.ts */
        sessionId?: string;

        /** Session timeout in milliseconds — set by middleware/automaticLogoff.ts */
        sessionTimeout?: number;

        /** Rate limit info attached for post-response decrement logic — set by middleware/rateLimit.ts */
        rateLimit?: {
            key: string;
            limit: number;
            remaining: number;
            reset: Date;
            skipSuccessfulRequests?: boolean;
            skipFailedRequests?: boolean;
        };

        /** Account lockout info — set by middleware/rateLimit.ts */
        accountLockout?: {
            isLocked: boolean;
            lockedUntil?: number;
            remainingTime?: number;
        };
    }
}

export {};
