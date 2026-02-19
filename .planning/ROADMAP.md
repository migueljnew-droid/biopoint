# Roadmap: BioPoint — Phase 5 & 6: Production Launch

## Overview

BioPoint is a health tracking app with HIPAA/GDPR compliance requirements that has completed 4 phases of security remediation (risk score 7.8 -> 2.5). This milestone takes the risk score below 2.0 and deploys to production via Render + App Store. The work flows through 6 phases: first fix all PHI exposure and encryption bugs in the code, then clean up code quality and add CI security scanning, then execute vendor BAAs, then deploy production infrastructure with monitoring, then build test coverage to 80%, and finally submit to the iOS App Store.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: PHI Security Fixes** - Eliminate all PHI exposure vectors and encryption bugs in the codebase
- [x] **Phase 2: Code Quality & CI Hardening** - Clean code, enable strict typing, add SAST/dependency scanning to CI (completed 2026-02-19)
- [x] **Phase 3: Compliance & Vendor Agreements** - Execute BAAs with all PHI-handling vendors, implement de-identification layer (completed 2026-02-19)
- [ ] **Phase 4: Infrastructure & Deployment** - Deploy production environment on Render HIPAA workspace with monitoring
- [ ] **Phase 5: Test Coverage** - Achieve 80% test coverage across API and mobile with integration tests
- [ ] **Phase 6: App Store Submission** - Prepare and submit iOS app to App Store Connect

## Phase Details

### Phase 1: PHI Security Fixes
**Goal**: No PHI leaks exist in the codebase -- every data path that touches protected health information is encrypted, gated, or disabled
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08
**Success Criteria** (what must be TRUE):
  1. Gemini lab analysis endpoint returns 404 or feature-flag-disabled response (no PHI sent to non-BAA vendor)
  2. LabMarker database rows contain only ciphertext in the value column (no plaintext duplicate)
  3. API error responses never contain the string `[DECRYPTION_FAILED]` -- a proper error message is returned instead
  4. Audit log has entries for queries that return zero results (not just queries with data)
  5. Prisma encryption uses `$extends()` and an integration test proves DB columns store ciphertext
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- PHI exposure remediation (Gemini disable, S3 content-type validation, OpenAI audit)
- [x] 01-02-PLAN.md -- Decryption sentinel fix and audit log unconditional logging
- [x] 01-03-PLAN.md -- Prisma $extends migration, LabMarker plaintext fix, connection pool wiring

### Phase 2: Code Quality & CI Hardening
**Goal**: The codebase has zero `as any` casts, strict TypeScript checking, no dead code, and every push is scanned for vulnerabilities
**Depends on**: Phase 1
**Requirements**: CODE-01, CODE-02, CODE-03, CODE-04, CODE-05, TEST-08, TEST-09
**Success Criteria** (what must be TRUE):
  1. `grep -r "as any" apps/api/src/` returns zero matches
  2. API tsconfig.json has `"noImplicitAny": true` and `tsc --noEmit` passes with zero errors
  3. Files `dataIntegrity.ts` and unused `getPrismaConfig` no longer exist in the codebase
  4. CI pipeline runs Semgrep SAST and `npm audit --audit-level=high` on every push, failing on findings
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- TypeScript strictness: eliminate all as-any casts, create FastifyRequest augmentation, enable noImplicitAny
- [x] 02-02-PLAN.md -- Dead code removal and bug fix: delete dataIntegrity.ts, prismaRequestId.ts, getPrismaConfig; fix automaticLogoff stats bug
- [x] 02-03-PLAN.md -- CI security pipeline: modernize Semgrep to container approach, set npm audit to --audit-level=high

### Phase 3: Compliance & Vendor Agreements
**Goal**: Every vendor that touches PHI has an executed BAA, and any AI service without a BAA receives only de-identified data
**Depends on**: Phase 1 (PHI exposure must be fixed before BAAs are meaningful)
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05
**Success Criteria** (what must be TRUE):
  1. Signed BAA documents exist for Neon (PostgreSQL), Cloudflare (R2), and Render (HIPAA workspace)
  2. PHI de-identification layer strips all 18 HIPAA identifiers before data reaches any non-BAA service
  3. Privacy policy URL is accessible from within the app and accurately describes current data practices
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md -- BAA execution with Neon, Cloudflare/AWS, Render, and OpenAI (vendor dashboard + signing)
- [ ] 03-02-PLAN.md -- PHI de-identification utility, food analysis PHI guard, privacy policy accuracy update

### Phase 4: Infrastructure & Deployment
**Goal**: BioPoint API is running in a HIPAA-compliant production environment with persistent rate limiting, current framework versions, and PHI-safe monitoring
**Depends on**: Phase 3 (BAAs must be executed before deploying PHI to vendors)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, MON-01, MON-02, MON-03, MON-04
**Success Criteria** (what must be TRUE):
  1. API responds to requests at production URL on Fly.io HIPAA workspace (NOTE: Render replaced by Fly.io per Phase 3 decision)
  2. Database is running on Neon Scale with HIPAA add-on and Prisma directUrl configured for migrations
  3. Rate limiter persists state across deploys (Redis-backed, not in-memory)
  4. Fastify is version 5.x (not EOL v4) and all routes respond correctly
  5. Datadog logs and Sentry error reports contain zero PHI fields (masking/scrubbing verified)
**Plans**: 4 plans

Plans:
- [ ] 04-01-PLAN.md — Fastify v5 upgrade, LabMarker composite index, Prisma directUrl (Wave 1)
- [ ] 04-02-PLAN.md — Redis rate limiter migration (ioredis + @fastify/rate-limit v10 global plugin) (Wave 2)
- [ ] 04-03-PLAN.md — PHI monitoring hardening (pino redact + Sentry beforeSend scrubbing) (Wave 1)
- [ ] 04-04-PLAN.md — Fly.io deployment configs + production deployment checkpoint (Wave 3)

### Phase 5: Test Coverage
**Goal**: 80% test coverage across API route handlers, middleware, services, and mobile components, with integration tests proving encryption and audit logging work correctly
**Depends on**: Phase 4 (test against stable, deployed codebase -- not a moving target)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07
**Success Criteria** (what must be TRUE):
  1. API route handler test coverage is at or above 80% (reported by Vitest coverage)
  2. API middleware and service layer test coverage are each at or above 80%
  3. Encryption integration test queries the database directly and asserts columns contain ciphertext (not plaintext)
  4. Audit log integration test verifies log entries exist for read, write, AND empty-result queries
  5. Mobile test infrastructure exists (jest-expo + @testing-library/react-native) and component/hook coverage reaches 80%
**Plans**: TBD

Plans:
- [ ] 05-01: API test coverage (route handlers, middleware, service layer)
- [ ] 05-02: Integration tests (encryption verification, audit log verification)
- [ ] 05-03: Mobile test coverage (test infrastructure setup, component and hook tests)

### Phase 6: App Store Submission
**Goal**: BioPoint iOS app passes Apple review and is available for download on the App Store
**Depends on**: Phase 5 (all code, infrastructure, and testing must be complete)
**Requirements**: APPS-01, APPS-02, APPS-03, APPS-04, APPS-05, APPS-06, APPS-07
**Success Criteria** (what must be TRUE):
  1. iOS privacy manifest (NSPrivacyAccessedAPITypes) is present in the build and accurately declares API usage
  2. Users can delete their account from within the app (Apple requirement)
  3. TestFlight build is deployed and basic user flows work (signup, login, add biomarker, view labs, upload photo)
  4. DAST sweep (OWASP ZAP) against staging returns zero critical findings
  5. App Store Connect submission is completed and status is "Waiting for Review" or approved
**Plans**: TBD

Plans:
- [ ] 06-01: App Store compliance (privacy manifest, account deletion, HealthKit descriptions, privacy policy)
- [ ] 06-02: Build and submission (screenshots, metadata, TestFlight, DAST sweep, App Store Connect)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. PHI Security Fixes | 3/3 | Complete | 2026-02-19 |
| 2. Code Quality & CI Hardening | 3/3 | Complete   | 2026-02-19 |
| 3. Compliance & Vendor Agreements | 2/2 | Complete | 2026-02-19 |
| 4. Infrastructure & Deployment | 1/4 | In Progress|  |
| 5. Test Coverage | 0/3 | Not started | - |
| 6. App Store Submission | 0/2 | Not started | - |

---
*Roadmap created: 2026-02-19*
*Last updated: 2026-02-19*
