# BioPoint Research Summary

**Project:** BioPoint -- HIPAA-Compliant Health Tracking App
**Domain:** Regulated mobile health (PHI: lab reports, biomarkers, progress photos)
**Researched:** 2026-02-19
**Confidence:** HIGH (all 4 research files sourced from official docs and confirmed vendor materials)

---

## 1. Critical Blockers

These items MUST be resolved before any real user PHI enters the system. Non-negotiable.

| Blocker | Source | Why It Blocks |
|---------|--------|---------------|
| **Gemini consumer API sending PHI** | PITFALLS #1, FEATURES | Direct HIPAA violation -- consumer Gemini has no BAA, lab images sent to it are unprotected PHI. OCR fines: $100-$50K per violation. Disable immediately or migrate to Vertex AI. |
| **Cloudflare R2 BAA unconfirmed** | PITFALLS #2, ARCHITECTURE, FEATURES | PHI photos stored in R2 but R2 is not explicitly named in Cloudflare's BAA scope. Enterprise plan required. If R2 cannot be confirmed, migrate to AWS S3 (codebase already uses @aws-sdk/client-s3, so it is a config change). |
| **Render HIPAA workspace not enabled** | STACK, PITFALLS #3, ARCHITECTURE | $250/month minimum, irreversible. Must be done BEFORE first production deploy or PHI runs on non-restricted hosts. |
| **Neon Pro + BAA not executed** | FEATURES, STACK | Free tier has no BAA. Scale plan with HIPAA add-on required. Self-serve. |
| **Prisma $use() deprecated -- encryption/audit at risk** | PITFALLS #5, FEATURES | 4 usages power encryption middleware and audit logging. Silently removed in Prisma v7. Migration to $extends is required before any Prisma upgrade and should happen now to eliminate the risk. |
| **Fastify v4 EOL (June 2025)** | STACK | No security patches. Running EOL software handling PHI is an audit finding. Upgrade to v5 before production. |
| **1% test coverage** | PITFALLS #11, FEATURES, STACK | HIPAA auditors ask for evidence that PHI access controls work. 1% coverage with PHI handling is indefensible. 80% threshold already configured but unmet. |

---

## 2. Key Discoveries

Cross-referencing the 4 research files surfaced these patterns:

**The "dead code" pattern is systemic.** Connection pool config exists but is not wired (PITFALLS #6). Rate limiter has Redis support coded but uses database fallback (PITFALLS #4). Coverage config has 80% thresholds but actual coverage is 1% (PITFALLS #11). The codebase has the right ideas architecturally but multiple critical paths are not actually connected. Every "config exists" claim must be verified with runtime evidence.

**BAA gaps are the single largest legal risk.** Three vendors (Gemini, Cloudflare R2, Render) lack executed BAAs. OCR issued $137M in penalties in 2025 with 18 enforcement actions in H1 alone -- missing BAAs are the leading trigger. This is not theoretical risk.

**Cost will increase significantly.** The project was targeting ~$20/month hosting. Reality: Render HIPAA workspace ($250/month minimum) + Neon Scale plan + Cloudflare Enterprise (for R2 BAA) + Apple Developer ($99/year). Budget $350-500/month minimum for compliant production infrastructure.

**The Fastify v5 upgrade and Prisma $use migration are coupled.** Both are breaking changes that affect middleware chains. They should be done together, under test coverage, in the same phase. Doing one without the other creates a half-migrated state.

**App Store submission has its own compliance surface.** Privacy manifest (NSPrivacyAccessedAPITypes), in-app account deletion, HealthKit usage descriptions, and privacy policy URL are all Apple-mandated and separate from HIPAA. These are rejection risks, not just nice-to-haves.

---

## 3. Recommended Stack Changes

| Change | Priority | Rationale |
|--------|----------|-----------|
| Fastify 4 -> 5 | P0 | EOL, no security patches |
| Prisma $use() -> $extends() | P0 | Encryption + audit middleware will silently break on next Prisma upgrade |
| Add `ioredis` ^5.3.2 | P0 | Required for persistent rate limiting via @fastify/rate-limit |
| Render Key Value (managed Redis) | P0 | HIPAA-covered Redis within Render workspace, no extra BAA vendor |
| Vitest 1.2 -> 3.x | P1 | v1 is EOL; v3 has AST-based V8 coverage remapping; skip v4 (React coverage bug) |
| Add jest-expo + @testing-library/react-native | P1 | Mobile has zero test setup -- official Expo recommendation |
| Add Semgrep to CI | P1 | Free SAST, TypeScript-native, OWASP Top 10 rules |
| Add OWASP ZAP to CI | P2 | DAST against staging, validates runtime security posture |
| Add eas-cli (global) | P2 | Official Expo build/submit toolchain for App Store |

**Do NOT add:** Upstash (incompatible with ioredis), StackHawk (paid, built on ZAP), Detox (requires Expo prebuild), Kubernetes (premature at launch scale).

---

## 4. Build Order Implications

Research reveals hard dependencies. The following order is non-negotiable in key areas:

**Phase A: Security Fixes (code-level, no infra needed)**
1. Disable Gemini endpoint behind feature flag OFF
2. Migrate Prisma $use() to $extends()
3. Fix LabMarker plaintext dual-storage bug
4. Fix [DECRYPTION_FAILED] sentinel leak
5. Fix audit log skip on empty results
6. Wire connection pool params into DATABASE_URL
7. Add /labs/trends database index
8. Eliminate 142 `as any` casts (prioritize auth.ts, auditLog.ts, sanitization.ts)
9. Add Semgrep + npm audit to CI

**Phase B: Infrastructure + BAAs (depends on Phase A for secure code)**
1. Execute BAAs: Neon Scale, Cloudflare R2 Enterprise, Render HIPAA workspace
2. Provision Render Key Value (Redis) in HIPAA workspace
3. Wire ioredis into @fastify/rate-limit
4. Upgrade Fastify 4 -> 5 (run existing tests to catch breaks)
5. Deploy API to Render HIPAA workspace
6. Configure Datadog PHI masking + Sentry beforeSend scrubbing

**Phase C: Test Coverage (depends on Phase A+B for stable codebase)**
1. API: route handlers, service layer, middleware, security tests -> 80%
2. Mobile: hooks, API client, forms, screens -> 80%
3. Encryption integration test (query DB, assert ciphertext not plaintext)
4. Audit log integration test (verify logs on reads, writes, AND empty results)

**Phase D: App Store Submission (depends on all above)**
1. Audit NSPrivacyAccessedAPITypes, add privacy manifest
2. Implement in-app account deletion
3. Confirm privacy policy URL accessible in-app
4. Run DAST sweep (OWASP ZAP) against staging
5. EAS Build -> TestFlight -> App Store Connect submission

**Why this order:** BAAs must precede deployment (legal). Code fixes must precede BAAs (no point signing BAA if code leaks PHI to Gemini). Tests must follow code stabilization (testing a moving target wastes effort). App Store is last because it requires everything else.

---

## 5. Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Cloudflare R2 not covered by BAA | CRITICAL | HIGH | Confirm with CF Enterprise sales in writing. Fallback: swap to AWS S3 (config-only change per ADR-003). |
| Gemini PHI exposure before fix deployed | CRITICAL | MEDIUM | Feature flag OFF immediately. No lab analysis in production until Vertex AI migration. |
| Render HIPAA cost shock ($250+/month vs $20 planned) | HIGH | CERTAIN | Accept as compliance cost. No cheaper HIPAA-compliant PaaS exists at this simplicity level. |
| Prisma $use() silently breaks on upgrade | HIGH | HIGH | Migrate to $extends() before any Prisma version bump. Add test that asserts DB columns contain ciphertext. |
| App Store rejection for missing privacy manifest | MEDIUM | MEDIUM | Run Xcode privacy report tool against built IPA before submission. |
| Neon cold start drops audit log writes | MEDIUM | LOW | Set min_cu > 0 in production. Add retry with dead-letter queue for audit writes. |
| OpenAI food analysis sending PHI without BAA | MEDIUM | UNKNOWN | Audit foodAnalysis.ts to determine what data is sent. If PHI is included, get Enterprise BAA or strip identifiers. |
| JWT rotation cannot revoke active sessions | MEDIUM | LOW (until breach) | Implement refresh token DB store with revocation endpoint for breach response. |

---

*Research completed: 2026-02-19*
*Ready for roadmap: YES -- proceed with 4-phase structure (Security Fixes -> Infrastructure -> Testing -> App Store)*
