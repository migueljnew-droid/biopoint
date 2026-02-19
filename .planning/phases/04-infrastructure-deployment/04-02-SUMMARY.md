---
phase: 04-infrastructure-deployment
plan: 02
subsystem: api-rate-limiting
tags: [redis, rate-limiting, ioredis, fastify, security, infra]
dependency_graph:
  requires: [04-01]
  provides: [INFRA-03]
  affects: [apps/api/src/app.ts, apps/api/src/middleware/rateLimit.ts, doppler.yaml]
tech_stack:
  added: [ioredis@5.9.3]
  patterns: [Redis-backed sliding-window rate limiting, @fastify/rate-limit global plugin, onRoute per-prefix overrides]
key_files:
  created: []
  modified:
    - apps/api/src/middleware/rateLimit.ts
    - apps/api/src/app.ts
    - doppler.yaml
    - apps/api/package.json
decisions:
  - "Used { Redis } named import from ioredis (not default import) to satisfy ESM+CJS interop under TypeScript strict mode"
  - "redisClient is null when REDIS_HOST is unset — test env and pre-Redis deploys fall back to @fastify/rate-limit in-memory store"
  - "skipOnError: true on global plugin — fail-open if Redis unreachable (don't block users for infrastructure failure)"
  - "DatabaseAccountLockoutStore left unchanged — account lockout remains DB-backed per plan spec"
  - "onRoute hook applies per-prefix overrides (not per-route in each route file) to minimize regression surface"
metrics:
  duration: "~6 minutes"
  completed: "2026-02-19"
  tasks_completed: 2
  files_modified: 4
---

# Phase 04 Plan 02: Redis-Backed Rate Limiting Summary

**One-liner:** Redis-backed global `@fastify/rate-limit` v10 replaces in-process `DatabaseRateLimitStore`, with per-prefix overrides via `onRoute` hook and ioredis client factory with graceful null fallback.

## What Was Built

### rateLimit.ts changes

**Added:**
- `import { Redis } from 'ioredis'` (named import required for ESM/CJS interop)
- `createRedisClient()` exported factory — creates ioredis client when `REDIS_HOST` is set, returns `null` otherwise
- `redisClient` exported singleton — shared instance for app.ts to pass to `@fastify/rate-limit`

**Removed from `registerRateLimits`:**
- `addHook('onRequest', ...)` block — the entire request-level rate limit routing logic (presign/auth/health/labs/photos/profile detection + `createRateLimitMiddleware` calls)
- `addHook('onResponse', ...)` block — the `skipSuccessfulRequests` / `skipFailedRequests` decrement logic

**Preserved in `registerRateLimits`:**
- `addHook('preHandler', ...)` — account lockout check + auth attempt rate limit (non-enforced) + progressive delay for `/auth/login` POST only

**Unchanged:**
- `DatabaseRateLimitStore` class definition (kept for reference; no longer instantiated in production path)
- `DatabaseAccountLockoutStore` class (still used in production via `lockoutStore`)
- `createRateLimitMiddleware`, `createAccountLockoutMiddleware`, `createProgressiveDelayMiddleware` factories
- All `rateLimitConfigs` configs
- `accountLockoutConfig`, `recordFailedLogin`, `recordSuccessfulLogin`, etc.

### app.ts changes

**Import update:**
```typescript
import { registerRateLimits, redisClient } from './middleware/rateLimit.js';
```

**Global plugin registration (replaces `global: false` stub):**
```typescript
await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    ...(redisClient ? {
        redis: redisClient,
        nameSpace: 'biopoint-rl-',
    } : {}),
    skipOnError: true,
    keyGenerator: (request) => request.ip,
});
```

**Per-prefix `onRoute` hook (placed after plugin, before `registerRateLimits`):**

| Prefix | Max | Window | Rationale |
|--------|-----|--------|-----------|
| `/auth/login` | 20 | 1 min | Transport ceiling; lockout is primary defense |
| `/auth` | 5 | 15 min | Brute-force prevention for registration/refresh |
| `/health` | 1000 | 1 hr | Generous for monitoring systems |
| `/labs`, `/photos`, `/profile` | 200 | 1 min | PHI endpoint per-user throughput |
| `/presign` | 50 | 1 hr | S3 upload URL generation |
| all others (default) | 100 | 1 min | Global plugin default |

### doppler.yaml changes

Added to both `root.secrets` and `services.api.secrets`:
- `REDIS_HOST` — Fly.io private network hostname (e.g. `biopoint-redis.internal`)
- `REDIS_PORT` — defaults to 6379
- `DIRECT_URL` — Neon direct connection string (no -pooler suffix) for migrations
- `SERVICE_VERSION` — deployment version string
- `HEALTH_CHECK_TOKEN` — token for authenticated `/health/db` endpoint

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: ioredis + rateLimit.ts | `341fb10` | rateLimit.ts, package.json, package-lock.json |
| Task 2: app.ts + doppler.yaml | `2bd8266` | app.ts, doppler.yaml |

## Deviations from Plan

**1. [Rule 1 - Bug] Used named `{ Redis }` import instead of default import**
- **Found during:** Task 1 TypeScript check
- **Issue:** `import Redis from 'ioredis'` produced `TS2709: Cannot use namespace 'Redis' as a type` and `TS2351: This expression is not constructable` in ESM+strict TypeScript mode
- **Fix:** Changed to `import { Redis } from 'ioredis'` — the named export is the class, the default export is the namespace
- **Files modified:** `apps/api/src/middleware/rateLimit.ts`
- **Commit:** `341fb10`

No other deviations.

## Test Results

Build: TypeScript compiles with 0 errors.

Tests: 16 files fail / 7 pass — all failures are pre-existing `prisma db push` errors due to no local Postgres at `localhost:5433`. This matches the documented baseline in STATE.md ("Tests: 36 pass, 3 fail (pre-existing env/db issues)"). No new test failures introduced by these changes.

## Self-Check: PASSED

- [x] `apps/api/src/middleware/rateLimit.ts` — modified and committed
- [x] `apps/api/src/app.ts` — modified and committed
- [x] `doppler.yaml` — modified and committed
- [x] Commit `341fb10` exists
- [x] Commit `2bd8266` exists
- [x] TypeScript: 0 errors
- [x] `grep "ioredis" apps/api/package.json` → `"ioredis": "^5.9.3"`
- [x] `grep -c "addHook.*onRequest" rateLimit.ts` → 0
- [x] `grep "global: true" apps/api/src/app.ts` → confirmed
- [x] `grep "REDIS_HOST" doppler.yaml` → confirmed in root and api sections
