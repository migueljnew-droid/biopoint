import { PrismaClient } from '@prisma/client';
import {
    shouldProcessModel,
    encryptDataObject,
    decryptRecord,
} from './encryption/fields.js';

declare global {
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

/**
 * Pool size per environment (inlined to eliminate circular dependency on @biopoint/api).
 */
function getPoolMax(): number {
    switch (process.env.NODE_ENV) {
        case 'production': return 20;
        case 'staging': return 10;
        case 'test': return 3;
        default: return 5;
    }
}

/**
 * Append Neon/PgBouncer connection-pool params to DATABASE_URL (SEC-06).
 * Only adds params that are not already present in the URL.
 */
function getConnectionUrl(): string {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL environment variable is required');

    const parsed = new URL(url);

    if (!parsed.searchParams.has('connection_limit')) {
        parsed.searchParams.set('connection_limit', String(getPoolMax()));
    }
    if (!parsed.searchParams.has('pool_timeout')) {
        parsed.searchParams.set('pool_timeout', '15');
    }

    return parsed.toString();
}

// --- Request-context store (set per-request by Fastify hooks in app.ts) ---

type DbLogger = {
    info: (obj: object, msg?: string) => void;
    warn: (obj: object, msg?: string) => void;
    error: (obj: object, msg?: string) => void;
    debug: (obj: object, msg?: string) => void;
} | null;

let _requestLogger: DbLogger = null;

/** Set the per-request logger so $extends query hooks can trace DB calls. */
export function setDbRequestContext(_request: unknown, logger: DbLogger): void {
    _requestLogger = logger;
}

/** Clear per-request logger after response is sent. */
export function clearDbRequestContext(): void {
    _requestLogger = null;
}

// --- Prisma Client with $extends (SEC-05) ---

const basePrisma =
    global.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        errorFormat: 'pretty',
        datasources: {
            db: {
                url: getConnectionUrl(),
            },
        },
    });

if (process.env.NODE_ENV !== 'production') {
    global.prisma = basePrisma;
}

/**
 * Extended Prisma client with:
 *   1. Transparent field-level encryption (SEC-05)
 *   2. Request-ID query tracing (replaces deprecated $use middleware)
 *
 * Encryption is structurally embedded — there is no "unencrypted" client
 * that code can accidentally import.
 */
export const prisma = basePrisma.$extends({
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                const logger = _requestLogger;
                const startTime = Date.now();

                // --- Encrypt on writes ---
                if (shouldProcessModel(model)) {
                    if (operation === 'create' && args.data) {
                        args.data = await encryptDataObject(model, args.data);
                    } else if (operation === 'update' && args.data) {
                        args.data = await encryptDataObject(model, args.data);
                    } else if (operation === 'upsert') {
                        if (args.create) args.create = await encryptDataObject(model, args.create);
                        if (args.update) args.update = await encryptDataObject(model, args.update);
                    } else if (operation === 'createMany' && Array.isArray(args.data)) {
                        args.data = await Promise.all(
                            args.data.map((d: Record<string, unknown>) => encryptDataObject(model, d)),
                        );
                    }
                }

                try {
                    if (logger) {
                        logger.debug(
                            { db: { operation, model, startTime } },
                            'Database query started',
                        );
                    }

                    let result = await query(args);

                    // --- Decrypt on reads ---
                    if (shouldProcessModel(model) && result != null) {
                        if (
                            (operation === 'findFirst' || operation === 'findUnique') &&
                            typeof result === 'object' &&
                            !Array.isArray(result)
                        ) {
                            result = await decryptRecord(model, result);
                        } else if (operation === 'findMany' && Array.isArray(result)) {
                            result = await Promise.all(
                                result.map((r: Record<string, unknown>) => decryptRecord(model, r)),
                            );
                        }
                    }

                    if (logger) {
                        logger.info(
                            {
                                db: {
                                    operation,
                                    model,
                                    duration: Date.now() - startTime,
                                    status: 'success',
                                },
                            },
                            'Database query completed',
                        );
                    }

                    return result;
                } catch (error) {
                    if (logger) {
                        logger.error(
                            {
                                db: {
                                    operation,
                                    model,
                                    duration: Date.now() - startTime,
                                    status: 'error',
                                    error:
                                        error instanceof Error
                                            ? { name: error.name, message: error.message }
                                            : String(error),
                                },
                            },
                            'Database query failed',
                        );
                    }
                    throw error;
                }
            },
        },
    },
});

// Re-export encryption utilities so API can import from @biopoint/db
export * from './encryption/index.js';

export * from '@prisma/client';
