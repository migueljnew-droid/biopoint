# Phase 4: Infrastructure & Deployment - Research

**Researched:** 2026-02-19
**Domain:** Cloud deployment (Fly.io), Redis rate limiting, Fastify v5, Neon HIPAA, PHI-safe observability
**Confidence:** HIGH (most findings verified via official docs and authoritative sources)

## Summary

Phase 4 deploys a HIPAA-compliant Fastify API to Fly.io, migrates rate limiting from in-memory/database to Redis, upgrades Fastify from v4 (EOL June 2025) to v5, configures Neon Scale with HIPAA enabled and `directUrl` for migrations, and verifies that Datadog logs and Sentry error reports contain zero PHI fields.

The codebase already has a working multi-stage Dockerfile targeting `node:20-alpine` — this is the correct base image for Fly.io. Fly.io has a $99/month compliance package that covers the BAA. Neon Scale provides HIPAA at no surcharge currently (15% later). The critical unresolved question is Redis HIPAA coverage: Upstash Redis on Fly.io requires an Enterprise plan for a BAA; the safer option for HIPAA is self-hosting Redis as a Fly.io app within the same private network, where Fly.io's own BAA covers the traffic. Rate-limiting state in this phase uses Redis via `ioredis` — a significant refactor from the current custom `DatabaseRateLimitStore` to `@fastify/rate-limit`'s built-in Redis store.

**Primary recommendation:** Deploy via `fly launch` using the existing Dockerfile, self-host Redis on Fly.io private network (avoids Upstash HIPAA BAA gap), enable Neon HIPAA via console, configure `directUrl` in `schema.prisma`, upgrade Fastify to v5 by following the official migration guide 20-point checklist, and apply pino `redact` paths + Sentry `beforeSend` scrubbing before going live.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | API deployed to Fly.io HIPAA workspace (production environment) | Fly.io $99/mo compliance plan with BAA via dashboard at fly.io/dashboard/personal/compliance; `fly launch` + `fly deploy` workflow documented |
| INFRA-02 | Database running on Neon Scale with HIPAA add-on and `directUrl` configured for migrations | Neon Scale plan enables HIPAA self-serve; `directUrl = env("DIRECT_URL")` in `schema.prisma` for Prisma 4.10+ (current codebase uses Prisma 5.x) |
| INFRA-03 | Rate limiter migrated from in-memory/DB to Redis (persistent across deploys) | `@fastify/rate-limit` v10 with `ioredis` client; current `DatabaseRateLimitStore` must be replaced; self-hosted Redis on Fly.io recommended for HIPAA coverage |
| INFRA-04 | Fastify upgraded from v4 (EOL) to v5 | Official migration guide lists 20 breaking changes; `@fastify/rate-limit` v10 supports both v4 and v5; Node.js v20 already in use |
| INFRA-05 | `/labs/trends` database index added (eliminates full table scan) | `LabMarker` model lacks `@@index([userId])` and `@@index([userId, recordedAt])`; trends query does `WHERE userId = ... ORDER BY recordedAt ASC`; add via Prisma migration |
| INFRA-06 | Prisma `directUrl` configured for migrations (separate from pooled connection) | Add `directUrl = env("DIRECT_URL")` to `datasource db` block; set `DIRECT_URL` env var to Neon direct connection string (no `-pooler` suffix) |
| INFRA-07 | Production environment variables configured in Fly.io (via Doppler or manual sync) | Doppler has native Fly.io integration; `fly secrets set` or Doppler sync both work; `doppler.yaml` already defines all needed env var names |
| MON-01 | Datadog PHI fields masked in logs | Pino `redact` paths already configured in `config/monitoring.ts`; needs audit/expansion of PHI field list; Datadog Sensitive Data Scanner as second layer |
| MON-02 | Sentry `beforeSend` scrubs PHI from error reports | Sentry `beforeSend` hook in `utils/sentry.ts` exists; needs PHI field scrubbing implemented; current code does header scrubbing but not PHI body fields |
| MON-03 | Production alerting configured (error rate, response time, DB connection pool) | Datadog `HealthMonitor` class exists; needs alerting rules wired up in Datadog dashboard/monitors |
| MON-04 | Health check endpoint verified and monitored | `healthRoutes` registered at root; needs verification it responds at production URL; Fly.io health check in `fly.toml` |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | 5.x (upgrade from ^4.25.0) | HTTP API framework | v4 EOL June 2025; v5 is 5-10% faster, Node 20 required |
| `@fastify/rate-limit` | ^10.x (upgrade from ^9.1.0) | Per-route rate limiting | v10 supports Fastify v4+v5; Redis store via ioredis |
| `ioredis` | ^5.x | Redis client | Required by `@fastify/rate-limit` for external store; optimized for rate limiting |
| Prisma (existing) | ^5.x | ORM + migrations | Already in use; `directUrl` added to schema |
| `dd-trace` | latest | Datadog APM | Already imported in `config/monitoring.ts` |
| `@sentry/node` | latest | Error tracking | Already configured in `utils/sentry.ts` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fastify/redis` | ^7.x | Shared Redis connection decorator | Allows rate limiter + other plugins to share one connection |
| `pino-datadog-transport` | latest | Send pino logs to Datadog | Alternative to dd-agent sidecar for log forwarding |

### Fly.io CLI Tools

```bash
brew install flyctl    # macOS install
fly auth login
fly launch             # Initialize from existing Dockerfile
fly deploy             # Deploy changes
fly secrets set KEY=VALUE  # Set env vars
```

### Installation (Redis upgrade)

```bash
# In apps/api/
npm install ioredis @fastify/redis
# Upgrade rate-limit for Fastify v5 compatibility
npm install @fastify/rate-limit@^10
# Upgrade Fastify itself
npm install fastify@^5
```

## Architecture Patterns

### Recommended Project Structure (no changes needed)

The existing Dockerfile is already correct for Fly.io:

```
apps/api/
├── Dockerfile          # node:20-alpine builder+runner — correct for Fly.io
├── src/
│   ├── app.ts          # Fastify instance — logger option → loggerInstance (v5 breaking change)
│   ├── config/
│   │   └── monitoring.ts   # Datadog + Sentry init
│   └── middleware/
│       └── rateLimit.ts    # Replace DatabaseRateLimitStore with @fastify/rate-limit Redis
```

New files needed:
```
fly.toml                # Fly.io app config (health check, port, region)
```

### Pattern 1: Fly.io Deployment with Existing Dockerfile

**What:** `fly launch` detects the existing Dockerfile and generates `fly.toml`
**When to use:** Monorepo with custom build — Fly.io can use any Dockerfile

```bash
# From /Users/GRAMMY/biopoint/apps/api/
fly launch --name biopoint-api --org biopoint-production --no-deploy
# Edit fly.toml to set health check and port
fly deploy
```

Minimal `fly.toml`:
```toml
app = 'biopoint-api'
primary_region = 'iad'  # us-east, closest to Neon default region

[build]
  dockerfile = 'Dockerfile'

[env]
  PORT = '3000'
  NODE_ENV = 'production'

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false   # Keep-alive for HIPAA; no cold starts with PHI
  auto_start_machines = true
  min_machines_running = 1

[[services.ports]]
  port = 443
  handlers = ['tls', 'http']

[[vm]]
  memory = '512mb'
  cpu_kind = 'shared'
  cpus = 1

[checks]
  [checks.health]
    grace_period = '10s'
    interval = '30s'
    method = 'GET'
    path = '/health'
    port = 3000
    timeout = '5s'
    type = 'http'
```

### Pattern 2: Redis Rate Limiting with `@fastify/rate-limit` v10

**What:** Replace the custom `DatabaseRateLimitStore` with `@fastify/rate-limit`'s built-in Redis store using `ioredis`
**When to use:** Any multi-instance or restart-safe rate limiting

```typescript
// Source: https://github.com/fastify/fastify-rate-limit
import Redis from 'ioredis';
import rateLimit from '@fastify/rate-limit';

// CRITICAL: Customize ioredis for rate limiting (docs say defaults are not optimal)
const redis = new Redis({
  host: process.env.REDIS_HOST!,   // e.g. redis-app.internal on Fly.io
  port: 6379,
  connectTimeout: 500,             // Recommended by @fastify/rate-limit docs
  maxRetriesPerRequest: 1,         // Recommended by @fastify/rate-limit docs
});

// Register as global plugin (replaces current registerRateLimits hook approach)
await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  redis,
  nameSpace: 'biopoint-rl-',
  skipOnError: true,               // Fail-open if Redis is unreachable
  keyGenerator: (request) => request.ip,
});
```

Per-route override (replaces current `rateLimitConfigs` object):
```typescript
// On individual route registrations
app.get('/health', {
  config: {
    rateLimit: {
      max: 1000,
      timeWindow: '1 hour',
    }
  }
}, handler);
```

### Pattern 3: Fastify v5 Migration — Key Code Changes

**What:** Targeted fixes for the ~6 breaking changes that likely affect this codebase

**Change 1: Logger option renamed** (affects `app.ts`)
```typescript
// v4 (current)
const app = Fastify({ logger });

// v5 — if passing a custom pino instance:
const app = Fastify({ loggerInstance: myPinoInstance });
// BUT if passing config object (current usage): still uses 'logger' option
// Only affects custom instances. Current usage (config object) is unchanged.
```

**Change 2: reply.redirect signature** (search codebase)
```typescript
// v4 (old)
reply.redirect(301, '/new-url');
// v5 (new)
reply.redirect('/new-url', 301);
```

**Change 3: reply.sent → reply.hijack()** (check any `reply.sent = true` usage)
```typescript
// v4
reply.sent = true;
// v5
reply.hijack();
```

**Change 4: JSON Schema strict mode** (any routes with shorthand schemas)
```typescript
// v4 (shorthand — breaks in v5)
schema: { body: { type: 'object', properties: { name: { type: 'string' } } } }
// v5 (must be full schema — already valid in v4 too, but NOW REQUIRED)
schema: { body: { type: 'object', required: ['name'], properties: { name: { type: 'string' } }, additionalProperties: false } }
```

**Change 5: .listen() must use object form**
```typescript
// v4 (variadic — breaks in v5)
app.listen(port, host);
// v5 (object form — already used in apps/api/src/index.ts correctly)
app.listen({ port, host }); // Already correct in codebase
```

### Pattern 4: Neon HIPAA + directUrl Configuration

**What:** Add `directUrl` for migration-only connection; enable HIPAA on Neon project

```prisma
// db/prisma/schema.prisma — add directUrl field
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // pooled connection (existing)
  directUrl = env("DIRECT_URL")        // direct connection for migrations (add this)
}
```

Env vars needed:
```bash
DATABASE_URL="postgres://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

Note: `DIRECT_URL` is the same connection string as `DATABASE_URL` but **without** the `-pooler` suffix in the hostname.

### Pattern 5: LabMarker Index for Trends Query

**What:** Add composite index to eliminate full table scan on `/labs/trends`

The trends query at `routes/labs.ts:133` does:
```typescript
prisma.labMarker.findMany({ where: { userId }, orderBy: { recordedAt: 'asc' } })
```

This is currently a full table scan because `LabMarker` has no index on `userId`.

```prisma
// db/prisma/schema.prisma — add to LabMarker model
model LabMarker {
  // ... existing fields ...
  @@index([value_encrypted])
  @@index([encryption_version])
  @@index([userId])                   // ADD: range scan by user
  @@index([userId, recordedAt])       // ADD: compound for sorted trends query
}
```

Generate migration:
```bash
cd /Users/GRAMMY/biopoint/db
npx prisma migrate dev --name add_lab_marker_trends_index
```

### Pattern 6: PHI Masking in Pino + Sentry

**What:** Audit and extend PHI field redaction before logs leave the process

Current `config/monitoring.ts` redacts these paths via pino `redact`:
```typescript
redact: {
  paths: ['*.password', '*.token', '*.secret', '*.api_key', '*.ssn', '*.dob',
          '*.phi', '*.pii', 'headers.authorization', 'headers.cookie'],
  remove: true,
}
```

Missing PHI fields that should be added:
```typescript
// Additional PHI fields for healthcare context
'*.email',        // Direct identifier
'*.name',         // PHI if associated with health data
'*.dateOfBirth',  // Common PHI field name in codebase
'*.value',        // Lab marker values (PHI)
'*.notes',        // Clinical notes (PHI)
'*.markers',      // Lab marker arrays
'body.email',     // Request body patterns
'body.name',
'res.email',
```

Sentry `beforeSend` PHI scrubbing pattern (add to `utils/sentry.ts`):
```typescript
// Source: https://docs.sentry.io/platforms/javascript/guides/node/data-management/sensitive-data/
beforeSend(event, hint) {
  // Filter health check noise
  if (event.transaction?.includes('/health')) return null;

  // Scrub PHI from request body in breadcrumbs
  if (event.breadcrumbs?.values) {
    event.breadcrumbs.values = event.breadcrumbs.values.map(crumb => {
      if (crumb.data) {
        const { email, name, value, notes, dateOfBirth, ...safe } = crumb.data;
        crumb.data = safe;
      }
      return crumb;
    });
  }

  // Scrub PHI from extra context
  if (event.extra) {
    const { email, name, value, notes, dateOfBirth, phi, ...safe } = event.extra as Record<string, unknown>;
    event.extra = safe;
  }

  // Scrub user email from Sentry user context
  if (event.user?.email) {
    event.user = { id: event.user.id };  // Keep only opaque ID
  }

  return event;
},
```

### Anti-Patterns to Avoid

- **Using Upstash Redis on Fly.io for HIPAA without Enterprise BAA:** Fly.io's BAA does not cover Upstash Redis data. PHI in Redis rate-limit keys (which include userId) requires Upstash Enterprise BAA or use of self-hosted Redis.
- **`auto_stop_machines = true` in fly.toml:** Cold starts introduce latency spikes and can cause health check failures during HIPAA access audits. Keep `min_machines_running = 1`.
- **Migrating with pooled DATABASE_URL:** Prisma Migrate requires a direct (non-pooler) connection. Without `directUrl`, migrations will fail or hang on Neon's pooler.
- **Logging PHI in request context:** The current logger setup logs request objects; pino's `req` serializer must exclude body content for PHI endpoints.
- **Logging user identifiers with health data:** Logging `userId` alongside `markerValue` in the same log line creates a PHI record even if the user ID alone isn't PHI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Redis rate limit store | Custom `DatabaseRateLimitStore` | `@fastify/rate-limit` v10 with `ioredis` | Built-in sliding window, IETF draft headers, atomic operations, tested |
| PHI log scrubbing at runtime | Custom log filter middleware | Pino `redact` + Datadog Sensitive Data Scanner | Two-layer defense; Pino redact is zero-overhead (compile-time path resolution) |
| Fly.io deployment scripts | Custom deploy shell scripts | `flyctl` CLI + `fly.toml` | Fly handles rolling deploys, health checks, TLS, secrets |
| Neon connection pooling | pgBouncer sidecar | Neon built-in connection pooler (PgBouncer-compatible) | Already included in Neon; pooled URL has `-pooler` in hostname |
| Health check logic | Complex status aggregation | `GET /health` → Prisma `$queryRaw SELECT 1` | Simple liveness check is all Fly.io health check needs |

**Key insight:** Rate limiting state is fundamentally a distributed problem. Any in-process or single-database approach loses state on restart. Redis as the source of truth is the standard solution — and `@fastify/rate-limit` has already solved the atomic sliding-window problem.

## Common Pitfalls

### Pitfall 1: Upstash Redis + HIPAA Gap
**What goes wrong:** Deploy Upstash Redis on Fly.io, assume Fly.io's BAA covers all services, PHI appears in Redis keys (rate-limit keys often encode userId or email).
**Why it happens:** Fly.io's BAA covers Fly infrastructure but Upstash is a separate vendor requiring its own Enterprise BAA.
**How to avoid:** Use self-hosted Redis as a Fly.io app (`fly launch --image redis:7-alpine`) within the same private organization. Fly.io's BAA covers this.
**Warning signs:** Rate limit key format includes `phi:${userId}` — userId is a pseudonymous identifier but combined with health endpoint context becomes PHI-adjacent.

### Pitfall 2: Fastify v5 Strict JSON Schema Breaking Routes
**What goes wrong:** Routes with shorthand schemas (`{ name: { type: 'string' } }` without top-level `type: 'object'`) throw `FST_ERR_SCH_MISSING_ID` or validation errors.
**Why it happens:** v5 enforces full JSON Schema. The `jsonShortHand` option is removed.
**How to avoid:** Run `npm run test` after the Fastify upgrade — Vitest will catch schema validation failures. Audit all route schema definitions for missing `type: 'object'` wrappers.
**Warning signs:** Tests pass locally on v4 but fail after `npm install fastify@^5`.

### Pitfall 3: Rate Limit Migration State Loss
**What goes wrong:** During migration from `DatabaseRateLimitStore` to Redis, existing rate limit counters are lost, potentially allowing a burst of requests from previously limited IPs.
**Why it happens:** Different storage backends — Postgres has historical counts, Redis starts empty.
**How to avoid:** Deploy during low-traffic window. Redis will self-populate within one timeWindow. Not a HIPAA risk; only a brief gap in rate limiting.
**Warning signs:** Auth endpoint gets spike of requests immediately post-deploy during migration window.

### Pitfall 4: Pino Logger Custom Instance in Fastify v5
**What goes wrong:** Passing a pino instance via `logger` option in `Fastify({})` — silently ignored or throws in v5.
**Why it happens:** v5 renamed the option from `logger` to `loggerInstance` for custom instances.
**How to avoid:** The current codebase passes a config object (not a pino instance) to `logger`, which is unchanged. However, `createLogger()` in `config/monitoring.ts` creates a pino logger — if this is ever passed directly to Fastify, it must use `loggerInstance`.
**Warning signs:** Log format changes unexpectedly after upgrade; Datadog stops receiving structured logs.

### Pitfall 5: Neon HIPAA Cannot Be Undone
**What goes wrong:** Accidentally enabling HIPAA on the wrong project or enabling it before BAA is fully understood.
**Why it happens:** The operation is irreversible — once enabled, HIPAA cannot be disabled on a project.
**How to avoid:** Create a separate Neon project for production specifically for PHI. Enable HIPAA only on that project. The restart that occurs on enablement briefly drops connections.
**Warning signs:** Trying to disable HIPAA after finding it breaks Neon Auth integration.

### Pitfall 6: `directUrl` Missing — Migration Hangs on Neon
**What goes wrong:** Running `prisma migrate deploy` against the pooled DATABASE_URL causes migrations to hang or fail.
**Why it happens:** Neon's connection pooler doesn't support the extended protocol that Prisma Migrate requires for advisory locks.
**How to avoid:** Always set `DIRECT_URL` env var and `directUrl` in schema. The pooler URL is for application queries; the direct URL is for migrations only.
**Warning signs:** `prisma migrate deploy` hangs indefinitely in CI/CD.

### Pitfall 7: Sentry Breadcrumbs Leaking PHI
**What goes wrong:** Sentry `beforeSend` scrubs the event body but breadcrumbs still contain PHI from previous request logging.
**Why it happens:** Auto-instrumentation (HTTP module) captures request/response bodies in breadcrumbs before `beforeSend` runs.
**How to avoid:** Scrub breadcrumbs in `beforeSend` as shown in code examples above. Also set `maxBreadcrumbs: 20` to limit exposure window.
**Warning signs:** Sentry events show `data.body` or `data.response` fields containing health data values.

## Code Examples

Verified patterns from official sources:

### Self-Hosted Redis on Fly.io

```bash
# Source: https://community.fly.io/t/self-hosted-redis-on-fly-io/17925
# Deploy Redis as a separate Fly app in the same org

fly launch --name biopoint-redis --org biopoint-production --image redis:7-alpine --no-deploy

# fly.toml for Redis (minimal, private only)
# Do NOT add public HTTP service — private network only
cat > redis-fly.toml << 'EOF'
app = 'biopoint-redis'
primary_region = 'iad'

[build]
  image = 'redis:7-alpine'

[[mounts]]
  source = 'redis_data'
  destination = '/data'

[[vm]]
  memory = '256mb'
  cpu_kind = 'shared'
  cpus = 1
EOF

fly volume create redis_data --region iad --size 1 --app biopoint-redis
fly deploy --config redis-fly.toml
```

Connection from API app (private network):
```typescript
const redis = new Redis({
  host: 'biopoint-redis.internal',  // Fly.io private DNS
  port: 6379,
  connectTimeout: 500,
  maxRetriesPerRequest: 1,
});
```

### Fly.io BAA Signing Process

```
1. Upgrade to paid plan: fly.io/pricing
2. Sign BAA: fly.io/dashboard/personal/compliance
   (or fly.io/dashboard/[ORG_NAME]/compliance for org accounts)
3. Select HIPAA compliance package ($99/month)
4. BAA becomes active immediately upon signing
5. Create isolated production org: fly orgs create biopoint-production
```

### Neon HIPAA Enablement

```
1. Upgrade to Scale plan: neon.com/pricing
2. Enable BAA: Console → Settings → HIPAA support → Accept BAA
3. Create or enable on project: Console → Project Settings → Enable HIPAA
   (OR) neon projects update --hipaa --project-id <id>
4. Warning: operation restarts computes, brief connection drop
5. Set DIRECT_URL env var (no -pooler suffix)
```

### Datadog PHI Masking Verification

```bash
# After deploy, verify no PHI in logs:
# 1. Make a request to /labs/trends
# 2. In Datadog Log Explorer, search: service:biopoint-api
# 3. Verify no 'value', 'notes', 'dateOfBirth' fields in log entries
# 4. Enable Sensitive Data Scanner for second-layer protection:
#    Datadog → Security → Sensitive Data Scanner → Create scanning group → HIPAA ruleset
```

### Fastify v5 Upgrade Procedure

```bash
# 1. Upgrade packages
npm install fastify@^5 @fastify/rate-limit@^10 @fastify/cors@^10 @fastify/helmet@^12

# 2. Run existing tests to find breaks
npm test

# 3. Fix any failures:
#    - Add 'type: object' to any shorthand schemas
#    - Change reply.redirect(code, url) → reply.redirect(url, code)
#    - Check for reply.sent usage → reply.hijack()
#    - Verify .listen({ port, host }) object form (already correct)

# 4. Rebuild and verify
npm run build && npm run test
```

### Doppler → Fly.io Secrets Sync

```bash
# Source: https://docs.doppler.com/docs/flyio
# Option A: Doppler native sync (recommended — keeps secrets in sync automatically)
# 1. Create Fly.io access token at fly.io/user/personal_access_tokens
# 2. In Doppler: Project → Syncs → Add Fly.io → Paste token → Select app

# Option B: Manual sync via flyctl
doppler secrets download --no-file --format env --project biopoint --config production \
  | fly secrets import --app biopoint-api
```

New secrets needed for this phase (add to doppler.yaml):
```yaml
# Add to apps/api/secrets section:
- REDIS_HOST          # e.g. biopoint-redis.internal
- REDIS_PORT          # 6379
- DIRECT_URL          # Neon direct connection (no pooler)
- SENTRY_DSN          # Sentry project DSN
- DATADOG_API_KEY     # Datadog API key
- DATADOG_ENABLED     # 'true'
- SENTRY_ENABLED      # 'true'
- SERVICE_VERSION     # e.g. '1.0.0'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fastify v4 | Fastify v5 | v5 released Oct 2024, v4 EOL June 2025 | 20 breaking changes; Node 20+ required |
| Render HIPAA workspace | Fly.io ($99/mo compliance) | Phase 3 decision | BAA via dashboard; self-service |
| `DatabaseRateLimitStore` (custom) | `@fastify/rate-limit` v10 + Redis | v10 released 2024 | Built-in atomic operations, persistence |
| Single connection URL | `url` (pooled) + `directUrl` (direct) | Prisma 4.10.0 | Migrations work correctly with connection poolers |
| Neon Enterprise ($700+/mo) for HIPAA | Neon Scale (usage-based) + HIPAA | Sept 2025 | HIPAA moved into Scale plan; no surcharge yet |
| Manual secrets in Fly | Doppler sync → Fly secrets | 2024 | Auto-sync on Doppler config change |

**Deprecated/outdated:**

- `Upstash Redis on Fly.io` for HIPAA: No BAA without Enterprise plan. Use self-hosted Redis on Fly.io private network instead.
- `DatabaseRateLimitStore`: Persists across restarts but is slow (every request hits Postgres) and loses state on DB migration. Replace entirely.
- `Render` references in REQUIREMENTS.md `INFRA-01` and `COMP-03`: Per Phase 3 decision, Render is replaced by Fly.io. COMP-03 (Render BAA) is no longer applicable; superseded by Fly.io BAA.

## Open Questions

1. **Does Fly.io's BAA cover self-hosted Redis apps in the same org?**
   - What we know: Fly.io BAA covers the Fly platform infrastructure including Fly Volumes and private networking
   - What's unclear: Whether a Redis app running on Fly VMs is explicitly covered vs. Fly core services only
   - Recommendation: Email sales@fly.io before deploying PHI to Redis. Rate-limit keys that include userId may be PHI-adjacent. Alternatively, hash the key: `crypto.createHash('sha256').update(userId).digest('hex')` to avoid storing raw identifiers.

2. **Sentry BAA status**
   - What we know: Sentry offers a standard BAA for HIPAA customers via account manager
   - What's unclear: Whether BAA is required before any error events are sent, or only when events contain PHI. Phase 3 deferred all BAAs.
   - Recommendation: Enable Sentry with `beforeSend` scrubbing from day one. Negotiate BAA when approaching production launch with real users.

3. **Datadog BAA status**
   - What we know: Datadog has HIPAA-enabled log management with BAA for enterprise customers
   - What's unclear: Current plan/tier for BioPoint; whether current setup has BAA
   - Recommendation: Same as Sentry — implement scrubbing first, BAA second. The pino `redact` ensures PHI never leaves the process even without BAA.

4. **Fastify v5 plugin ecosystem compatibility**
   - What we know: `@fastify/rate-limit` v10 explicitly supports v4+v5; `@fastify/cors` and `@fastify/helmet` have v5-compatible releases
   - What's unclear: Internal route plugins (custom Fastify plugins in the codebase) may use deprecated APIs
   - Recommendation: Run `npm run test` after upgrade; TypeScript will catch many API mismatches at compile time. Budget 2-4 hours for fixing TypeScript errors.

5. **Redis persistence requirements for rate limiting**
   - What we know: Self-hosted Redis on Fly.io with volume mount provides persistence; without volume, Redis data is lost on restart
   - What's unclear: Whether rate-limit data surviving restarts is strictly required for HIPAA or just operationally desirable
   - Recommendation: Mount a Fly Volume for Redis (`fly volume create redis_data`). 1GB is sufficient. This ensures account lockout state survives deploys.

## Sources

### Primary (HIGH confidence)

- [fly.io/docs/blueprints/going-to-production-with-healthcare-apps/](https://fly.io/docs/blueprints/going-to-production-with-healthcare-apps/) — Fly.io HIPAA deployment steps
- [fly.io/compliance](https://fly.io/compliance) — BAA signing, $99/mo plan
- [neon.com/docs/security/hipaa](https://neon.com/docs/security/hipaa) — HIPAA setup steps, what's covered, what's not
- [neon.com/docs/guides/prisma](https://neon.com/docs/guides/prisma) — directUrl configuration
- [fastify.dev/docs/latest/Guides/Migration-Guide-V5/](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/) — All 20 breaking changes
- [github.com/fastify/fastify-rate-limit README](https://github.com/fastify/fastify-rate-limit/blob/main/README.md) — ioredis configuration, v10 compatibility
- [docs.sentry.io/platforms/javascript/guides/node/data-management/sensitive-data/](https://docs.sentry.io/platforms/javascript/guides/node/data-management/sensitive-data/) — beforeSend scrubbing
- [docs.datadoghq.com/data_security/logs/](https://docs.datadoghq.com/data_security/logs/) — Log data security
- Codebase analysis: `/Users/GRAMMY/biopoint/apps/api/src/middleware/rateLimit.ts`, `config/monitoring.ts`, `utils/sentry.ts`, `db/prisma/schema.prisma`, `routes/labs.ts`

### Secondary (MEDIUM confidence)

- Community thread: [community.fly.io/t/self-hosted-redis-on-fly-io/17925](https://community.fly.io/t/self-hosted-redis-on-fly-io/17925) — self-hosted Redis config verified working
- [docs.doppler.com/docs/flyio](https://docs.doppler.com/docs/flyio) — Doppler Fly.io sync integration
- Neon pricing analysis via [vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/) — Scale plan HIPAA details

### Tertiary (LOW confidence — flag for validation)

- Upstash Enterprise BAA requirement: based on Upstash's docs but exact pricing for Enterprise not confirmed; validate before deciding on Redis approach
- Fly.io $99/month compliance package price: from search results summary; verify at fly.io/compliance before purchase

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — Fly.io, Neon, Fastify v5, @fastify/rate-limit v10 all verified against official docs
- Architecture: HIGH — Deployment patterns from official blueprints; Redis patterns from fastify-rate-limit README
- Pitfalls: MEDIUM-HIGH — Upstash HIPAA gap verified; Fastify breaking changes from official migration guide; some PHI-in-Redis analysis is reasoning from principles
- Open questions: Flagged honestly with LOW confidence where vendor docs don't cover specifics

**Research date:** 2026-02-19
**Valid until:** 2026-03-21 (stable ecosystem; Fastify v5 is stable, Fly.io/Neon pricing unlikely to change quickly)
