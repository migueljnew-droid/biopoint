# Architecture Patterns: BioPoint Production Deployment

**Domain:** HIPAA-compliant health tracking app — production deployment
**Researched:** 2026-02-19
**Focus:** Render + Neon + Cloudflare R2 production architecture

---

## Recommended Architecture

### System Overview

```
[Mobile App: Expo RN]
        |
        | HTTPS / JWT Bearer
        v
[Cloudflare WAF + DDoS Layer]
        |
        | TLS 1.3 terminated at Cloudflare edge
        v
[Render Web Service: Fastify API]
   - HIPAA-enabled workspace (access-restricted host)
   - Doppler injects secrets at runtime
   - Graceful SIGTERM shutdown (already implemented)
        |
     /--+--\
     |     |
     v     v
[Neon DB]  [Cloudflare R2]
 Pooled     Presigned URLs
 connection  only — no public
 (PgBouncer) bucket access
     |
     v
[Doppler] <-- secret source of truth for all envs
     |
     v
[Datadog + Sentry] <-- observability layer
```

### Deployment Topology

```
GitHub (source of truth)
  |
  +-- GitHub Actions CI
  |     - lint, test, build check on PR
  |     - Terraform plan on infra PRs
  |     - EAS Build trigger on mobile release tags
  |
  +-- Render (auto-deploy on merge to main)
  |     - HIPAA workspace → access-restricted host
  |     - Doppler service token → env var injection
  |     - Health check: GET /health (already implemented)
  |
  +-- EAS Build (mobile)
        - eas build --platform all --profile production
        - eas submit → TestFlight + Play Store
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | PHI Boundary |
|-----------|---------------|-------------------|--------------|
| **Expo Mobile App** | UI, local state, JWT storage | Fastify API only, via HTTPS | None — no PHI stored locally |
| **Cloudflare WAF** | DDoS, OWASP WAF rules, rate limiting at edge | Render (forward), R2 (CDN for non-PHI) | Passes through but does not store PHI |
| **Fastify API (Render)** | Auth, business logic, PHI access, presigned URL generation | Neon DB, Cloudflare R2, Doppler, Datadog/Sentry | PHI owner — all reads/writes audited |
| **Neon PostgreSQL** | Persistent PHI storage (field-level encrypted), audit logs | Fastify API (pooled connection) | PHI at rest — encrypted with AES-256-GCM |
| **Cloudflare R2** | Binary PHI storage (photos, lab PDFs) | Fastify API (presigned URL generation); Mobile app (direct upload/download via presigned URL) | PHI at rest — AES-256 server-side encryption |
| **Doppler** | Single source of truth for all environment secrets | Render (service token injection), GitHub Actions (CI secrets) | Holds encryption keys — not a PHI processor |
| **Datadog** | APM, infrastructure metrics, PHI-masked logs, audit log retention | Fastify API (agent/SDK), Render (infrastructure metrics) | Receives logs with PHI auto-masked |
| **Sentry** | Error tracking, source maps | Fastify API (SDK), Expo (SDK) | Must be configured with beforeSend to strip PHI from error payloads |

---

## Data Flow: PHI Through the System

### 1. User Writes Health Data (e.g., Lab Result)

```
Mobile App
  → POST /labs (JWT Bearer)
  → Cloudflare WAF validates request, forwards
  → Fastify auth middleware verifies JWT, attaches userId
  → Fastify sanitization middleware strips injection vectors
  → Fastify route handler calls Prisma
  → Prisma encryption middleware encrypts PHI fields (AES-256-GCM)
  → Neon PostgreSQL stores encrypted ciphertext
  → Fastify audit logger writes audit record (fire-and-forget)
  → API returns 201, no PHI in response body beyond what was submitted
```

### 2. User Uploads Photo (Binary PHI)

```
Mobile App
  → POST /photos/presign (JWT Bearer) — requests presigned URL
  → Fastify generates time-limited presigned PUT URL for R2
  → Fastify logs audit record: PRESIGN action, userId, expiry
  → Mobile App PUT directly to R2 via presigned URL (bypasses API)
  → Mobile App → POST /photos/confirm (sends R2 key back to API)
  → Fastify validates R2 key belongs to userId, creates DB record
  → Audit log: CREATE ProgressPhoto
```

### 3. User Reads Health Data

```
Mobile App
  → GET /dashboard (JWT Bearer)
  → Fastify auth + rate limit check
  → Prisma decrypts PHI fields transparently
  → Fastify audit logger writes READ record (fire-and-forget, non-blocking)
  → Datadog receives log entry with PHI fields masked
  → Response returned — encrypted in transit via TLS 1.3
```

### 4. Secrets Flow at Startup

```
Render deploy triggered (GitHub push to main)
  → Render pulls image/code from GitHub
  → Doppler service token (set as Render env var) authenticates to Doppler
  → Doppler CLI injects production secrets into process.env at startup
  → Fastify validates required env vars at boot (JWT_SECRET, DATABASE_URL, etc.)
  → Server starts, listens on 0.0.0.0:PORT
  → Render health check hits GET /health every 30s
```

---

## Environment Separation

Render's "Projects and Environments" feature provides network-isolated separation:

| Environment | Render Project | Neon Branch | Doppler Config | Purpose |
|-------------|---------------|-------------|----------------|---------|
| **production** | biopoint/production | main | production | Live users, HIPAA workspace, paid hosts only |
| **staging** | biopoint/staging | staging | staging | Pre-release validation, production-parity data |
| **dev** | local only | dev-[feature] | dev | Individual developer branches |

**Key rule:** Production Render environment is marked as "Protected" — only admins can trigger deploys. Staging auto-deploys from `develop` branch. Production deploys are manual-approval gated.

**Network isolation:** Render's environment-level private network isolation prevents staging services from touching the production Neon database.

---

## Patterns to Follow

### Pattern 1: Presigned URL for Binary PHI (Do Not Proxy Files Through API)

**What:** Generate a time-limited presigned URL from the API, then let the mobile app upload/download directly to R2. The API never receives the binary payload.

**When:** All file uploads and downloads (photos, lab PDFs).

**Why:** Avoids binary streaming through the API server, reduces attack surface, preserves audit chain (presign event logged, confirm event logged).

```typescript
// API generates presigned URL (already partially implemented in storageService.ts)
const presignedUrl = await storageService.getPresignedUrl(key, 900); // 15 min expiry
// Mobile app uses this URL directly — API does not proxy the bytes
```

**HIPAA note:** Presigned URLs must use short expiry (<15 min for write, <1 hour for read). Log the presign event as a PHI access audit record.

---

### Pattern 2: Doppler as Single Injection Point (No .env Files in Production)

**What:** Doppler service token is the only secret stored in Render's dashboard. All other secrets (DATABASE_URL, JWT_SECRET, R2 credentials, encryption keys) live in Doppler and are injected at deploy time.

**When:** Always. No exceptions for production.

**Why:** Single rotation point, full audit trail of secret access, no plaintext in Render's env var dashboard beyond the Doppler token.

```yaml
# doppler.yaml (already created in project)
setup:
  project: biopoint
  config: production
```

---

### Pattern 3: Neon Pooled Connection for API, Direct for Migrations

**What:** Use `-pooler` connection string (PgBouncer) for all API runtime queries. Use direct (non-pooler) connection string only for `prisma migrate deploy` in CI.

**When:** Always — serverless-style environments like Render open many short-lived connections that exhaust Neon's direct connection limit without pooling.

**Why:** Neon's PgBouncer supports up to 10,000 client connections. Direct connections are limited to ~420 on 1 CU compute. Prisma's `directUrl` field handles the split:

```typescript
// schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")         // pooler connection string (runtime)
  directUrl = env("DATABASE_DIRECT_URL")  // direct connection (migrations only)
}
```

Doppler stores both `DATABASE_URL` (pooler) and `DATABASE_DIRECT_URL` (direct).

---

### Pattern 4: Fire-and-Forget Audit Logging (Already Implemented)

**What:** Audit log writes are non-blocking — they do not fail the main request if the audit write fails.

**When:** Every PHI read, write, update, delete — already wired into route handlers.

**Why:** HIPAA §164.312(b) requires audit controls but the regulation does not require audit failure to block clinical operations. Blocking on audit writes would create availability risk.

**Retention:** Audit logs must be retained for minimum 6 years (HIPAA) — configure Datadog log retention policy to 7 years for the audit log stream.

---

### Pattern 5: Render HIPAA Workspace Before Any PHI in Production

**What:** Enable Render's HIPAA workspace (sign BAA, enable workspace upgrade) before the first production deploy that handles real user PHI.

**When:** Before go-live. The workspace upgrade is irreversible and triggers a ~5-minute redeployment of all services to access-restricted hosts.

**Why:** Once HIPAA workspace is enabled, Render provides dedicated access-restricted hosts, encrypted disks, encrypted snapshots, and TLS enforcement. Without it, the Render infrastructure layer is not covered by the BAA.

**Cost impact:** +20% fee on all Render usage. Free instances are migrated to smallest paid tier automatically. Budget for minimum ~$250/month on Render alone.

---

### Pattern 6: Zero-PHI in Sentry Payloads

**What:** Configure Sentry's `beforeSend` hook to scrub PHI from error payloads before transmission.

**When:** Required before production launch.

**Why:** Sentry receives error stack traces which may include request context. Without scrubbing, lab values, profile data, or user emails could appear in Sentry's error dashboard, which is outside the HIPAA BAA coverage unless Sentry signs one separately.

```typescript
// apps/api/src/utils/sentry.ts
Sentry.init({
  beforeSend(event) {
    // Strip request body from all events (may contain PHI)
    if (event.request?.data) delete event.request.data;
    // Strip user email (PII)
    if (event.user?.email) event.user.email = '[redacted]';
    return event;
  }
});
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing R2 Credentials in Mobile App

**What:** Embedding R2 access keys in the Expo app bundle so the mobile app can call R2 directly without presigned URLs.

**Why bad:** App store binaries are extractable. Any credential in the app bundle is effectively public. Violates HIPAA minimum necessary access principle and creates an unaudited PHI access path.

**Instead:** Always generate presigned URLs server-side, logged with userId and expiry. The mobile app uses the presigned URL directly (no embedded credentials).

---

### Anti-Pattern 2: Running Migrations Against Pooled Connection

**What:** Running `prisma migrate deploy` against the PgBouncer `-pooler` connection string.

**Why bad:** Migrations require a stable, long-lived connection with session-level locking. PgBouncer in transaction mode drops session-level state between queries, breaking migration tracking.

**Instead:** Use `DATABASE_DIRECT_URL` in CI/CD migration step only:
```yaml
# GitHub Actions migration step
- name: Run migrations
  env:
    DATABASE_URL: ${{ secrets.DATABASE_DIRECT_URL }}
  run: npm run db:migrate
```

---

### Anti-Pattern 3: Shared Render Workspace for Staging and Production

**What:** Running staging and production services in the same Render workspace/environment.

**Why bad:** HIPAA workspace upgrade applies per-workspace. If staging shares a workspace with production, any staging service misconfiguration can access production database via Render's private network. Render's environment isolation requires separate projects or environments with explicit network blocking.

**Instead:** Separate Render environments within a project, with private network isolation enabled and different Doppler configs injected per environment.

---

### Anti-Pattern 4: Logging PHI in Datadog Without Masking

**What:** Sending structured logs from Fastify to Datadog that include raw field values from PHI columns (dateOfBirth, lab values, notes).

**Why bad:** Datadog's log retention and access controls are separate from HIPAA requirements unless specifically configured. Unmasked PHI in logs creates a secondary breach surface.

**Instead:** Datadog's Log Pipelines should include a PHI masking processor before indexing. Application-level redaction (already partially in auditLog.ts for sensitive keys) must also cover response payload logging.

---

### Anti-Pattern 5: Render Free Tier for Any Production PHI Service

**What:** Deploying any service that touches PHI on Render's free tier.

**Why bad:** Free instances run on shared hosts that do not support Render's HIPAA-restricted access model. Render explicitly states free instances cannot be part of a HIPAA workspace and are migrated to paid on workspace upgrade.

**Instead:** Size all PHI-touching services at Render Starter ($7/month) or above before enabling the HIPAA workspace. Budget this as a fixed compliance cost.

---

## Build Order: Production Deployment Dependencies

Components have hard dependencies — this is the required build sequence:

```
Phase 1: Secrets Foundation
  ├── Doppler project + production config populated
  ├── Neon production branch + pooler connection string obtained
  ├── R2 production bucket created, credentials in Doppler
  └── Doppler service token → stored in Render env var dashboard

Phase 2: Render HIPAA Infrastructure
  ├── Render workspace upgraded to HIPAA (BAA signed)
  ├── All free instances migrated to paid (Render auto-handles)
  └── Production and Staging environments configured with network isolation

Phase 3: API Production Deploy
  ├── Database migrations via direct URL (GitHub Actions CI)
  ├── Render deploys Fastify API from main branch
  ├── Health check /health passes (already implemented)
  └── Datadog agent configured with PHI masking rules

Phase 4: Mobile Production Build
  ├── EAS Build profile "production" configured
  ├── Apple Developer account + provisioning profile
  ├── eas build --platform all --profile production
  └── eas submit → TestFlight (iOS) + Internal track (Android)

Phase 5: Observability Validation
  ├── Datadog dashboards confirm PHI masking active
  ├── Sentry beforeSend hook verified (no PHI in test error)
  ├── Audit log query confirms logs flowing to 7-year retention
  └── Smoke test: create + read PHI, verify audit records in DB
```

**Dependency rule:** Phase 2 (HIPAA workspace) must complete before Phase 3 (API deploy). The workspace upgrade redeploys services — deploying before upgrade means the first deploy runs on non-restricted hosts.

---

## Scalability Considerations

| Concern | Current (0-1K users) | Growth (1K-10K users) | Scale (10K+ users) |
|---------|---------------------|----------------------|-------------------|
| API compute | Render Starter (1 instance) | Render Standard + auto-scale | Render Pro + multiple instances |
| DB connections | Neon PgBouncer pooler (10K client limit) | Still pooler — scale Neon compute up for more `max_connections` | Read replicas for analytics queries |
| Storage | R2 single bucket, flat key structure | R2 still sufficient (zero egress) | R2 — add lifecycle rules for old versions |
| Secrets rotation | Manual rotation via Doppler | Automated rotation schedule (30-90 days) | HSM + Doppler Dynamic Secrets |
| Audit log volume | Neon audit_log table (fire-and-forget) | Consider offloading audit logs to dedicated Datadog index | Separate audit log store with immutable write policy |
| Monitoring | Datadog free/developer plan | Datadog Pro for custom metrics retention | Datadog Enterprise for HIPAA log archive |

---

## Cloudflare R2 HIPAA BAA Status (Confidence: MEDIUM)

**Finding:** Research sources indicate Cloudflare offers BAAs, but the ADR and some 2025 sources note that R2 does not match AWS S3's explicit HIPAA certification depth.

**Project ADR-003 position:** BAA is listed as "HIPAA Ready" and available. The project's Security Officer signed off on this posture.

**Recommendation:** Verify BAA coverage directly with Cloudflare Enterprise support before production launch if the app handles highly sensitive PHI categories (psychiatric notes, HIV status, substance abuse records). For biomarker tracking and progress photos at the current use case, R2 with a signed BAA is acceptable — but this needs explicit verification with Cloudflare's legal/compliance team, not just their marketing documentation.

**Fallback:** If R2 BAA coverage proves insufficient for the PHI categories in scope, swap to AWS S3 — the codebase already uses `@aws-sdk/client-s3` with the S3 API, so the endpoint change is a configuration update, not a code rewrite (ADR-003 explicitly documents this migration path).

---

## Sources

| Source | Confidence | URL |
|--------|-----------|-----|
| Render HIPAA docs | HIGH | https://render.com/docs/hipaa-compliance |
| Render HIPAA blog announcement | HIGH | https://render.com/blog/introducing-hipaa-enabled-workspaces |
| Render Projects + Environments | HIGH | https://render.com/docs/projects |
| Neon connection pooling docs | HIGH | https://neon.com/docs/connect/connection-pooling |
| Neon pool size dynamic update (Jan 2025) | HIGH | https://neon.com/docs/changelog/2025-01-10 |
| Doppler + Render integration | MEDIUM | https://www.doppler.com/integrations/render |
| Cloudflare R2 presigned URLs | HIGH | https://developers.cloudflare.com/r2/api/s3/presigned-urls/ |
| R2 vs S3 HIPAA comparison | MEDIUM | https://www.digitalapplied.com/blog/cloudflare-r2-vs-aws-s3-comparison |
| Expo EAS Build CI docs | HIGH | https://docs.expo.dev/build/building-on-ci/ |
| Project ADR-002 (Neon decision) | HIGH | /Users/GRAMMY/biopoint/docs/adr/ADR-002-neon-postgresql-over-rds.md |
| Project ADR-003 (R2 decision) | HIGH | /Users/GRAMMY/biopoint/docs/adr/ADR-003-cloudflare-r2-over-aws-s3.md |
| Project ADR-004 (Doppler decision) | HIGH | /Users/GRAMMY/biopoint/docs/adr/ADR-004-doppler-over-aws-secrets-manager.md |
| HIPAA compliant app architecture 2026 | MEDIUM | https://mindsea.com/blog/hipaa-compliant/ |
| Paubox: Is Render HIPAA compliant | MEDIUM | https://www.paubox.com/blog/is-render.com-hipaa-compliant-2025-update |
