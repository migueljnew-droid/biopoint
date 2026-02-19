# BioPoint Vendor BAA Tracker - HIPAA Compliance

**Document Status:** ACTIVE
**Last Updated:** 2026-02-19
**Clearance Level:** L3-CONFIDENTIAL

## Vendor BAA Status

| Vendor | Service | BAA Status | Action |
|--------|---------|------------|--------|
| Google Gemini | AI Analysis | **Disabled** (Phase 1 feature flag) | Re-enable only after BAA obtained |
| Neon PostgreSQL | Database | Planned — pre-launch | Self-serve: Console → HIPAA → Enable |
| Cloudflare R2 | Object Storage | Planned — pre-launch | Confirm R2 coverage or migrate to AWS S3 |
| Fly.io | API Hosting | Planned — pre-launch | Launch plan BAA (replaces Render) |
| OpenAI | Food Analysis API | Planned — pre-launch | Email baa@openai.com |
| Expo | Mobile Framework | Not Required | No PHI access (client-side only) |

## Key Decisions

1. **Render replaced by Fly.io** (2026-02-19) — Render HIPAA workspace requires $250/month minimum + 20% surcharge. Fly.io Launch plan offers BAA at ~$30/month.
2. **BAAs deferred to pre-launch** (2026-02-19) — No real PHI in the system yet. All BAAs will be executed immediately before production deployment with real user data.
3. **Gemini disabled via feature flag** (Phase 1) — Google Gemini lab analysis endpoint returns feature-flag-disabled response. Will not be re-enabled until a BAA is obtained or the service is replaced.
4. **De-identification layer built** (Phase 3, 03-02) — `deidentify.ts` strips all 18 HIPAA Safe Harbor identifiers before data reaches any non-BAA AI service. `assertNoPhi` guard protects food analysis prompts.

## Pre-Launch BAA Checklist

Execute these before deploying with real PHI:

- [ ] **Neon**: Console → Org Settings → HIPAA → Enable + Accept BAA → Project Settings → HIPAA → Enable (requires Scale plan)
- [ ] **Cloudflare R2**: Email enterprise@cloudflare.com confirming R2 BAA scope. If not covered, migrate to AWS S3 (accept BAA via AWS Artifact)
- [ ] **Fly.io**: Launch plan → sign BAA in dashboard
- [ ] **OpenAI**: Email baa@openai.com → after approval, enable Zero Data Retention

## Application-Level PHI Protections (Already Implemented)

These protections are in place regardless of vendor BAA status:

- **AES-256-GCM encryption** at field level for all PHI (Phase 1)
- **PHI de-identification** via `deidentify.ts` for non-BAA AI services (Phase 3)
- **assertNoPhi runtime guard** on food analysis prompts (Phase 3)
- **Audit logging** for all PHI access (Phase 1)
- **TLS 1.3** for all data in transit
- **Feature flag** disabling Gemini AI analysis (Phase 1)

---

**Document Classification:** L3-CONFIDENTIAL
**Next Review:** Before production launch
