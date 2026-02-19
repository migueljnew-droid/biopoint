# Architecture

**Analysis Date:** 2026-02-19

## Pattern Overview

**Overall:** Turborepo monorepo with a PHI-aware layered architecture

**Key Characteristics:**
- Three-tier separation: mobile client → REST API → PostgreSQL via Prisma
- Shared schema package (`@biopoint/shared`) enforces contract between mobile and API using Zod
- Field-level AES-256-GCM encryption applied transparently at the Prisma middleware layer for PHI fields
- HIPAA/GDPR compliance embedded into the data model (audit logs, disclosure logs, breach incidents, consent records, deletion requests)
- Fastify plugin system used for route grouping; all routes are registered under both `/` and `/api` prefixes

## Layers

**Mobile (Presentation):**
- Purpose: User interface, local state management, native device integrations
- Location: `apps/mobile/`
- Contains: Expo Router screens, Zustand stores, service clients, theme, reusable UI components
- Depends on: `@biopoint/shared` types (not schemas — Zod runs server-side only)
- Used by: End users on iOS

**API (Application/Routing):**
- Purpose: HTTP request handling, authentication, input validation, response shaping
- Location: `apps/api/src/routes/`
- Contains: Fastify route handlers grouped by domain (auth, profile, labs, stacks, nutrition, fasting, photos, community, compliance, admin)
- Depends on: Middleware layer, `@biopoint/db`, `@biopoint/shared` schemas
- Used by: Mobile app via REST

**Middleware (Cross-Cutting):**
- Purpose: Auth verification, rate limiting, input sanitization, audit logging, encryption, error handling
- Location: `apps/api/src/middleware/`
- Contains: `auth.ts`, `auditLog.ts`, `automaticLogoff.ts`, `encryption.ts`, `errorHandler.ts`, `rateLimit.ts`, `requestId.ts`, `sanitization.ts`, `s3Security.ts`
- Depends on: `@biopoint/db`, `apps/api/src/utils/`
- Used by: All route handlers via Fastify hooks and `preHandler` declarations

**Services (Business Logic):**
- Purpose: Complex operations that span multiple entities or external integrations
- Location: `apps/api/src/services/`
- Contains: `gdpr-compliance.ts`, `breachNotification.ts`, `foodAnalysis.ts`, `notificationService.ts`, `databasePerformance.ts`, `analysis.ts`
- Depends on: `@biopoint/db`, external APIs (OpenAI, AWS S3)
- Used by: Route handlers

**Shared Contract:**
- Purpose: Zod validation schemas and TypeScript types shared across the monorepo
- Location: `packages/shared/src/schemas/`
- Contains: Domain schemas for auth, profile, dashboard, stacks, labs, photos, community, reminders, nutrition
- Depends on: Zod only
- Used by: `apps/api` (runtime validation), `apps/mobile` (TypeScript types)

**Database Layer:**
- Purpose: Prisma client singleton with connection pooling and encryption middleware wiring
- Location: `db/src/index.ts`, `db/prisma/schema.prisma`
- Contains: PrismaClient export, pool monitoring, connection config per environment
- Depends on: PostgreSQL (Neon in production), `apps/api/src/config/database.ts`
- Used by: All API routes and services via `import { prisma } from '@biopoint/db'`

## Data Flow

**Standard Authenticated Request:**

1. Mobile Zustand store calls `api.get/post(...)` via axios (configured in `apps/mobile/src/services/api.ts`)
2. Axios request interceptor attaches Bearer token from `expo-secure-store`
3. Fastify receives request; `requestIdMiddleware` and `sanitizationMiddleware` fire as global `onRequest`/`preHandler` hooks
4. Route's `preHandler: authMiddleware` verifies JWT, looks up user in DB, attaches `userId`/`userEmail`/`userRole` to request
5. Route handler validates request body against `@biopoint/shared` Zod schema (`.parse()` throws on invalid input, caught by global error handler)
6. Handler calls `prisma.*` — Prisma middleware transparently encrypts PHI fields on write, decrypts on read
7. PHI access routes call `createAuditLog()` to persist action to `AuditLog` table
8. Response returned; response logging hook fires

**Token Refresh Flow:**

1. Axios response interceptor detects 401 on any request
2. If not already refreshing, calls `POST /auth/refresh` with stored refresh token
3. On success, stores new tokens in `expo-secure-store`, replays original request
4. Concurrent 401 responses are queued and resolved after single refresh completes

**PHI Encryption Flow:**

1. API writes PHI field (e.g., `Profile.dateOfBirth`) via any Prisma `create`/`update`/`upsert`
2. `setupEncryptionMiddleware` Prisma middleware intercepts; encrypts plaintext with AES-256-GCM (`ENCRYPTION_KEY` env var, must be 32 bytes base64)
3. Encrypted JSON `{encrypted, iv, tag, version, algorithm}` stored in `field_encrypted` column; plaintext column set to `null` for optional PHI fields
4. On read, middleware decrypts `field_encrypted` back to `field`; removes `_encrypted` key from result
5. Decryption failure returns `[DECRYPTION_FAILED]` sentinel instead of throwing, to prevent full read failure

**Food AI Analysis Flow:**

1. Mobile captures base64 photo, sends `POST /nutrition/analyze-photo`
2. `foodAnalysis.ts` service sends image to OpenAI GPT-4o with structured JSON prompt
3. Returns macros `{name, calories, proteinG, carbsG, fatG, fiberG, items[], confidence}`
4. Mobile renders result in `FoodAnalysisModal`; user confirms and meal entry is created

## Key Abstractions

**Prisma Encryption Middleware:**
- Purpose: Transparent field-level PHI encryption without manual call sites
- File: `apps/api/src/middleware/encryption.ts`
- Pattern: Prisma `$use()` hooks wrap all read/write operations; configured via `ENCRYPTED_FIELDS` map
- PHI models: `Profile.dateOfBirth`, `LabMarker.value`, `LabReport.notes`, `DailyLog.notes`, `StackItem.notes`, `ProgressPhoto.notes`

**Audit Log:**
- Purpose: HIPAA-required access tracking for all PHI entity reads/writes
- File: `apps/api/src/middleware/auditLog.ts`
- Pattern: `createAuditLog(request, { action, entityType, entityId, metadata })` called explicitly in route handlers after PHI access; metadata is auto-redacted via `redactSensitiveFields()`
- Entity types: `LabReport`, `LabMarker`, `ProgressPhoto`, `Profile`, `DailyLog`, `BioPointScore`, `FastingProtocol`, `FastingSession`, `MealEntry`, `FoodLog`

**Zustand Stores (Mobile State):**
- Purpose: Domain-scoped client-side state with persistence
- Files: `apps/mobile/src/store/` — `authStore.ts`, `dashboardStore.ts`, `nutritionStore.ts`, `fastingStore.ts`, `profileStore.ts`, `stacksStore.ts`, `chatStore.ts`, `settingsStore.ts`, `subscriptionStore.ts`
- Pattern: `create<State>()(persist(...))` with `expo-secure-store` as storage backend for auth; plain JSON storage for others

**Route Registration:**
- Purpose: Routes registered under both `` and `/api` prefix to support multiple consumers
- File: `apps/api/src/app.ts` — `registerRoutesForPrefix()` called twice with `['', '/api']`
- Pattern: Each domain exported as `async function domainRoutes(app: FastifyInstance)`, registered via `app.register(domainRoutes, { prefix })`

**Shared Zod Schemas:**
- Purpose: Single source of truth for request/response shape validation
- Location: `packages/shared/src/schemas/` — one file per domain, re-exported from `index.ts`
- Pattern: Named exports like `RegisterSchema`, `CreateMealEntrySchema`; corresponding `z.infer<>` types exported alongside

## Entry Points

**API Server:**
- Location: `apps/api/src/index.ts`
- Triggers: `npm run dev:api` (via `doppler run -- tsx watch src/index.ts`)
- Responsibilities: Creates Fastify server via `createServer()`, binds port, registers SIGTERM/SIGINT handlers, starts `dbPerformanceMonitor`

**Mobile App:**
- Location: `apps/mobile/app/_layout.tsx`
- Triggers: Expo Go / standalone build
- Responsibilities: Sets background color, calls `checkAuth()` from `authStore` on mount, wraps all screens in `GestureHandlerRootView` and expo-router `Stack`

**Auth Guard (Mobile):**
- Location: `apps/mobile/app/(tabs)/_layout.tsx` (implicitly gated) + `authStore.checkAuth()`
- Pattern: `checkAuth()` in root layout verifies token on app start; unauthenticated state navigates to `/index` (welcome) or `/login`

## Error Handling

**Strategy:** Centralized Fastify error handler with structured JSON responses; non-throwing audit log failures

**Patterns:**
- Global `errorHandler` registered via `app.setErrorHandler()` in `apps/api/src/middleware/errorHandler.ts`
- Zod parse errors thrown from route handlers are caught by error handler and returned as `400 Bad Request`
- Auth failures return `401` with `requestId` for tracing
- `createAuditLog()` wraps DB writes in try/catch and never throws — audit failure is logged but does not fail the request
- Encryption decryption failure returns sentinel `[DECRYPTION_FAILED]` rather than throwing, preventing read cascade failures
- Mobile: axios interceptor catches 401 and attempts token refresh; non-401 network errors preserve session (offline mode)

## Cross-Cutting Concerns

**Logging:** Pino (via Fastify built-in); `pino-pretty` in development. Request logger created per-request in `apps/api/src/utils/logger.ts` and attached to `request.log`. All sensitive fields redacted before logging via `sanitizeForLogging()`.

**Validation:** Zod schemas from `@biopoint/shared` called via `.parse()` at the start of each route handler. Input sanitization middleware (`sanitizationMiddleware`) fires globally as `preHandler` hook.

**Authentication:** JWT (jsonwebtoken) short-lived access tokens + database-backed refresh tokens with rotation. `authMiddleware` exported from `apps/api/src/middleware/auth.ts`; applied per-route via `preHandler` or globally per route group via `app.addHook('preHandler', authMiddleware)`. Admin routes additionally guarded by `adminMiddleware`.

**Rate Limiting:** Custom Prisma-backed rate limiting in `apps/api/src/middleware/rateLimit.ts`. Account lockout after 5 failed logins with 15-minute lockout, stored in `AccountLockout` table. Notifications sent on lockout via `notificationService`.

**Secrets Management:** Doppler — all `npm run dev:*` and `npm run build:*` scripts are prefixed with `doppler run --`. No `.env` files committed. `ENCRYPTION_KEY` is required at startup and validated for exact 32-byte length.

**GDPR/HIPAA Compliance:** `apps/api/src/services/gdpr-compliance.ts` implements GDPR Art. 17 (erasure), Art. 20 (portability), and consent management. `apps/api/src/routes/compliance.ts` implements HIPAA §164.528 (disclosure accounting) and §164.400 breach notification. Schema models: `AuditLog`, `DisclosureLog`, `BreachIncident`, `ComplianceAudit`, `ConsentRecord`, `DeletionRequest`.

---

*Architecture analysis: 2026-02-19*
