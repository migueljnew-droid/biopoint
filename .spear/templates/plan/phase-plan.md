---
phase_id: "PHASE-[NNN]"
title: "[Phase title]"
epic_shard: "SHARD-[NNN]"
status: planned # planned | in-progress | blocked | complete | aborted
estimated_tasks: 0
---

# Phase Plan: [Phase Title]

## Goal

[One sentence: what is true when this phase is done?]

## Prerequisites

- [ ] [Dependency or precondition that must be met before starting]
- [ ] [Dependency or precondition]
- [ ] [Prior phase completed: PHASE-XXX]

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | [Concrete action verb + deliverable] | [ ] | |
| 2 | [Concrete action verb + deliverable] | [ ] | |
| 3 | [Concrete action verb + deliverable] | [ ] | |
| 4 | [Concrete action verb + deliverable] | [ ] | |
| 5 | [Run fitness functions and verify pass] | [ ] | |

## Success Criteria

- [ ] [Measurable outcome that proves the phase goal is met]
- [ ] [Measurable outcome]
- [ ] [All applicable fitness functions pass]

## Fitness Functions

| Function ID | Name | Pre-Phase Value | Target | Script |
|------------|------|-----------------|--------|--------|
| [FF-001] | [e.g., Test Coverage] | [78%] | [>= 80%] | `[./scripts/check-coverage.sh]` |
| [FF-002] | [e.g., Lint Clean] | [0 errors] | [0 errors] | `[cargo clippy]` |

## Risk & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [What could go wrong] | low/med/high | low/med/high | [How to prevent or handle it] |
| [What could go wrong] | low/med/high | low/med/high | [How to prevent or handle it] |

## Rollback Strategy

**If this phase fails or is aborted:**

1. [How to revert changes safely]
2. [What state the system returns to]
3. [Any data migrations to undo]
4. [Who to notify]

> If no rollback is possible, state why and what the forward-fix strategy is.
