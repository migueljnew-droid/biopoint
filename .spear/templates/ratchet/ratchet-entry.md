---
entry_id: "RATCHET-[NNN]"
date: "YYYY-MM-DD"
metric: "[FF-NNN — metric name]"
old_value: "[previous threshold]"
new_value: "[new threshold]"
direction: tightened # tightened | loosened | unchanged
---

# Ratchet Entry: RATCHET-[NNN]

## Trigger

[What caused this ratchet change? Reference the specific event.]

- **Event type:** [audit-pass / manual-tighten / approved-loosen / initial-baseline]
- **Source:** [e.g., "Audit of PHASE-003 measured coverage at 85%, previous threshold was 80%"]
- **Fitness function:** [FF-NNN — Name]

## Justification

[Why is this the right new value?]

**For tightening:** [The metric improved and the new floor prevents regression. Buffer of X% applied.]
**For loosening:** [Why the previous threshold was too aggressive. What evidence supports relaxing it. Who approved.]
**For unchanged:** [Why this entry was created — e.g., reviewed and confirmed current value is correct.]

## Impact on CI

**Before:** `[metric] >= [old_value]` --> [pass/fail behavior]
**After:** `[metric] >= [new_value]` --> [pass/fail behavior]

**Config updated:** [e.g., `.spear/ratchet.yaml`, CI pipeline, fitness function script]
**Verified:** [yes/no — did CI run with new threshold?]
