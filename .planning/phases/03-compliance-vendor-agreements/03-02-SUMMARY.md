---
phase: 03-compliance-vendor-agreements
plan: "02"
subsystem: api
tags: [hipaa, phi, deidentification, privacy-policy, safe-harbor, typescript, openai]

requires:
  - phase: 01-security-foundations
    provides: AES-256-GCM encryption at rest and TLS 1.3 in transit (accurate claims for privacy policy)
  - phase: 03-01
    provides: BAA vendor context for privacy policy third-party disclosures

provides:
  - "PHI de-identification utility (scrubPhiFromText, deidentifyUserForAI, assertNoPhi) covering 18 HIPAA Safe Harbor categories"
  - "Runtime PHI assertion guard on all food analysis OpenAI API calls"
  - "Accurate, properly formatted in-app privacy policy describing current data practices"

affects:
  - "Any future service that sends data to non-BAA AI providers must import assertNoPhi"
  - "Phase 5 (monitoring) — privacy policy URL may need external link per Phase 6 requirement"

tech-stack:
  added: []
  patterns:
    - "assertNoPhi() runtime guard pattern — import and call before any non-BAA AI transmission"
    - "PHI_PATTERNS constant — regex array iterating Safe Harbor categories with lastIndex reset for reuse"
    - "deidentifyUserForAI() — field-stripping pattern returning SafeUserContext with only birthYear/ageRange/biologicalSex"
    - "Ages >89 bucketed as '90+' per Safe Harbor requirement to prevent age-based re-identification"

key-files:
  created:
    - apps/api/src/utils/deidentify.ts
  modified:
    - apps/api/src/services/foodAnalysis.ts
    - apps/mobile/app/settings/privacy.tsx

key-decisions:
  - "assertNoPhi() applied as defense-in-depth guard on existing known-safe static prompt — prevents future regressions if user context is added to prompt"
  - "PHI_PATTERNS uses fresh lastIndex reset per iteration to handle global regex reuse in a loop"
  - "Privacy policy removes BioPoint Score de-identification claim (feature not implemented) — replaced with accurate AI-assisted features description"
  - "Ages >89 → null birthYear + '90+' ageRange — both values suppressed per 45 CFR 164.514(b)(2)(i) to prevent identifying elderly individuals"

patterns-established:
  - "HIPAA guard pattern: extract prompt to const → assertNoPhi(prompt, context) → openai.chat.completions.create()"
  - "PHI_PATTERNS regex loop: always reset lastIndex = 0 before pattern.test() or pattern.replace()"

requirements-completed: [COMP-04, COMP-05]

duration: 4min
completed: 2026-02-19
---

# Phase 3 Plan 02: PHI De-identification + Privacy Policy Summary

**HIPAA Safe Harbor de-identification utility (45 CFR 164.514(b)(2)(i)) covering all 18 identifier categories, runtime PHI guard on OpenAI food analysis calls, and accurate in-app privacy policy with BAA vendor disclosure**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T21:01:18Z
- **Completed:** 2026-02-19T21:05:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `deidentify.ts` with three exported functions (scrubPhiFromText, deidentifyUserForAI, assertNoPhi) and two exported types (SafeUserContext, DeidentifiedContext) covering all 18 HIPAA Safe Harbor identifier categories via regex patterns and field-stripping
- Wired `assertNoPhi()` runtime guard into `foodAnalysis.ts` as defense-in-depth before every OpenAI API call, with SEC-08 and COMP-04 references in JSDoc
- Rewrote `privacy.tsx` with proper React Native Text components (no raw markdown), accurate data practice descriptions, new BAA vendor section, new food analysis AI disclosure, updated effective date, and data deletion rights

## Task Commits

1. **Task 1: Create PHI de-identification utility and wire into food analysis** - `303182f` (feat)
2. **Task 2: Audit and update in-app privacy policy for accuracy** - `11ad90c` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `apps/api/src/utils/deidentify.ts` — PHI de-identification utility; 3 exported functions, 2 exported types, PHI_PATTERNS covering Safe Harbor categories B/C/D/E/F/G/H/I-K/N/O
- `apps/api/src/services/foodAnalysis.ts` — Added assertNoPhi runtime guard before OpenAI API call; extracted systemPrompt to const; preserved SEC-08 PHI Risk Assessment comment
- `apps/mobile/app/settings/privacy.tsx` — Rewrote with SectionHeader/BulletItem/BodyText helper components; 7 sections; no raw markdown; BAA disclosure; AI food analysis disclosure; deletion rights; effective date 2026-02-19

## Decisions Made

- assertNoPhi applied to static prompt as defense-in-depth: the current prompt is known PHI-free, but this guard prevents regression if a future developer adds user context
- PHI_PATTERNS iterates with `lastIndex = 0` reset per pass — global regex reuse in a loop requires explicit lastIndex management to avoid skipping matches
- Removed BioPoint Score de-identification claim from privacy policy — the feature was referenced but not implemented; replaced with accurate AI-assisted features language
- Ages >89: both birthYear and ageRange are bucketed per 45 CFR 164.514(b)(2)(i) — the Safe Harbor explicitly requires suppressing specific ages above 89

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The mobile TypeScript compile (`npx tsc --noEmit -p apps/mobile/tsconfig.json`) produces errors in pre-existing files (account-deletion.tsx, data-export.tsx, nutrition.tsx, and test files). None are in `privacy.tsx` — confirmed by grepping output for `privacy.tsx`. These are out-of-scope pre-existing issues per deviation scope rules and were not touched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- COMP-04 and COMP-05 complete: deidentify.ts utility ready for any future non-BAA AI service
- Any future service sending data to OpenAI (or other non-BAA provider) should import `assertNoPhi` from `../utils/deidentify.js`
- Privacy policy is live at `/settings/privacy` with accurate descriptions
- Phase 3 (2/2 plans complete) — ready to proceed to Phase 4

---
*Phase: 03-compliance-vendor-agreements*
*Completed: 2026-02-19*
