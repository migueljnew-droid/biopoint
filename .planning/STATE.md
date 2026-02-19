# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** Get BioPoint's risk score from 2.5/10 to below 2.0/10 and deploy a production-ready, HIPAA-compliant health tracking app to Fly.io + App Store.
**Current focus:** Phase 3 complete — moving to Phase 4: Infrastructure & Deployment.

## Current Position

Phase: 4 of 6 (Infrastructure & Deployment) — PLANNED
Plan: 0 of 4 complete (04-01 Fastify v5, 04-02 Redis rate limiter, 04-03 PHI monitoring, 04-04 Fly.io deploy)
Status: Phase 4 planned — 4 plans across 3 waves, verified by plan-checker, ready to execute
Last activity: 2026-02-19 -- Phase 4 planned (research + 4 plans + verification passed)

Progress: [██████████░░░░░░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 8 (3 from Phase 1 + 3 from Phase 2 + 2 from Phase 3)
- Average duration: ~8 min per plan
- Total execution time: ~59 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1     | 3     | ~45m  | ~15m     |
| 2     | 3     | ~7m   | ~2m      |
| 3     | 2     | ~7m   | ~3.5m    |

**Recent Trend:**
- Last 3 plans: 02-03, 03-02, 03-01 (all completed)
- Trend: Very fast (utility code + documentation)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: Wave 1 (01-01 + 01-02) executed in parallel, Wave 2 (01-03) sequential
- Phase 1: Gemini lab analysis disabled via feature flag (not deleted — can re-enable with BAA)
- Phase 1: S3 magic byte validation uses file-type v19 (ESM, dynamic import)
- Phase 1: Encryption rewritten as pure functions for $extends (not $use middleware)
- Phase 1: LabMarker.value made nullable (Float?) so plaintext can be cleared after encryption
- Phase 1: Request-ID tracing moved from $use middleware to $extends $allOperations hook
- Phase 1: Connection pool params appended to DATABASE_URL via getConnectionUrl() helper
- Roadmap: 6 phases derived from 45 requirements (SEC/CODE/COMP/INFRA/TEST/MON/APPS)

### Phase 2 Decisions

- Wave 1: Plans 02-01 + 02-02 execute in parallel (touch different files)
- Wave 2: Plan 02-03 (CI) depends on both Wave 1 plans
- prismaRequestId.ts deletion moved from 02-02 to 02-01 (avoid parallel verify conflict)
- FastifyRequest augmentation via declaration merging (official Fastify TS pattern)
- `decorateRequest` calls for runtime safety alongside compile-time types
- Test file casts also eliminated (25 casts across 7 test files)
- [02-02]: Removed getPrismaConfig() only — getDatabaseConfig() and performanceTargets preserved (actively used)
- [02-02]: getStats() fix uses Object.entries to carry both sessionId key and SessionData value — passes key to isSessionExpired()
- [02-03]: docker://semgrep/semgrep:latest over returntocorp/semgrep-action@v1 (deprecated, not maintained)
- [02-03]: npm audit --audit-level=high (not moderate) — avoids transitive-dep noise while blocking exploitable vulns
- [02-03]: Removed ESLint security step referencing non-existent .eslintrc.security.js (always would have failed)
- [02-03]: Semgrep scopes to apps/ packages/ db/ only — infrastructure scanned by Checkov/tfsec separately

### Phase 3 Decisions

- **Render replaced by Fly.io** — $250/mo HIPAA workspace unaffordable, Fly.io Launch plan ~$30/mo with BAA
- **All BAAs deferred to pre-launch** — no real PHI in system yet, execute immediately before production deployment
- assertNoPhi() applied as defense-in-depth guard on existing static prompt — prevents future regressions
- PHI_PATTERNS uses lastIndex = 0 reset per iteration — required for global regex reuse
- Removed BioPoint Score de-identification claim from privacy policy (feature not implemented)
- Ages >89 → both birthYear null and ageRange '90+' per 45 CFR 164.514(b)(2)(i)
- Privacy policy helper components (SectionHeader, BulletItem, BodyText) established

### Pending Todos

None for current phase.

### Blockers/Concerns

- Cloudflare R2 BAA coverage is uncertain -- may need to migrate to AWS S3 (deferred to pre-launch)
- ROADMAP success criterion 1 references `packages/api/src/` but actual path is `apps/api/src/` — plans use correct path
- Phase 4 ROADMAP references Render — updated to Fly.io in REQUIREMENTS.md (INFRA-07)

## Phase 1 Summary

**Requirements addressed:** SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08

| Commit | Wave | Plans | Changes |
|--------|------|-------|---------|
| ab4eb4b | 1 | 01-01, 01-02 | Feature flag for Gemini, S3 magic byte validation, PHI audit comment, 7 audit log guards fixed, decryption sentinel → null |
| 5322afd | 2 | 01-03 | Encryption → pure functions, $extends client, LabMarker Float?, connection pool URL params, $use removed |

**Verification:**
- Zero `$use()` calls in codebase
- `$extends()` in db/src/index.ts
- LabMarker.value is `Float?` in schema
- Prisma generates successfully
- TypeScript: only 4 pre-existing errors (JS test file)
- Tests: 36 pass, 3 fail (pre-existing env/db issues)

## Phase 2 Summary

**Requirements addressed:** CODE-01, CODE-02 (02-01), CODE-03, CODE-04 (02-02), TEST-08, TEST-09 (02-03)

| Commit | Plan | Changes |
|--------|------|---------|
| 3e9f20d | 02-01 | FastifyRequest declaration merging, 167 as-any casts eliminated, test files fixed |
| b58d5e6 | 02-01 | noImplicitAny + noUnusedLocals + noUnusedParameters enabled, 42 errors fixed |
| 00019f9 | 02-02 | dataIntegrity.ts deleted, getPrismaConfig() removed from database.ts |
| 3961d40 | 02-02 | automaticLogoff.ts getStats() bug fixed (Object.entries + sessionId) |
| 6c552de | 02-03 | Semgrep modernized to semgrep/semgrep container, pull_request trigger added, SARIF upload |
| 5ceea08 | 02-03 | npm audit --audit-level=high in ci.yml |

## Phase 3 Summary

**Requirements addressed:** COMP-01, COMP-02, COMP-03 (03-01), COMP-04, COMP-05 (03-02)

| Commit | Plan | Changes |
|--------|------|---------|
| 303182f | 03-02 | deidentify.ts (3 functions, 2 types, PHI_PATTERNS), foodAnalysis.ts assertNoPhi guard |
| 11ad90c | 03-02 | privacy.tsx rewrite with BAA disclosure, AI food analysis section, no raw markdown |
| — | 03-01 | vendor-baa-tracker.md updated: Render→Fly.io, BAAs deferred to pre-launch |

## Session Continuity

Last session: 2026-02-19
Stopped at: Phase 4 planned
Resume file: None
Next action: Execute Phase 4 (/gsd:execute-phase 4)
