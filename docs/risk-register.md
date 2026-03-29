# Information Security Risk Register
## BioPoint — ISO 27001 Clause 6.1.2

**Version:** 1.0
**Last Updated:** February 10, 2026
**Risk Owner:** Security Lead
**Review Cycle:** Quarterly

---

## Risk Assessment Matrix

**Likelihood:** 1 (Rare) → 5 (Almost Certain)
**Impact:** 1 (Negligible) → 5 (Catastrophic)
**Risk Score:** Likelihood × Impact

| Score | Level | Color |
|-------|-------|-------|
| 20-25 | Critical | Red |
| 12-19 | High | Orange |
| 6-11 | Medium | Yellow |
| 1-5 | Low | Green |

---

## Risk Register

### R-001: Unauthorized Access to PHI

| Field | Value |
|-------|-------|
| **ID** | R-001 |
| **Category** | Access Control |
| **Threat** | Unauthorized access to protected health information |
| **Vulnerability** | Weak authentication, session hijacking |
| **Asset** | User health data, lab results, biometric data |
| **Likelihood** | 2 (Unlikely) |
| **Impact** | 5 (Catastrophic — HIPAA breach) |
| **Inherent Risk** | 10 (Medium) |
| **Controls** | JWT + refresh token rotation, bcrypt hashing, account lockout after 5 failed attempts, rate limiting, RBAC |
| **Residual Risk** | 4 (Low) |
| **Status** | Mitigated |
| **Owner** | Development Lead |

### R-002: SQL Injection / NoSQL Injection

| Field | Value |
|-------|-------|
| **ID** | R-002 |
| **Category** | Application Security |
| **Threat** | Data exfiltration via injection attacks |
| **Vulnerability** | Unparameterized queries, unsanitized input |
| **Asset** | Database (all user data) |
| **Likelihood** | 2 (Unlikely) |
| **Impact** | 5 (Catastrophic) |
| **Inherent Risk** | 10 (Medium) |
| **Controls** | Prisma ORM (parameterized queries), input sanitization middleware (SQL/NoSQL/LDAP/XSS validation), Helmet headers |
| **Residual Risk** | 2 (Low) |
| **Status** | Mitigated |
| **Owner** | Development Lead |

### R-003: Data Breach via Third-Party Service

| Field | Value |
|-------|-------|
| **ID** | R-003 |
| **Category** | Supply Chain |
| **Threat** | Third-party provider compromise (Neon, AWS, OpenAI, Render) |
| **Vulnerability** | Shared responsibility model gaps |
| **Asset** | All data processed by third parties |
| **Likelihood** | 2 (Unlikely) |
| **Impact** | 4 (Major) |
| **Inherent Risk** | 8 (Medium) |
| **Controls** | Field-level encryption (data encrypted before storage), signed/time-limited URLs, BAA with providers, DPA in place, minimal data sharing with AI (transient only) |
| **Residual Risk** | 4 (Low) |
| **Status** | Mitigated |
| **Owner** | DevOps Lead |

### R-004: Encryption Key Compromise

| Field | Value |
|-------|-------|
| **ID** | R-004 |
| **Category** | Cryptography |
| **Threat** | Master encryption key exposed or compromised |
| **Vulnerability** | Key stored in environment variable |
| **Asset** | All encrypted fields (DOB, notes, lab values) |
| **Likelihood** | 1 (Rare) |
| **Impact** | 5 (Catastrophic) |
| **Inherent Risk** | 5 (Low) |
| **Controls** | Doppler secret management, key versioning (encryption_version field), key rotation capability, separate keys per environment |
| **Residual Risk** | 3 (Low) |
| **Status** | Mitigated |
| **Owner** | DevOps Lead |

### R-005: Denial of Service (DoS/DDoS)

| Field | Value |
|-------|-------|
| **ID** | R-005 |
| **Category** | Availability |
| **Threat** | Service unavailability due to volumetric or application-layer attacks |
| **Vulnerability** | Public-facing API endpoints |
| **Asset** | API service availability |
| **Likelihood** | 3 (Possible) |
| **Impact** | 3 (Moderate) |
| **Inherent Risk** | 9 (Medium) |
| **Controls** | Route-aware rate limiting, account lockout, Render platform DDoS protection, Fastify request validation |
| **Residual Risk** | 4 (Low) |
| **Status** | Mitigated |
| **Owner** | DevOps Lead |

### R-006: Insider Threat

| Field | Value |
|-------|-------|
| **ID** | R-006 |
| **Category** | People |
| **Threat** | Authorized personnel misusing access |
| **Vulnerability** | Broad admin access, insufficient monitoring |
| **Asset** | All user data |
| **Likelihood** | 1 (Rare) |
| **Impact** | 4 (Major) |
| **Inherent Risk** | 4 (Low) |
| **Controls** | Comprehensive audit logging (all CRUD operations), RBAC with least privilege, admin action logging, anomaly detection planned |
| **Residual Risk** | 2 (Low) |
| **Status** | Mitigated |
| **Owner** | Security Lead |

### R-007: Data Loss / Corruption

| Field | Value |
|-------|-------|
| **ID** | R-007 |
| **Category** | Availability / Integrity |
| **Threat** | Database corruption, accidental deletion, ransomware |
| **Vulnerability** | Single database instance |
| **Asset** | All persistent data |
| **Likelihood** | 2 (Unlikely) |
| **Impact** | 4 (Major) |
| **Inherent Risk** | 8 (Medium) |
| **Controls** | Neon continuous backup (1-hour RPO), point-in-time recovery, S3 versioning for photos, deletion request 30-day grace period |
| **Residual Risk** | 3 (Low) |
| **Status** | Mitigated |
| **Owner** | DevOps Lead |

### R-008: GDPR Non-Compliance

| Field | Value |
|-------|-------|
| **ID** | R-008 |
| **Category** | Regulatory |
| **Threat** | Failure to comply with GDPR data subject rights |
| **Vulnerability** | Incomplete data export, delayed deletion, missing consent records |
| **Asset** | EU/EEA user data |
| **Likelihood** | 2 (Unlikely) |
| **Impact** | 4 (Major — fines up to 4% revenue) |
| **Inherent Risk** | 8 (Medium) |
| **Controls** | Data export API (JSON/CSV), account deletion pipeline with 30-day grace, granular consent management (ConsentRecord model), DPA template, privacy policy |
| **Residual Risk** | 3 (Low) |
| **Status** | Mitigated |
| **Owner** | DPO |

### R-009: HIPAA Breach Notification Failure

| Field | Value |
|-------|-------|
| **ID** | R-009 |
| **Category** | Regulatory |
| **Threat** | Failure to notify HHS/individuals within required timeframes |
| **Vulnerability** | No automated breach tracking system |
| **Asset** | Regulatory compliance status |
| **Likelihood** | 2 (Unlikely) |
| **Impact** | 4 (Major — fines, reputation) |
| **Inherent Risk** | 8 (Medium) |
| **Controls** | BreachIncident model with deadline tracking, automated deadline checking endpoint, disclosure log (HIPAA §164.528), audit trail |
| **Residual Risk** | 3 (Low) |
| **Status** | Mitigated |
| **Owner** | Security Lead |

### R-010: AI Food Analysis Data Leakage

| Field | Value |
|-------|-------|
| **ID** | R-010 |
| **Category** | Third-Party / AI |
| **Threat** | Food photos containing personal information sent to OpenAI |
| **Vulnerability** | Base64 images sent to external API |
| **Asset** | User food photos |
| **Likelihood** | 3 (Possible) |
| **Impact** | 2 (Minor — food photos, not medical records) |
| **Inherent Risk** | 6 (Medium) |
| **Controls** | Images resized/compressed before sending (1024px, 0.7 quality), no user identifiers sent with image, OpenAI DPA, images not stored after analysis, detail set to "low" to minimize data |
| **Residual Risk** | 3 (Low) |
| **Status** | Mitigated |
| **Owner** | Development Lead |

---

## Risk Summary

| Level | Count | Inherent | Residual |
|-------|-------|----------|----------|
| Critical | 0 | 0 | 0 |
| High | 0 | 0 | 0 |
| Medium | 8 | 8 | 0 |
| Low | 2 | 2 | 10 |

**Overall Risk Posture:** LOW (all risks mitigated to acceptable levels)

---

## Review History

| Date | Reviewer | Changes |
|------|----------|---------|
| 2026-02-10 | Security Team | Initial risk register creation |

*Next review scheduled: May 2026*
