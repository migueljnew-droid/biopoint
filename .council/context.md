# BioPoint - Project Context

> **Generated**: 2026-03-30 15:00:14 UTC
> **Council Protocol Version**: 1.0.0
> **Connected to**: The Council (430 AI agents)

---

## Quick Reference

**Copy this entire file** into any IDE that doesn't have native Council integration.

---

## Project Overview

**Name**: BioPoint
**Description**: A project managed by The Council AI system.
**Tech Stack**: expo, react-native, typescript

---

## Chairman Identity

- **Name**: Miguel Louis Jiminez
- **Artist Name**: Louis Gold
- **AI System**: The Council (430 specialized agents)

---

## Critical Preferences (ALWAYS FOLLOW)

### 1. ACTION OVER EXPLANATION
Execute tasks, don't explain them. "YOU RUN IT" and "JUST DO IT" are common directives.

### 2. AVOID OVER-ENGINEERING
- Only make changes directly requested
- Don't add features beyond what's asked
- Keep solutions simple and focused
- Three similar lines > premature abstraction

### 3. READ BEFORE MODIFYING
- Never propose changes to code you haven't read
- Understand existing patterns before suggesting modifications

### 4. NO TIME ESTIMATES
Never give time predictions. Focus on what needs to be done.

### 5. PROFESSIONAL OBJECTIVITY
- Technical accuracy over validation
- Disagree when necessary
- No excessive praise or "You're absolutely right"

---

## Lessons Learned (APPLY EVERYWHERE)

1. **Never use sed on Python files** - too easy to break indentation/syntax
2. **Always keep backups** before remote modifications
3. **Test API changes incrementally** - don't batch risky changes

---

## Code Standards

### Before Making Changes
- Read existing code first
- Check for existing implementations
- Understand patterns before modifying

### When Writing Code
- Avoid over-engineering
- Keep solutions focused
- Don't add unnecessary abstractions
- Test incrementally

### What NOT to Do
- Don't add docstrings/comments to unchanged code
- Don't add error handling for impossible scenarios
- Don't create helpers for one-time operations
- Don't design for hypothetical future requirements

---

## Council Access

### Via Claude Code (Recommended)
- MCP server configured in `.claude/mcp.json`
- Use `!!` for Divine Orchestrator
- Use `/memory` to store project memories
- Use `/recall` to search memories

### Via API
```
Memory Sync: POST http://localhost:8000/api/v1/memories/sync
Status: GET http://localhost:8000/api/v1/memories/status
Project: GET http://localhost:8000/api/v1/memories/project/biopoint
```

### Available Agent Categories
- **GENESIS** (L5-BLACK): Divine Orchestrator
- **SOVEREIGN** (L4): Strategic synthesis
- **TECHNE** (L3): Technical development
- **LEXIS** (L3): Legal analysis
- **AURUM** (L3): Financial strategy
- **MELODIA** (L3): Music/creative
- *+ 469 more specialized agents*

---
## Project Structure

```
biopoint/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── __tests__/
│   │   │   ├── config/
│   │   │   ├── docs/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── scripts/
│   │   │   ├── services/
│   │   │   ├── types/
│   │   │   ├── utils/
│   │   │   ├── app.ts
│   │   │   ├── index.ts
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   ├── mobile/
│   │   ├── app/
│   │   │   ├── (tabs)/
│   │   │   ├── community/
│   │   │   ├── settings/
│   │   │   ├── _layout.tsx
│   │   │   ├── calculator.tsx
│   │   │   ├── index.tsx
│   │   │   ├── lab-suggestions.tsx
│   │   │   ├── login.tsx
│   │   │   ├── onboarding.tsx
│   │   │   ├── oracle.tsx
│   │   │   ├── peptide-detail.tsx
│   │   │   ├── peptides.tsx
│   │   │   ├── premium.tsx
│   │   │   └── ... (3 more files)
│   │   ├── assets/
│   │   │   ├── icon.png
│   │   │   ├── logo-new.png
│   │   │   ├── splash.png
│   │   ├── src/
│   │   │   ├── __tests__/
│   │   │   ├── components/
│   │   │   ├── constants/
│   │   │   ├── data/
│   │   │   ├── services/
│   │   │   ├── store/
│   │   │   ├── theme/
│   │   │   ├── utils/
│   │   ├── targets/
│   │   │   ├── widget/
│   │   ├── app.json
│   │   ├── ARX_INFINITUM_ARTICLES_OF_ORGANIZATION.md
│   │   ├── ARX_INFINITUM_BYLAWS.md
│   │   ├── ARX_INFINITUM_INITIAL_RESOLUTIONS.md
│   │   ├── babel.config.js
│   │   ├── eas.json
│   │   ├── expo-env.d.ts
│   │   ├── jest.config.js
│   │   ├── jest.setup.js
│   │   ├── metro.config.js
│   │   └── ... (6 more files)
│   ├── web/
│   │   ├── index.html
├── db/
│   ├── prisma/
│   │   ├── migrations/
│   │   │   ├── 20240101000000_init/
│   │   │   ├── 20240120000000_add_phi_encryption/
│   │   │   ├── 20260120000000_add_gdpr_compliance/
│   │   │   ├── 20260219000000_add_lab_marker_trends_index/
│   │   │   ├── 20260313000000_add_peptide_compound/
│   │   │   ├── 20260313100000_add_goals_gin_index/
│   │   │   ├── add_rate_limiting_tables.sql
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   ├── src/
│   │   ├── encryption/
│   │   │   ├── crypto.ts
│   │   │   ├── fields.ts
│   │   │   ├── index.ts
│   │   ├── index.d.ts
│   │   ├── index.d.ts.map
│   │   ├── index.js
│   │   ├── index.js.map
│   │   ├── index.ts
│   ├── init-test.sql
│   ├── package.json
│   ├── tsconfig.json
├── docker/
│   ├── docker-compose.monitoring.yml
├── docs/
│   ├── adr/
│   │   ├── ADR-001-fastify-over-express.md
│   │   ├── ADR-002-neon-postgresql-over-rds.md
│   │   ├── ADR-003-cloudflare-r2-over-aws-s3.md
│   │   ├── ADR-004-doppler-over-aws-secrets-manager.md
│   │   ├── ADR-005-prisma-over-typeorm.md
│   │   ├── ADR-006-expo-over-react-native-cli.md
│   ├── compliance-evidence/
│   │   ├── gdpr-compliance-evidence.md
│   │   ├── hipaa-compliance-evidence.md
│   ├── monitoring/
│   ├── runbooks/
│   │   ├── api-outage.md
│   │   ├── database-outage.md
│   ├── scaling/
│   ├── security/
│   │   ├── audit-readiness-assessment.md
│   │   ├── penetration-test-plan.md
│   │   ├── remediation-tracker.md
│   │   ├── security-architecture.md
│   │   ├── security-assessment.md
│   │   ├── security-controls.md
│   │   ├── vulnerability-management.md
│   ├── api-reference.md
│   ├── AUDIT_FINDINGS_QUICK_REFERENCE.md
│   ├── baa-assessment-checklist.md
│   ├── business-associate-agreement-template.md
│   ├── ci-cd-pipeline.md
│   ├── CI_CD_README.md
│   ├── CRITICAL_FINDING_GOOGLE_GEMINI.md
│   ├── data-model.md
│   ├── data-processing-agreement.md
│   ├── database-performance.md
│   └── ... (53 more files)
├── infrastructure/
│   ├── backup/
│   │   ├── docs/
│   │   │   ├── backup-strategy.md
│   │   │   ├── disaster-recovery.md
│   │   ├── k8s/
│   │   │   ├── cronjobs/
│   │   │   ├── configmap-backup-scripts.yaml
│   │   ├── monitoring/
│   │   ├── scripts/
│   │   │   ├── backup-database.sh
│   │   │   ├── backup-database.sh.bak
│   │   │   ├── backup-s3.sh
│   │   │   ├── restore-database.sh
│   │   │   ├── restore-s3.sh
│   │   │   ├── verify-backups.sh
│   │   ├── IMPLEMENTATION_SUMMARY.md
│   │   ├── README.md
│   ├── cloudflare/
│   │   ├── load-balancer.tf
│   ├── docs/
│   ├── environments/
│   │   ├── dev.tfvars
│   │   ├── production.tfvars
│   │   ├── staging.tfvars
│   ├── k8s/
│   │   ├── hpa-pgbouncer.yaml
│   │   ├── hpa.yaml
│   ├── scripts/
│   │   ├── test-load-balancer.sh
│   │   ├── verify-deployment.sh
│   ├── terraform/
│   │   ├── cloudflare/
│   │   │   ├── main.tf
│   │   │   ├── outputs.tf
│   │   │   ├── variables.tf
│   │   ├── datadog/
│   │   │   ├── main.tf
│   │   │   ├── outputs.tf
│   │   │   ├── variables.tf
│   │   ├── doppler/
│   │   │   ├── main.tf
│   │   │   ├── outputs.tf
│   │   │   ├── variables.tf
│   │   ├── neon/
│   │   │   ├── main.tf
│   │   │   ├── outputs.tf
│   │   │   ├── variables.tf
│   │   ├── s3/
│   │   │   ├── main.tf
│   │   │   ├── outputs.tf
│   │   │   ├── variables.tf
│   │   ├── main.tf
│   │   ├── outputs.tf
│   │   ├── variables.tf
│   │   ├── versions.tf
│   ├── DEPLOYMENT_CHECKLIST.md
│   ├── IMPLEMENTATION_SUMMARY.md
│   ├── README.md
├── k8s/
│   ├── production/
│   │   ├── api-deployment-blue.yaml
│   │   ├── api-deployment-green.yaml
│   ├── staging/
│   │   ├── api-deployment.yaml
│   ├── datadog-values.yaml
├── logs/
│   ├── hipaa-compliance.log
├── monitoring/
│   ├── datadog/
│   ├── health-checks/
│   ├── sentry/
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── schemas/
│   │   │   ├── index.d.ts
│   │   │   ├── index.d.ts.map
│   │   │   ├── index.js
│   │   │   ├── index.js.map
│   │   │   ├── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
├── reports/
│   ├── baa_executive_summary_20260123_000233.md
│   ├── baa_executive_summary_20260123_000239.md
│   ├── baa_executive_summary_20260123_000253.md
│   ├── baa_executive_summary_20260123_000325.md
│   ├── baa_executive_summary_20260123_000703.md
├── ... (3 more directories)
├── CHANGELOG.md
├── COMPLIANCE_COMPLETION_SUMMARY.md
├── CORS_SECURITY_FIX_SUMMARY.md
├── DATABASE_PERFORMANCE_IMPLEMENTATION.md
├── docker-compose.test.yml
├── DOCUMENTATION_AUDIT_SUMMARY.md
├── DOCUMENTATION_QUALITY_AUDIT.md
├── DOCUMENTATION_REMEDIATION_ROADMAP.md
├── doppler.yaml
├── DOPPLER_IMPLEMENTATION_SUMMARY.md
└── ... (42 more files)
```

## Project-Specific Notes

*Add project-specific context below this line.*

---

## Last Sync

**Timestamp**: 2026-03-30 15:00:14 UTC
**Synced By**: Council Project Protocol
