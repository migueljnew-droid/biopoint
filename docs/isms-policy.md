# Information Security Management System (ISMS) Policy
## BioPoint — ISO 27001:2022 Compliance

**Version:** 1.0
**Effective Date:** February 10, 2026
**Classification:** L3-CONFIDENTIAL
**Document Owner:** Security Team
**Review Cycle:** Annual

---

## 1. Purpose

This document establishes the Information Security Management System (ISMS) for BioPoint, defining the framework for managing information security risks and ensuring the confidentiality, integrity, and availability of all information assets.

## 2. Scope

This ISMS applies to:
- All BioPoint information systems and infrastructure
- All personnel with access to BioPoint systems
- All data processed, stored, or transmitted by BioPoint
- All third-party services integrated with BioPoint

### In-Scope Assets
| Asset Category | Examples |
|----------------|----------|
| Data | User PII, PHI, lab results, biometric data, food logs |
| Systems | API servers, databases, storage (S3), mobile app |
| Infrastructure | Render (hosting), Neon (database), AWS (storage) |
| Code | Source code, configuration, secrets |
| People | Development team, administrators |

## 3. Information Security Policy Statement

BioPoint is committed to:
1. Protecting the confidentiality, integrity, and availability of all information
2. Complying with applicable legal, regulatory, and contractual requirements (HIPAA, GDPR, SOC 2)
3. Continually improving the effectiveness of the ISMS
4. Managing information security risks systematically
5. Ensuring all personnel understand their security responsibilities

## 4. Leadership and Governance

### 4.1 Roles and Responsibilities

| Role | Responsibility |
|------|----------------|
| **CISO / Security Lead** | ISMS ownership, risk management, compliance oversight |
| **Development Lead** | Secure development practices, code review, vulnerability management |
| **DevOps Lead** | Infrastructure security, monitoring, incident response |
| **DPO** | Data protection, GDPR compliance, data subject rights |

### 4.2 Management Review

Management reviews the ISMS:
- **Quarterly:** Security metrics, incident review, risk status
- **Annually:** Full ISMS review, policy updates, certification readiness
- **Ad-hoc:** After significant incidents or changes

## 5. Risk Management (ISO 27001 Clause 6)

### 5.1 Risk Assessment Methodology

BioPoint uses a risk-based approach:

1. **Identify** assets, threats, and vulnerabilities
2. **Analyze** likelihood and impact (5x5 matrix)
3. **Evaluate** against risk acceptance criteria
4. **Treat** with appropriate controls

### 5.2 Risk Acceptance Criteria

| Risk Level | Score | Action Required |
|------------|-------|-----------------|
| Critical | 20-25 | Immediate remediation, escalate to leadership |
| High | 12-19 | Remediation within 30 days |
| Medium | 6-11 | Remediation within 90 days |
| Low | 1-5 | Accept or remediate at next cycle |

### 5.3 Risk Treatment Options

- **Mitigate:** Apply security controls
- **Transfer:** Insurance, contractual obligations
- **Avoid:** Discontinue the risky activity
- **Accept:** Document and monitor (low risks only)

## 6. Security Controls (Annex A Mapping)

### A.5 — Organizational Controls

| Control | Implementation | Status |
|---------|----------------|--------|
| A.5.1 Information security policies | This ISMS document | Implemented |
| A.5.2 Information security roles | Role definitions above | Implemented |
| A.5.3 Segregation of duties | Separate dev/prod access | Implemented |
| A.5.7 Threat intelligence | Dependency scanning, CVE monitoring | Implemented |
| A.5.23 Information security for cloud services | Render/Neon/AWS security configs | Implemented |
| A.5.34 Privacy and PII protection | GDPR/HIPAA compliance framework | Implemented |

### A.6 — People Controls

| Control | Implementation | Status |
|---------|----------------|--------|
| A.6.1 Screening | Background checks for team | Planned |
| A.6.3 Information security awareness | Training curriculum (docs/staff-training-materials.md) | Implemented |
| A.6.5 Responsibilities after termination | Access revocation procedures | Implemented |

### A.7 — Physical Controls

| Control | Implementation | Status |
|---------|----------------|--------|
| A.7.1 Physical security perimeters | Cloud-hosted (provider responsibility) | N/A (Cloud) |
| A.7.9 Security of assets off-premises | Encrypted laptops, VPN | Implemented |

### A.8 — Technological Controls

| Control | Implementation | Status |
|---------|----------------|--------|
| A.8.1 User endpoint devices | Development device security | Implemented |
| A.8.3 Information access restriction | RBAC (USER/ADMIN roles) | Implemented |
| A.8.5 Secure authentication | JWT + refresh tokens + account lockout | Implemented |
| A.8.7 Protection against malware | Input sanitization, dependency scanning | Implemented |
| A.8.9 Configuration management | Environment variables via Doppler | Implemented |
| A.8.10 Information deletion | GDPR deletion pipeline | Implemented |
| A.8.11 Data masking | Field-level encryption (AES-256) | Implemented |
| A.8.12 Data leakage prevention | Signed URLs, audit logging | Implemented |
| A.8.15 Logging | Comprehensive audit log (AuditLog model) | Implemented |
| A.8.16 Monitoring | Health checks, request logging | Implemented |
| A.8.24 Use of cryptography | AES-256-GCM, TLS 1.3, bcrypt | Implemented |
| A.8.25 Secure development lifecycle | Code review, testing, CI/CD | Implemented |
| A.8.28 Secure coding | Input sanitization, parameterized queries (Prisma) | Implemented |

## 7. Incident Management

### 7.1 Incident Classification

| Severity | Description | Response Time | Notification |
|----------|-------------|---------------|--------------|
| P1 — Critical | Data breach, system compromise | Immediate | Within 1 hour |
| P2 — High | Service outage, vulnerability exploited | Within 4 hours | Within 24 hours |
| P3 — Medium | Performance degradation, policy violation | Within 24 hours | Weekly report |
| P4 — Low | Minor issue, informational | Within 72 hours | Monthly report |

### 7.2 Incident Response Process

1. **Detection** — monitoring alerts, user reports, automated scanning
2. **Triage** — classify severity, assign responder
3. **Containment** — isolate affected systems
4. **Eradication** — remove root cause
5. **Recovery** — restore normal operations
6. **Lessons Learned** — post-incident review, update controls

See: `docs/incident-response-plan.md` for detailed procedures.

## 8. Business Continuity

- **RPO (Recovery Point Objective):** 1 hour (Neon continuous backup)
- **RTO (Recovery Time Objective):** 4 hours
- **Backup Strategy:** Automated database snapshots, S3 versioning
- **DR Plan:** Multi-region failover capability

See: `docs/disaster-recovery-master-plan.md` for detailed procedures.

## 9. Compliance Mapping

| Framework | Status | Evidence |
|-----------|--------|----------|
| **HIPAA** | ~90% compliant | Encryption, audit logs, BAA template, incident response |
| **GDPR** | ~80% compliant | DPA, consent management, data export, deletion pipeline |
| **SOC 2** | ~70% compliant | Security controls, monitoring, access management |
| **ISO 27001** | ~60% compliant | This ISMS, risk register, controls implementation |

## 10. Continual Improvement

BioPoint improves the ISMS through:
1. Regular internal audits (tracked via `/compliance/audits` API)
2. Management reviews (quarterly)
3. Incident post-mortems
4. Compliance dashboard monitoring (`/compliance/dashboard`)
5. Annual penetration testing
6. Dependency vulnerability scanning

## 11. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-10 | Security Team | Initial ISMS policy |

---

*This policy is reviewed annually or upon significant organizational or technological changes.*
