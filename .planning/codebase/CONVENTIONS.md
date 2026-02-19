# Coding Conventions

**Analysis Date:** 2026-02-19

## TypeScript Configuration

**Base Config:** `tsconfig.base.json`
- `target: ES2022`, `strict: true`
- `noUnusedLocals: true`, `noUnusedParameters: true`
- `noImplicitReturns: true`, `noFallthroughCasesInSwitch: true`
- `noUncheckedIndexedAccess: true`

**API override** (`apps/api/tsconfig.json`): Relaxes `noImplicitAny: false`, `noUnusedLocals: false` (base is strict but API opts out for flexibility in middleware)

**Mobile** (`apps/mobile/tsconfig.json`): Keeps `strict: true`, adds path alias `@/*` → `./src/*`

**No linter config found** (no `.eslintrc`, `biome.json`, or `.prettierrc` at project root or per-package). Code style is enforced through TypeScript compiler flags only.

---

## Naming Patterns

**Files:**
- API route files: kebab-case matching route path — `health.routes.ts`, `admin-s3.ts`, `account-deletion.ts`
- Middleware files: camelCase — `auditLog.ts`, `errorHandler.ts`, `rateLimit.ts`
- Utility files: camelCase — `auth.ts`, `encryption.ts`, `sanitization.ts`
- Mobile component files: PascalCase — `AnimatedButton.tsx`, `BiomarkerCard.tsx`, `GlassView.tsx`
- Mobile store files: camelCase with `Store` suffix — `authStore.ts`, `dashboardStore.ts`
- Mobile service files: camelCase — `api.ts`, `healthKitService.ts`
- Schema files: camelCase — `auth.ts`, `labs.ts`, `stacks.ts`

**Functions:**
- Route handlers: async arrow functions inside plugin functions (`app.get('/', async (request) => {...})`)
- Middleware: named `async function` with `Middleware` suffix — `authMiddleware`, `adminMiddleware`, `sanitizationMiddleware`
- Utility functions: named exports, camelCase verbs — `hashPassword`, `generateAccessToken`, `createAuditLog`
- React components: PascalCase named exports — `GlassView`, `BiomarkerCard`, `AnimatedButton`

**Variables:**
- Constants: SCREAMING_SNAKE_CASE for env-backed module-level constants — `JWT_SECRET`, `BCRYPT_ROUNDS`, `ACCESS_TOKEN_KEY`
- Regular variables: camelCase
- Zustand store state keys: camelCase — `isLoading`, `isAuthenticated`, `bioPointScore`

**Types/Interfaces:**
- Interfaces: PascalCase with descriptive noun — `JwtPayload`, `SanitizationConfig`, `AuditContext`, `TestUser`
- Type aliases: PascalCase — `AuditAction`, `PhiEntityType`
- Zod schemas: PascalCase with `Schema` suffix — `RegisterSchema`, `CreateLabReportSchema`, `PresignUploadSchema`
- Inferred Zod types: PascalCase with `Input` suffix — `RegisterInput`, `LoginInput`, `CreateLabReportInput`
- Response interfaces: PascalCase with `Response` suffix — `AuthResponse`, `UserResponse`, `LabReportResponse`

---

## Import Organization

**Order used consistently:**
1. External packages — `import Fastify from 'fastify'`
2. Internal workspace packages — `import { prisma } from '@biopoint/db'`
3. Shared package — `import { CreateLabReportSchema } from '@biopoint/shared'`
4. Local modules — `import { authMiddleware } from '../middleware/auth.js'`

**Module extensions:** All local imports use explicit `.js` extension in API (ESM `NodeNext` resolution).
**Type imports:** `import type { FastifyInstance }` used for type-only imports.
**Path aliases:** Mobile uses `@/*` for `src/*`; API uses relative paths with `.js` extension.

---

## Module Structure

**API Route Modules:**
```typescript
// Pattern: async plugin function registered with Fastify prefix
import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { SomeSchema } from '@biopoint/shared';
import { authMiddleware } from '../middleware/auth.js';

export async function xyzRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    app.get('/', async (request) => {
        const userId = (request as any).userId;
        // ...
        return result;
    });

    app.post('/', async (request) => {
        const body = SomeSchema.parse(request.body);
        // ...
        return result;
    });
}
```

**Shared Schema Modules:**
```typescript
// Pattern: Zod schema + inferred Input type + explicit Response interface
import { z } from 'zod';

export const CreateThingSchema = z.object({ ... });
export type CreateThingInput = z.infer<typeof CreateThingSchema>;

export interface ThingResponse { ... }
```

**Middleware Modules:**
```typescript
// Pattern: named async function taking FastifyRequest + FastifyReply
export async function xyzMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    // validate/reject with reply.status(N).send({...})
    // or attach to request and return
}
```

**Mobile Store Modules:**
```typescript
// Pattern: Zustand create with typed interface + persist middleware
interface XyzState { ... }
export const useXyzStore = create<XyzState>()(
    persist((set, get) => ({ ... }), { storage: secureStorage })
);
```

**Mobile Components:**
```typescript
// Pattern: named function export with Props interface + StyleSheet.create
interface ComponentProps { ... }
export function ComponentName({ prop1, prop2 = default }: ComponentProps) { ... }
const styles = StyleSheet.create({ ... });
```

For components needing `ref`, `React.forwardRef` is used with explicit `displayName`:
```typescript
export const AnimatedButton = React.forwardRef<View, AnimatedButtonProps>((...) => { ... });
AnimatedButton.displayName = 'AnimatedButton';
```

---

## Exports

**Barrel files:**
- `packages/shared/src/schemas/index.ts` — re-exports all schemas with `export * from './auth.js'`
- `apps/mobile/src/components/index.ts` — re-exports all components
- `apps/mobile/src/components/ui/index.ts` — re-exports all UI components

**Named exports preferred** over default for utilities and middleware.
**Default exports used** for React screen components (`export default function DashboardScreen`) and Expo Router layouts.

---

## Error Handling

**API Strategy:** Centralized error handler at `apps/api/src/middleware/errorHandler.ts`. All routes return errors by throwing; the global handler normalizes them.

**Error response shape (always consistent):**
```typescript
{
    statusCode: number,
    error: string,        // "Unauthorized" | "Forbidden" | "Not Found" | "Validation Error" | "Conflict"
    message: string,      // Human-readable description
    requestId?: string,   // x-request-id for debugging
}
```

**Error types handled explicitly:**
- `ZodError` → 400 Validation Error (message concatenates all field errors)
- `JsonWebTokenError` / `TokenExpiredError` → 401 Unauthorized
- Prisma `P2002` (unique constraint) → 409 Conflict
- Prisma `P2025` (record not found) → 404 Not Found
- Default → 500 (message hidden: "An unexpected error occurred")

**In middleware:** Early-return pattern — `return reply.status(N).send({...})` stops execution. Check `if (reply.sent) return` after calling sub-middleware.

**Audit log failures swallowed:** `createAuditLog` catches errors internally and never fails the request. Pattern:
```typescript
// Don't fail the request if audit logging fails
await createAuditLog(request, { ... }).catch(error => { ... });
```

**Mobile (Zustand stores):** `try/catch` in every async action, error stored in state:
```typescript
} catch (error: any) {
    set({ error: error.response?.data?.message || 'Action failed', isLoading: false });
    throw error;
}
```

---

## Validation

**All API inputs validated with Zod at the start of route handlers:**
```typescript
const body = SomeSchema.parse(request.body);  // throws ZodError on failure
```

**Schemas live in `packages/shared/src/schemas/`** — shared between API and mobile.

**Sanitization middleware** (`apps/api/src/middleware/sanitization.ts`) runs globally via `addHook('onRequest')` and sanitizes body, params, query, and select headers before route handlers run.

---

## Logging

**Framework:** Pino (via Fastify) in API. Structured JSON in production, pino-pretty in development, `silent` in test.

**Config:** `apps/api/src/app.ts` `envToLogger` map:
```typescript
const envToLogger = {
    development: { transport: { target: 'pino-pretty', ... } },
    production: true,
    test: { level: 'silent' },
};
```

**Pattern:** Structured objects first, then message string:
```typescript
logger.info({ userId, userEmail, userRole }, 'Authentication successful');
logger.warn({ hasAuthHeader }, 'Authentication failed - missing header');
logger.error({ error: { name, message } }, 'Token verification error');
```

**Test suppression:** `process.env.NODE_ENV !== 'test' || process.env.VITEST_DEBUG_LOGS` guards noisy console output in sanitization middleware. Enable verbose output in tests via `VITEST_DEBUG_LOGS=1`.

**Logger utilities:** `apps/api/src/utils/logger.ts` exports `createRequestLogger`, `logRequest`, `logResponse`, `logError`, `logAuditEvent`, `logDatabaseQuery`.

---

## Comments

**File-level JSDoc blocks** used for middleware files documenting HIPAA compliance references:
```typescript
/**
 * Input Sanitization Middleware for BioPoint API
 * HIPAA Compliance: §164.312(a)(1) Access controls, §164.312(c)(1) Integrity
 */
```

**Inline comments** on non-obvious logic:
```typescript
// Cache only in test env to keep production behaviour simple.
// Under Vitest, some suites fire hundreds of concurrent authenticated requests.
```

**Section dividers in schemas:**
```typescript
// ============ Auth Schemas ============
// ============ Auth Response Types ============
```

**Theme file header** with version and feature list — `apps/mobile/src/theme/index.ts`.

---

## HIPAA / Security Patterns

**Sensitive field redaction in audit logs** — `redactSensitiveFields()` strips `password`, `passwordHash`, `token`, `secret`, `s3Key`:
```typescript
redacted[key] = '[REDACTED]';
```

**PHI entity type enforcement:** `PhiEntityType` union type in `auditLog.ts` restricts what can be audit-logged to known PHI-bearing entities.

**Test-only code** isolated with env guards:
```typescript
export function __testResetAuthCache(): void {
    if (process.env.NODE_ENV !== 'test') return;
    userLookupCache.clear();
}
```

**Sensitive data never in logs:** S3 keys, tokens, and passwords always [REDACTED] before being passed to logger.

---

## Code Style Observations

**`(request as any).userId`** cast is the standard way route handlers access auth-attached context since Fastify's request type doesn't include custom properties. This pattern is used uniformly across all authenticated routes.

**Zod `.parse()` not `.safeParse()`** — errors propagate to the global error handler rather than being manually handled per-route.

**Prisma query isolation** — all queries filter by `userId` in `where` clauses to enforce per-user data isolation at the query level, not just at the authorization layer.

**Date serialization** — always `.toISOString()` in route responses, never raw `Date` objects returned to clients.

**Optional chaining for nullable fields:** `report.reportDate?.toISOString() ?? null`

---

*Convention analysis: 2026-02-19*
