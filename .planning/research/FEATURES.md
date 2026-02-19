# Feature Landscape: Security Enhancement & Production Hardening

**Domain:** HIPAA-compliant health data app (PHI: lab reports, biomarkers, progress photos)
**Milestone scope:** Phase 5 (Security Enhancement) + Phase 6 (Production Hardening)
**Researched:** 2026-02-19
**Overall confidence:** HIGH — HIPAA regulations are public law; App Store guidelines are published by Apple; vendor BAA availability confirmed from official documentation.

---

## Context: What Already Exists

BioPoint already has (do NOT re-implement):
- AES-256-GCM field-level encryption for PHI
- JWT auth + refresh token rotation
- Multi-tier rate limiting (in-memory)
- Brute-force protection on auth endpoints
- HIPAA audit logging framework
- CI/CD pipeline (GitHub Actions)
- Monitoring (Datadog + Sentry)
- Automated database backups + DR procedures
- HIPAA + GDPR compliance frameworks (documented, 100%)
- Breach notification system
- Input sanitization (XSS/SQL injection)
- Request tracing

The gap: 1% test coverage, no production deployment, no BAAs executed, Gemini endpoint leaking PHI, Redis rate limiter not wired, code quality bugs.

---

## Table Stakes

Features where absence blocks launch — App Store rejection, HIPAA violation, or production instability.

| Feature | Why Non-Negotiable | Complexity | Current State |
|---------|-------------------|------------|---------------|
| **BAAs with Neon + Cloudflare R2** | HIPAA requires written BAA before any PHI touches vendor infrastructure. Without this: illegal operation. Neon: self-serve on Scale plan. Cloudflare R2: requires Enterprise (verify separately — R2 PHI storage requires confirming R2 is explicitly in BAA scope). | Low (paperwork) | Missing — 2 remaining HIGH-risk findings |
| **Render HIPAA-enabled workspace + BAA** | Render now offers self-serve HIPAA workspaces ($250/mo, Organization plan). BAA signed via dashboard. Services run on access-restricted hosts. Without this: PHI on non-HIPAA infra = violation. | Low (config + cost) | Missing |
| **Gemini endpoint disabled/gated** | Standard Gemini API has no BAA. Sending lab report images to Gemini = unprotected PHI transmission = HIPAA violation. Must be behind feature flag OFF by default or replaced with a BAA-covered service. | Low (feature flag) | Identified, not done |
| **PHI de-identification before AI/analytics** | Any AI service not covered by BAA must receive only de-identified data. Even with a future Gemini Workspace BAA, de-identification is defense-in-depth. | Medium | Missing |
| **80% test coverage (API)** | Not a HIPAA mandate by number, but: risk-based HIPAA testing requires demonstrating PHI access paths are tested. 1% coverage with PHI handling is indefensible in an audit. 80% is the configured threshold in vitest.config.ts. | High (173 routes/middleware, ~1% → 80%) | 1% currently |
| **Redis-backed rate limiter** | In-memory rate limiter resets on every deploy. On Render, services restart frequently. An attacker can trigger a deploy to reset brute-force counters. Redis persists state. | Medium | Dead code exists (in-memory active) |
| **Fix [DECRYPTION_FAILED] sentinel leaking** | Sentinel value leaking in API responses reveals encryption internals to attackers. Security flaw. | Low | Bug confirmed |
| **Fix LabMarker.value plaintext alongside encrypted copy** | Dual-storage means PHI exists unencrypted in DB. Violates the encryption guarantee. | Low-Medium | Bug confirmed |
| **Fix audit log skip on empty results** | HIPAA requires audit trail of ALL PHI access, including queries that return no results. Skipping empties = audit gap = finding in HIPAA audit. | Low | Bug confirmed |
| **Production API deployment to Render** | Nothing ships without this. | Medium (env vars, health checks, TLS) | Missing |
| **Neon Pro (HIPAA tier) database** | Free tier lacks BAA eligibility. Must be on Scale plan with HIPAA add-on enabled. | Low (plan upgrade + migration) | Missing |
| **iOS App Store submission** | Core business goal. Requires: privacy manifest (NSPrivacyAccessedAPITypes), privacy policy URL, account deletion flow in-app, App Review Notes with demo credentials. | Medium (Apple process + compliance docs) | Missing |
| **Privacy manifest (NSPrivacyAccessedAPITypes)** | Enforced by Apple since May 2024. Apps using File Timestamp, UserDefaults, SystemBootTime, or DiskSpace APIs must declare them. Missing = ITMS-91053 rejection. | Low | Unknown — must audit |
| **In-app account deletion** | Apple Guideline requirement since June 2022. Apps with user registration must allow account deletion initiated within the app. Rejection if missing. | Low-Medium | Status unknown |
| **Privacy policy URL in App Store Connect** | Required for any health/medical app. Must be accessible URL, not PDF attachment. | Low | Status unknown |
| **Production monitoring + alerting** | Datadog + Sentry already exist. Must be configured for production environment with PagerDuty/alert routing before launch. Without it: blind to production failures. | Low (config) | Staging only |
| **SAST in CI/CD (GitHub Actions)** | Catch security regressions before they reach production. Semgrep or GitHub CodeQL — both free. Should gate merges to main. | Low (add workflow step) | Missing |
| **noImplicitAny enabled + any casts fixed** | 142 `as any` casts + disabled `noImplicitAny` means TypeScript's safety guarantees are off in the API layer handling PHI. Type safety is part of PHI integrity. | Medium (142 locations) | Identified, not done |
| **Fix database connection pool (Prisma)** | Dead code — pool configured but not wired into Prisma instance. Under production load, connection exhaustion will occur. | Low | Bug confirmed |
| **Fix /labs/trends full table scan** | Missing index causes full table scan on PHI-heavy table. Under real load: slow queries, timeouts, potential DoS. | Low (add index) | Bug confirmed |
| **Fix Prisma $use → $extends migration** | `$use` is deprecated in Prisma v6. This is how HIPAA audit logging hooks into DB queries. If it breaks after an upgrade, audit logging silently stops. | Low-Medium | Identified |

---

## Differentiators

Features that are not blocking launch but provide competitive advantage or defensibility.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **DAST sweep (OWASP ZAP or StackHawk)** | Confirms runtime behavior matches code-level assertions. Catches auth bypass, session issues, header injection that SAST misses. Becomes mandatory under proposed 2026 HIPAA NPRM (bi-annual vulnerability scans). Doing it pre-launch = ahead of regulation. | Medium (run against staging) | Not blocking launch but validates security posture |
| **Penetration test checklist + evidence** | Proposed 2026 HIPAA rule mandates annual pen tests by "qualified persons." Generating a pre-launch pen test report (even self-conducted checklist) creates audit evidence. Shows diligence for App Store Review Notes. | High if hired firm; Medium if internal checklist | Not blocking; becomes mandatory if NPRM finalizes |
| **PHI access dashboard for users** | Users can view what PHI BioPoint holds about them + export/delete it. GDPR Article 15 already mandated. Displaying it in-app (not just API endpoint) builds trust. Differentiated vs. competitors who bury it in email requests. | Medium | GDPR export/deletion API exists; UI layer missing |
| **MFA (biometric already exists, add TOTP fallback)** | Expo local authentication (Face ID/Touch ID) is implemented. Proposed 2026 HIPAA changes mandate MFA for ePHI access. Adding TOTP as fallback (when biometrics fail/unavailable) makes MFA coverage complete. | Medium | Biometrics exist; TOTP missing |
| **Automated vulnerability scanning in CI** | Beyond SAST: dependency vulnerability scanning (npm audit, Snyk free tier) catches CVEs in third-party packages before they reach production. Under proposed 2026 HIPAA: bi-annual vulnerability scans required. | Low (npm audit already exists; add Snyk action) | Quick win |
| **Certificate pinning (mobile → API)** | Prevents man-in-the-middle attacks on the mobile client. HIPAA best practice for apps transmitting ePHI. Expo doesn't make this trivial but react-native-ssl-pinning exists. | High | Recommended by HIPAA mobile guidance but not blocking launch |
| **Remote wipe capability** | HIPAA best practice when device containing PHI is lost/stolen. If BioPoint caches any PHI on-device (Zustand + AsyncStorage), remote invalidation of tokens + cache-bust mechanism is the minimum. Full MDM-style remote wipe is enterprise-tier. | Medium (token revocation already exists; add cache invalidation signal) | Token rotation handles most of this |
| **Annual compliance audit automation** | Proposed 2026 HIPAA: compliance audit at least once per 12 months. Script that generates compliance report from audit logs + test results + BAA inventory = evidence artifact. | Medium | Valuable for future investors/enterprise customers |
| **OpenAI GPT-4o BAA (or disable food analysis)** | OpenAI Enterprise does offer HIPAA BAAs. If food photo analysis sends any PHI (user ID, health context), it needs BAA coverage. Current implementation uses `openai` package — unclear if it's sending PHI. Audit required. | Low (audit) → Medium (replace or get BAA) | Flag: verify what data food analysis sends |

---

## Anti-Features

Features to deliberately NOT build in Phase 5/6. These are scope creep risks.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Custom WAF / DDoS protection** | Render + Cloudflare handle this at infra level. Building custom L7 WAF is months of work and maintenance burden. | Already scoped out. Trust Render + Cloudflare. |
| **Kubernetes deployment** | K8s YAML exists in the repo but Render is simpler, cheaper, and sufficient for launch scale. Migrating to K8s adds ops complexity with no benefit at launch traffic levels. | Render. Revisit at 10K+ users. |
| **Android Play Store (Phase 5/6)** | Focus resources. iOS first. Android adds: separate build config, Google Play Data Safety form, different security model, more devices to test. | Defer until iOS is live and generating signal. |
| **Full MDM remote wipe** | Enterprise Mobile Device Management is for companies issuing devices to employees. BioPoint is a consumer health app — token revocation + local storage clear is sufficient. | Implement token revocation + clear local Zustand cache on logout. |
| **Real-time features / WebSocket** | Out of scope per PROJECT.md. Adds infra complexity, attack surface. | Ship polling-based UX. |
| **Community features enhancement** | Out of scope. Existing implementation ships as-is. | Don't touch. |
| **Building a TOTP auth server from scratch** | Use a managed auth provider or existing JWT + biometric. TOTP adds complexity + support burden for solo founder. | Biometric (already exists) is sufficient for launch. Add TOTP as post-launch differentiator. |
| **SOC 2 Type 2 certification** | Requires 6-12 months of evidence collection + auditor fees ($20K-50K). Premature for launch. | Get SOC 2 readiness assessment post-Series A. |
| **FDA SaMD clearance** | BioPoint tracks biomarkers but does not diagnose conditions or drive clinical decisions — likely not SaMD. Pursuing 510(k) would take 1-2 years. | Add clear "not for clinical diagnosis" disclaimer in app. |
| **New clinical features** | Phase 5/6 is security + production only. No new feature development. | Park in backlog. |

---

## Feature Dependencies

```
BAA: Neon (Scale plan) → Production database on Neon Pro
BAA: Render (Organization plan) → Production API deployment on Render
BAA: Cloudflare Enterprise → R2 for PHI storage (verify R2 in BAA scope)

Gemini endpoint disabled → PHI de-identification layer (if re-enabling later)

Redis rate limiter → Production deployment (needs Redis service on Render)

80% test coverage → App Store submission (risk gate: PHI handling must be tested)
Fix Prisma $use → $extends → Test coverage (audit log tests must pass)
Fix audit log skip → Test coverage (compliance tests verify this)
Fix LabMarker plaintext → Test coverage (encryption tests cover this)
Fix [DECRYPTION_FAILED] sentinel → Test coverage (unit tests catch this)

noImplicitAny + fix 142 any casts → Production deployment (type safety = stability)
Fix connection pool → Production deployment (connection exhaustion under load)
Fix /labs/trends index → Production deployment (performance under real traffic)

Privacy manifest (NSPrivacyAccessedAPITypes) → iOS App Store submission
In-app account deletion → iOS App Store submission
Privacy policy URL → iOS App Store submission

Production monitoring + alerting config → Production deployment (must be on before users enter)
SAST in CI → All development work (gate before merge)

DAST sweep → Pre-App Store submission (run against staging)
```

---

## Phase Allocation Recommendation

### Phase 5: Security Enhancement (do these first)

All items that must complete before any production traffic touches the system:

1. Execute BAAs — Neon, Cloudflare R2 (Enterprise), Render
2. Disable Gemini endpoint behind feature flag (OFF)
3. Add PHI de-identification layer skeleton (for future AI re-enable)
4. Migrate rate limiter to Redis
5. Fix LabMarker.value plaintext storage
6. Fix [DECRYPTION_FAILED] sentinel leak
7. Fix audit log skip on empty results
8. Fix Prisma $use → $extends migration
9. Fix connection pool wiring in Prisma
10. Add /labs/trends database index
11. Fix automaticLogoff.ts stats bug
12. Eliminate 142 `as any` casts + enable noImplicitAny
13. Remove dead code (dataIntegrity.ts, unused getPrismaConfig)
14. Validate S3 content-type server-side
15. Add SAST (Semgrep or GitHub CodeQL) to CI pipeline

### Phase 6: Production Hardening (do these after Phase 5)

Items that require a secure foundation to be meaningful:

1. Achieve 80% test coverage (API + mobile)
2. Deploy API to Render (HIPAA-enabled workspace)
3. Deploy database on Neon Pro (HIPAA tier)
4. Configure production monitoring + alerting (Datadog + Sentry → production environment)
5. Audit NSPrivacyAccessedAPITypes — add privacy manifest
6. Implement in-app account deletion (App Store requirement)
7. Confirm privacy policy URL in App Store Connect
8. Run DAST sweep against staging (OWASP ZAP or StackHawk)
9. Performance testing against production-like environment
10. Pen testing checklist (internal, generates audit evidence)
11. iOS App Store submission (App Review Notes with demo credentials, regulatory docs)

---

## Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| HIPAA BAA requirements | HIGH | HHS official regulation, vendor docs (Neon, Render) |
| App Store submission requirements | HIGH | Apple App Review Guidelines (official), enforced May 2024 |
| Render HIPAA ($250/mo Organization plan) | HIGH | Render official docs + changelog |
| Neon HIPAA (Scale plan add-on, self-serve) | HIGH | Neon official HIPAA docs |
| Cloudflare R2 BAA scope | MEDIUM | R2 in BAA scope unconfirmed — BAA confirmed Enterprise-only; R2 not explicitly listed. Verify with Cloudflare Enterprise. |
| SAST/DAST tool recommendations | HIGH | OWASP, vendor docs, multiple sources agree |
| 2026 HIPAA NPRM (pen testing mandates) | MEDIUM | NPRM published Jan 2025, public comment closed Mar 2025; Final Rule not yet published. Requirements directionally clear but not yet law. |
| OpenAI HIPAA BAA availability | MEDIUM | Multiple sources confirm Enterprise BAA exists; not verified against official OpenAI terms for this context. Verify before assuming food analysis is compliant. |

---

## Critical Gaps to Resolve

1. **Cloudflare R2 PHI storage**: Confirm with Cloudflare Enterprise whether R2 is explicitly in-scope under their BAA before storing progress photos in R2 under a HIPAA context. Alternative: migrate photo storage to AWS S3 (well-documented HIPAA BAA). This is a HIGH-priority question that could require a vendor change.

2. **OpenAI / food analysis PHI audit**: Determine what data the `foodAnalysis.ts` service sends to GPT-4o. If it includes any user identifier alongside health context, it's PHI flowing to a service without a confirmed BAA. Either get OpenAI Enterprise BAA or strip all PHI from food analysis requests.

3. **NSPrivacyAccessedAPITypes audit**: Run the app through Xcode's privacy report tool to identify which API categories are accessed. Undeclared APIs since May 2024 = rejection with ITMS-91053.

4. **Render pricing constraint**: At $250/month for HIPAA-enabled workspace, this exceeds the originally planned "~$20/mo" constraint. The project must either accept this cost increase or explore alternatives (fly.io + self-managed HIPAA controls, or AWS with BAA at potentially higher ops cost).

---

## Sources

- [HIPAA Security Rule NPRM — HHS.gov](https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/factsheet/index.html) (MEDIUM — NPRM, not Final Rule)
- [2026 HIPAA Changes — HIPAA Vault](https://www.hipaavault.com/resources/2026-hipaa-changes/) (MEDIUM)
- [Apple App Store Review Guidelines (June 2025 PDF)](https://developer.apple.com/support/downloads/terms/app-review-guidelines/App-Review-Guidelines-20250609-English-UK.pdf) (HIGH)
- [Protecting user privacy — Apple HealthKit Developer Docs](https://developer.apple.com/documentation/healthkit/protecting-user-privacy) (HIGH)
- [Render HIPAA Docs](https://render.com/docs/hipaa-compliance) (HIGH)
- [Render HIPAA Best Practices](https://render.com/docs/hipaa-best-practices) (HIGH)
- [Neon HIPAA Compliance Docs](https://neon.com/docs/security/hipaa) (HIGH)
- [Neon HIPAA Blog Announcement](https://neon.com/blog/hipaa) (HIGH)
- [Is Cloudflare HIPAA Compliant — Paubox](https://www.paubox.com/blog/cloudflare-hipaa-compliant) (MEDIUM — R2 scope unconfirmed)
- [HIPAA Penetration Testing 2025 — DeepStrike](https://deepstrike.io/blog/hipaa-penetration-testing-2025-guide) (MEDIUM)
- [Proposed HIPAA Update — Annual Pen Testing Mandatory — Core Security](https://www.coresecurity.com/blog/proposed-hipaa-update-makes-yearly-pen-testing-mandatory) (MEDIUM — NPRM, not Final Rule)
- [HIPAA Vulnerability Scan Requirements — Censinet](https://censinet.com/perspectives/2025-hipaa-requirements-vulnerability-scanning) (MEDIUM)
- [OWASP Free Security Tools](https://owasp.org/www-community/Free_for_Open_Source_Application_Security_Tools) (HIGH)
- [Top SAST Tools 2026 — AccuKnox](https://accuknox.com/blog/best-sast-tools) (MEDIUM)
- [HIPAA Compliance Testing — QASource](https://blog.qasource.com/5-best-strategies-to-comply-with-hipaa-compliance-testing) (MEDIUM)
- [App Store Requirements for Health Apps — DashSDK](https://blog.dashsdk.com/app-store-requirements-for-health-apps/) (MEDIUM)
- [Apple Privacy Manifest Requirements — Bugfender](https://bugfender.com/blog/apple-privacy-requirements/) (HIGH — enforced May 2024)
