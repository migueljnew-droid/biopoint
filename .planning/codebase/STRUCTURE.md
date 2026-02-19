# Codebase Structure

**Analysis Date:** 2026-02-19

## Directory Layout

```
biopoint/                          # Turborepo monorepo root
├── apps/
│   ├── api/                       # Fastify REST API (@biopoint/api)
│   │   └── src/
│   │       ├── index.ts           # Server entry point
│   │       ├── app.ts             # Fastify app factory, plugin/route registration
│   │       ├── config/            # Environment-specific configuration
│   │       ├── middleware/        # Auth, encryption, audit, rate-limit, sanitization
│   │       ├── routes/            # Domain route handlers (one file per domain)
│   │       │   └── user/          # User self-service routes (data export, account deletion)
│   │       ├── services/          # Business logic, external API clients
│   │       ├── utils/             # Pure utility functions (encryption, auth, logger, s3)
│   │       ├── docs/              # OpenAPI / Swagger docs
│   │       └── scripts/           # One-off admin scripts
│   └── mobile/                    # Expo React Native app (@biopoint/mobile)
│       ├── app/                   # Expo Router file-system routing
│       │   ├── _layout.tsx        # Root layout, auth check on mount
│       │   ├── index.tsx          # Welcome/landing screen
│       │   ├── login.tsx          # Login screen
│       │   ├── register.tsx       # Registration screen
│       │   ├── onboarding.tsx     # First-run onboarding
│       │   ├── oracle.tsx         # AI health oracle screen
│       │   ├── premium.tsx        # Subscription upgrade screen
│       │   ├── settings.tsx       # Account settings
│       │   ├── settings/          # Settings sub-screens
│       │   └── (tabs)/            # Tab navigator group
│       │       ├── _layout.tsx    # Tab bar configuration
│       │       ├── index.tsx      # Dashboard tab
│       │       ├── stacks.tsx     # Stacks (supplements) tab
│       │       ├── nutrition.tsx  # Nutrition tracking tab
│       │       ├── progress.tsx   # Progress photos tab
│       │       ├── labs.tsx       # Lab results tab
│       │       └── community.tsx  # Community tab
│       ├── src/
│       │   ├── components/        # Reusable React Native components
│       │   │   ├── ui/            # Generic UI primitives
│       │   │   ├── nutrition/     # Nutrition-domain components
│       │   │   └── index.ts       # Barrel export
│       │   ├── store/             # Zustand state stores (one per domain)
│       │   ├── services/          # API client, native integrations
│       │   ├── theme/             # Design tokens, colors, typography
│       │   └── constants/         # App-level constants
│       └── assets/                # Images, fonts
├── packages/
│   └── shared/                    # Shared Zod schemas + TypeScript types (@biopoint/shared)
│       └── src/
│           ├── schemas/           # One schema file per domain
│           └── index.ts           # Barrel re-export
├── db/                            # Prisma database package (@biopoint/db)
│   ├── src/
│   │   └── index.ts               # PrismaClient singleton export
│   └── prisma/
│       ├── schema.prisma          # Single source of truth for DB schema
│       └── migrations/            # Versioned migration files
├── infrastructure/                # IaC and deployment config
│   ├── terraform/                 # Terraform modules (cloudflare, datadog, doppler, neon, s3)
│   ├── k8s/                       # Kubernetes manifests (HPA, pgbouncer)
│   ├── environments/              # Environment-specific config files
│   └── scripts/                   # Deployment/maintenance scripts
├── k8s/                           # K8s app manifests
│   ├── production/                # Blue/green deployment YAMLs
│   └── staging/
├── tests/
│   └── load/                      # k6 load testing scripts
├── monitoring/                    # Observability config (Datadog, Sentry, health checks)
├── docs/
│   ├── adr/                       # Architecture Decision Records
│   ├── compliance-evidence/       # HIPAA/GDPR evidence artifacts
│   ├── security/                  # Security documentation
│   └── runbooks/                  # Operational runbooks
├── scripts/                       # Root-level utility scripts
│   └── doppler/                   # Doppler secret migration scripts
├── .kiro/                         # Kiro spec-driven development
│   └── specs/                     # requirements.md, design.md, tasks.md
├── package.json                   # Workspace root (npm workspaces + Turborepo)
└── turbo.json                     # Turborepo pipeline config
```

## Directory Purposes

**`apps/api/src/routes/`:**
- Purpose: One file per domain feature area; each exports a single `async function domainRoutes(app: FastifyInstance)` registered via `app.register()`
- Contains: `auth.ts`, `profile.ts`, `dashboard.ts`, `logs.ts`, `stacks.ts`, `labs.ts`, `photos.ts`, `nutrition.ts`, `fasting.ts`, `community.ts`, `reminders.ts`, `compliance.ts`, `research.ts`, `health.ts`, `admin.ts`, `admin-s3.ts`
- Sub-dir `user/`: GDPR self-service — `data-export.ts`, `account-deletion.ts`

**`apps/api/src/middleware/`:**
- Purpose: Fastify hooks and preHandlers that run before route logic
- Key files: `auth.ts` (JWT verify + user lookup), `auditLog.ts` (PHI access tracking), `encryption.ts` (Prisma field-level encryption), `rateLimit.ts` (account lockout + rate windows), `sanitization.ts` (XSS/injection scrubbing), `errorHandler.ts` (global error shape)

**`apps/api/src/services/`:**
- Purpose: Business logic requiring multi-entity coordination or external API calls
- Key files: `gdpr-compliance.ts` (Art.17/20 erasure+export), `breachNotification.ts` (HIPAA breach handling), `foodAnalysis.ts` (GPT-4o food photo AI), `notificationService.ts` (lockout alerts), `databasePerformance.ts` (pool metrics monitor)

**`apps/api/src/utils/`:**
- Purpose: Pure, stateless utility functions; no Fastify or Prisma imports
- Key files: `encryption.ts` (AES-256-GCM primitives), `auth.ts` (bcrypt hash, JWT generation, refresh token lifecycle), `logger.ts` (request-scoped Pino logger), `s3.ts` (presigned URL generation), `sanitization.ts`

**`apps/mobile/src/store/`:**
- Purpose: Zustand stores — one per domain — that encapsulate API calls and local UI state
- Pattern: Each store is created with `create<State>()(persist(...))` and exported as a named hook (e.g., `useAuthStore`)
- Files: `authStore.ts`, `dashboardStore.ts`, `nutritionStore.ts`, `fastingStore.ts`, `profileStore.ts`, `stacksStore.ts`, `chatStore.ts`, `settingsStore.ts`, `subscriptionStore.ts`, `secureStorage.ts`

**`apps/mobile/src/services/`:**
- Purpose: Mobile-side API and native integration adapters
- Key files: `api.ts` (axios instance, token management, auto-refresh interceptor), `healthService.ts` (Apple HealthKit bridge), `healthKitService.ts` (HealthKit singleton), `biometricService.ts` (expo-local-authentication), `auditService.ts` (client-side audit helpers), `socialAuth.ts` (Google/Apple OAuth), `labs.ts`, `community.ts`

**`apps/mobile/src/components/ui/`:**
- Purpose: Generic, reusable UI primitives with glassmorphism styling
- Key files: `GlassView.tsx`, `AnimatedButton.tsx`, `BiomarkerCard.tsx`, `ScreenWrapper.tsx`, `GlassAutocomplete.tsx`, `GlassDaySelector.tsx`, `GlassPicker.tsx`, `GradientText.tsx`, `ScoreChart.tsx`

**`apps/mobile/src/components/nutrition/`:**
- Purpose: Nutrition-domain components
- Key files: `AddMealModal.tsx`, `FoodAnalysisModal.tsx`, `FoodLogView.tsx`, `FastingTimer.tsx`, `FastingView.tsx`, `FastingZoneBanner.tsx`, `MacroBar.tsx`, `MealCard.tsx`, `CalorieGauge.tsx`, `ProtocolSelector.tsx`

**`packages/shared/src/schemas/`:**
- Purpose: Zod schemas used for API validation and TypeScript type extraction
- Files: `auth.ts`, `profile.ts`, `dashboard.ts`, `stacks.ts`, `labs.ts`, `photos.ts`, `community.ts`, `reminders.ts`, `nutrition.ts`
- All re-exported from `packages/shared/src/schemas/index.ts` then from `packages/shared/src/index.ts`

**`db/prisma/schema.prisma`:**
- Purpose: Authoritative data model — all models, enums, relations, and indexes defined here
- Key models: `User`, `Profile`, `Stack`/`StackItem`, `LabReport`/`LabMarker`, `ProgressPhoto`, `DailyLog`, `BioPointScore`, `FastingProtocol`/`FastingSession`, `FoodLog`/`MealEntry`, `Group`/`GroupMember`/`Post`, `AuditLog`, `DisclosureLog`, `BreachIncident`, `ComplianceAudit`, `ConsentRecord`, `DeletionRequest`, `AccountLockout`, `RefreshToken`

## Key File Locations

**Entry Points:**
- `apps/api/src/index.ts`: API server startup, port binding, graceful shutdown
- `apps/api/src/app.ts`: Fastify factory `createServer()`, all plugin and route registration
- `apps/mobile/app/_layout.tsx`: Mobile root layout, `checkAuth()` on mount
- `apps/mobile/app/(tabs)/_layout.tsx`: Tab navigator with 6 tabs

**Configuration:**
- `package.json` (root): Workspace definitions, Turborepo task scripts, Doppler-prefixed dev commands
- `apps/api/src/config/database.ts`: Pool sizes per environment (dev: 5, staging: 10, prod: 20)
- `db/prisma/schema.prisma`: Full data model
- `db/src/index.ts`: PrismaClient singleton with pool monitoring

**Core Logic:**
- `apps/api/src/middleware/encryption.ts`: Prisma `$use()` hooks for PHI field encryption/decryption
- `apps/api/src/middleware/auth.ts`: JWT verification middleware + admin guard
- `apps/api/src/middleware/auditLog.ts`: `createAuditLog()` function called in every PHI-accessing route
- `apps/api/src/utils/encryption.ts`: AES-256-GCM primitives (`encrypt`, `decrypt`, `encryptToString`, `decryptFromString`, `isEncryptedString`)
- `apps/api/src/utils/auth.ts`: `hashPassword`, `verifyPassword`, `generateAccessToken`, `createRefreshToken`, `rotateRefreshToken`
- `apps/api/src/services/gdpr-compliance.ts`: GDPR Art.17/20 implementation
- `apps/mobile/src/services/api.ts`: Axios client with token management and 401 refresh interceptor

**Testing:**
- `apps/api/src/__tests__/`: Vitest test suites organized by category
  - `unit/`: Unit tests for utilities and services
  - `integration/`: Integration tests for full route flows
  - `security/`: Security-focused tests (encryption, auth hardening)
  - `compliance/`: HIPAA/GDPR compliance tests
  - `middleware/`: Middleware unit tests
  - `mocks/`: Shared test fixtures and mocks
  - `utils/`: Test helper utilities
- `apps/mobile/src/__tests__/`: Mobile unit tests

## Naming Conventions

**Files:**
- Route handlers: camelCase, domain noun + `Routes` suffix — `authRoutes`, `nutritionRoutes`, `labsRoutes`
- Middleware: camelCase noun — `auth.ts`, `auditLog.ts`, `errorHandler.ts`
- Services: camelCase noun or noun phrase — `foodAnalysis.ts`, `gdpr-compliance.ts`, `breachNotification.ts`
- Stores: camelCase domain + `Store` — `authStore.ts`, `fastingStore.ts`
- Components: PascalCase — `GlassView.tsx`, `FoodAnalysisModal.tsx`
- Schemas: PascalCase domain + `Schema` suffix — `RegisterSchema`, `CreateMealEntrySchema`
- Migration directories: `YYYYMMDDHHMMSS_description` — `20240101000000_init`

**Directories:**
- All lowercase, domain-named: `routes/`, `middleware/`, `services/`, `utils/`, `store/`, `components/`
- Expo Router groups use parentheses: `(tabs)/`
- Test subdirectories match purpose: `unit/`, `integration/`, `compliance/`, `security/`

## Where to Add New Code

**New API Domain (e.g., a new feature area):**
- Route handler: `apps/api/src/routes/newdomain.ts` — export `async function newdomainRoutes(app: FastifyInstance)`
- Register in: `apps/api/src/app.ts` → `registerRoutesForPrefix()`, add `app.register(newdomainRoutes, { prefix: withPrefix('/newdomain') })`
- Schema: `packages/shared/src/schemas/newdomain.ts` + re-export from `packages/shared/src/schemas/index.ts`
- Prisma model: add to `db/prisma/schema.prisma`, then run `npm run db:migrate`

**New PHI Field:**
- Add `fieldname_encrypted String?` alongside `fieldname` in `db/prisma/schema.prisma`
- Add model + field to `ENCRYPTED_FIELDS` map in `apps/api/src/middleware/encryption.ts`
- Add to `CLEAR_PLAINTEXT_FIELDS` if the field is optional and should null plaintext after encryption
- Add audit log calls in any route that reads/writes this field

**New Mobile Screen:**
- File-based: add `apps/mobile/app/screenname.tsx` for a standalone screen, or `apps/mobile/app/(tabs)/screenname.tsx` for a tab
- Register tab in `apps/mobile/app/(tabs)/_layout.tsx` with `<Tabs.Screen>`

**New Mobile Store:**
- Create `apps/mobile/src/store/newdomainStore.ts` following the `create<State>()(persist(...))` pattern
- Export named hook: `export const useNewdomainStore = create<...>()(...)`

**New UI Component:**
- Generic primitive: `apps/mobile/src/components/ui/ComponentName.tsx` + export from `apps/mobile/src/components/ui/index.ts`
- Domain-specific: `apps/mobile/src/components/domain/ComponentName.tsx`

**Utilities:**
- Pure functions with no Fastify/Prisma dependencies: `apps/api/src/utils/`
- Stateless helpers usable across packages: `packages/shared/src/`

## Special Directories

**`db/prisma/migrations/`:**
- Purpose: Versioned SQL migration files generated by `prisma migrate dev`
- Generated: Yes (by Prisma CLI)
- Committed: Yes — migrations are committed and applied in CI/CD

**`infrastructure/terraform/`:**
- Purpose: Infrastructure as Code for Cloudflare, Datadog, Doppler, Neon (PostgreSQL), S3
- Generated: No
- Committed: Yes

**`k8s/production/`:**
- Purpose: Kubernetes deployment manifests including blue/green deployments (`api-deployment-blue.yaml`, `api-deployment-green.yaml`) and HPA
- Generated: No
- Committed: Yes

**`tests/load/`:**
- Purpose: k6 load testing scripts (baseline, stress, spike, endurance, database)
- Generated: No
- Committed: Yes

**`monitoring/`:**
- Purpose: Datadog dashboards, Sentry config, health check definitions
- Generated: No
- Committed: Yes

**`docs/adr/`:**
- Purpose: Architecture Decision Records documenting key technical choices
- Generated: No
- Committed: Yes

**`docs/compliance-evidence/`:**
- Purpose: HIPAA/GDPR compliance artifacts and audit evidence
- Generated: Partially (some auto-generated reports)
- Committed: Yes

**`apps/api/dist/`:**
- Purpose: TypeScript compiled output
- Generated: Yes (`npm run build`)
- Committed: No (gitignored)

**`packages/shared/dist/`:**
- Purpose: Compiled shared package output (`.js` + `.d.ts` + `.map` files)
- Generated: Yes (`npm run build:shared`)
- Committed: No (gitignored; but source `.js` built files visible in repo — pre-built for workspace consumption)

---

*Structure analysis: 2026-02-19*
