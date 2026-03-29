---
phase_id: "PHASE-[NNN]"
date: "YYYY-MM-DD"
overall_verdict: GO # GO | NO-GO
---

# Audit Summary: PHASE-[NNN]

**Phase:** [Phase Title]
**Shard:** SHARD-[NNN] — [Shard Title]
**Audit date:** YYYY-MM-DD

## Category Verdicts

| Category | Auditor | Findings | Critical | High | Verdict |
|----------|---------|----------|----------|------|---------|
| Security | [name] | [N] | [N] | [N] | PASS/FAIL/WARN |
| Dependencies | [name] | [N] | [N] | [N] | PASS/FAIL/WARN |
| Performance | [name] | [N] | [N] | [N] | PASS/FAIL/WARN |
| Code Quality | [name] | [N] | [N] | [N] | PASS/FAIL/WARN |
| Documentation | [name] | [N] | [N] | [N] | PASS/FAIL/WARN |
| Architecture | [name] | [N] | [N] | [N] | PASS/FAIL/WARN |

## Critical Findings

> Any finding with severity=critical automatically triggers NO-GO.

| ID | Category | Description | Status |
|----|----------|-------------|--------|
| [F-NNN] | [category] | [description] | [open/fixed] |

> If none: "No critical findings."

## High Findings Requiring Override

> High findings do not auto-block but require explicit acknowledgment to proceed.

| ID | Category | Description | Override Justification |
|----|----------|-------------|----------------------|
| [F-NNN] | [category] | [description] | [Why it is safe to proceed] |

> If none: "No high findings requiring override."

## Ratchet Impacts

| Metric | Before | After | Direction | Action |
|--------|--------|-------|-----------|--------|
| [e.g., Test Coverage] | [78%] | [82%] | improved | Ratchet tightened to 80% |
| [e.g., Build Time] | [42s] | [48s] | regressed | Investigate in next cycle |

## Final Verdict

**[GO / NO-GO]**

[One paragraph justification. For GO: confirm all critical resolved, ratchets updated. For NO-GO: list what must be fixed.]

## Required Actions Before Merge

- [ ] [Action item — or "None required"]
- [ ] [Action item]
- [ ] [Update ratchet values in fitness functions]
- [ ] [Record new rules from findings]
