# Data Processing Agreement (DPA)
## BioPoint — GDPR Article 28 Compliance

**Version:** 1.0
**Effective Date:** February 10, 2026
**Classification:** L3-CONFIDENTIAL

---

## 1. Parties

- **Data Controller:** The individual user ("User") who registers and uses BioPoint.
- **Data Processor:** BioPoint Inc. ("BioPoint"), operating the BioPoint health tracking platform.

## 2. Subject Matter and Duration

This DPA governs the processing of personal data by BioPoint on behalf of Users in connection with the BioPoint health and wellness tracking platform. Processing continues for the duration of the User's account and for legally required retention periods thereafter.

## 3. Nature and Purpose of Processing

BioPoint processes personal data for the following purposes:

| Purpose | Legal Basis | Data Categories |
|---------|-------------|-----------------|
| Account management | Contract performance (Art. 6(1)(b)) | Email, password hash |
| Health metric tracking | Explicit consent (Art. 9(2)(a)) | Biometric data, health logs |
| Lab report analysis | Explicit consent (Art. 9(2)(a)) | Lab markers, medical data |
| AI food analysis | Explicit consent (Art. 9(2)(a)) | Food photos (transient) |
| Progress photo storage | Explicit consent (Art. 9(2)(a)) | Body images |
| Service improvement | Legitimate interest (Art. 6(1)(f)) | Anonymized usage analytics |

## 4. Categories of Data Subjects

- Registered BioPoint users (adults 18+)

## 5. Types of Personal Data Processed

### Standard Personal Data
- Email address
- Date of birth (encrypted at rest)
- Height, weight measurements

### Special Category Data (Article 9 GDPR)
- Health data: lab results, biomarkers, daily health logs
- Biometric data: progress photos, body measurements
- Dietary data: food logs, nutrition analysis
- Fasting data: fasting sessions, physiological zones

## 6. Processor Obligations

BioPoint shall:

1. **Process only on documented instructions** from the Controller (User), unless required by EU/Member State law.

2. **Ensure confidentiality** — all personnel authorized to process personal data have committed to confidentiality obligations.

3. **Implement appropriate security measures** (Article 32):
   - AES-256 encryption at rest for sensitive fields
   - TLS 1.3 for data in transit
   - JWT-based authentication with refresh token rotation
   - Rate limiting and account lockout protection
   - Signed, time-limited S3 URLs for photo access
   - Input sanitization against injection attacks
   - Comprehensive audit logging

4. **Sub-processor management** — engage sub-processors only with prior authorization:

   | Sub-Processor | Purpose | Location | DPA Status |
   |---------------|---------|----------|------------|
   | Neon (PostgreSQL) | Database hosting | US-East-1 | Required |
   | AWS S3 | Photo/file storage | US-East-1 | AWS DPA |
   | OpenAI | Food photo analysis | US | OpenAI DPA |
   | Render | API hosting | US | Required |

5. **Assist the Controller** with data subject rights requests (Articles 15-22):
   - Right of access (Art. 15): Data export endpoint `/user/data-export`
   - Right to rectification (Art. 16): Profile update endpoints
   - Right to erasure (Art. 17): Account deletion with 30-day grace period
   - Right to data portability (Art. 20): JSON/CSV export
   - Right to restrict processing: Consent management

6. **Breach notification** — notify the Controller without undue delay (max 72 hours) after becoming aware of a personal data breach, via:
   - In-app notification
   - Email to registered address
   - Breach incident tracking system (internal)

7. **Data deletion** — upon termination of processing, delete all personal data unless retention is required by law. BioPoint implements:
   - 30-day grace period on account deletion requests
   - 7-year retention for audit logs (anonymized after deletion)
   - Immediate deletion of transient data (AI analysis images)

8. **Audit rights** — make available to the Controller all information necessary to demonstrate compliance. The compliance dashboard endpoint `/compliance/dashboard` provides real-time status.

## 7. International Data Transfers

BioPoint processes data in the United States. For EU/EEA data subjects, transfers are governed by:
- Standard Contractual Clauses (SCCs) as applicable
- Adequacy decisions where available
- Supplementary measures (encryption, pseudonymization)

## 8. Data Protection Impact Assessment (DPIA)

BioPoint has conducted a DPIA identifying:
- **High-risk processing:** Health data, biometric data, AI-based analysis
- **Mitigating measures:** Encryption, access controls, audit logging, consent management, data minimization
- **Residual risk:** LOW after mitigations

## 9. Data Protection Officer

BioPoint designates a Data Protection contact:
- **Email:** privacy@biopoint.app
- **Role:** Responsible for GDPR compliance oversight, data subject requests, breach coordination

## 10. Amendment

This DPA may be amended by BioPoint with 30 days' notice to Users. Continued use after the notice period constitutes acceptance.

---

**Signatures:**

_Data Processor: BioPoint Inc._
_Date: February 10, 2026_
