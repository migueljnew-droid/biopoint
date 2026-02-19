import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Redis } from 'ioredis';
import { prisma, Prisma } from '@biopoint/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Create an ioredis client optimized for @fastify/rate-limit.
 * Returns null if REDIS_HOST is not configured (falls back to in-memory in tests,
 * and DatabaseRateLimitStore in production until Redis is provisioned).
 */
export function createRedisClient(): Redis | null {
  const host = process.env.REDIS_HOST;
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);

  if (!host) return null;

  return new Redis({
    host,
    port,
    connectTimeout: 500,       // @fastify/rate-limit recommendation
    maxRetriesPerRequest: 1,   // @fastify/rate-limit recommendation
    lazyConnect: true,         // Don't connect until first use
  });
}

// Singleton Redis client — shared between rate limiter and any future Redis usage.
// Null when REDIS_HOST is not set (test env or first-deploy without Redis).
export const redisClient = createRedisClient();

function getUserIdFromAuthHeader(request: FastifyRequest): string | undefined {
  const header = request.headers?.authorization;
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) return undefined;

  const token = header.slice(7);
  if (!token) return undefined;

  // If we can't verify, fall back to IP-based rate limiting.
  if (!JWT_SECRET) return undefined;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId?: string };
    return payload?.userId;
  } catch {
    return undefined;
  }
}

// Rate limiting storage interfaces
interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitInfo>;
  decrement(key: string): Promise<void>;
  reset(key: string): Promise<void>;
}

interface RateLimitInfo {
  total: number;
  remaining: number;
  reset: number;
}

// Account lockout storage interface
interface AccountLockoutStore {
  getFailedAttempts(identifier: string): Promise<FailedAttemptsInfo>;
  recordFailedAttempt(identifier: string, attempt: FailedAttempt): Promise<void>;
  resetFailedAttempts(identifier: string): Promise<void>;
  isAccountLocked(identifier: string): Promise<LockoutInfo>;
  lockAccount(identifier: string, durationMs: number): Promise<void>;
  unlockAccount(identifier: string): Promise<void>;
}

interface FailedAttempt {
  timestamp: number;
  ip: string;
}

interface FailedAttemptsInfo {
  attempts: FailedAttempt[];
  count: number;
  isLocked: boolean;
  lockedUntil?: number;
}

interface LockoutInfo {
  isLocked: boolean;
  lockedUntil?: number;
  remainingTime?: number;
}

// In-memory rate limit store for tests (avoids hammering Postgres under high concurrency).
class InMemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, number[]>();

  async increment(key: string, windowMs: number): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = now - windowMs;

    const existing = this.entries.get(key) ?? [];
    const recent = existing.filter((ts) => ts >= windowStart);
    recent.push(now);
    this.entries.set(key, recent);

    const earliest = recent[0] ?? now;
    const reset = earliest + windowMs;

    return {
      total: recent.length,
      remaining: 0,
      reset,
    };
  }

  async decrement(key: string): Promise<void> {
    const existing = this.entries.get(key);
    if (!existing || existing.length === 0) return;
    existing.pop();
    this.entries.set(key, existing);
  }

  async reset(key: string): Promise<void> {
    this.entries.delete(key);
  }

  resetAll(): void {
    this.entries.clear();
  }
}

class InMemoryAccountLockoutStore implements AccountLockoutStore {
  private readonly state = new Map<
    string,
    { failedAttempts: FailedAttempt[]; lockedUntil?: number }
  >();

  async getFailedAttempts(identifier: string): Promise<FailedAttemptsInfo> {
    const entry = this.state.get(identifier);
    if (!entry) return { attempts: [], count: 0, isLocked: false };

    const now = Date.now();
    const attempts = entry.failedAttempts ?? [];
    const recentAttempts = attempts.filter((att) => now - att.timestamp < 15 * 60 * 1000);

    const isLocked = typeof entry.lockedUntil === 'number' && entry.lockedUntil > now;

    // Persist pruned attempts to avoid unbounded growth.
    this.state.set(identifier, { failedAttempts: recentAttempts, lockedUntil: entry.lockedUntil });

    return {
      attempts: recentAttempts,
      count: recentAttempts.length,
      isLocked,
      lockedUntil: isLocked ? entry.lockedUntil : undefined,
    };
  }

  async recordFailedAttempt(identifier: string, attempt: FailedAttempt): Promise<void> {
    const existing = this.state.get(identifier) ?? { failedAttempts: [], lockedUntil: undefined };
    const nextAttempts = [...(existing.failedAttempts ?? []), attempt];

    const now = Date.now();
    const recentAttempts = nextAttempts.filter((att) => now - att.timestamp < 15 * 60 * 1000);

    this.state.set(identifier, { failedAttempts: recentAttempts, lockedUntil: existing.lockedUntil });
  }

  async resetFailedAttempts(identifier: string): Promise<void> {
    this.state.set(identifier, { failedAttempts: [], lockedUntil: undefined });
  }

  async isAccountLocked(identifier: string): Promise<LockoutInfo> {
    const entry = this.state.get(identifier);
    if (!entry?.lockedUntil) return { isLocked: false };

    const now = Date.now();
    const isLocked = entry.lockedUntil > now;
    return {
      isLocked,
      lockedUntil: isLocked ? entry.lockedUntil : undefined,
      remainingTime: isLocked ? entry.lockedUntil - now : undefined,
    };
  }

  async lockAccount(identifier: string, durationMs: number): Promise<void> {
    const lockedUntil = Date.now() + durationMs;
    const existing = this.state.get(identifier) ?? { failedAttempts: [], lockedUntil: undefined };
    this.state.set(identifier, { failedAttempts: existing.failedAttempts ?? [], lockedUntil });
  }

  async unlockAccount(identifier: string): Promise<void> {
    this.state.set(identifier, { failedAttempts: [], lockedUntil: undefined });
  }

  resetAll(): void {
    this.state.clear();
  }
}

// Database-based rate limit store (fallback when Redis is not available)
class DatabaseRateLimitStore implements RateLimitStore {
  async increment(key: string, windowMs: number): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const reset = now + windowMs;

    // Clean up old entries and get current count
    await prisma.$executeRaw`
      DELETE FROM "RateLimit" 
      WHERE key = ${key} AND timestamp < ${new Date(windowStart)}
    `;

    // Insert new entry
    await prisma.rateLimit.create({
      data: {
        key,
        timestamp: new Date(now),
        count: 1,
      },
    });

    // Get total count for this window
    const total = await prisma.rateLimit.count({
      where: {
        key,
        timestamp: {
          gte: new Date(windowStart),
        },
      },
    });

    return {
      total,
      remaining: 0, // Will be calculated by the rate limiter
      reset,
    };
  }

  async decrement(key: string): Promise<void> {
    // Remove the most recent entry for this key
    const latest = await prisma.rateLimit.findFirst({
      where: { key },
      orderBy: { timestamp: 'desc' },
    });

    if (latest) {
      await prisma.rateLimit.delete({
        where: { id: latest.id },
      });
    }
  }

  async reset(key: string): Promise<void> {
    await prisma.rateLimit.deleteMany({
      where: { key },
    });
  }
}

// Database-based account lockout store
class DatabaseAccountLockoutStore implements AccountLockoutStore {
  async getFailedAttempts(identifier: string): Promise<FailedAttemptsInfo> {
    const lockout = await prisma.accountLockout.findUnique({
      where: { identifier },
    });

    if (!lockout) {
      return { attempts: [], count: 0, isLocked: false };
    }

    const now = Date.now();
    const attempts = (lockout.failedAttempts as unknown as FailedAttempt[]) || [];

    // Filter out attempts older than 15 minutes
    const recentAttempts = attempts.filter(
      attempt => now - attempt.timestamp < 15 * 60 * 1000
    );

    const isLocked = !!(lockout.lockedUntil && lockout.lockedUntil > new Date());

    return {
      attempts: recentAttempts,
      count: recentAttempts.length,
      isLocked,
      lockedUntil: lockout.lockedUntil?.getTime(),
    };
  }

  async recordFailedAttempt(identifier: string, attempt: FailedAttempt): Promise<void> {
    const existing = await prisma.accountLockout.findUnique({ where: { identifier } });
    const attempts = existing ? ((existing.failedAttempts as unknown as FailedAttempt[]) || []) : [];
    const now = Date.now();
    const recentAttempts = [...attempts, attempt].filter((att) => now - att.timestamp < 15 * 60 * 1000);

    // Use upsert to avoid unique constraint races under concurrency.
    await prisma.accountLockout.upsert({
      where: { identifier },
      update: {
        failedAttempts: recentAttempts as unknown as Prisma.InputJsonValue,
        lastAttemptAt: new Date(attempt.timestamp),
      },
      create: {
        identifier,
        failedAttempts: recentAttempts as unknown as Prisma.InputJsonValue,
        lastAttemptAt: new Date(attempt.timestamp),
      },
    });
  }

  async resetFailedAttempts(identifier: string): Promise<void> {
    // Use updateMany to avoid noisy P2025 logs when the row doesn't exist.
    await prisma.accountLockout.updateMany({
      where: { identifier },
      data: {
        failedAttempts: [],
        lockedUntil: null,
      },
    });
  }

  async isAccountLocked(identifier: string): Promise<LockoutInfo> {
    const lockout = await prisma.accountLockout.findUnique({
      where: { identifier },
    });

    if (!lockout?.lockedUntil) {
      return { isLocked: false };
    }

    const now = Date.now();
    const lockedUntil = lockout.lockedUntil.getTime();
    const isLocked = lockedUntil > now;

    return {
      isLocked,
      lockedUntil: isLocked ? lockedUntil : undefined,
      remainingTime: isLocked ? lockedUntil - now : undefined,
    };
  }

  async lockAccount(identifier: string, durationMs: number): Promise<void> {
    const lockedUntil = new Date(Date.now() + durationMs);

    await prisma.accountLockout.upsert({
      where: { identifier },
      update: {
        lockedUntil,
      },
      create: {
        identifier,
        lockedUntil,
        failedAttempts: [],
      },
    });
  }

  async unlockAccount(identifier: string): Promise<void> {
    await prisma.accountLockout.updateMany({
      where: { identifier },
      data: {
        lockedUntil: null,
        failedAttempts: [],
      },
    });
  }
}

// Rate limiting configuration
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (request: FastifyRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  // When false, still sets headers + tracks counters but never blocks the request.
  enforce?: boolean;
  onLimitReached?: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

// Account lockout configuration
export interface AccountLockoutConfig {
  maxAttempts: number;
  lockoutDurationMs: number;
  progressiveDelays: number[];
}

const IS_TEST_ENV = process.env.NODE_ENV === 'test';

// Create rate limiting stores
const rateLimitStore: RateLimitStore = IS_TEST_ENV ? new InMemoryRateLimitStore() : new DatabaseRateLimitStore();
const lockoutStore: AccountLockoutStore = IS_TEST_ENV ? new InMemoryAccountLockoutStore() : new DatabaseAccountLockoutStore();

// Test helper to avoid cross-test leakage when using in-memory stores.
export function __testResetSecurityState(): void {
  if (!IS_TEST_ENV) return;
  if (rateLimitStore instanceof InMemoryRateLimitStore) rateLimitStore.resetAll();
  if (lockoutStore instanceof InMemoryAccountLockoutStore) lockoutStore.resetAll();
}

// Rate limiting middleware factory
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = config.keyGenerator ? config.keyGenerator(request) : request.ip;
    const now = Date.now();

    try {
      const rateLimitInfo = await rateLimitStore.increment(key, config.windowMs);

      // Calculate remaining requests
      const remaining = Math.max(0, config.max - rateLimitInfo.total);
      const reset = new Date(now + config.windowMs);

      // Set rate limit headers
      reply.header('X-RateLimit-Limit', config.max);
      reply.header('X-RateLimit-Remaining', remaining);
      reply.header('X-RateLimit-Reset', reset.toISOString());

      // Check if limit exceeded
      if (rateLimitInfo.total > config.max) {
        const retryAfter = Math.ceil(config.windowMs / 1000);
        reply.header('Retry-After', retryAfter);

        if (config.onLimitReached) {
          await config.onLimitReached(request, reply);
        }

        if (config.enforce !== false) {
          return reply.status(429).send({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter,
          });
        }
      }

      // Store rate limit info in request for later use
      request.rateLimit = {
        key,
        limit: config.max,
        remaining,
        reset,
        skipSuccessfulRequests: config.skipSuccessfulRequests,
        skipFailedRequests: config.skipFailedRequests,
      };
    } catch (error) {
      request.log.error({ error, key }, 'Rate limiting error');
      // Continue with request on rate limit store error (fail open)
    }
  };
}

// Account lockout middleware factory
export function createAccountLockoutMiddleware(_config: AccountLockoutConfig) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { email?: string; username?: string } | null | undefined;
    const identifier = body?.email || body?.username || request.ip;

    if (!identifier) {
      return; // Cannot apply lockout without identifier
    }

    try {
      // Check if account is locked
      const lockoutInfo = await lockoutStore.isAccountLocked(identifier);

      if (lockoutInfo.isLocked) {
        const remainingTime = Math.ceil((lockoutInfo.remainingTime || 0) / 1000);
        reply.header('Retry-After', remainingTime);

        return reply.status(429).send({
          error: 'Account Temporarily Locked',
          message: 'Account temporarily locked due to multiple failed login attempts.',
          retryAfter: remainingTime,
          lockedUntil: lockoutInfo.lockedUntil,
        });
      }

      // Store lockout info in request for later use
      request.accountLockout = lockoutInfo;
    } catch (error) {
      request.log.error({ error, identifier }, 'Account lockout check error');
      // Continue with request on lockout store error (fail open)
    }
  };
}

// Progressive delay middleware factory
export function createProgressiveDelayMiddleware(config: AccountLockoutConfig) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const body = request.body as { email?: string; username?: string } | null | undefined;
    const identifier = body?.email || body?.username || request.ip;

    if (!identifier) {
      return; // Cannot apply delay without identifier
    }

    try {
      const failedAttempts = await lockoutStore.getFailedAttempts(identifier);
      const attemptCount = failedAttempts.count;

      // Apply progressive delay
      // `attemptCount` is the number of previous failed attempts; delay for the *next* attempt.
      if (attemptCount >= 0 && attemptCount < config.progressiveDelays.length) {
        const delayMs = (config.progressiveDelays[attemptCount] ?? 0) * 1000;

        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    } catch (error) {
      request.log.error({ error, identifier }, 'Progressive delay error');
      // Continue with request on delay error (fail open)
    }
  };
}

// Handle failed login attempt
export async function recordFailedLogin(
  identifier: string,
  ip: string,
  config: AccountLockoutConfig
): Promise<number> {
  const attempt: FailedAttempt = {
    timestamp: Date.now(),
    ip,
  };

  await lockoutStore.recordFailedAttempt(identifier, attempt);

  const failedAttempts = await lockoutStore.getFailedAttempts(identifier);

  // Lock account if max attempts reached
  if (failedAttempts.count >= config.maxAttempts) {
    await lockoutStore.lockAccount(identifier, config.lockoutDurationMs);
  }

  return failedAttempts.count;
}

// Handle successful login
export async function recordSuccessfulLogin(identifier: string): Promise<void> {
  await lockoutStore.resetFailedAttempts(identifier);
}

export async function getAccountLockoutInfo(identifier: string): Promise<LockoutInfo> {
  return lockoutStore.isAccountLocked(identifier);
}

// Rate limiting configurations for different endpoint types
export const rateLimitConfigs = {
  // Auth endpoints: 5 requests per 15 minutes per IP
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    keyGenerator: (request: FastifyRequest) => `auth:${request.ip}`,
    // Do not count successful logins against the brute-force budget.
    skipSuccessfulRequests: true,
  },

  // PHI endpoints: 200 requests per minute per user
  phi: {
    windowMs: 60 * 1000, // 1 minute
    max: 200,
    keyGenerator: (request: FastifyRequest) => {
      const userId = request.userId || getUserIdFromAuthHeader(request);
      const rawUrl = request.url || '';
      const normalizedUrl = rawUrl.startsWith('/api/') ? rawUrl.slice(4) : rawUrl;
      const path = normalizedUrl.split('?')[0] ?? '';
      const segment = path.split('/').filter(Boolean)[0] ?? 'unknown';
      return userId ? `phi:${userId}:${segment}` : `phi:${request.ip}:${segment}`;
    },
  },

  // Public endpoints: 1000 requests per hour per IP
  public: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000,
    keyGenerator: (request: FastifyRequest) => `public:${request.ip}`,
  },

  // API presign endpoints: 50 requests per hour per user
  presign: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    keyGenerator: (request: FastifyRequest) => {
      const userId = request.userId || getUserIdFromAuthHeader(request);
      return userId ? `presign:${userId}` : `presign:${request.ip}`;
    },
  },

  // Default fallback
  default: {
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    keyGenerator: (request: FastifyRequest) => `default:${request.ip}`,
  },
};

// Account lockout configuration
const baseAccountLockoutConfig: AccountLockoutConfig = {
  maxAttempts: 5,
  lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
  progressiveDelays: [0, 1, 2, 4, 8], // Seconds: 0, 1, 2, 4, 8
};

// The progressive delay middleware intentionally slows brute force attempts; in tests we scale
// delays down drastically so the suite stays fast and deterministic.
const testSecurityTimeScaleRaw = Number.parseFloat(process.env.TEST_SECURITY_TIME_SCALE ?? '0.1');
const testSecurityTimeScale = Number.isFinite(testSecurityTimeScaleRaw) && testSecurityTimeScaleRaw > 0
  ? testSecurityTimeScaleRaw
  : 0.1;

export const accountLockoutConfig: AccountLockoutConfig = {
  ...baseAccountLockoutConfig,
  progressiveDelays: IS_TEST_ENV
    ? baseAccountLockoutConfig.progressiveDelays.map((delaySec) => delaySec * testSecurityTimeScale)
    : baseAccountLockoutConfig.progressiveDelays,
};

// Register rate limiting for different endpoint types.
// NOTE: Request-level rate limiting (per-IP, per-route) is now handled by the global
// @fastify/rate-limit plugin registered in app.ts with Redis backing. This function
// only registers the account lockout + progressive delay preHandler for auth/login.
export async function registerRateLimits(app: FastifyInstance) {
  // Apply account lockout and progressive delays to auth endpoints
  app.addHook('preHandler', async (request, reply) => {
    const normalizedUrl = request.url.startsWith('/api/') ? request.url.slice(4) : request.url;
    if (normalizedUrl.startsWith('/auth/login') && request.method === 'POST') {
      const lockoutMiddleware = createAccountLockoutMiddleware(accountLockoutConfig);
      const delayMiddleware = createProgressiveDelayMiddleware(accountLockoutConfig);
      const authAttemptRateLimit = createRateLimitMiddleware({
        ...rateLimitConfigs.auth,
        // Never block login here; lockout handles enforcement deterministically.
        enforce: false,
      });

      await lockoutMiddleware(request, reply);
      if (!reply.sent) {
        await authAttemptRateLimit(request, reply);
      }
      if (!reply.sent) {
        await delayMiddleware(request, reply);
      }
    }
  });
}
