---
id: "FF-[NNN]"
name: "[Metric Name]"
category: quality # quality | performance | security | reliability | maintainability
metric: "[e.g., test_coverage_percent, build_time_seconds, lint_error_count]"
direction: higher_is_better # higher_is_better | lower_is_better
threshold: "[e.g., 80, 60, 0]"
script: "[e.g., ./scripts/check-coverage.sh]"
---

# Fitness Function: [Metric Name]

## Purpose

[Why does this metric matter? What quality does it protect? One or two sentences.]

## Measurement Method

**What is measured:** [Exact definition — no ambiguity]
**How it is measured:** [Tool, command, or script that produces the number]
**When it runs:** [On every commit, PR, nightly, manually]

```bash
# Example command to measure
[command that outputs the metric value]
```

**Output format:** [What the script returns — e.g., a single integer, a JSON object, exit code]

## Threshold Rationale

| Value | Meaning |
|-------|---------|
| Current | [What the metric is today] |
| Threshold | [Minimum acceptable value] |
| Stretch | [Aspirational target] |

[Why this threshold and not higher/lower? Reference industry standards, team agreement, or past incidents.]

## Ratchet Behavior

- **On improvement:** Threshold automatically tightens to new best value (minus [buffer, e.g., 2%])
- **On regression:** Build/audit fails. Deviation log required to proceed.
- **Override:** Requires explicit deviation approval with justification.

## Implementation

- **Script path:** `[./scripts/fitness/FF-NNN.sh]`
- **Command:** `[e.g., cargo test --coverage | extract-percent]`
- **Exit code:** `0` = pass, `1` = fail
- **CI integration:** [Where this runs in the pipeline — e.g., GitHub Actions step name]
