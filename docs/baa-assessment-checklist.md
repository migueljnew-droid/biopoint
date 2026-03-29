# BioPoint BAA Assessment Checklist - HIPAA Vendor Due Diligence

**Document Status:** ACTIVE  
**Last Updated:** 2026-01-20  
**Clearance Level:** L3-CONFIDENTIAL  
**Compliance Officer:** Healthcare Compliance Team  

## Executive Summary

This checklist ensures comprehensive vendor assessment for HIPAA Business Associate Agreement (BAA) execution. All vendors with PHI access must complete this assessment before BAA execution.

**Assessment Categories:**
- 🔴 **Critical Risk:** Immediate BAA required, high PHI exposure
- 🟠 **High Risk:** BAA required, moderate PHI exposure
- 🟡 **Medium Risk:** BAA required, limited PHI exposure
- 🟢 **Low Risk:** BAA not required, no PHI access

---

## Pre-Assessment Vendor Classification

### Vendor Risk Matrix

| Risk Level | Criteria | BAA Required | Assessment Depth | Timeline |
|------------|----------|--------------|------------------|----------|
| 🔴 Critical | Processes PHI directly, no BAA | ✅ Immediate | Full assessment | 24-48 hours |
| 🟠 High | Stores/transmits PHI | ✅ Required | Comprehensive | 1 week |
| 🟡 Medium | Potential PHI access | ✅ Required | Standard | 2 weeks |
| 🟢 Low | No PHI access | ❌ Not required | Minimal | N/A |

---

## Due Diligence Questionnaire

### Section 1: Basic Vendor Information

#### Company Profile
- [ ] **Legal Entity Name:** Complete legal business name
- [ ] **Primary Business Address:** Corporate headquarters
- [ ] **Data Processing Locations:** All facilities processing PHI
- [ ] **Years in Business:** Business longevity assessment
- [ ] **Healthcare Industry Experience:** Specific HIPAA experience
- [ ] **Client References:** Minimum 3 healthcare clients

#### Contact Information
- [ ] **Primary Contact:** Business relationship manager
- [ ] **Technical Contact:** Security/engineering contact
- [ ] **Legal Contact:** Contract/legal affairs contact
- [ ] **24/7 Security Contact:** Incident response contact
- [ ] **Escalation Path:** Management escalation procedures

### Section 2: HIPAA Compliance Assessment

#### HIPAA Expertise
- [ ] **HIPAA Training Program:** Employee training documentation
- [ ] **Compliance Officer Designation:** Named HIPAA compliance officer
- [ ] **Policy Documentation:** Written HIPAA policies and procedures
- [ ] **Incident Response Plan:** Documented breach response procedures
- [ ] **Business Associate Experience:** Number of current BAAs

#### Regulatory History
- [ ] **OCR Investigations:** Any HHS Office for Civil Rights investigations
- [ ] **Breach History:** Any HIPAA breaches in past 5 years
- [ ] **Settlements/Penalties:** Any regulatory settlements
- [ ] **Audit History:** Results of any HIPAA audits
- [ ] **Corrective Action Plans:** Any implemented CAPs

### Section 3: Security Assessment

#### Administrative Safeguards (§164.308)
- [ ] **Security Officer Designation:** Named security officer
- [ ] **Workforce Training:** Security awareness training program
- [ ] **Access Management:** User access provisioning/deprovisioning
- [ ] **Security Incident Procedures:** Documented incident response
- [ ] **Contingency Plan:** Disaster recovery and emergency mode
- [ ] **Business Associate Agreements:** Subcontractor BAAs
- [ ] **Security Evaluations:** Periodic risk assessments

#### Physical Safeguards (§164.310)
- [ ] **Facility Access Controls:** Physical security measures
- [ ] **Workstation Use Policies:** Device and media controls
- [ ] **Device and Media Controls:** Equipment disposal procedures
- [ ] **Visitor Access:** Visitor logging and escort procedures

#### Technical Safeguards (§164.312)
- [ ] **Access Control:** Unique user identification
- [ ] **Audit Controls:** Hardware/software/transaction auditing
- [ ] **Integrity:** Electronic PHI protection
- [ ] **Person or Entity Authentication:** Multi-factor authentication
- [ ] **Transmission Security:** Encryption and integrity controls

### Section 4: Technical Security Requirements

#### Encryption Standards
- [ ] **Data at Rest Encryption:** AES-256 or equivalent
- [ ] **Data in Transit Encryption:** TLS 1.3 minimum
- [ ] **Key Management:** Secure key storage and rotation
- [ ] **Database Encryption:** Transparent data encryption
- [ ] **File System Encryption:** Full disk encryption
- [ ] **Mobile Device Encryption:** Device-level encryption

#### Access Controls
- [ ] **Multi-Factor Authentication:** Required for all systems
- [ ] **Role-Based Access Control:** Principle of least privilege
- [ ] **Privileged Access Management:** Admin access controls
- [ ] **Session Management:** Timeout and concurrent session controls
- [ ] **Password Policies:** Complex password requirements
- [ ] **Account Lockout:** Failed login attempt controls

#### Audit and Monitoring
- [ ] **System Audit Logs:** Comprehensive logging
- [ ] **Access Audit Trails:** User activity monitoring
- [ ] **Failed Login Attempts:** Security event logging
- [ ] **Privilege Escalation:** Administrative action logging
- [ ] **Data Access Logging:** PHI access monitoring
- [ ] **Log Retention:** Minimum 6-year retention

### Section 5: Infrastructure and Operations

#### Data Center Security
- [ ] **Physical Security:** 24/7 security personnel
- [ ] **Environmental Controls:** Climate and fire suppression
- [ ] **Power Redundancy:** UPS and generator backup
- [ ] **Network Redundancy:** Multiple ISP connections
- [ ] **Geographic Distribution:** Multiple data center locations
- [ ] **Disaster Recovery:** RPO/RTO requirements met

#### Network Security
- [ ] **Firewall Protection:** Next-generation firewalls
- [ ] **Intrusion Detection/Prevention:** IDS/IPS systems
- [ ] **Network Segmentation:** VLAN and subnet isolation
- [ ] **DDoS Protection:** Distributed denial of service mitigation
- [ ] **VPN Access:** Secure remote access
- [ ] **Network Monitoring:** 24/7 network operations center

### Section 6: Third-Party and Subcontractor Management

#### Subcontractor Assessment
- [ ] **Subcontractor Inventory:** Complete list of all subcontractors
- [ ] **Due Diligence Process:** Subcontractor assessment procedures
- [ ] **BAA Flow-Down:** Business associate agreements with subcontractors
- [ ] **Security Requirements:** Security standards for subcontractors
- [ ] **Audit Rights:** Right to audit subcontractors
- [ ] **Geographic Restrictions:** Data processing location requirements

#### Cloud Service Providers
- [ ] **Cloud Provider Assessment:** AWS, Azure, GCP evaluation
- [ ] **Shared Responsibility Model:** Security responsibility matrix
- [ ] **Data Residency:** Geographic data location controls
- [ ] **Cloud Security Tools:** Native cloud security services
- [ ] **Compliance Certifications:** SOC 2, ISO 27001, FedRAMP

---

## Risk Assessment Criteria

### Risk Scoring Methodology

#### Likelihood Scale (1-5)
- **1 - Rare:** Unlikely to occur (less than 10% chance)
- **2 - Unlikely:** May occur under specific circumstances (10-25%)
- **3 - Possible:** Could occur under normal operations (25-50%)
- **4 - Likely:** Probably will occur under normal operations (50-75%)
- **5 - Almost Certain:** Expected to occur under normal operations (75%+)

#### Impact Scale (1-5)
- **1 - Minimal:** Minor inconvenience, no PHI exposure
- **2 - Minor:** Limited PHI exposure, easily remediated
- **3 - Moderate:** Moderate PHI exposure, requires investigation
- **4 - Major:** Significant PHI exposure, regulatory notification required
- **5 - Catastrophic:** Massive PHI exposure, business-critical impact

#### Risk Matrix

| Likelihood/Impact | 1 Minimal | 2 Minor | 3 Moderate | 4 Major | 5 Catastrophic |
|-------------------|-----------|---------|------------|---------|----------------|
| **5 Almost Certain** | 🟡 Medium | 🟡 Medium | 🟠 High | 🔴 Critical | 🔴 Critical |
| **4 Likely** | 🟡 Medium | 🟡 Medium | 🟠 High | 🟠 High | 🔴 Critical |
| **3 Possible** | 🟢 Low | 🟡 Medium | 🟡 Medium | 🟠 High | 🟠 High |
| **2 Unlikely** | 🟢 Low | 🟢 Low | 🟡 Medium | 🟡 Medium | 🟠 High |
| **1 Rare** | 🟢 Low | 🟢 Low | 🟢 Low | 🟡 Medium | 🟡 Medium |

### Risk Categories

#### 🔴 Critical Risk (Score 20-25)
- **Immediate Action Required:** 24-48 hour response
- **Executive Notification:** C-suite notification required
- **Legal Review:** Legal counsel involvement required
- **BAA Priority:** Execute BAA immediately
- **Monitoring:** Weekly status reviews

#### 🟠 High Risk (Score 12-19)
- **Action Required:** 1 week response
- **Management Notification:** Department head notification
- **Security Review:** Security team assessment
- **BAA Priority:** Execute BAA within 1 week
- **Monitoring:** Bi-weekly status reviews

#### 🟡 Medium Risk (Score 6-11)
- **Action Required:** 2 week response
- **Team Notification:** Project team notification
- **Standard Review:** Standard assessment process
- **BAA Priority:** Execute BAA within 2 weeks
- **Monitoring:** Monthly status reviews

#### 🟢 Low Risk (Score 1-5)
- **Action Required:** Standard process
- **Documentation:** Risk acceptance documentation
- **BAA Status:** BAA not required
- **Monitoring:** Quarterly reviews

---

## Security Assessment Requirements

### Required Security Certifications

#### Essential Certifications
- [ ] **SOC 2 Type II:** Service Organization Control 2
- [ ] **ISO 27001:** Information Security Management
- [ ] **HIPAA Compliance:** Direct HIPAA compliance verification
- [ ] **NIST Cybersecurity Framework:** Implementation verification

#### Preferred Certifications
- [ ] **FedRAMP:** Federal Risk and Authorization Management Program
- [ ] **ISO 27017:** Cloud Security Controls
- [ ] **ISO 27018:** Cloud Privacy Controls
- [ ] **CSA STAR:** Cloud Security Alliance Security Trust Assurance
- [ ] **HITRUST CSF:** Health Information Trust Alliance

### Security Assessment Process

#### Phase 1: Documentation Review
- [ ] **Security Policies:** Comprehensive policy documentation
- [ ] **Procedures Documentation:** Detailed operational procedures
- [ ] **Training Records:** Employee security training documentation
- [ ] **Audit Reports:** Third-party audit results
- [ ] **Incident Reports:** Security incident history

#### Phase 2: Technical Assessment
- [ ] **Vulnerability Scan:** External vulnerability assessment
- [ ] **Penetration Test:** Authorized penetration testing
- [ ] **Configuration Review:** Security configuration assessment
- [ ] **Architecture Review:** Security architecture evaluation
- [ ] **Code Review:** Application security assessment (if applicable)

#### Phase 3: Operational Assessment
- [ ] **Incident Response Test:** Simulated incident response
- [ ] **Disaster Recovery Test:** DR plan validation
- [ ] **Business Continuity Test:** BC plan validation
- [ ] **Security Awareness Test:** Employee security testing
- [ ] **Access Control Test:** User access validation

---

## Breach Notification Requirements

### Vendor Breach Notification Obligations

#### Immediate Notification (Within 24 Hours)
- [ ] **Security Incident Discovery:** Vendor discovers potential breach
- [ ] **Initial Assessment:** Preliminary impact assessment
- [ ] **BioPoint Notification:** Immediate notification to BioPoint
- [ ] **Containment Actions:** Immediate containment measures
- [ ] **Evidence Preservation:** Preservation of forensic evidence

#### Detailed Notification (Within 72 Hours)
- [ ] **Incident Description:** Detailed description of the incident
- [ ] **PHI Impact Assessment:** Assessment of PHI affected
- [ ] **Root Cause Analysis:** Preliminary root cause analysis
- [ ] **Remediation Actions:** Steps taken to remediate
- [ ] **Timeline of Events:** Chronological timeline of incident

#### Regulatory Notification (Within 60 Days)
- [ ] **OCR Notification:** HHS Office for Civil Rights notification
- [ ] **Individual Notification:** Affected individual notification
- [ ] **Media Notification:** Media notification (if required)
- [ ] **State Notification:** State attorney general notification
- [ ] **Documentation:** Complete incident documentation

### Breach Response Timeline

#### Hour 0-24: Discovery and Initial Response
- Incident discovery and initial assessment
- Immediate containment measures
- BioPoint notification within 24 hours
- Legal counsel notification
- Evidence preservation

#### Day 1-3: Investigation and Assessment
- Detailed incident investigation
- PHI impact assessment
- Root cause analysis initiation
- Remediation planning
- Stakeholder communication

#### Day 4-30: Remediation and Documentation
- Implementation of remediation measures
- Complete root cause analysis
- Documentation of all actions taken
- Process improvement implementation
- Regulatory preparation

#### Day 31-60: Regulatory Response
- OCR notification and response
- Individual notification process
- Media coordination (if required)
- Legal coordination
- Post-incident review

---

## Audit Rights Requirements

### BioPoint Audit Rights

#### Right to Audit Clause
- [ ] **Annual Audit Right:** Annual comprehensive audit
- [ ] **For-Cause Audit Right:** Audit triggered by incidents
- [ ] **Third-Party Auditor:** Use of external audit firms
- [ ] **Cost Allocation:** Audit cost responsibility
- [ ] **Cooperation Requirement:** Vendor cooperation obligations

#### Audit Scope
- [ ] **Security Controls:** Assessment of security measures
- [ ] **HIPAA Compliance:** HIPAA requirement verification
- [ ] **BAA Compliance:** Business associate agreement compliance
- [ ] **Subcontractor Assessment:** Subcontractor compliance review
- [ ] **Incident Response:** Incident response capability assessment

### Vendor Audit Obligations

#### Internal Audit Program
- [ ] **Annual Internal Audits:** Annual self-assessments
- [ ] **Third-Party Audits:** External audit firm assessments
- [ ] **Compliance Certifications:** Industry certifications
- [ ] **Audit Report Sharing:** Sharing results with BioPoint
- [ ] **Corrective Action Plans:** Remediation of audit findings

#### Audit Documentation
- [ ] **Audit Reports:** Complete audit documentation
- [ ] **Remediation Evidence:** Evidence of corrective actions
- [ ] **Compliance Certificates:** Current certifications
- [ ] **Risk Assessments:** Periodic risk assessments
- [ ] **Management Reviews:** Senior management reviews

---

## Assessment Completion and Approval

### Assessment Scoring

#### Total Score Calculation
- **Section 1:** Basic Information (10 points)
- **Section 2:** HIPAA Compliance (25 points)
- **Section 3:** Security Assessment (30 points)
- **Section 4:** Technical Security (20 points)
- **Section 5:** Infrastructure (10 points)
- **Section 6:** Third-Party Management (5 points)
- **Total Possible:** 100 points

#### Approval Thresholds
- **90-100 Points:** Approved for BAA execution
- **80-89 Points:** Approved with conditions
- **70-79 Points:** Requires remediation before approval
- **Below 70 Points:** Not approved for BAA execution

### Sign-Off Requirements

#### Internal Review Process
- [ ] **Compliance Officer Review:** Primary assessment review
- [ ] **Security Officer Review:** Security assessment validation
- [ ] **Legal Counsel Review:** Legal and regulatory compliance
- [ ] **Executive Approval:** Senior management approval
- [ ] **Documentation:** Complete assessment documentation

#### External Validation
- [ ] **Vendor Acknowledgment:** Vendor review and acknowledgment
- [ ] **Third-Party Validation:** External expert review (if required)
- [ ] **Legal Review:** External legal counsel review
- [ ] **Final Approval:** Executive sign-off
- [ ] **Archival:** Assessment documentation archival

---

**Document Classification:** L3-CONFIDENTIAL  
**Next Review Date:** Quarterly or upon vendor change  
**Distribution:** Compliance Team, Legal, Security, Vendor Management