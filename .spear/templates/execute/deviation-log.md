---
deviation_id: "DEV-[NNN]"
phase_id: "PHASE-[NNN]"
severity: minor # minor | moderate | major
date: "YYYY-MM-DD"
---

# Deviation Log: DEV-[NNN]

## Original Plan

[What was supposed to happen according to the phase plan? Reference the specific task number.]

**Task reference:** PHASE-[NNN], Task #[N]
**Expected approach:** [Brief description of the planned approach]

## Actual Change

[What actually happened instead? Be specific about how the implementation diverged.]

**What changed:** [Concrete description]
**Files affected:** [List of files that differ from the plan]

## Reason

[Why did the deviation occur? Categories:]
- [ ] Technical discovery (the plan assumed something incorrect)
- [ ] Dependency change (an external factor shifted)
- [ ] Scope clarification (requirements were ambiguous)
- [ ] Better approach found (improvement over original plan)
- [ ] Blocker workaround (something was blocked, found alternate path)

[Detailed explanation:]

## Impact Assessment

**Scope impact:** [none / expanded / reduced / shifted]
**Timeline impact:** [none / delayed by X / accelerated by X]
**Quality impact:** [none / improved / degraded — explain]
**Fitness functions affected:** [list any, or "none"]
**Other shards affected:** [list any, or "none"]

## Approval

**Approved by:** [Name or "self-approved (minor)"]
**Date:** [YYYY-MM-DD]
**Condition:** [Any conditions on the approval — e.g., "must add tests before merge"]

> Minor deviations can be self-approved. Moderate requires peer review. Major requires explicit sign-off.
