# Disaster Recovery Communication Templates

**Classification:** L3-CONFIDENTIAL  
**Last Updated:** January 2026  
**Owner:** Communications Coordinator  
**Review Schedule:** Quarterly

---

## Overview

This document contains standardized communication templates for disaster recovery incidents affecting BioPoint's healthcare platform. These templates ensure consistent, accurate, and HIPAA-compliant communications during crisis situations.

**Communication Principles:**
- **Transparency:** Clear, honest communication about incidents
- **Timeliness:** Regular updates at defined intervals
- **HIPAA Compliance:** Protect PHI while communicating appropriately
- **Stakeholder-Specific:** Tailored messages for different audiences
- **Professional Tone:** Calm, reassuring, and authoritative

---

## Internal Communication Templates

### Immediate Alert (0-15 minutes)

**Recipients:** DR Team, Leadership, Key Stakeholders
**Channels:** PagerDuty, Slack, Email, SMS
**Frequency:** Once at detection

```
🚨 DISASTER RECOVERY ALERT - P{PRIORITY}

Incident ID: BP-DR-{YYYYMMDD}-{SEQUENCE}
Severity: P{PRIORITY} - {CLASSIFICATION}
Time Detected: {TIMESTAMP}
Affected Systems: {SYSTEMS}
Estimated Impact: {IMPACT_DESCRIPTION}

DR Commander: {DRC_NAME} - +1-415-555-0100
Status Page: https://status.biopoint.com
Conference Bridge: {EMERGENCY_BRIDGE}

All DR team members report to emergency bridge immediately.

{ADDITIONAL_DETAILS}
```

### Progress Update (Every 15 minutes)

**Recipients:** DR Team, Leadership
**Channels:** Slack, Email, Conference Bridge
**Frequency:** Every 15 minutes during active incident

```
BioPoint DR Update - {TIMESTAMP}

Incident ID: BP-DR-{ID}
Status: {ASSESSMENT/RECOVERY/VERIFICATION}
Progress: {PERCENTAGE_COMPLETE}%
Next Milestone: {NEXT_ACTION}
ETA: {ESTIMATED_COMPLETION}

Affected Users: {COUNT}
Services Impacted: {LIST}
Data Integrity: {STATUS}
HIPAA Compliance: {STATUS}

{DETAILED_UPDATE}

Next Update: {NEXT_UPDATE_TIME}
Contact: {DRC_NAME} - +1-415-555-0100
```

### Leadership Briefing (Every 30 minutes)

**Recipients:** C-Suite, Board Members, Legal Counsel
**Channels:** Email, Conference Call
**Frequency:** Every 30 minutes

```
BioPoint Executive Briefing - {DATE}

INCIDENT OVERVIEW:
- Incident ID: BP-DR-{ID}
- Severity: P{PRIORITY}
- Status: {ACTIVE/CONTAINED/RESOLVED}
- Duration: {HOURS} hours

BUSINESS IMPACT:
- Users Affected: {COUNT}
- Systems Impacted: {SYSTEMS}
- Service Disruption: {DESCRIPTION}
- Regulatory Exposure: {HIPAA/GDPR/OTHER}

REGULATORY STATUS:
- Breach Assessment: {IN_PROGRESS/COMPLETE}
- Individual Notifications: {REQUIRED/NOT_REQUIRED}
- HHS OCR Notification: {REQUIRED/NOT_REQUIRED}
- Timeline Compliance: {ON_TRACK/AT_RISK}

NEXT STEPS:
- {IMMEDIATE_ACTIONS}
- {REGULATORY_DEADLINES}
- {COMMUNICATION_PLAN}

Contact: {DRC_NAME} - +1-415-555-0100
Legal Counsel: {LEGAL_CONTACT}
```

### Recovery Completion (Within 1 hour of resolution)

**Recipients:** All Internal Stakeholders
**Channels:** Email, Slack, Status Page
**Frequency:** Once when resolved

```
✅ BioPoint DR Recovery Complete

Incident ID: BP-DR-{ID}
Recovery Time: {DURATION}
Services Restored: {LIST}
Data Integrity: Verified
HIPAA Compliance: Maintained

Next Steps:
- Continuous monitoring for 24 hours
- Post-incident review scheduled
- Enhanced monitoring activated
- Customer notifications sent

Thank you for your patience during this incident.

{TEAM_CONTACTS}
```

### Post-Incident Review Invitation (24 hours post-resolution)

**Recipients:** DR Team, Leadership, Affected Teams
**Channels:** Email, Calendar Invite
**Frequency:** Once, 24 hours post-resolution

```
Subject: Post-Incident Review - BioPoint DR Event {INCIDENT_ID}

Dear Team,

A post-incident review meeting has been scheduled for the recent disaster recovery event:

**Incident:** BP-DR-{ID}
**Date:** {INCIDENT_DATE}
**Duration:** {DURATION}
**Impact:** {DESCRIPTION}

**Review Meeting Details:**
Date: {REVIEW_DATE}
Time: {REVIEW_TIME}
Duration: 90 minutes
Location: {MEETING_LINK}

**Required Attendees:**
- Incident Commander
- Technical Recovery Lead
- Communications Coordinator
- Legal Counsel (if applicable)
- Affected Department Heads

**Meeting Agenda:**
1. Incident Timeline Review (15 min)
2. Response Effectiveness Analysis (20 min)
3. Lessons Learned Discussion (25 min)
4. Process Improvement Recommendations (20 min)
5. Action Items and Next Steps (10 min)

**Pre-Meeting Preparation:**
- Review incident documentation
- Prepare feedback on response procedures
- Identify areas for improvement

Please confirm your attendance by {RSVP_DEADLINE}.

Contact: {COORDINATOR_NAME} - {COORDINATOR_EMAIL}
```

---

## External Communication Templates

### Customer Notification - Service Disruption

**Recipients:** All BioPoint Users
**Channels:** Email, In-App Notification, Status Page
**Frequency:** Upon detection and upon resolution

```
Subject: BioPoint Service Update - {INCIDENT_TYPE}

Dear BioPoint User,

We are writing to inform you of a service disruption that affected BioPoint between {START_TIME} and {END_TIME}.

**What happened:**
{BRIEF_DESCRIPTION}

**What we did:**
{RECOVERY_ACTIONS}

**Your data:**
✅ All health data remains secure and encrypted
✅ No PHI was compromised during the incident
✅ All biomarker and lab data is intact
✅ Progress photos and documents are safe

**Current status:**
✅ Service is fully restored
✅ All features are operational
✅ Enhanced monitoring is active

We sincerely apologize for any inconvenience this may have caused. Our team has implemented additional safeguards to prevent similar incidents.

If you have any questions or concerns, please contact us at support@biopoint.com or 1-800-BIOPOINT.

Thank you for your patience and continued trust in BioPoint.

The BioPoint Team

Reference: Incident {INCIDENT_ID}
```

### Customer Notification - Maintenance Window

**Recipients:** All BioPoint Users
**Channels:** Email, In-App Notification, Status Page
**Frequency:** 24 hours before, 1 hour before, upon completion

```
Subject: Scheduled Maintenance - BioPoint Service

Dear BioPoint User,

We will be performing scheduled maintenance on BioPoint to enhance our infrastructure and improve service reliability.

**Maintenance Schedule:**
Start Time: {START_TIME}
End Time: {END_TIME}
Duration: Approximately {DURATION}

**What to expect:**
- Service will be temporarily unavailable
- All data will remain secure and encrypted
- No action is required on your part

**Why we're doing this:**
{MAINTENANCE_REASON}

We'll send another notification when maintenance is complete.

Thank you for your patience as we work to improve BioPoint.

The BioPoint Team
```

### Customer Notification - Security Incident

**Recipients:** Affected Users Only
**Channels:** Email, Certified Mail (if required)
**Frequency:** Within 60 days per HIPAA requirements

```
Subject: Important Security Notice - BioPoint Account

Dear [USER_NAME],

We are writing to inform you of a data security incident that may have affected some of your personal health information maintained by BioPoint.

**WHAT HAPPENED:**
On [DISCOVERY_DATE], we discovered that [BRIEF_DESCRIPTION_OF_INCIDENT]. We immediately took action to secure our systems and investigate the incident.

**INFORMATION INVOLVED:**
The information that may have been affected includes [SPECIFIC_PHI_TYPES], such as [EXAMPLES].

**WHAT WE ARE DOING:**
We took immediate steps to [MITIGATION_ACTIONS]. We have also [SECURITY_IMPROVEMENTS]. We are working with cybersecurity experts and have reported this incident to the appropriate authorities.

**WHAT YOU SHOULD DO:**
While we have no evidence that your information has been misused, we recommend that you:
1. Monitor your accounts for any unusual activity
2. Contact us immediately if you notice anything suspicious
3. Consider placing a fraud alert on your credit reports
4. Keep this notice for your records

We sincerely apologize for this incident and any inconvenience it may cause.

If you have questions, please contact us at:
Phone: 1-800-BIOPOINT (1-800-246-7646)
Email: privacy@biopoint.com
Address: BioPoint Privacy Office, 123 Healthcare Ave, Suite 100, San Francisco, CA 94105

Sincerely,
BioPoint Privacy Team

Reference: Incident {INCIDENT_ID}
```

---

## Regulatory Communication Templates

### HHS OCR Breach Notification

**Recipients:** HHS Office for Civil Rights
**Channels:** OCR Breach Report Tool
**Frequency:** Within 60 days of discovery (if applicable)

```
COVERED ENTITY REPORT

1. Entity Information:
   - Name: BioPoint Inc.
   - Address: 123 Healthcare Ave, Suite 100, San Francisco, CA 94105
   - Phone: 1-800-246-7646
   - Contact: Chief Privacy Officer

2. Breach Information:
   - Date of Breach: {BREACH_DATE}
   - Date of Discovery: {DISCOVERY_DATE}
   - Number of Individuals Affected: {COUNT}

3. Circumstances of Breach:
   - Type of Breach: {HACKING/IMPROPER_DISCLOSURE/LOSS/THEFT/OTHER}
   - Location of Breached Information: {SYSTEMS_AFFECTED}
   - Description: {DETAILED_DESCRIPTION}

4. Types of PHI Involved:
   - Names: {YES/NO}
   - Addresses: {YES/NO}
   - Dates: {YES/NO}
   - Phone Numbers: {YES/NO}
   - Email Addresses: {YES/NO}
   - Medical Record Numbers: {YES/NO}
   - Health Plan Numbers: {YES/NO}
   - Account Numbers: {YES/NO}
   - Certificate/License Numbers: {YES/NO}
   - Vehicle Identifiers: {YES/NO}
   - Device Identifiers: {YES/NO}
   - Biometric Identifiers: {YES/NO}
   - Full Face Photos: {YES/NO}
   - Other: {SPECIFY}

5. Mitigation Efforts:
   - {DETAILED_MITIGATION_STEPS}
   - {SECURITY_IMPROVEMENTS_MADE}

6. Risk Assessment:
   - Low probability of compromise: {YES/NO}
   - Risk factors considered: {LIST_FACTORS}
   - Mitigation effectiveness: {ASSESSMENT}

7. Notification Status:
   - Individual Notifications: {STATUS}
   - Media Notification: {STATUS}
   - Documentation: Complete and available for review

Contact for additional information:
privacy@biopoint.com | 1-800-246-7646
```

### State Attorney General Notification

**Recipients:** Relevant State Attorney General(s)
**Channels:** Certified Mail, Email
**Frequency:** Within 72 hours (if ≥500 residents affected)

```
URGENT - HIPAA BREACH NOTIFICATION

TO: [STATE] Attorney General's Office
FROM: BioPoint Inc.
DATE: [CURRENT_DATE]
RE: Data Security Incident Notification

Dear [ATTORNEY_GENERAL_NAME],

BioPoint Inc. is notifying your office of a data security incident that may have affected [COUNT] residents of [STATE].

INCIDENT DETAILS:
- Date of Discovery: [DISCOVERY_DATE]
- Number of [STATE] Residents Affected: [COUNT]
- Types of Information Involved: [DATA_TYPES]
- Brief Description: [DESCRIPTION]

We have taken immediate steps to secure our systems and investigate the incident, including:
- Securing affected systems
- Conducting forensic analysis
- Implementing additional security measures
- Notifying affected individuals

Individual notification letters are being mailed separately. Affected residents have been provided with specific steps to protect themselves.

We are committed to full compliance with all applicable state and federal laws.

Contact for additional information:
[CONTACT_NAME]
[CONTACT_TITLE]
BioPoint Inc.
[ADDRESS]
Phone: [PHONE]
Email: [EMAIL]

Sincerely,
[SIGNATURE]
[NAME]
[Title]
```

### Media Statement (≥500 individuals)

**Recipients:** Major Media Outlets
**Channels:** Press Release, Wire Services
**Frequency:** Within 60 days (if required)

```
FOR IMMEDIATE RELEASE

BioPoint Provides Notice of Data Security Incident

SAN FRANCISCO, CA - [DATE] - BioPoint Inc. today announced that it experienced a data security incident that may have affected the personal health information of approximately [NUMBER] individuals.

On [DISCOVERY_DATE], BioPoint discovered that [BRIEF_DESCRIPTION]. Upon discovery, BioPoint immediately took steps to secure its systems and launched a comprehensive investigation with leading cybersecurity experts.

The information that may have been accessed includes [TYPES_OF_PHI]. BioPoint has no evidence that any information has been misused, and the company is taking this matter very seriously.

BioPoint has taken the following steps in response to this incident:
- Immediately secured affected systems
- Launched comprehensive investigation
- Implemented additional security measures
- Notified appropriate authorities
- Providing support to affected individuals

BioPoint is notifying all affected individuals directly and has established a dedicated call center to answer questions. Affected individuals can call 1-800-BIOPOINT or visit biopoint.com/privacy for more information.

BioPoint sincerely apologizes for this incident and any inconvenience it may cause.

About BioPoint: BioPoint is a health technology company dedicated to helping individuals track and optimize their health biomarkers.

Contact: privacy@biopoint.com
```

---

## Vendor Communication Templates

### Cloud Provider Escalation

**Recipients:** AWS Support, Cloudflare Support, Neon Support
**Channels:** Support Tickets, Phone
**Frequency:** As needed during incident

```
URGENT: Production Service Down - Enterprise Support Required

Customer: BioPoint Inc.
Account ID: [ACCOUNT_ID]
Support Plan: Enterprise
Severity: Critical (Service Down)

INCIDENT SUMMARY:
- Service: [SERVICE_NAME]
- Region: [REGION]
- Start Time: [START_TIME]
- Impact: Complete service unavailability
- Users Affected: [COUNT]

BUSINESS IMPACT:
- Healthcare platform serving [X] users
- HIPAA-regulated environment
- Revenue impact: $[AMOUNT]/hour
- Regulatory compliance at risk

CURRENT STATUS:
- Health checks failing
- All availability zones affected
- Backup systems activated

REQUESTED ACTION:
- Immediate escalation to engineering team
- Root cause analysis
- ETA for service restoration
- Workaround options

Contact: [TECHNICAL_CONTACT]
Phone: [PHONE_NUMBER]
Email: [EMAIL]
Reference: Ticket #[TICKET_NUMBER]
```

### Vendor Service Disruption Notification

**Recipients:** All Critical Vendors
**Channels:** Email, Phone
**Frequency:** Upon vendor impact detection

```
URGENT: Service Disruption Notification

TO: [VENDOR_NAME] Support Team
FROM: BioPoint Operations
DATE: [CURRENT_DATE]
RE: Service Disruption Affecting BioPoint

We are experiencing a service disruption that may affect your services integrated with BioPoint.

INCIDENT DETAILS:
- Start Time: [START_TIME]
- Expected Duration: [DURATION]
- Affected Services: [SERVICES]
- Impact Level: [SEVERITY]

YOUR SERVICES:
- Service Name: [SERVICE_NAME]
- Expected Impact: [DESCRIPTION]
- Recommended Action: [ACTION]

We will keep you updated as the situation develops.

Emergency Contact: [CONTACT_NAME]
Phone: [PHONE]
Email: [EMAIL]
Incident ID: [INCIDENT_ID]
```

---

## Communication Timing Guidelines

### Immediate Response (0-15 minutes)
- Internal alert to DR team
- Vendor escalation if needed
- Status page update

### Assessment Phase (15-60 minutes)
- Leadership briefing
- Customer notification (if service impact)
- Regulatory notification preparation

### Recovery Phase (1-4 hours)
- Progress updates every 15 minutes
- Customer updates every 30 minutes
- Leadership updates every 30 minutes

### Resolution Phase (4-24 hours)
- Final resolution notification
- Post-incident review scheduling
- Customer follow-up communications

### Post-Resolution (24+ hours)
- Post-incident review meeting
- Regulatory notifications (if required)
- Process improvement communications

---

## Communication Approval Matrix

| Communication Type | Approval Required | Approver | Timeline |
|-------------------|-------------------|----------|----------|
| Internal DR Alert | Immediate | DR Commander | Instant |
| Customer Notification | Within 30 min | Communications Officer | 30 min |
| Regulatory Notification | Within 4 hours | Legal Counsel | 4 hours |
| Media Statement | Within 2 hours | CEO + Legal | 2 hours |
| Public Status Update | Within 15 min | Communications Officer | 15 min |

---

## Communication Quality Checklist

### Before Sending Any Communication:
- [ ] Accurate incident details verified
- [ ] HIPAA compliance reviewed
- [ ] Legal team approval (if required)
- [ ] Technical accuracy confirmed
- [ ] Tone appropriate for audience
- [ ] Contact information updated
- [ ] Timeline commitments realistic

### For Customer Communications:
- [ ] PHI protection verified
- [ ] Regulatory requirements met
- [ ] Translation needs identified
- [ ] Accessibility requirements met
- [ ] Follow-up process established

---

## Emergency Contact Information

### Internal Contacts
- **DR Commander:** +1-415-555-0100
- **Communications Officer:** +1-415-555-0103
- **Legal Counsel:** +1-415-555-0103
- **C-Suite Emergency:** +1-415-555-0100

### External Contacts
- **AWS Support:** Enterprise Support Console
- **Cloudflare Support:** Emergency Portal
- **Neon Support:** support@neon.tech
- **HHS OCR:** (877) 696-6775

---

## Communication Training Requirements

### Annual Training
- All communication templates review
- HIPAA communication requirements
- Crisis communication best practices
- Media relations training

### Quarterly Updates
- Template revisions and improvements
- Contact information updates
- Process enhancements
- Lessons learned integration

### Incident-Specific Training
- Post-incident communication review
- Process improvement implementation
- New template creation
- Team feedback incorporation

---

**Document Control:**
- **Version:** 1.0
- **Last Review:** January 2026
- **Next Review:** April 2026
- **Owner:** Communications Coordinator
- **Classification:** L3-CONFIDENTIAL

**Training Requirements:**
- All communication team members must review quarterly
- Annual crisis communication training required
- Legal review for regulatory templates annually