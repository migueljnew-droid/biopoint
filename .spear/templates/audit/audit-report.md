---
category: "[e.g., security, quality, performance, reliability, maintainability]"
auditor: "[Name or 'automated']"
date: "YYYY-MM-DD"
phase_id: "PHASE-[NNN]"
verdict: PASS # PASS | FAIL | WARN
---

# Audit Report: [Category]

**Phase:** PHASE-[NNN] — [Phase Title]
**Shard:** SHARD-[NNN] — [Shard Title]

## Scope

[What was audited? Which files, modules, endpoints, or behaviors were reviewed?]

- [File/module/area reviewed]
- [File/module/area reviewed]
- [File/module/area reviewed]

**Out of scope:** [Anything explicitly not reviewed this cycle]

## Methodology

[How was the audit performed?]

- [ ] Automated scan ([tool name, version])
- [ ] Manual code review
- [ ] Fitness function evaluation
- [ ] Penetration test / fuzz test
- [ ] Checklist walkthrough
- [ ] Other: [describe]

## Findings

| ID | Severity | Description | Location | Recommendation |
|----|----------|-------------|----------|----------------|
| F-001 | critical | [Brief description] | `[file:line]` | [What to do] |
| F-002 | high | [Brief description] | `[file:line]` | [What to do] |
| F-003 | medium | [Brief description] | `[file:line]` | [What to do] |
| F-004 | low | [Brief description] | `[file:line]` | [What to do] |
| F-005 | info | [Brief description] | `[file:line]` | [What to do] |

> For detailed findings, create individual finding files using the finding template.

## Summary Statistics

| Severity | Count |
|----------|-------|
| Critical | [N] |
| High | [N] |
| Medium | [N] |
| Low | [N] |
| Info | [N] |
| **Total** | **[N]** |

## Verdict with Justification

**Verdict: [PASS / FAIL / WARN]**

[Explain why. A PASS with warnings should note what to watch. A FAIL must list the blocking findings. A WARN means no blockers but action is needed soon.]

**Blocking findings:** [List IDs, or "None"]
**Required before merge:** [Actions, or "None — clear to proceed"]
