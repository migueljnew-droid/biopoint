# Changelog

All notable changes to the BioPoint Health Tracking Application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security - P0 Critical Remediation (2026-01-22)

#### Fixed
- **[CRITICAL]** Removed CORS wildcard (`*`) vulnerability in API endpoints
  - Implemented whitelist-only CORS policy via `ALLOWED_ORIGINS` environment variable
  - Updated both main API and admin endpoints with explicit origin controls
  - See: `CORS_SECURITY_FIX_SUMMARY.md`

- **[CRITICAL]** Enhanced `.gitignore` to prevent credential exposure
  - Added comprehensive environment file patterns (`.env*`, `*.env`, `.envrc`)
  - Added database encryption key exclusions
  - Added secret scanning configuration (`.gitleaks.toml`)

- **[HIGH]** Implemented PHI audit logging system
  - Added encrypted, immutable audit trail for all PHI access (CREATE, READ, UPDATE, DELETE)
  - 7-year retention policy (HIPAA compliant)
  - Tamper-proof logging with cryptographic verification
  - See: `PHI_AUDIT_LOGGING_IMPLEMENTATION.md`

- **[HIGH]** Enhanced secrets management
  - Integrated Doppler for credential management (`doppler.yaml`)
  - Created `.env.example` template for secure configuration
  - Implemented Gitleaks secret scanning to prevent accidental commits

#### Changed
- Updated `.env.example` with comprehensive security configuration templates
- Added HIPAA compliance documentation framework
- Enhanced README with security best practices

#### Documentation
- **Added**: `SOVEREIGN_BLACK_FORENSIC_AUDIT.md` - Comprehensive security assessment
- **Added**: `SOVEREIGN_BLACK_FORENSIC_AUDIT_PART2.md` - Detailed findings and recommendations
- **Added**: `CORS_SECURITY_FIX_SUMMARY.md` - CORS remediation documentation
- **Added**: `PHI_AUDIT_LOGGING_IMPLEMENTATION.md` - Audit system documentation

### Pending - P0 Critical Items (Manual Action Required)

⚠️ **IMMEDIATE ACTION REQUIRED:**

1. **Credential Rotation** (0-24 hours)
   - [ ] Rotate Neon database credentials
   - [ ] Generate new JWT signing secrets
   - [ ] Rotate AWS/S3 access keys
   - [ ] Update all environment variables in production

2. **Database Encryption** (0-7 days)
   - [ ] Enable encryption at rest for Neon PostgreSQL
   - [ ] Implement field-level encryption for sensitive PHI columns
   - [ ] Verify backup encryption

3. **HIPAA BAA Verification** (0-7 days)
   - [ ] Obtain signed Business Associate Agreement from Neon
   - [ ] Obtain signed Business Associate Agreement from Cloudflare
   - [ ] Verify Google Gemini BAA status for AI features
   - [ ] Document all third-party vendor compliance

4. **PHI Audit System Deployment** (0-7 days)
   - [ ] Deploy PHI audit logger to production
   - [ ] Configure log retention and backup
   - [ ] Set up monitoring and alerts
   - [ ] Test audit trail completeness

### Risk Assessment

| Category | Before | After | Target |
|----------|--------|-------|--------|
| Security Posture | 6/10 (HIGH RISK) | 7.5/10 (MEDIUM) | 9/10 |
| HIPAA Compliance | 13% (NON-COMPLIANT) | 40% | 95%+ |
| Credential Exposure | CRITICAL | MITIGATED* | SECURE |
| Audit Coverage | 25% | 75%* | 100% |

*After pending manual actions are completed

---

## [0.1.0] - 2026-01-22

### Added
- Initial React Native mobile application with TypeScript
- Node.js Fastify API backend
- PostgreSQL database with Drizzle ORM
- Turborepo monorepo structure
- User authentication system (JWT + refresh tokens)
- Health metrics tracking (biomarkers, lab reports, progress photos)
- AI-powered health insights via Google Gemini
- S3 integration for file uploads
- Basic audit logging (CREATE, UPDATE, DELETE operations)

### Technical Stack
- **Frontend**: React Native, TypeScript, Zod validation
- **Backend**: Fastify, TypeScript, Drizzle ORM
- **Database**: PostgreSQL (Neon)
- **Storage**: AWS S3 / Cloudflare R2
- **AI**: Google Gemini API
- **Auth**: bcrypt (12 rounds) + JWT

---

## Security Classifications

This project handles **Protected Health Information (PHI)** and must comply with:
- HIPAA Security Rule
- HIPAA Privacy Rule
- State health privacy laws

**Current Classification**: L3-CONFIDENTIAL (Health Data)
**Required Compliance**: HIPAA, HITECH Act

---

## Contributing

All changes must:
1. Pass security review (run `gitleaks detect`)
2. Update this CHANGELOG under `[Unreleased]`
3. Include security impact assessment for PHI-related changes
4. Maintain or improve HIPAA compliance posture

---

## Contact

For security issues: **DO NOT** open public issues. Contact project maintainers directly.

For HIPAA compliance questions: See `docs/HIPAA_COMPLIANCE.md`
