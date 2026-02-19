---
phase: 04-infrastructure-deployment
plan: 01
subsystem: api-database
tags: [fastify-v5, prisma, database-indexes, neon, performance]
dependency_graph:
  requires: []
  provides: [fastify-v5-runtime, lab-marker-indexes, prisma-direct-url]
  affects: [04-02-redis-rate-limiter, 04-03-phi-monitoring, 04-04-fly-deploy]
tech_stack:
  added:
    - fastify@^5.7.4 (upgraded from ^4.25.0)
    - "@fastify/cors@^10.1.0 (upgraded from ^9.0.0)"
    - "@fastify/helmet@^12.0.1 (upgraded from ^11.1.0)"
    - "@fastify/rate-limit@^10.3.0 (upgraded from ^9.1.0)"
  patterns:
    - Prisma directUrl pattern for Neon pooled vs direct connections
    - Composite database index for O(log N) trends query
key_files:
  modified:
    - apps/api/package.json
    - db/prisma/schema.prisma
  created:
    - db/prisma/migrations/20260219000000_add_lab_marker_trends_index/migration.sql
key_decisions:
  - "reply.sent confirmed valid in Fastify v5 types (plan noted it as v4-only but types show it still exists)"
  - "Migration generated manually as SQL file — prisma migrate dev requires interactive TTY not available in CI/CD environment"
  - "DIRECT_URL uses Neon direct endpoint (without -pooler suffix) for migration compatibility"
metrics:
  duration: 5m
  tasks_completed: 2
  files_modified: 3
  files_created: 1
  completed_date: 2026-02-19
---

# Phase 4 Plan 1: Fastify v5 Upgrade + LabMarker Indexes Summary

Upgraded Fastify from EOL v4 to v5, installed v5-compatible @fastify ecosystem plugins, added LabMarker composite indexes for O(log N) /labs/trends query performance, and wired Prisma directUrl for Neon migration compatibility.

## What Was Built

### Task 1: Fastify v5 Package Upgrade

Upgraded four packages in `apps/api/package.json`:

| Package | Before | After |
|---------|--------|-------|
| fastify | ^4.25.0 | ^5.7.4 |
| @fastify/cors | ^9.0.0 | ^10.1.0 |
| @fastify/helmet | ^11.1.0 | ^12.0.1 |
| @fastify/rate-limit | ^9.1.0 | ^10.3.0 |

**Breaking changes investigated:**

- `reply.redirect()` — searched all route files: zero occurrences found. No argument swap needed.
- `reply.sent` — found in `middleware/rateLimit.ts` (lines 656, 659) and `middleware/auth.ts` (line 128). Plan noted this should be replaced with `reply.hijack()`, but Fastify v5 type definitions confirm `reply.sent: boolean` is still present. No change needed.
- JSON Schema shorthand — no route files use explicit `schema:` blocks. No changes needed.
- Logger option — `app.ts` uses config object (`envToLogger` map), not a pino instance. No change needed.

**TypeScript result:** Zero errors after upgrade.

### Task 2: Prisma Schema Updates

**directUrl added to datasource block:**
```prisma
datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")     // pooled PgBouncer connection
  directUrl  = env("DIRECT_URL")       // direct non-pooler connection for migrations
  ...
}
```

**LabMarker composite indexes added:**
```prisma
model LabMarker {
  // ... existing fields ...
  @@index([userId])                   // range scan by user (eliminates full table scan)
  @@index([userId, recordedAt])       // compound for sorted trends query
}
```

These indexes reduce `/labs/trends` query from O(N) full table scan to O(log N) index lookup. The compound index covers both the `WHERE userId` filter and the `ORDER BY recordedAt` sort in a single index.

**Migration file:** `db/prisma/migrations/20260219000000_add_lab_marker_trends_index/migration.sql`
```sql
CREATE INDEX "LabMarker_userId_idx" ON "LabMarker"("userId");
CREATE INDEX "LabMarker_userId_recordedAt_idx" ON "LabMarker"("userId", "recordedAt");
```

**Prisma client regenerated** successfully with updated schema.

## Verification Results

1. `npx tsc --noEmit` — PASS: zero TypeScript errors
2. `fastify` in package.json — shows `^5.7.4`
3. `@fastify/rate-limit` — shows `^10.3.0`
4. `directUrl` in schema.prisma — shows `env("DIRECT_URL")`
5. LabMarker `@@index([userId, recordedAt])` — present in model
6. Migration directory `20260219000000_add_lab_marker_trends_index` — exists
7. Migration SQL — contains both CREATE INDEX statements

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as intended, with the following discoveries documented:

**1. [Discovery] reply.sent remains valid in Fastify v5**
- **Found during:** Task 1 type checking
- **Issue:** Plan stated "Fix 2: `reply.sent` → `reply.hijack()`" as a v5 breaking change. After installing v5, checking Fastify's type definition at `node_modules/fastify/types/reply.d.ts` confirmed `sent: boolean` is still a valid property in v5.
- **Action:** Reverted the unnecessary `headersSent` changes. No fix applied.
- **Files modified:** None (change reverted)

**2. [Discovery] prisma migrate dev requires interactive TTY**
- **Found during:** Task 2 migration generation
- **Issue:** `prisma migrate dev --create-only` fails with "non-interactive environment" error when run in a shell without TTY. Additionally, the Neon direct endpoint (`ep-dark-sound-adrl7qrf.c-2.us-east-1.aws.neon.tech:5432`) is not reachable from local dev (firewall/network restriction).
- **Action:** Created migration SQL file manually following Prisma's migration file format. The SQL is semantically identical to what `prisma migrate dev` would have generated based on the schema diff.
- **Files created:** `db/prisma/migrations/20260219000000_add_lab_marker_trends_index/migration.sql`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | e3aa525 | feat(04-01): upgrade Fastify v4 to v5 with @fastify ecosystem plugins |
| Task 2 | b804dc0 | feat(04-01): add LabMarker composite indexes and Prisma directUrl for Neon |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| apps/api/package.json | FOUND |
| db/prisma/schema.prisma | FOUND |
| migration file (20260219000000_add_lab_marker_trends_index) | FOUND |
| commit e3aa525 | FOUND |
| commit b804dc0 | FOUND |
| fastify ^5 in package.json | FOUND |
| directUrl in schema.prisma | FOUND |
| @@index([userId, recordedAt]) in LabMarker | FOUND |
