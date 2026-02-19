# Phase 2: Code Quality & CI Hardening - Research

**Researched:** 2026-02-19
**Domain:** TypeScript strictness, Fastify type augmentation, SAST tooling, CI pipeline hardening
**Confidence:** HIGH

## Summary

Phase 2 targets zero `as any` casts in the API source, strict TypeScript compilation, dead code removal, a bug fix, and two new CI pipeline stages (Semgrep SAST + npm audit). The codebase currently has **142 non-test `as any` casts** across 27 files, with the overwhelming majority (89 of 142) being `(request as any).userId` accesses. The fix is structural: augment `FastifyRequest` via declaration merging and decorate the request instance.

Fastify's official TypeScript documentation prescribes a `declare module 'fastify'` block to extend the `FastifyRequest` interface. This is well-supported, stable, and the idiomatic approach. For the Prisma `$extends` callback, TypeScript inference handles typing automatically -- the `{ model, operation, args, query }` destructured parameter should NOT be annotated with `: any` because Prisma infers it. The `db/src/index.ts` file needs the explicit `: any` annotation removed and the destructured parameters left un-annotated for inference to work.

The existing CI pipeline already has a `security-scan.yml` that references `returntocorp/semgrep-action@v1` -- which is **deprecated**. The replacement is the native `semgrep/semgrep` container image with `semgrep scan`. The npm audit integration already exists in both `ci.yml` (line 122, `--audit-level=moderate`) and `security-scan.yml` (with JSON output + high/critical threshold). The CI changes needed are: (1) update Semgrep to the modern approach and ensure it runs on every push/PR, and (2) verify the npm audit threshold is `--audit-level=high` in the main CI pipeline.

**Primary recommendation:** Create a single `types/fastify.d.ts` declaration file that augments `FastifyRequest` with all custom properties (`userId`, `userEmail`, `userRole`, `id`, `log`, `startTime`, `sessionId`, `sessionTimeout`, `rateLimit`, `accountLockout`), then systematically remove all `(request as any).X` casts. Follow up by enabling `noImplicitAny: true` and running `tsc --noEmit` to catch remaining issues.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CODE-01 | All 142 `as any` casts eliminated (FastifyRequest augmented for userId, userEmail, userRole) | Fastify declaration merging pattern documented; 89/142 casts are `(request as any).userId`; full property inventory identified |
| CODE-02 | `noImplicitAny` enabled in API tsconfig.json | Currently `false` in `apps/api/tsconfig.json` line 8; base tsconfig already has `strict: true`; enable after CODE-01 fixes |
| CODE-03 | Dead code removed (unused `dataIntegrity.ts`, unused `getPrismaConfig`) | Confirmed: `dataIntegrity.ts` has zero imports across codebase; `getPrismaConfig` exported but never imported; `prismaRequestId.ts` is also dead (no imports) |
| CODE-04 | `automaticLogoff.ts` stats bug fixed | Bug identified at line 188: `this.isSessionExpired(s.userId)` passes userId instead of sessionId |
| CODE-05 | Deprecated Prisma `$use` middleware fully removed | `prismaRequestId.ts` is the last remnant of the `$use` era; it exports `createPrismaRequestMiddleware` but is never imported; safe to delete |
| TEST-08 | SAST tool (Semgrep) integrated into CI pipeline | Existing `security-scan.yml` uses deprecated `returntocorp/semgrep-action@v1`; must migrate to `semgrep/semgrep` container with `semgrep scan`; rulesets identified |
| TEST-09 | npm audit added to CI pipeline with fail-on-high threshold | Already present in `security-scan.yml` with high/critical check; needs to be added/verified in main `ci.yml` for every-push trigger |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Fastify | 4.x | HTTP framework | Already in use; TypeScript support via declaration merging |
| TypeScript | ^5.3.3 | Type system | Already in use; `strict: true` in base tsconfig |
| Prisma | ^5.8.0 | ORM with `$extends` | Already migrated from `$use` in Phase 1 |

### CI Tooling (To Add/Update)
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Semgrep CE | latest (container: `semgrep/semgrep`) | SAST scanning | Every push and PR; replaces deprecated `returntocorp/semgrep-action@v1` |
| npm audit | built-in (Node 20) | Dependency vulnerability scanning | Every push; `--audit-level=high` |
| audit-ci (optional) | ^7.x | Advanced audit with allowlisting | Only if npm audit produces false positives needing suppression |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Semgrep CE (free) | Semgrep AppSec Platform (paid) | Pro has cross-file analysis and 20K+ rules; CE is sufficient for this phase |
| npm audit | Snyk | Snyk already in security-scan.yml; npm audit is zero-cost and sufficient for the CI requirement |
| audit-ci | npm audit raw | audit-ci adds allowlisting; only needed if transitive dependency false positives block CI |

## Architecture Patterns

### Recommended: FastifyRequest Declaration Merging

The Fastify-idiomatic approach for custom request properties. Create a single declaration file that augments the `FastifyRequest` interface globally.

**File: `apps/api/src/types/fastify.d.ts`**

```typescript
// Source: https://fastify.dev/docs/latest/Reference/TypeScript/
import type { FastifyRequest } from 'fastify';

// Logger interface matching what createRequestLogger returns
interface RequestLogger {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
  debug: (obj: object, msg?: string) => void;
  child: (bindings: object) => RequestLogger;
}

declare module 'fastify' {
  interface FastifyRequest {
    // Auth middleware (set in middleware/auth.ts)
    userId: string;
    userEmail: string;
    userRole: 'USER' | 'ADMIN';

    // Request ID middleware (set in middleware/requestId.ts)
    id: string;

    // Logger (set in app.ts onRequest hook)
    log: RequestLogger;

    // Timing (set in app.ts onRequest hook)
    startTime: number;

    // Session management (set in middleware/automaticLogoff.ts)
    sessionId?: string;
    sessionTimeout?: number;

    // Rate limiting (set in middleware/rateLimit.ts)
    rateLimit?: {
      limit: number;
      remaining: number;
      resetTime: number;
    };
    accountLockout?: {
      locked: boolean;
      lockedUntil?: Date;
      failedAttempts: number;
    };
  }
}
```

**CRITICAL:** The `declare module 'fastify'` block must be in a `.d.ts` file that is included in the TypeScript compilation (covered by the existing `"include": ["src/**/*"]` in tsconfig). The file must NOT have top-level imports/exports OR must use `import type` within the `declare module` block to avoid turning it into a module.

**Confidence:** HIGH -- This is the official Fastify documentation pattern, verified at https://fastify.dev/docs/latest/Reference/TypeScript/

### Pattern: Register Decorators in App Bootstrap

After declaring the types, register decorators so Fastify initializes the properties:

```typescript
// In createServer() in app.ts
app.decorateRequest('userId', '');
app.decorateRequest('userEmail', '');
app.decorateRequest('userRole', 'USER');
app.decorateRequest('startTime', 0);
app.decorateRequest('sessionId', '');
app.decorateRequest('sessionTimeout', 0);
```

**Note:** `decorateRequest` with a non-null default initializer allows Fastify to optimize property access. The `id` and `log` properties are already part of Fastify's base `FastifyRequest` type (Fastify sets `request.id` and `request.log` natively when `genReqId` is configured), so they do NOT need decorating -- only the custom middleware-injected properties do.

**Confidence:** HIGH -- Fastify docs confirm `request.id` and `request.log` are built-in.

### Pattern: Prisma `$extends` Without Explicit `: any`

The current `db/src/index.ts` line 81 uses:
```typescript
async $allOperations({ model, operation, args, query }: any) {
```

Remove the `: any` annotation entirely. TypeScript infers the correct types from Prisma's `$extends` generic constraints:
```typescript
async $allOperations({ model, operation, args, query }) {
  // model: string | undefined
  // operation: string
  // args: record type
  // query: (args) => Promise<result>
}
```

**Confidence:** HIGH -- Verified with Prisma official documentation at https://www.prisma.io/docs/orm/prisma-client/client-extensions/query

### Pattern: Typing Prisma JSON Fields

Several `as any` casts relate to Prisma `Json` fields (`zonesReached`, `failedAttempts`, `itemsJson`). Prisma types `Json` fields as `Prisma.JsonValue` (which is `string | number | boolean | null | JsonObject | JsonArray`). The proper fix:

```typescript
// Instead of: updated.zonesReached as any[]
// Use: (updated.zonesReached as Prisma.JsonArray) ?? []

// For writes, Prisma accepts JsonValue directly:
// Instead of: failedAttempts: recentAttempts as any
// Use: failedAttempts: recentAttempts as Prisma.JsonArray
```

Or define a typed helper:
```typescript
import { Prisma } from '@prisma/client';

function asJsonArray(val: Prisma.JsonValue | null | undefined): Prisma.JsonArray {
  return Array.isArray(val) ? val : [];
}
```

**Confidence:** HIGH -- `Prisma.JsonValue`, `Prisma.JsonArray`, `Prisma.JsonObject` are documented types.

### Pattern: Typing Prisma Enum Casts

The `breachNotification.ts` line 193 uses `sev as any` to pass a string to a `BreachSeverity` enum filter. The proper fix:

```typescript
import { BreachSeverity } from '@prisma/client';

// Instead of: where: { severity: sev as any }
// Use: where: { severity: sev as BreachSeverity }

// Or better, type the array:
const severities: BreachSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
for (const sev of severities) {
  bySeverity[sev] = await prisma.breachIncident.count({ where: { severity: sev } });
}
```

**Confidence:** HIGH -- Prisma generates enum types that match the schema.

### Anti-Patterns to Avoid

- **Blanket `@ts-ignore` or `@ts-expect-error`:** Do NOT suppress errors instead of fixing types. Every cast must be replaced with a proper type.
- **Overly broad declaration merging:** Do NOT add properties to `FastifyRequest` that are only used in one route. Route-specific typing should use `FastifyRequest<{ Body: T; Params: P; Querystring: Q }>`.
- **Casting Prisma `$queryRawUnsafe` results:** The `health.ts` line 174 `queryStats[0] as any` should use a typed result interface instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request type augmentation | Custom middleware type wrappers | Fastify declaration merging (`declare module 'fastify'`) | Fastify's built-in pattern; custom wrappers would fight the framework |
| SAST scanning | Custom ESLint security rules | Semgrep with `p/typescript` + `p/nodejs` rulesets | Semgrep has 500+ TypeScript security rules maintained by security researchers |
| Dependency auditing | Custom vulnerability checker | `npm audit --audit-level=high` | Built into npm; maintained by npm security team |
| JSON field type casting | Per-file inline casts | Shared typed helpers (e.g., `asJsonArray()`) | Centralizes the cast pattern; easier to update if Prisma changes |

## Common Pitfalls

### Pitfall 1: Declaration File Becomes a Module
**What goes wrong:** Adding a top-level `import` or `export` statement to the `.d.ts` file turns it into a module, breaking the ambient declaration merging.
**Why it happens:** TypeScript treats any file with top-level import/export as a module. Module-scoped `declare module` only works for *augmentation* if the file is already a module -- but it changes the semantics.
**How to avoid:** Use `import type` inside the `declare module` block, or keep the `.d.ts` file purely ambient with no top-level imports. Reference other types by path:
```typescript
// WRONG -- turns file into module, may break augmentation
import { RequestLogger } from '../utils/logger.js';
declare module 'fastify' { ... }

// RIGHT -- define the interface inline or use import() type
declare module 'fastify' {
  interface FastifyRequest {
    log: import('../utils/logger.js').RequestLogger;
  }
}
```
**Warning signs:** `tsc` compiles but properties are still `any` at usage sites.

### Pitfall 2: `decorateRequest` Default Value Type Mismatch
**What goes wrong:** Fastify requires `decorateRequest('userId', '')` be called before any hook accesses `request.userId`. If omitted, Fastify throws at runtime even though TypeScript compiles.
**Why it happens:** Declaration merging only affects the type system. Fastify still needs the runtime decorator registration.
**How to avoid:** Add `decorateRequest` calls in `createServer()` for every custom property. Test by starting the server and hitting a route.
**Warning signs:** Runtime error `FST_ERR_DEC_MISSING_DEPENDENCY` or `undefined` property access.

### Pitfall 3: `noImplicitAny` Reveals Hidden Errors
**What goes wrong:** Enabling `noImplicitAny: true` causes compilation errors in files that were previously silently using implicit `any`.
**Why it happens:** The API tsconfig currently has `noImplicitAny: false` (line 8), overriding the base tsconfig's `strict: true`.
**How to avoid:** Enable `noImplicitAny` AFTER all explicit `as any` casts are removed. Run `tsc --noEmit` and fix any new errors before committing the tsconfig change.
**Warning signs:** `tsc --noEmit` reports errors in files that weren't touched by the `as any` removal.

### Pitfall 4: Prisma `$extends` Inference Requires No Annotation
**What goes wrong:** Explicitly annotating the `$allOperations` callback parameter as `: any` short-circuits TypeScript's inference, making the entire callback untyped.
**Why it happens:** Prisma uses complex generics in `$extends`. Adding `: any` overrides the generic inference.
**How to avoid:** Remove the `: any` annotation entirely. Let TypeScript infer from Prisma's generics. If you need the type explicitly, use `Parameters<>` extraction as documented.
**Warning signs:** After removing `: any`, `model` and `operation` should resolve to `string | undefined` and `string` respectively.

### Pitfall 5: Deprecated Semgrep Action Still in CI
**What goes wrong:** `returntocorp/semgrep-action@v1` is deprecated and may stop receiving updates or break without notice.
**Why it happens:** The existing `security-scan.yml` was written when this was the official approach.
**How to avoid:** Replace with the native container approach: `container: { image: semgrep/semgrep }` and `run: semgrep scan --config ...`.

### Pitfall 6: `automaticLogoff.ts` Stats Bug is Subtle
**What goes wrong:** The `getStats()` method at line 188 calls `this.isSessionExpired(s.userId)` but `isSessionExpired()` expects a **sessionId**, not a userId. The session store is keyed by sessionId, so passing userId will always return `true` (session not found = expired), making `expiredSessions` count equal `totalSessions`.
**Why it happens:** `s.userId` was used instead of iterating with the sessionId key from the `sessions` object.
**How to avoid:** Use `Object.entries(this.sessions)` to get both key (sessionId) and value, then call `this.isSessionExpired(sessionId)`.
**Warning signs:** `getSessionStats().expiredSessions` always equals `getSessionStats().totalSessions`.

## Code Examples

### Example 1: Complete FastifyRequest Augmentation File

```typescript
// apps/api/src/types/fastify.d.ts
// Source: https://fastify.dev/docs/latest/Reference/TypeScript/

declare module 'fastify' {
  interface FastifyRequest {
    // Set by middleware/auth.ts
    userId: string;
    userEmail: string;
    userRole: 'USER' | 'ADMIN';

    // Set by app.ts onRequest hook
    startTime: number;

    // Set by middleware/automaticLogoff.ts
    sessionId?: string;
    sessionTimeout?: number;

    // Set by middleware/rateLimit.ts
    rateLimit?: {
      limit: number;
      remaining: number;
      resetTime: number;
    };
    accountLockout?: {
      locked: boolean;
      lockedUntil?: Date;
      failedAttempts: number;
    };
  }
}

export {};  // Ensure this is treated as a module for augmentation
```

**Note on `request.id` and `request.log`:** These are already typed on `FastifyRequest` by Fastify itself. The `genReqId` option in the Fastify constructor populates `request.id`. The `request.log` is a Pino logger instance. The existing casts `(request as any).id` and `(request as any).log` can simply become `request.id` and `request.log` with no augmentation needed.

### Example 2: Removing `as any` from Auth Middleware

```typescript
// BEFORE (apps/api/src/middleware/auth.ts lines 94-96)
(request as any).userId = user.id;
(request as any).userEmail = user.email;
(request as any).userRole = user.role;

// AFTER (with declaration merging in place)
request.userId = user.id;
request.userEmail = user.email;
request.userRole = user.role;
```

### Example 3: Removing `as any` from Route Handlers

```typescript
// BEFORE (every route file, e.g., routes/profile.ts line 16)
const userId = (request as any).userId;

// AFTER
const userId = request.userId;
```

### Example 4: Fixing Prisma `$extends` Typing

```typescript
// BEFORE (db/src/index.ts line 81)
async $allOperations({ model, operation, args, query }: any) {

// AFTER -- remove `: any`, let Prisma infer
async $allOperations({ model, operation, args, query }) {
```

Also fix the inner `d: any` at line 96:
```typescript
// BEFORE
args.data.map((d: any) => encryptDataObject(model, d)),

// AFTER -- model is string, d is the data element type
args.data.map((d: Record<string, unknown>) => encryptDataObject(model as string, d)),
```

### Example 5: Fixing `automaticLogoff.ts` Stats Bug

```typescript
// BEFORE (line 185-188)
const sessions = Object.values(this.sessions);
const expiredSessions = sessions.filter(s => this.isSessionExpired(s.userId)).length;

// AFTER
const sessionEntries = Object.entries(this.sessions);
const expiredSessions = sessionEntries.filter(
  ([sessionId]) => this.isSessionExpired(sessionId)
).length;
```

### Example 6: Modern Semgrep CI Configuration

```yaml
# .github/workflows/semgrep.yml (new file, or update security-scan.yml)
# Source: https://semgrep.dev/docs/semgrep-ci/sample-ci-configs
name: Semgrep SAST
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  semgrep:
    name: SAST Scan
    runs-on: ubuntu-latest
    container:
      image: semgrep/semgrep
    if: (github.actor != 'dependabot[bot]')
    steps:
      - uses: actions/checkout@v4
      - name: Run Semgrep scan
        run: |
          semgrep scan \
            --config p/typescript \
            --config p/nodejs \
            --config p/security-audit \
            --config p/secrets \
            --error \
            --sarif --output semgrep-results.sarif \
            apps/ packages/ db/
      - name: Upload SARIF to GitHub Security
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: semgrep-results.sarif
```

Key flags:
- `--error`: Exit with non-zero code if findings are detected (fails the CI)
- `--sarif`: Output in SARIF format for GitHub Security tab integration
- `--config p/typescript p/nodejs p/security-audit p/secrets`: Four rulesets covering TypeScript patterns, Node.js server patterns, OWASP security audit, and secrets detection

### Example 7: npm Audit in CI

```yaml
# Add to ci.yml security-scan job
- name: Run npm audit
  run: npm audit --audit-level=high
```

This already exists in `security-scan.yml` with a more detailed JSON-parsing approach (lines 36-53). The main `ci.yml` line 122 uses `--audit-level=moderate` -- this should be changed to `--audit-level=high` per the requirement.

## `as any` Cast Inventory and Fix Strategy

### By Category

| Category | Count | Fix Strategy |
|----------|-------|-------------|
| `(request as any).userId` | 89 | FastifyRequest declaration merging |
| `(request as any).id` | 10 | Already typed on FastifyRequest (built-in); just remove cast |
| `(request as any).log` | 9 | Already typed on FastifyRequest (built-in Pino logger); just remove cast |
| `(request as any).userRole` | 4 | FastifyRequest declaration merging |
| `(request as any).startTime` | 2 | FastifyRequest declaration merging |
| `(request as any).rateLimit` | 2 | FastifyRequest declaration merging |
| `(request as any).userEmail` | 1 | FastifyRequest declaration merging |
| `(request as any).url` | 1 | Already typed on FastifyRequest (built-in); just remove cast |
| `(request as any).sessionId` | 1 | FastifyRequest declaration merging |
| `(request as any).sessionTimeout` | 1 | FastifyRequest declaration merging |
| `(request as any).accountLockout` | 1 | FastifyRequest declaration merging |
| `prisma as any` (prismaRequestId.ts) | 7 | DELETE FILE -- dead code, never imported |
| `request.body as any` / `request.query as any` | 4 | Use Fastify generic: `FastifyRequest<{ Body: T }>` |
| `request.params as any` | 1 | Use Fastify generic: `FastifyRequest<{ Params: T }>` |
| Prisma JSON field casts (`zonesReached as any[]`, `failedAttempts as any`, `itemsJson as any[]`) | 5 | Use `Prisma.JsonArray` / typed helpers |
| Prisma enum cast (`sev as any`) | 1 | Use `BreachSeverity` enum type |
| `queryStats[0] as any` (health.ts) | 1 | Define typed interface for raw query result |
| `prisma.X as any` in test mocks | 0 (excluded) | Test files excluded from CODE-01 count |
| `metadata as any` (auditLog.ts) | 1 | Type the metadata parameter properly |
| `error as any` (errorHandler.ts) | 1 | Use proper error type narrowing |
| **Total non-test** | **142** | |

### By File (Top 10)

| File | Count | Primary Category |
|------|-------|-----------------|
| `routes/stacks.ts` | 13 | `request.userId` |
| `routes/fasting.ts` | 12 | `request.userId` + `zonesReached as any[]` |
| `middleware/auth.ts` | 12 | `request.userId/userEmail/userRole/id/log` |
| `routes/user/account-deletion.ts` | 9 | `request.userId` + `request.params as any` |
| `routes/community.ts` | 9 | `request.userId` + `itemsJson as any[]` |
| `middleware/rateLimit.ts` | 8 | `request.userId/rateLimit/accountLockout` |
| `routes/labs.ts` | 8 | `request.userId` |
| `middleware/prismaRequestId.ts` | 7 | DELETE FILE (dead code) |
| `routes/user/data-export.ts` | 6 | `request.userId` + `request.query/body as any` |
| `routes/photos.ts` | 6 | `request.userId` |

## Dead Code Inventory

| File | Status | Evidence | Action |
|------|--------|----------|--------|
| `apps/api/src/utils/dataIntegrity.ts` | DEAD | Zero imports across entire codebase; only referenced in `docs/hipaa-audit-preparation.md` (a doc file, not code) | DELETE |
| `apps/api/src/middleware/prismaRequestId.ts` | DEAD | Zero imports across `apps/api/src/`; functionality replaced by `$extends` in `db/src/index.ts` + `setDbRequestContext`/`clearDbRequestContext` | DELETE |
| `getPrismaConfig()` in `apps/api/src/config/database.ts` | DEAD | Exported but never imported anywhere; `getDatabaseConfig()` is used instead (imported in `db/src/index.ts`) | DELETE function only; keep `getDatabaseConfig()` and rest of file |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `returntocorp/semgrep-action@v1` | `semgrep/semgrep` container with `semgrep scan` | 2024-2025 | Old action deprecated; new approach is faster and doesn't require Semgrep cloud token for CE mode |
| Prisma `$use()` middleware | Prisma `$extends()` query component | Prisma 4.16+ (2023) | `$use` is deprecated; Phase 1 already migrated but `prismaRequestId.ts` remnant remains |
| Manual `(request as any).X` casts | Fastify declaration merging + `decorateRequest` | Always available | The codebase accumulated technical debt; declaration merging has been the official pattern since Fastify 3.x |

**Deprecated/outdated:**
- `returntocorp/semgrep-action@v1`: Deprecated. Replace with native Semgrep container.
- `prismaRequestId.ts`: Uses `$use` middleware pattern (the old `next(params)` approach). Already replaced by `$extends` in `db/src/index.ts`. Delete.
- `dataIntegrity.ts`: Contains mock data and unused functions. Never wired into any route or middleware. Delete.

## Open Questions

1. **Test file `as any` casts (25 total)**
   - What we know: The requirement says "all 142 `as any` casts eliminated" and the success criterion is `grep -r "as any" apps/api/src/` returns zero matches (which would include test files).
   - What's unclear: Whether the 25 test file casts should also be fixed (they include Prisma mock casts like `prisma.X.create as any` and test helper casts).
   - Recommendation: Fix them. The test mock casts can use `vi.mocked()` or `jest.mocked()` instead. The `apiClient.ts` `null as any` can use proper initialization.

2. **`app.ts` route handler casts**
   - What we know: `app.ts` lines 52, 76, 96, 114 use `(request: any, reply: any)` in inline route handlers inside `registerRoutesForPrefix`.
   - What's unclear: These are `any` parameter annotations, not `as any` casts -- they would be caught by `noImplicitAny` but not by `grep "as any"`.
   - Recommendation: Type them as `FastifyRequest` and `FastifyReply` while doing the cleanup. The `registerRoutesForPrefix` function parameter `app: any` should also be typed as `FastifyInstance`.

3. **`db/src/index.ts` request context types**
   - What we know: Lines 40-43 use `any` for the request logger context (`let _requestLogger: any = null`; `export function setDbRequestContext(_request: any, logger: any)`).
   - What's unclear: Whether `noImplicitAny` in the API tsconfig affects `db/src/index.ts` (which has its own tsconfig).
   - Recommendation: Type these properly regardless. The db package should have its own types or import from Fastify.

## Sources

### Primary (HIGH confidence)
- Fastify TypeScript documentation: https://fastify.dev/docs/latest/Reference/TypeScript/ -- Declaration merging pattern, decorateRequest
- Prisma Client Extensions query docs: https://www.prisma.io/docs/orm/prisma-client/client-extensions/query -- $allOperations callback typing, inference behavior
- Prisma type utilities: https://www.prisma.io/docs/orm/prisma-client/client-extensions/type-utilities -- Prisma.Args, Prisma.Result, Prisma.JsonValue
- Semgrep CI sample configs: https://semgrep.dev/docs/semgrep-ci/sample-ci-configs -- Current recommended GitHub Actions workflow
- Semgrep CE deployment: https://semgrep.dev/docs/deployment/oss-deployment -- OSS mode without SEMGREP_APP_TOKEN

### Secondary (MEDIUM confidence)
- Semgrep TypeScript ruleset: https://semgrep.dev/p/typescript -- Available rules for TypeScript
- Semgrep JavaScript deep dive (Jan 2025): https://semgrep.dev/blog/2025/a-technical-deep-dive-into-semgreps-javascript-vulnerability-detection/ -- Engine improvements for JS/TS
- npm audit docs: https://docs.npmjs.com/cli/v8/commands/npm-audit/ -- `--audit-level` flag behavior
- audit-ci (IBM): https://github.com/IBM/audit-ci -- Alternative for advanced allowlisting

### Tertiary (LOW confidence)
- TypeScript strictness interaction (noImplicitAny + strictNullChecks): https://huonw.github.io/blog/2025/12/typescript-monotonic/ -- Edge case where enabling noImplicitAny can reduce errors from strictNullChecks

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All tools verified via official documentation
- Architecture (FastifyRequest augmentation): HIGH -- Official Fastify docs, verified pattern
- Architecture (Prisma $extends typing): HIGH -- Official Prisma docs, verified inference behavior
- Pitfalls: HIGH -- Identified from direct codebase analysis + official docs
- CI patterns (Semgrep): HIGH -- Official Semgrep docs confirm deprecation of old action and current approach
- CI patterns (npm audit): HIGH -- Built-in npm functionality, well-documented

**Research date:** 2026-02-19
**Valid until:** 2026-04-19 (90 days -- all tools are stable/mature)
