---
rule_id: "RULE-[NNN]"
source_finding: "F-[NNN]"
category: "[security | quality | performance | reliability | maintainability]"
severity: medium # critical | high | medium | low
proposed_by: "[Name]"
---

# Rule Proposal: RULE-[NNN]

## Rule Statement

[One clear sentence that can be evaluated as true/false. Write it like a linter rule description.]

> Example: "All public API endpoints must validate authentication tokens before processing requests."

## Rationale

[Why should this be a permanent rule? Reference the finding that triggered it.]

- **Finding:** F-[NNN] — [brief description of what went wrong]
- **Recurrence risk:** [How likely is this to happen again without a rule?]
- **Cost of violation:** [What is the impact when this rule is broken?]

## Detection Method

[How will violations of this rule be detected?]

- **Automated:** [Tool, script, or command that checks this — preferred]
- **Manual:** [Checklist item or review step — fallback if automation is not feasible]
- **Regex/Pattern:** [If applicable, the pattern to search for violations]

```bash
# Example detection command
[command that returns 0 if rule passes, 1 if violated]
```

## Enforcement

**Method:** [hook | fitness-function | manual-review | ci-gate]

- **If hook:** [Which hook — pre-commit, pre-push, post-merge]
- **If fitness function:** [FF-NNN or new function to create]
- **If manual:** [When in the workflow is it checked]
- **If CI gate:** [Which pipeline step]

**Blocking:** [yes/no — does violation block merge?]

## Exceptions

[Are there legitimate cases where this rule should not apply?]

- [Exception scenario and how to mark it — e.g., `// spear:allow RULE-NNN: reason`]
- [Exception scenario]

> If no exceptions: "No exceptions. This rule applies universally."

## Vote

**Status:** [proposed | approved | rejected]

| Voter | Decision | Reason | Date |
|-------|----------|--------|------|
| [Name] | approve/reject | [brief reason] | YYYY-MM-DD |
