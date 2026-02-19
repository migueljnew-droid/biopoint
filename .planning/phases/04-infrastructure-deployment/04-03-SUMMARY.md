---
phase: 04-infrastructure-deployment
plan: 03
subsystem: infra
tags: [pino, sentry, datadog, hipaa, phi, monitoring, logging, alerting]

# Dependency graph
requires:
  - phase: 04-infrastructure-deployment
    provides: monitoring.ts base configuration with Datadog APM and Sentry init

provides:
  - Extended pino redact paths covering HIPAA 18 identifiers (email, name, dateOfBirth, value, notes, markers)
  - Sentry beforeSend PHI scrubbing (breadcrumbs, extra context, user context)
  - maxBreadcrumbs reduced from 100 to 20 to limit PHI exposure window
  - ALERT_THRESHOLDS export (errorRatePercent, responseTimeP95Ms, dbPoolUsagePercent)
  - alerts.ts with DATADOG_MONITORS (3 monitors) and SENTRY_ALERT_RULES
  - doppler.yaml updated with DATADOG and SENTRY secret keys

affects:
  - 04-04-fly-deploy (reads ALERT_THRESHOLDS for health check context)
  - All monitoring consumers importing monitoring.ts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pino censor: '[REDACTED]' preferred over remove: true for HIPAA-compliant debuggability"
    - "Sentry beforeSend PHI scrubbing via destructuring rest pattern (keep safe keys, drop PHI)"
    - "User context in Sentry: only opaque user.id — never user.email"
    - "Datadog monitor definitions co-located with ALERT_THRESHOLDS in code for threshold sync"

key-files:
  created:
    - apps/api/src/config/alerts.ts
  modified:
    - apps/api/src/config/monitoring.ts
    - doppler.yaml

key-decisions:
  - "censor: '[REDACTED]' replaces remove: true — preserves log structure for debugging while remaining HIPAA-compliant"
  - "beforeSend scrubs breadcrumbs, extra context, and user.email — three distinct PHI vectors covered"
  - "maxBreadcrumbs: 20 (down from 100) — reduces the PHI exposure window from Sentry auto-instrumentation"
  - "DATADOG_MONITORS co-located with ALERT_THRESHOLDS in config/ — threshold drift prevention"

patterns-established:
  - "PHI redact pattern: wildcard (*.field) + request body (body.field) + response (res.field)"
  - "Sentry PHI scrub: destructure PHI keys, spread safe remainder into crumb.data/event.extra"

requirements-completed:
  - MON-01
  - MON-02
  - MON-03
  - MON-04

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 4 Plan 03: PHI Monitoring Hardening Summary

**Pino redact paths extended to 23 HIPAA-compliant fields, Sentry beforeSend scrubs breadcrumbs/extra/user context, and Datadog monitor definitions for error rate/response time/DB pool production alerting added.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T22:25:18Z
- **Completed:** 2026-02-19T22:28:00Z
- **Tasks:** 3
- **Files modified:** 3 (monitoring.ts, alerts.ts created, doppler.yaml)

## Accomplishments

- Extended pino `redact.paths` from 10 to 23 paths covering all HIPAA 18 identifier field names used in the codebase
- Implemented Sentry `beforeSend` PHI scrubbing across 3 attack surfaces: breadcrumb data, event.extra, and user context
- Reduced `maxBreadcrumbs` from 100 to 20, cutting the PHI exposure window by 80%
- Created `alerts.ts` with 3 Datadog monitor definitions (error rate >1%, p95 >2000ms, DB pool >80%) and Sentry alert rules
- Exported `ALERT_THRESHOLDS` from `monitoring.ts` for use by health check routes and deploy scripts

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend pino PHI redact paths** - `069a23a` (feat)
2. **Task 2: Implement Sentry beforeSend PHI scrubbing and reduce breadcrumb limit** - `837f0d0` (feat)
3. **Task 3: Configure production alerting for error rate, response time, and DB connection pool** - `c8cb3fe` (feat)

## New PHI Redact Paths Added to Pino

Previously (10 paths):
- `*.password`, `*.token`, `*.secret`, `*.api_key`, `*.ssn`, `*.dob`, `*.phi`, `*.pii`, `headers.authorization`, `headers.cookie`

Added (13 new paths):
- `*.email` — Direct identifier in auth/profile routes
- `*.name` — PHI when associated with health records
- `*.dateOfBirth` — Profile model field
- `*.value` — Lab marker values (encrypted in DB)
- `*.notes` — Clinical notes in StackItem, LabReport, DailyLog, ProgressPhoto
- `*.markers` — Lab marker arrays
- `body.email` — Request body patterns
- `body.name`
- `body.dateOfBirth`
- `body.value`
- `body.notes`
- `res.email` — Response patterns
- `res.name`

Changed: `remove: true` → `censor: '[REDACTED]'` for better debuggability while remaining compliant.

## Sentry beforeSend Changes

**Already present (kept):**
- Health check filter (`event.transaction?.includes('/health') → return null`)
- Compliance context addition (`framework: 'hipaa'`, `data_classification: 'phi'`)

**Added:**
1. **Breadcrumb scrubbing** — `event.breadcrumbs.values.map()` removes `email`, `name`, `value`, `notes`, `dateOfBirth`, `phi`, `password`, `token` from `crumb.data`
2. **Extra context scrubbing** — Same PHI keys removed from `event.extra`
3. **User context stripping** — `event.user.email` removed; only `event.user.id` (opaque) preserved

## maxBreadcrumbs Change

- **Before:** `maxBreadcrumbs: 100`
- **After:** `maxBreadcrumbs: 20` (80% reduction in PHI exposure window)

## TypeScript Compilation Result

`npx tsc --noEmit -p apps/api/tsconfig.json` — zero errors after all changes.

## Health Endpoint Verification

`/health` endpoint confirmed to return `{ status: 'ok' }` from source code review:
- File: `apps/api/src/routes/health.ts` line 227
- In test mode returns `{ status: 'ok', timestamp, uptime, database, responseTime }`
- In production returns `{ status: 'ok', ... }` with optional database pool details

## Files Created/Modified

- `apps/api/src/config/monitoring.ts` — Extended pino redact paths, Sentry beforeSend PHI scrubbing, ALERT_THRESHOLDS export
- `apps/api/src/config/alerts.ts` — New file: DATADOG_MONITORS (3 monitors) and SENTRY_ALERT_RULES
- `doppler.yaml` — Added DATADOG_API_KEY, DATADOG_ENABLED, SENTRY_DSN, SENTRY_ENABLED to api service secrets

## Decisions Made

- `censor: '[REDACTED]'` over `remove: true` — preserves log field structure (key exists, value masked), easier to debug PHI-adjacent issues while remaining HIPAA-compliant
- `beforeSend` uses destructuring rest pattern (`{ email, name, ...safe }`) — type-safe PHI removal that compiles cleanly with `noUnusedLocals`
- DATADOG_MONITORS defined as TypeScript `as const` — type-safe definitions that can be serialized to Datadog API calls
- SENTRY_DSN and DATADOG keys added to doppler.yaml (were missing) — ensures secrets are managed via Doppler in all environments

## Deviations from Plan

None - plan executed exactly as written.

The plan noted that `SentryManager` class in `utils/sentry.ts` already has adequate `scrubHeaders`/`scrubQuery` methods — confirmed no changes needed there.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Datadog monitors defined in `alerts.ts` must be created via Datadog API or Terraform using the monitor definitions — but this is a deploy-time operation, not a code change.

## Next Phase Readiness

- `ALERT_THRESHOLDS` ready for import by plan 04-04 (Fly.io deploy) health check routes
- Datadog monitor definitions in `alerts.ts` ready to POST to Datadog API during deploy
- PHI protection in logs and error reports hardened — ready for production deployment

---
*Phase: 04-infrastructure-deployment*
*Completed: 2026-02-19*
