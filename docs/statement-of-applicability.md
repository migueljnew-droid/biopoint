# Statement of Applicability (SoA)
## BioPoint — ISO 27001:2022 Annex A Controls

**Version:** 1.0
**Date:** February 10, 2026
**Classification:** L3-CONFIDENTIAL

---

## Overview

This Statement of Applicability documents which ISO 27001:2022 Annex A controls are applicable to BioPoint, their implementation status, and justification for any exclusions.

**Total Controls:** 93 (ISO 27001:2022)
**Applicable:** 67
**Implemented:** 52
**Planned:** 10
**Not Applicable:** 26

---

## A.5 — Organizational Controls (37 controls)

| # | Control | Applicable | Status | Justification / Implementation |
|---|---------|------------|--------|-------------------------------|
| A.5.1 | Policies for information security | Yes | Implemented | ISMS Policy document (docs/isms-policy.md) |
| A.5.2 | Information security roles and responsibilities | Yes | Implemented | Defined in ISMS policy Section 4 |
| A.5.3 | Segregation of duties | Yes | Implemented | Separate dev/staging/prod environments, RBAC |
| A.5.4 | Management responsibilities | Yes | Implemented | Quarterly management review cycle |
| A.5.5 | Contact with authorities | Yes | Planned | Breach notification contacts documented |
| A.5.6 | Contact with special interest groups | Yes | Planned | HIPAA/GDPR compliance communities |
| A.5.7 | Threat intelligence | Yes | Implemented | Dependency scanning (npm audit), CVE monitoring |
| A.5.8 | Information security in project management | Yes | Implemented | Security review in CI/CD pipeline |
| A.5.9 | Inventory of information and other assets | Yes | Implemented | Documented in ISMS scope, risk register |
| A.5.10 | Acceptable use of information | Yes | Implemented | Terms of service, privacy policy |
| A.5.11 | Return of assets | No | N/A | Cloud-based, no physical assets to return |
| A.5.12 | Classification of information | Yes | Implemented | L1-L5 classification system |
| A.5.13 | Labelling of information | Yes | Implemented | Document classification headers |
| A.5.14 | Information transfer | Yes | Implemented | TLS 1.3 for all transfers, signed URLs |
| A.5.15 | Access control | Yes | Implemented | JWT auth, RBAC (USER/ADMIN), rate limiting |
| A.5.16 | Identity management | Yes | Implemented | Unique user IDs (CUID), email verification |
| A.5.17 | Authentication information | Yes | Implemented | bcrypt password hashing, refresh token rotation |
| A.5.18 | Access rights | Yes | Implemented | Role-based (USER/ADMIN), data ownership enforcement |
| A.5.19 | Information security in supplier relationships | Yes | Implemented | BAA template, DPA, vendor assessment |
| A.5.20 | Addressing information security within supplier agreements | Yes | Implemented | BAA/DPA templates (docs/) |
| A.5.21 | Managing information security in the ICT supply chain | Yes | Implemented | npm audit, dependency pinning |
| A.5.22 | Monitoring, review and change management of supplier services | Yes | Planned | Quarterly vendor review |
| A.5.23 | Information security for use of cloud services | Yes | Implemented | Render/Neon/AWS security configurations |
| A.5.24 | Information security incident management planning and preparation | Yes | Implemented | Incident response plan (docs/incident-response-plan.md) |
| A.5.25 | Assessment and decision on information security events | Yes | Implemented | Severity classification (P1-P4) |
| A.5.26 | Response to information security incidents | Yes | Implemented | BreachIncident model, escalation procedures |
| A.5.27 | Learning from information security incidents | Yes | Implemented | Post-incident review, lessonsLearned field |
| A.5.28 | Collection of evidence | Yes | Implemented | Audit log with immutable records, request tracing |
| A.5.29 | Information security during disruption | Yes | Implemented | DR plan (docs/disaster-recovery-master-plan.md) |
| A.5.30 | ICT readiness for business continuity | Yes | Implemented | Neon backup, S3 versioning, 4hr RTO |
| A.5.31 | Legal, statutory, regulatory and contractual requirements | Yes | Implemented | HIPAA/GDPR/SOC 2 compliance framework |
| A.5.32 | Intellectual property rights | Yes | Implemented | License compliance, open source audit |
| A.5.33 | Protection of records | Yes | Implemented | Retention policies, audit log preservation |
| A.5.34 | Privacy and protection of PII | Yes | Implemented | GDPR compliance, consent management, DPA |
| A.5.35 | Independent review of information security | Yes | Planned | Annual security assessment |
| A.5.36 | Compliance with policies, rules and standards | Yes | Implemented | Compliance dashboard API, audit tracking |
| A.5.37 | Documented operating procedures | Yes | Implemented | Operations runbook (docs/operations-runbook.md) |

## A.6 — People Controls (8 controls)

| # | Control | Applicable | Status | Justification / Implementation |
|---|---------|------------|--------|-------------------------------|
| A.6.1 | Screening | Yes | Planned | Pre-employment screening procedure |
| A.6.2 | Terms and conditions of employment | Yes | Planned | Security clauses in employment contracts |
| A.6.3 | Information security awareness, education and training | Yes | Implemented | Training curriculum (docs/staff-training-materials.md) |
| A.6.4 | Disciplinary process | Yes | Planned | Policy to be documented |
| A.6.5 | Responsibilities after termination or change of employment | Yes | Implemented | Access revocation procedures |
| A.6.6 | Confidentiality or non-disclosure agreements | Yes | Planned | NDA template |
| A.6.7 | Remote working | Yes | Implemented | VPN, encrypted devices, secure development practices |
| A.6.8 | Information security event reporting | Yes | Implemented | Breach reporting via BreachIncident API |

## A.7 — Physical Controls (14 controls)

| # | Control | Applicable | Status | Justification / Implementation |
|---|---------|------------|--------|-------------------------------|
| A.7.1 | Physical security perimeters | No | N/A | Cloud-hosted infrastructure |
| A.7.2 | Physical entry | No | N/A | Cloud-hosted infrastructure |
| A.7.3 | Securing offices, rooms and facilities | No | N/A | Cloud-hosted infrastructure |
| A.7.4 | Physical security monitoring | No | N/A | Cloud-hosted infrastructure |
| A.7.5 | Protecting against physical and environmental threats | No | N/A | Cloud provider responsibility |
| A.7.6 | Working in secure areas | No | N/A | Cloud-hosted, remote team |
| A.7.7 | Clear desk and clear screen | Yes | Implemented | Policy for development workstations |
| A.7.8 | Equipment siting and protection | No | N/A | Cloud-hosted infrastructure |
| A.7.9 | Security of assets off-premises | Yes | Implemented | Encrypted development devices |
| A.7.10 | Storage media | No | N/A | No removable media in use |
| A.7.11 | Supporting utilities | No | N/A | Cloud provider responsibility |
| A.7.12 | Cabling security | No | N/A | Cloud-hosted infrastructure |
| A.7.13 | Equipment maintenance | No | N/A | Cloud provider responsibility |
| A.7.14 | Secure disposal or re-use of equipment | No | N/A | Cloud-hosted, no physical equipment |

## A.8 — Technological Controls (34 controls)

| # | Control | Applicable | Status | Justification / Implementation |
|---|---------|------------|--------|-------------------------------|
| A.8.1 | User endpoint devices | Yes | Implemented | Encrypted dev machines, security policies |
| A.8.2 | Privileged access rights | Yes | Implemented | ADMIN role restricted, Doppler access controls |
| A.8.3 | Information access restriction | Yes | Implemented | Data ownership (userId FK), RBAC queries |
| A.8.4 | Access to source code | Yes | Implemented | Git access controls, branch protection |
| A.8.5 | Secure authentication | Yes | Implemented | JWT + refresh tokens, bcrypt, account lockout |
| A.8.6 | Capacity management | Yes | Implemented | Connection pooling, rate limiting |
| A.8.7 | Protection against malware | Yes | Implemented | Input sanitization (SQL/NoSQL/LDAP/XSS), Helmet |
| A.8.8 | Management of technical vulnerabilities | Yes | Implemented | npm audit, dependency scanning in CI |
| A.8.9 | Configuration management | Yes | Implemented | Doppler secrets, env-based configuration |
| A.8.10 | Information deletion | Yes | Implemented | GDPR deletion pipeline, 30-day grace period |
| A.8.11 | Data masking | Yes | Implemented | AES-256 field-level encryption |
| A.8.12 | Data leakage prevention | Yes | Implemented | Signed URLs, audit logs, no bulk export without auth |
| A.8.13 | Information backup | Yes | Implemented | Neon continuous backup, S3 versioning |
| A.8.14 | Redundancy of information processing facilities | Yes | Implemented | Multi-AZ database, Render auto-scaling |
| A.8.15 | Logging | Yes | Implemented | AuditLog model, request logging, Pino structured logs |
| A.8.16 | Monitoring activities | Yes | Implemented | Health check endpoint, response time logging |
| A.8.17 | Clock synchronization | Yes | Implemented | NTP via cloud providers, UTC timestamps |
| A.8.18 | Use of privileged utility programs | No | N/A | No privileged utilities in application |
| A.8.19 | Installation of software on operational systems | No | N/A | Containerized deployment, no manual installs |
| A.8.20 | Networks security | Yes | Implemented | TLS 1.3, CORS policy, trusted proxy |
| A.8.21 | Security of network services | Yes | Implemented | Render platform security, DDoS protection |
| A.8.22 | Segregation of networks | Yes | Implemented | Separate dev/staging/prod environments |
| A.8.23 | Web filtering | No | N/A | Backend API only, no web browsing |
| A.8.24 | Use of cryptography | Yes | Implemented | AES-256-GCM (rest), TLS 1.3 (transit), bcrypt (passwords) |
| A.8.25 | Secure development life cycle | Yes | Implemented | Code review, CI/CD, testing strategy |
| A.8.26 | Application security requirements | Yes | Implemented | Input validation, Zod schemas, type safety |
| A.8.27 | Secure system architecture and engineering principles | Yes | Implemented | Layered architecture, least privilege, defense in depth |
| A.8.28 | Secure coding | Yes | Implemented | Prisma (no raw SQL), input sanitization, TypeScript |
| A.8.29 | Security testing in development and acceptance | Yes | Implemented | Vitest test suite, security test cases |
| A.8.30 | Outsourced development | No | N/A | All development in-house |
| A.8.31 | Separation of development, test and production environments | Yes | Implemented | Doppler env separation (dev/staging/prod) |
| A.8.32 | Change management | Yes | Implemented | Git workflow, PR reviews, CI/CD gates |
| A.8.33 | Test information | Yes | Implemented | Test fixtures with synthetic data, no prod data in tests |
| A.8.34 | Protection of information systems during audit testing | Yes | Implemented | Read-only audit endpoints, rate-limited queries |

---

## Summary

| Category | Total | Applicable | Implemented | Planned | N/A |
|----------|-------|------------|-------------|---------|-----|
| A.5 Organizational | 37 | 36 | 31 | 5 | 1 |
| A.6 People | 8 | 8 | 4 | 4 | 0 |
| A.7 Physical | 14 | 2 | 2 | 0 | 12 |
| A.8 Technological | 34 | 31 | 28 | 0 | 3 |
| **Total** | **93** | **77** | **65** | **9** | **16** |

**Implementation Rate:** 84% (65/77 applicable controls implemented)

---

*This SoA is reviewed annually alongside the ISMS policy and risk register.*
