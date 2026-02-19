# BioPoint — Phase 5 & 6: Production Launch

## What This Is

BioPoint is a comprehensive health tracking app for monitoring biomarkers, supplement/peptide stacks, lab results, and progress photos. It's an Expo React Native + Fastify API monorepo with HIPAA/GDPR compliance requirements. Phases 1-4 (crisis containment, perimeter hardening, infrastructure, compliance) are complete. This milestone covers Phase 5 (Security Enhancement) and Phase 6 (Production Hardening) to get the app deployed to production and submitted to the App Store.

## Core Value

Get BioPoint's risk score from 2.5/10 to below 2.0/10 and deploy a production-ready, HIPAA-compliant health tracking app to Render + App Store.

## Requirements

### Validated

<!-- Shipped and confirmed from Phases 1-4 -->

- ✓ AES-256-GCM field-level encryption for PHI — Phase 1
- ✓ JWT access tokens + refresh token rotation — Phase 1
- ✓ Rate limiting (multi-tier) — Phase 2
- ✓ Auth endpoint brute-force protection — Phase 2
- ✓ S3 presigned URL 5-minute expiry — Phase 2
- ✓ Content-type validation (upload) — Phase 2
- ✓ Input sanitization (XSS/SQL injection) — Phase 2
- ✓ HIPAA audit logging — Phase 2
- ✓ Request tracing — Phase 2
- ✓ CI/CD pipeline (GitHub Actions) — Phase 3
- ✓ Monitoring (Datadog + Sentry) — Phase 3
- ✓ Automated database backups — Phase 3
- ✓ Disaster recovery procedures — Phase 3
- ✓ Load balancing config — Phase 3
- ✓ Infrastructure as Code (Terraform) — Phase 3
- ✓ HIPAA compliance framework (100%) — Phase 4
- ✓ GDPR compliance framework (100%) — Phase 4
- ✓ Breach notification system — Phase 4
- ✓ GDPR data export/deletion — Phase 4

### Active

<!-- Phase 5 + 6 scope -->

- [ ] Disable Gemini lab analysis endpoint (PHI exposure — gate behind feature flag)
- [ ] Execute BAAs with Neon PostgreSQL, Cloudflare R2
- [ ] PHI de-identification layer for any AI/analytics services
- [ ] Fix connection pool not wired into Prisma (dead code in database.ts)
- [ ] Eliminate 142 `as any` casts (augment FastifyRequest interface)
- [ ] Enable `noImplicitAny` in API tsconfig
- [ ] Remove dead code (dataIntegrity.ts, unused getPrismaConfig)
- [ ] Fix audit log skip on empty results
- [ ] Fix `[DECRYPTION_FAILED]` sentinel leaking in API responses
- [ ] Fix LabMarker.value plaintext stored alongside encrypted copy
- [ ] Migrate rate limiter from in-memory to Redis/persistent store
- [ ] Fix `/labs/trends` full table scan (add database index)
- [ ] Update deprecated Prisma `$use` middleware to `$extends`
- [ ] Fix `automaticLogoff.ts` stats bug
- [ ] Validate S3 content-type server-side
- [ ] Achieve 80% test coverage (currently ~1%)
- [ ] Deploy API to Render (production)
- [ ] Deploy database on Neon Pro (HIPAA tier)
- [ ] Configure production monitoring + alerting
- [ ] Performance testing and optimization
- [ ] iOS App Store submission
- [ ] Android Play Store submission (if ready)
- [ ] Production security sweep (SAST/DAST)
- [ ] Penetration testing checklist

### Out of Scope

- New feature development — this milestone is security + production only
- Android Play Store (defer if not ready, iOS first)
- Custom WAF/DDoS protection — Render + Cloudflare handle this at infrastructure level
- Real-time features / WebSocket — not needed for launch
- Community features enhancement — existing implementation ships as-is
- Kubernetes deployment — using Render instead (simpler, sufficient)

## Context

**Existing Codebase:**
- 17,466 LOC across 169 files (API: 3,158, Mobile: 4,833, DB: 280)
- 13 Prisma data models, 6 handle PHI
- 20+ API routes, 10 middleware, 6 services
- Mobile: Zustand stores, Expo Router, 10+ components
- Shared: 9 Zod schema files

**Security History:**
- Original risk score: 7.8/10 (HIGH RISK)
- After 4 phases: 2.5/10 (ELEVATED but MANAGEABLE)
- Target: below 2.0/10 (PRODUCTION READY)
- 156 total findings, 135 resolved (85% remediation rate)
- 2 remaining high-risk: Gemini BAA + vendor BAAs

**IP Protection:**
- Source code registered on SongSecure blockchain (Feb 14, 2026)
- Certificate ID: 0qcsBYasprUmDN0RR

**Codebase Map:** See `.planning/codebase/` (7 documents, 2,007 lines)

## Constraints

- **HIPAA**: All PHI handling must be compliant before any real user data enters the system
- **Budget**: Solo founder — prefer affordable solutions (Render ~$20/mo, Neon Pro ~$19/mo)
- **BAAs**: Must be executed before production launch with real users
- **Test Coverage**: Must reach 80% before production (currently ~1%)
- **Deployment**: Render for API, Neon for DB, Cloudflare R2 for storage
- **App Store**: iOS is primary target, Android secondary

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Render over AWS | Simpler for solo founder, sufficient for initial scale, affordable | — Pending |
| Disable Gemini before launch | No BAA available for standard Gemini API, HIPAA violation risk | — Pending |
| Sign BAAs with Neon + Cloudflare | Both support BAAs on paid tiers, cheaper than migrating vendors | — Pending |
| iOS first, Android follow | Focus resources on one platform for launch | — Pending |
| Redis rate limiter | In-memory store lost on restart, Redis persists across deploys | — Pending |
| Prisma `$extends` migration | `$use` deprecated in Prisma v6, migrate now before it breaks | — Pending |

---
*Last updated: 2026-02-19 after initialization*
