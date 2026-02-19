# Requirements: BioPoint — Phase 5 & 6

**Defined:** 2026-02-19
**Core Value:** Get BioPoint's risk score from 2.5/10 to below 2.0/10 and deploy a production-ready, HIPAA-compliant health tracking app to Render + App Store.

## v1 Requirements

Requirements for Phase 5 (Security Enhancement) + Phase 6 (Production Hardening). Each maps to roadmap phases.

### Security Fixes

- [ ] **SEC-01**: Gemini lab analysis endpoint is disabled behind feature flag OFF (no PHI sent to non-BAA vendor)
- [ ] **SEC-02**: LabMarker.value no longer stores plaintext alongside encrypted copy (dual-storage bug fixed)
- [ ] **SEC-03**: `[DECRYPTION_FAILED]` sentinel is never returned in API responses (replaced with appropriate error)
- [ ] **SEC-04**: Audit log records access even when query returns empty results
- [ ] **SEC-05**: Prisma encryption middleware migrated from `$use()` to `$extends()` with integration test proving ciphertext in DB
- [ ] **SEC-06**: Connection pool parameters from `database.ts` are wired into Prisma client (not dead code)
- [ ] **SEC-07**: S3/R2 content-type validated server-side before accepting upload
- [ ] **SEC-08**: OpenAI food analysis endpoint audited for PHI exposure and remediated (strip identifiers or obtain BAA)

### Code Quality

- [x] **CODE-01**: All 142 `as any` casts eliminated (FastifyRequest interface augmented for `userId`, `userEmail`, `userRole`)
- [x] **CODE-02**: `noImplicitAny` enabled in API tsconfig.json
- [x] **CODE-03**: Dead code removed (unused `dataIntegrity.ts`, unused `getPrismaConfig`)
- [x] **CODE-04**: `automaticLogoff.ts` stats bug fixed
- [x] **CODE-05**: Deprecated Prisma `$use` middleware fully removed (no remaining usages)

### Compliance

- [ ] **COMP-01**: BAA executed with Neon (PostgreSQL — Scale plan with HIPAA add-on)
- [ ] **COMP-02**: BAA executed with Cloudflare (R2 storage — Enterprise plan, or migrate to AWS S3 if R2 not covered)
- [ ] **COMP-03**: BAA executed with Render (HIPAA workspace enabled)
- [x] **COMP-04**: PHI de-identification layer implemented for any AI/analytics services that lack BAAs
- [x] **COMP-05**: Privacy policy URL accessible in-app and accurate to current data practices

### Infrastructure

- [ ] **INFRA-01**: API deployed to Render HIPAA workspace (production environment)
- [ ] **INFRA-02**: Database running on Neon Pro/Scale with HIPAA add-on
- [ ] **INFRA-03**: Rate limiter migrated from in-memory to Redis (Render Key Value) for persistence across deploys
- [ ] **INFRA-04**: Fastify upgraded from v4 (EOL) to v5
- [ ] **INFRA-05**: `/labs/trends` database index added (eliminates full table scan)
- [ ] **INFRA-06**: Prisma `directUrl` configured for migrations (separate from pooled connection)
- [ ] **INFRA-07**: Production environment variables configured in Fly.io (via Doppler integration or `fly secrets set`)

### Testing

- [ ] **TEST-01**: API route handler test coverage reaches 80%
- [ ] **TEST-02**: API middleware test coverage reaches 80% (auth, encryption, rate limiting, audit log)
- [ ] **TEST-03**: API service layer test coverage reaches 80%
- [ ] **TEST-04**: Encryption integration test proves DB columns contain ciphertext (not plaintext)
- [ ] **TEST-05**: Audit log integration test verifies logging on reads, writes, AND empty results
- [ ] **TEST-06**: Mobile test infrastructure set up (jest-expo + @testing-library/react-native)
- [ ] **TEST-07**: Mobile component/hook test coverage reaches 80%
- [x] **TEST-08**: SAST tool (Semgrep) integrated into CI pipeline
- [x] **TEST-09**: npm audit added to CI pipeline with fail-on-high threshold

### Monitoring

- [x] **MON-01**: Datadog PHI fields masked in logs (no PHI in observability platform)
- [x] **MON-02**: Sentry `beforeSend` scrubs PHI from error reports
- [x] **MON-03**: Production alerting configured (error rate, response time, DB connection pool)
- [x] **MON-04**: Health check endpoint verified and monitored

### App Store

- [ ] **APPS-01**: iOS privacy manifest (NSPrivacyAccessedAPITypes) added and accurate
- [ ] **APPS-02**: In-app account deletion implemented (Apple requirement since 2022)
- [ ] **APPS-03**: HealthKit usage descriptions added if applicable
- [ ] **APPS-04**: App Store screenshots and metadata prepared
- [ ] **APPS-05**: TestFlight build deployed and smoke-tested
- [ ] **APPS-06**: App Store Connect submission completed for iOS
- [ ] **APPS-07**: DAST sweep (OWASP ZAP) run against staging with no critical findings

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Feature Enhancement

- **FEAT-01**: Gemini lab analysis re-enabled via Vertex AI with BAA (after Vertex AI Healthcare API available)
- **FEAT-02**: Android Play Store submission
- **FEAT-03**: Real-time push notifications for health alerts
- **FEAT-04**: HealthKit/Google Fit data sync
- **FEAT-05**: Community features enhancement (existing implementation ships as-is)

### Advanced Security

- **ASEC-01**: Hardware security key support (WebAuthn/FIDO2)
- **ASEC-02**: Biometric authentication on mobile
- **ASEC-03**: Custom WAF rules beyond Cloudflare defaults

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| New feature development | This milestone is security + production only |
| Android Play Store | iOS first — Android deferred to v2 |
| Custom WAF/DDoS protection | Render + Cloudflare handle this at infrastructure level |
| Real-time features / WebSocket | Not needed for launch |
| Kubernetes deployment | Using Render (simpler, sufficient for launch scale) |
| Detox E2E testing | Requires Expo prebuild, too heavy for v1 — use component/unit tests |
| Upstash Redis | Incompatible with ioredis; use Render Key Value instead |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 1 | Pending |
| SEC-04 | Phase 1 | Pending |
| SEC-05 | Phase 1 | Pending |
| SEC-06 | Phase 1 | Pending |
| SEC-07 | Phase 1 | Pending |
| SEC-08 | Phase 1 | Pending |
| CODE-01 | Phase 2 | Complete |
| CODE-02 | Phase 2 | Complete |
| CODE-03 | Phase 2 | Complete |
| CODE-04 | Phase 2 | Complete |
| CODE-05 | Phase 2 | Complete |
| COMP-01 | Phase 3 | Pending |
| COMP-02 | Phase 3 | Pending |
| COMP-03 | Phase 3 | Pending |
| COMP-04 | Phase 3 | Complete |
| COMP-05 | Phase 3 | Complete |
| INFRA-01 | Phase 4 | Pending |
| INFRA-02 | Phase 4 | Pending |
| INFRA-03 | Phase 4 | Pending |
| INFRA-04 | Phase 4 | Pending |
| INFRA-05 | Phase 4 | Pending |
| INFRA-06 | Phase 4 | Pending |
| INFRA-07 | Phase 4 | Pending |
| TEST-01 | Phase 5 | Pending |
| TEST-02 | Phase 5 | Pending |
| TEST-03 | Phase 5 | Pending |
| TEST-04 | Phase 5 | Pending |
| TEST-05 | Phase 5 | Pending |
| TEST-06 | Phase 5 | Pending |
| TEST-07 | Phase 5 | Pending |
| TEST-08 | Phase 2 | Complete |
| TEST-09 | Phase 2 | Complete |
| MON-01 | Phase 4 | Complete |
| MON-02 | Phase 4 | Complete |
| MON-03 | Phase 4 | Complete |
| MON-04 | Phase 4 | Complete |
| APPS-01 | Phase 6 | Pending |
| APPS-02 | Phase 6 | Pending |
| APPS-03 | Phase 6 | Pending |
| APPS-04 | Phase 6 | Pending |
| APPS-05 | Phase 6 | Pending |
| APPS-06 | Phase 6 | Pending |
| APPS-07 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 45 total
- Mapped to phases: 45/45
- Unmapped: 0

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 after roadmap creation (traceability populated)*
