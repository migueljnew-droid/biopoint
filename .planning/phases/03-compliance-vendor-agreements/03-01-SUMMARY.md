---
phase: 03-compliance-vendor-agreements
plan: 01
subsystem: compliance
tags: [hipaa, baa, fly-io, neon, cloudflare, openai]

requires:
  - phase: 01-phi-security-fixes
    provides: PHI encryption, Gemini feature flag, audit logging
provides:
  - Updated vendor-baa-tracker.md with Fly.io decision and pre-launch BAA checklist
  - Decision record: Render replaced by Fly.io, BAAs deferred to pre-launch
affects: [04-infrastructure-deployment, 06-app-store-submission]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - docs/vendor-baa-tracker.md

key-decisions:
  - "Render replaced by Fly.io — $250/mo HIPAA workspace too expensive, Fly.io Launch plan ~$30/mo with BAA"
  - "All BAAs deferred to pre-launch — no real PHI in system yet, execute immediately before production deployment"
  - "OpenAI BAA also deferred — food photos are low-risk, assertNoPhi guard protects text prompts"

patterns-established:
  - "Pre-launch compliance checklist pattern: defer vendor agreements until deployment-ready, track in vendor-baa-tracker.md"

requirements-completed: [COMP-01, COMP-02, COMP-03]

duration: 3min
completed: 2026-02-19
---

# Plan 03-01: BAA Execution Summary

**Vendor BAA tracker updated with Fly.io decision (replacing Render) and pre-launch checklist for Neon, Cloudflare/S3, Fly.io, and OpenAI BAAs**

## Performance

- **Duration:** 3 min
- **Tasks:** 2 (Task 1 checkpoint resolved by deferral, Task 2 tracker update)
- **Files modified:** 1

## Accomplishments
- Replaced Render ($250/mo HIPAA workspace) with Fly.io (~$30/mo Launch plan with BAA)
- Updated vendor-baa-tracker.md with current status, decisions, and pre-launch checklist
- Documented all application-level PHI protections already in place (encryption, de-identification, audit logging, feature flags)

## Task Commits

1. **Task 1: BAA execution** — Checkpoint resolved: BAAs deferred to pre-launch per Chairman directive
2. **Task 2: Update BAA tracker** — See commit below

## Files Created/Modified
- `docs/vendor-baa-tracker.md` — Complete rewrite: removed outdated panic tone, added Fly.io, added pre-launch checklist, documented existing protections

## Decisions Made
- **Render → Fly.io**: Render HIPAA workspace at $250/month minimum + 20% surcharge is not affordable. Fly.io Launch plan provides BAA at ~$30/month.
- **BAAs deferred**: No real PHI is in the system yet. All vendor BAAs will be executed immediately before production deployment with real user data. Application-level protections (encryption, de-identification, feature flags) are already in place.

## Deviations from Plan

Plan specified executing BAAs now. Chairman directed deferral to pre-launch with Fly.io replacing Render. Tracker updated to reflect new timeline and vendor choice.

## Issues Encountered
None — straightforward documentation update.

## User Setup Required

**Before production launch**, execute the pre-launch BAA checklist in `docs/vendor-baa-tracker.md`:
- Neon: HIPAA enable in Console (requires Scale plan)
- Cloudflare R2: Confirm BAA scope or migrate to AWS S3
- Fly.io: Sign BAA in Launch plan dashboard
- OpenAI: Email baa@openai.com

## Next Phase Readiness
- Phase 4 (Infrastructure) can proceed — Fly.io deployment replaces Render
- BAA signing is a pre-launch gate, not a development gate

---
*Phase: 03-compliance-vendor-agreements*
*Completed: 2026-02-19*
