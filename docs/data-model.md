# Data Model

## Entity Relationship Diagram

```
┌─────────────────┐
│      User       │
├─────────────────┤
│ id              │
│ email           │
│ passwordHash    │
│ role            │
└────────┬────────┘
         │
    ┌────┴────┬────────────┬──────────────┬──────────────┐
    │         │            │              │              │
    ▼         ▼            ▼              ▼              ▼
┌─────────┐ ┌─────────┐ ┌───────────┐ ┌─────────────┐ ┌─────────┐
│ Profile │ │  Stack  │ │ LabReport │ │ProgressPhoto│ │DailyLog │
└─────────┘ └────┬────┘ └─────┬─────┘ └─────────────┘ └─────────┘
                 │            │
                 ▼            ▼
           ┌───────────┐ ┌───────────┐
           │ StackItem │ │ LabMarker │
           └─────┬─────┘ └───────────┘
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
┌────────────┐ ┌────────┐ ┌────────────────┐
│Compliance  │ │Reminder│ │ BioPointScore  │
│   Event    │ │Schedule│ │                │
└────────────┘ └────────┘ └────────────────┘
```

## Core Entities

### User

The central entity. All other entities belong to a user.

| Field | Type | Description |
|-------|------|-------------|
| id | cuid | Primary key |
| email | string | Unique, used for login |
| passwordHash | string | bcrypt hash |
| role | enum | USER or ADMIN |

### Profile

User's health profile and consent status.

| Field | Type | Description |
|-------|------|-------------|
| sex | string | male, female, other |
| dateOfBirth | datetime | Optional |
| heightCm | float | In centimeters |
| baselineWeightKg | float | Starting weight |
| goals | string[] | Array of goal keywords |
| dietStyle | string | e.g., "keto", "paleo" |
| consentNotMedical | boolean | Required acknowledgment |
| consentDataStorage | boolean | Required for app use |
| consentResearch | boolean | Optional opt-in |
| onboardingComplete | boolean | Flags completion |

### Stack & StackItem

Supplement/peptide protocols.

**Stack**: A named collection of items (e.g., "Morning Stack")

**StackItem**: Individual supplement or peptide with dosing details

- name, dose, unit, route, frequency, timing
- cycleJson: { daysOn, daysOff } for cycling protocols

### LabReport & LabMarker

Lab test results.

**LabReport**: Uploaded document metadata

**LabMarker**: Individual biomarker values with reference ranges

- Markers can exist without a report (manual entry)
- isInRange computed by comparing value to ref range

### ProgressPhoto

Before/after photos with alignment.

- originalS3Key: Raw upload
- alignedS3Key: Processed/aligned version
- alignmentStatus: pending → processing → done

### DailyLog

Daily wellness metrics.

| Field | Range | Description |
|-------|-------|-------------|
| sleepHours | 0-24 | Hours slept |
| sleepQuality | 1-10 | Subjective quality |
| energyLevel | 1-10 | Energy throughout day |
| focusLevel | 1-10 | Concentration ability |
| moodLevel | 1-10 | Overall mood |
| weightKg | float | Daily weight |

### BioPointScore

Computed wellness score (0-100).

Breakdown:

- Sleep: 0-20 points (hours + quality)
- Energy: 0-20 points
- Focus: 0-20 points
- Mood: 0-20 points
- Weight: 0-20 points (vs goal)

## Community Entities

### Group & GroupMember

User-created communities.

### Post

Simple text posts within groups.

### StackTemplate

Shareable stack configurations that can be "forked" into user stacks.

## Audit & Compliance

### AuditLog

Tracks access to sensitive data (labs, photos).

| Field | Description |
|-------|-------------|
| action | CREATE, READ, UPDATE, DELETE |
| entityType | LabReport, LabMarker, ProgressPhoto |
| entityId | ID of accessed entity |
| metadata | Redacted details |
| ipAddress | Client IP |
