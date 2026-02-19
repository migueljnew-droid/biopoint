---
phase: 04-infrastructure-deployment
plan: 04
subsystem: infra
tags: [fly.io, redis, toml, hipaa, deployment, health-check, private-network]

# Dependency graph
requires:
  - phase: 04-infrastructure-deployment
    provides: Fastify v5 API, Redis rate limiter, PHI monitoring hardening (04-01, 04-02, 04-03 complete)

provides:
  - fly.toml at repo root: biopoint-api Fly.io app config (iad region, /health check, HIPAA keep-alive settings)
  - redis-fly.toml at repo root: biopoint-redis Fly.io app config (private network, persistent volume)
  - Complete deployment checklist (Steps 1-8) for human execution in one session

affects:
  - Production deployment (human steps: Fly.io org + BAA, Neon HIPAA, fly secrets, fly deploy)
  - Phase 5 / Phase 6 (can only proceed after production URL is live)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fly.toml at monorepo root when Dockerfile COPY commands reference monorepo-relative paths"
    - "auto_stop_machines=false for HIPAA: PHI endpoints must be always-on, no cold starts"
    - "min_machines_running=1 ensures at least one healthy machine serves production traffic"
    - "Redis as private Fly.io app (biopoint-redis.internal) avoids third-party HIPAA BAA requirement"

key-files:
  created:
    - fly.toml
    - redis-fly.toml
  modified: []

key-decisions:
  - "fly.toml placed at monorepo root (not apps/api/) — Dockerfile COPY commands use monorepo-relative paths, requiring root build context"
  - "Self-hosted Redis on Fly.io (biopoint-redis.internal) preferred over Upstash to avoid separate Enterprise HIPAA BAA"
  - "auto_stop_machines=false required for HIPAA — cold starts create latency spikes on PHI endpoints"
  - "redis-fly.toml has no [http_service] — Redis is private network only, not internet-accessible"

patterns-established:
  - "Health check: GET /health, port 3000, 30s interval, 5s timeout, 10s grace period"
  - "Fly.io private networking: biopoint-redis.internal:6379 used by API for Redis connection"

requirements-completed:
  - INFRA-01
  - INFRA-02
  - INFRA-07

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 4 Plan 04: Fly.io Deployment Config Summary

**fly.toml and redis-fly.toml created for HIPAA-compliant Fly.io production deployment — awaiting human execution of Fly.io BAA signing, Neon HIPAA enablement, and `fly deploy`.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T22:42:41Z
- **Completed:** 2026-02-19T22:46:00Z
- **Tasks:** 1 of 2 complete (Task 2 is checkpoint — awaiting human deployment)
- **Files modified:** 2

## Status: CHECKPOINT — Awaiting Human Deployment

Task 1 (config file creation) is complete and committed. Task 2 is a `checkpoint:human-verify` that requires the user to execute Fly.io and Neon account setup steps that cannot be automated.

## Accomplishments

- Created `fly.toml` at monorepo root with correct Fly.io app configuration for `biopoint-api`
- Created `redis-fly.toml` for self-hosted Redis as a separate Fly.io app (`biopoint-redis`)
- Corrected fly.toml placement: plan specified `apps/api/fly.toml` but Dockerfile COPY paths require the monorepo root as build context — placed at root with `dockerfile = 'apps/api/Dockerfile'`
- Documented complete 8-step deployment checklist directly in Task 2 checkpoint for human execution

## Task Commits

1. **Task 1: Create fly.toml and redis-fly.toml configuration files** - `9675e7d` (chore)
2. **Task 2: Deploy to Fly.io production** - CHECKPOINT (awaiting human)

## Files Created/Modified

- `fly.toml` — Fly.io app config: biopoint-api, iad region, port 3000, force_https, auto_stop_machines=false, min_machines_running=1, /health check
- `redis-fly.toml` — Fly.io app config: biopoint-redis, redis:7-alpine image, redis_data volume mount, private network only (no http_service)

## Decisions Made

- `fly.toml` at monorepo root (not `apps/api/`) — the Dockerfile uses `COPY apps/api ...`, `COPY packages/shared ...` etc., which are monorepo-relative paths. If fly.toml were in `apps/api/`, the build context would be wrong and COPY would fail. Root placement with `dockerfile = 'apps/api/Dockerfile'` is the correct pattern for monorepo deployments.
- Self-hosted Redis on Fly.io private network (not Upstash) — ensures Fly.io's HIPAA BAA covers all PHI-adjacent data; Upstash would require its own Enterprise BAA
- `auto_stop_machines = false` — HIPAA compliance requires zero cold starts on PHI endpoints; latency spikes on first request would be unacceptable for a healthcare app
- `redis-fly.toml` has no `[http_service]` — Redis must be private network only, not exposed to the internet

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] fly.toml placed at monorepo root instead of apps/api/**
- **Found during:** Task 1 (creating fly.toml)
- **Issue:** Plan specified `apps/api/fly.toml` with `dockerfile = 'Dockerfile'`. But the Dockerfile at `apps/api/Dockerfile` uses `COPY apps/api/package*.json ./apps/api/` and `COPY packages/shared ...` — paths that only exist relative to the monorepo root. Deploying from `apps/api/` with that Dockerfile would fail because Docker build context wouldn't include `packages/shared/` or `db/`.
- **Fix:** Placed `fly.toml` at monorepo root (`/biopoint/fly.toml`) with `dockerfile = 'apps/api/Dockerfile'`. Deploy command: `fly deploy --config fly.toml` from repo root.
- **Files modified:** fly.toml (placement corrected)
- **Verification:** `grep "dockerfile" fly.toml` confirms `apps/api/Dockerfile` path
- **Committed in:** 9675e7d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: wrong fly.toml placement would break Docker build)
**Impact on plan:** Required for correctness — deployment would fail without this fix. No scope creep.

## Issues Encountered

None.

## User Setup Required

**Production deployment requires human action.** Complete these steps in order:

### Step 1: Install flyctl (if not installed)
```bash
brew install flyctl
fly auth login
```

### Step 2: Set up Fly.io organization and sign BAA ($99/month)
```bash
fly orgs create biopoint-production
```
Then visit: **fly.io/dashboard/biopoint-production/compliance**
- Select "HIPAA Compliance Package"
- Sign BAA and confirm

### Step 3: Enable Neon HIPAA (IRREVERSIBLE — do on production project only)
1. Upgrade to Neon Scale plan: **neon.com/pricing**
2. In Neon console: **Project Settings > HIPAA Support > Accept BAA**
3. Note both connection strings (pooled + direct URLs)

### Step 4: Deploy self-hosted Redis
```bash
cd /Users/GRAMMY/biopoint
fly launch --name biopoint-redis --org biopoint-production --image redis:7-alpine --no-deploy
fly volume create redis_data --region iad --size 1 --app biopoint-redis
fly deploy --config redis-fly.toml
```

### Step 5: Create biopoint-api app and inject secrets
```bash
cd /Users/GRAMMY/biopoint/apps/api
fly launch --name biopoint-api --org biopoint-production --no-deploy
fly secrets set \
  DATABASE_URL="postgres://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require" \
  DIRECT_URL="postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require" \
  JWT_SECRET="your-production-jwt-secret-min-32-chars" \
  JWT_ACCESS_EXPIRES="15m" \
  JWT_REFRESH_EXPIRES="7d" \
  REDIS_HOST="biopoint-redis.internal" \
  REDIS_PORT="6379" \
  NODE_ENV="production" \
  PORT="3000" \
  AWS_REGION="auto" \
  AWS_ACCESS_KEY_ID="your-r2-key" \
  AWS_SECRET_ACCESS_KEY="your-r2-secret" \
  S3_BUCKET="biopoint-uploads-prod" \
  S3_ENDPOINT="https://account-id.r2.cloudflarestorage.com" \
  CORS_ORIGIN="https://app.biopoint.health" \
  SENTRY_DSN="your-sentry-dsn" \
  SENTRY_ENABLED="true" \
  DATADOG_API_KEY="your-datadog-api-key" \
  DATADOG_ENABLED="true" \
  SERVICE_VERSION="1.0.0" \
  HEALTH_CHECK_TOKEN="your-health-check-token" \
  --app biopoint-api
```

### Step 6: Run database migrations
```bash
cd /Users/GRAMMY/biopoint/db
DIRECT_URL="your-direct-neon-url" npx prisma migrate deploy
```

### Step 7: Deploy the API
```bash
cd /Users/GRAMMY/biopoint
fly deploy --config fly.toml
```

### Step 8: Verify
```bash
fly status --app biopoint-api
curl -s https://biopoint-api.fly.dev/health | jq .status    # Expected: "ok"
curl -s https://biopoint-api.fly.dev/health | jq .database.status  # Expected: "connected"
fly logs --app biopoint-api | grep -i redis                 # Should show Redis connected
```

Type "deployed" to resume plan execution once health checks pass.

## Next Phase Readiness

- `fly.toml` and `redis-fly.toml` are ready for deployment
- All Phase 4 prerequisites complete (Fastify v5, Redis rate limiting, PHI monitoring)
- Awaiting: Fly.io BAA signing, Neon HIPAA enablement, and `fly deploy` execution
- After deployment: Production URL `https://biopoint-api.fly.dev` becomes available for Phase 5/6

## Self-Check: PASSED

- FOUND: fly.toml (at monorepo root)
- FOUND: redis-fly.toml (at monorepo root)
- FOUND: 04-04-SUMMARY.md
- FOUND: commit 9675e7d (chore(04-04): add Fly.io deployment config files)

---
*Phase: 04-infrastructure-deployment*
*Completed: 2026-02-19 (Task 1 only — checkpoint at Task 2)*
