# Phase 1: PHI Security Fixes - Research

**Researched:** 2026-02-19
**Domain:** HIPAA PHI protection, field-level encryption, feature flags, audit logging, Prisma client extensions
**Confidence:** HIGH

## Summary

This phase addresses 8 security requirements (SEC-01 through SEC-08) that collectively prevent PHI leakage across the BioPoint API. The codebase has a well-structured encryption layer using AES-256-GCM, but several critical gaps exist: the Gemini lab analysis endpoint transmits PHI to a non-BAA vendor with no feature gate, the LabMarker.value field stores plaintext floats alongside encrypted copies (because the field is a required `Float` and cannot be nulled), the `[DECRYPTION_FAILED]` sentinel leaks encryption internals in API responses, audit logs skip empty-result access attempts, and the Prisma encryption middleware uses the deprecated `$use()` API (4 separate registrations). Additionally, the `database.ts` connection pool config is computed but never wired into the actual Prisma client, S3 upload content-types rely solely on client-declared values, and the OpenAI food analysis endpoint sends food photos (which could contain PHI context) to GPT-4o without a BAA.

A critical discovery during research: **`setupEncryptionMiddleware()` is defined in `apps/api/src/middleware/encryption.ts` but is never called anywhere in production code** -- only in the test file (`__tests__/encryption.test.ts:85`). This means the encryption layer may not be active in production at all unless it was wired in through a path not visible in the current codebase. This must be verified immediately and is the single most important finding of this research.

**Primary recommendation:** Address in dependency order: (1) verify/wire encryption middleware, (2) disable Gemini endpoint via feature flag, (3) fix LabMarker dual-storage, (4) replace DECRYPTION_FAILED sentinel, (5) fix audit log empty-result gap, (6) migrate $use to $extends, (7) wire connection pool, (8) add S3 content-type validation, (9) audit OpenAI endpoint.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | Gemini lab analysis endpoint disabled behind feature flag OFF | analysis.ts sends PHI (lab images) to Google Gemini standard API (no BAA). Route at labs.ts:263 `POST /:id/analyze` must return 404 or disabled response. Simple env-var feature flag pattern. |
| SEC-02 | LabMarker.value no longer stores plaintext alongside encrypted copy | Schema has `value Float` (required) + `value_encrypted String?`. CLEAR_PLAINTEXT_FIELDS map does NOT include LabMarker because Float cannot be nulled. Requires schema migration to make value optional or change approach. |
| SEC-03 | `[DECRYPTION_FAILED]` sentinel never returned in API responses | encryption.ts:205 catches decryption errors and sets field to literal string `'[DECRYPTION_FAILED]'`. Must be replaced with proper error handling (throw or return null with logged error). |
| SEC-04 | Audit log records access even when query returns empty results | 8 locations across 4 files (labs.ts:43,149; photos.ts:37; logs.ts:100; app.ts:85,105,124) wrap createAuditLog in `if (results.length > 0)` guard. Remove the guard to log all access attempts. |
| SEC-05 | Prisma encryption middleware migrated from `$use()` to `$extends()` with integration test | 4 `prisma.$use()` calls in encryption.ts:40-77. Prisma 5.x deprecated $use; Prisma 6 removes it. Migrate to `$extends({ query: { ... } })` pattern. Plus a 5th `$use` in app.ts:174 for request context. |
| SEC-06 | Connection pool parameters from database.ts wired into Prisma client | db/src/index.ts:15-26 creates PrismaClient with empty config. getPrismaConfig() in database.ts returns pool settings but is never called with effect. Wire via DATABASE_URL query params or Prisma constructor. |
| SEC-07 | S3/R2 content-type validated server-side before accepting upload | PresignUploadSchema validates contentType via regex but this is client-declared. S3 presigned PUT URLs do not enforce Content-Type. Need post-upload validation using magic bytes (file-type library). |
| SEC-08 | OpenAI food analysis endpoint audited for PHI exposure and remediated | foodAnalysis.ts sends food photos to GPT-4o. OpenAI API supports BAA (email baa@openai.com) with zero data retention. Alternatively strip any PHI identifiers before sending. |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@prisma/client` | ^5.8.0 | ORM with client extensions | `$extends()` replaces deprecated `$use()` middleware |
| `fastify` | ^4.25.0 | HTTP server | Already in use; feature flag checks go in route handlers |
| `zod` | ^3.22.4 | Schema validation | Already validates presign uploads; extend for content-type |
| `crypto` (Node built-in) | N/A | AES-256-GCM encryption | Already used in utils/encryption.ts |

### New Dependencies Needed
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `file-type` | ^19.x (ESM) | Magic-bytes MIME detection | SEC-07: validate actual file content after S3 upload |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `file-type` (magic bytes) | S3 Lambda trigger | Lambda adds infra complexity; file-type runs in-process and is simpler for presign-then-verify flow |
| Env-var feature flag | LaunchDarkly/Unleash | Over-engineered for a single boolean flag; env var is standard for early-stage |
| Full BAA with OpenAI | Strip all identifiers from food photos | BAA is the proper HIPAA path; stripping identifiers is a workaround if BAA not obtainable |

**Installation:**
```bash
npm install file-type@^19
```

Note: `file-type` v19+ is ESM-only, which matches the project (`"type": "module"` in package.json).

## Architecture Patterns

### Recommended Changes Structure
```
apps/api/src/
  config/
    database.ts          # SEC-06: already has pool config, needs wiring
    featureFlags.ts      # SEC-01: NEW - simple env-var feature flag module
  middleware/
    encryption.ts        # SEC-02,03,05: rewrite from $use to $extends
    auditLog.ts          # SEC-04: unchanged (callers change)
    s3Validation.ts      # SEC-07: NEW - post-upload MIME validation
  services/
    analysis.ts          # SEC-01: gated behind feature flag
    foodAnalysis.ts      # SEC-08: strip identifiers or document BAA
  routes/
    labs.ts              # SEC-01,04: feature flag + audit fix
    photos.ts            # SEC-04: audit fix
    logs.ts              # SEC-04: audit fix
  app.ts                 # SEC-04,06: audit fix + remove $use for request context
db/
  src/index.ts           # SEC-05,06: $extends encryption + pool wiring
  prisma/schema.prisma   # SEC-02: LabMarker.value type change
```

### Pattern 1: Feature Flag via Environment Variable
**What:** Simple boolean env var check to disable endpoints
**When to use:** SEC-01 (Gemini endpoint), any endpoint that must be gated
**Example:**
```typescript
// config/featureFlags.ts
export const featureFlags = {
  geminiLabAnalysis: process.env.FEATURE_GEMINI_LAB_ANALYSIS === 'true',
  openAiFoodAnalysis: process.env.FEATURE_OPENAI_FOOD_ANALYSIS !== 'false', // default ON for now
} as const;

// In route handler:
if (!featureFlags.geminiLabAnalysis) {
  return reply.status(404).send({
    statusCode: 404,
    error: 'Not Found',
    message: 'Lab analysis feature is not available',
  });
}
```

### Pattern 2: Prisma Client Extension for Encryption
**What:** Replace 4 `$use()` calls with a single `$extends()` chain
**When to use:** SEC-05 (encryption migration)
**Example:**
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/client-extensions/query
import { PrismaClient } from '@prisma/client';

const basePrisma = new PrismaClient();

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async create({ model, args, query }) {
        if (shouldProcessModel(model)) {
          args.data = await encryptDataObject(model, args.data);
        }
        return query(args);
      },
      async update({ model, args, query }) {
        if (shouldProcessModel(model)) {
          args.data = await encryptDataObject(model, args.data);
        }
        return query(args);
      },
      async findMany({ model, args, query }) {
        const results = await query(args);
        if (shouldProcessModel(model)) {
          return Promise.all(results.map(r => decryptRecord(model, r)));
        }
        return results;
      },
      async findFirst({ model, args, query }) {
        const result = await query(args);
        if (shouldProcessModel(model) && result) {
          return decryptRecord(model, result);
        }
        return result;
      },
      async findUnique({ model, args, query }) {
        const result = await query(args);
        if (shouldProcessModel(model) && result) {
          return decryptRecord(model, result);
        }
        return result;
      },
    },
  },
});
```

### Pattern 3: Always-Audit Access Pattern
**What:** Remove `if (results.length > 0)` guard before `createAuditLog`
**When to use:** SEC-04 (all PHI list endpoints)
**Example:**
```typescript
// BEFORE (incorrect):
const reports = await prisma.labReport.findMany({ where: { userId } });
if (reports.length > 0) {
  await createAuditLog(request, { action: 'READ', entityType: 'LabReport', entityId: 'list' });
}

// AFTER (correct):
const reports = await prisma.labReport.findMany({ where: { userId } });
await createAuditLog(request, {
  action: 'READ',
  entityType: 'LabReport',
  entityId: 'list',
  metadata: { resultCount: reports.length },
});
```

### Anti-Patterns to Avoid
- **Returning sentinel strings on error:** Never return `[DECRYPTION_FAILED]` or similar sentinel values in API responses. Either throw an error (caught by error handler) or return `null` for the field and log the error server-side.
- **Client-trust for security-critical validation:** Never rely solely on Zod schema validation (client-provided data) for content-type enforcement on uploads. Always verify server-side.
- **Conditional audit logging:** HIPAA requires logging access attempts, not just successful data retrievals. Never guard audit log creation on whether results were found.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MIME type detection | Custom file header parsing | `file-type` npm package | Handles 200+ file types, maintained, handles edge cases like polyglot files |
| Feature flags | Complex flag management system | Simple env var module | Single boolean flag does not warrant LaunchDarkly/Unleash complexity |
| Connection pool config | Custom connection manager | Prisma `connection_limit` URL param | Prisma + Neon handle pooling natively; just pass the query parameter |
| Encryption at field level | Raw crypto per-route | Prisma `$extends` query hook | Centralizes all encryption in one place, prevents missed fields |

**Key insight:** Every fix in this phase is surgical -- modifying existing patterns, not building new systems. The encryption, audit, and S3 infrastructure already exists; we are fixing gaps in how they are wired together.

## Common Pitfalls

### Pitfall 1: LabMarker.value Is a Required Float -- Cannot Simply Null It
**What goes wrong:** The CLEAR_PLAINTEXT_FIELDS pattern works by setting the original field to `null` after encrypting into `*_encrypted`. But `LabMarker.value` is `Float` (required, not nullable). Setting it to `null` causes a Prisma validation error.
**Why it happens:** The schema was designed with a required numeric field, and encryption was added as an afterthought with a parallel `value_encrypted` string column.
**How to avoid:** Change `value Float` to `value Float?` (nullable) in a schema migration. OR change the approach: store a sentinel value (e.g., `0`) in the Float column and always read from `value_encrypted`. The migration approach is cleaner and more honest.
**Warning signs:** Tests pass but production writes fail with "null constraint violation."

### Pitfall 2: $extends Returns a New Client Type
**What goes wrong:** `const prisma = basePrisma.$extends({...})` returns a different TypeScript type than `PrismaClient`. Code that expects `PrismaClient` as a parameter type will get type errors.
**Why it happens:** Prisma extensions are type-safe and the extended client has a different type signature.
**How to avoid:** Export the extended client and use it everywhere. Do not pass it to functions typed as `PrismaClient` -- use `typeof prisma` or the extended type. The `setupEncryptionMiddleware(prisma: PrismaClient)` function signature must change.
**Warning signs:** TypeScript errors on `setupEncryptionMiddleware(prisma)` calls.

### Pitfall 3: file-type v19+ Is ESM-Only
**What goes wrong:** Trying to `require('file-type')` fails. Must use `import { fileTypeFromBuffer } from 'file-type'`.
**Why it happens:** The file-type package dropped CJS support in v17+.
**How to avoid:** The BioPoint API is already ESM (`"type": "module"`), so this should work out of the box. Verify import paths use `.js` extensions per the project convention.
**Warning signs:** "Cannot use require() in ESM module" error.

### Pitfall 4: Encryption Middleware Not Called in Production
**What goes wrong:** `setupEncryptionMiddleware()` is exported from `apps/api/src/middleware/encryption.ts` but is **never imported or called** in `index.ts`, `app.ts`, or `db/src/index.ts`. Only the test file calls it.
**Why it happens:** The function was written but the integration step was missed, or it was removed during a refactor.
**How to avoid:** When migrating to `$extends`, the encryption becomes part of the Prisma client construction in `db/src/index.ts` -- it cannot be "forgotten" because the extended client IS the client. This is a structural advantage of `$extends` over `$use`.
**Warning signs:** Raw SQL queries on the database show plaintext in `_encrypted` columns (or those columns are NULL/empty).

### Pitfall 5: S3 Presigned PUT URLs Do NOT Enforce Content-Type
**What goes wrong:** Even though `ContentType` is set in `PutObjectCommand`, the client can upload any file type. S3 accepts whatever Content-Type header the client sends in the actual PUT request.
**Why it happens:** This is documented S3 behavior. Presigned URLs are access grants, not content contracts.
**How to avoid:** Use presigned POST with a policy document (partial enforcement), OR validate after upload by reading the first 4KB of the uploaded object and checking magic bytes with `file-type`. The post-upload approach is more robust.
**Warning signs:** A `.exe` file uploaded with `contentType: 'application/pdf'` passes validation.

### Pitfall 6: OpenAI BAA Requires Zero Data Retention
**What goes wrong:** Getting a BAA with OpenAI but using standard API endpoints that retain data for 30 days.
**Why it happens:** The BAA requires zero-retention endpoints; standard endpoints are not covered.
**How to avoid:** When configuring OpenAI for HIPAA use, ensure the API is configured for zero data retention. Contact baa@openai.com to set this up. Alternatively, for food photos specifically, the PHI risk is lower (food photos rarely contain identifiers), so documenting the risk assessment may be sufficient without a full BAA.
**Warning signs:** OpenAI data retention policy is set to "30 days" in the API dashboard.

## Code Examples

### SEC-01: Feature Flag to Disable Gemini Endpoint
```typescript
// apps/api/src/config/featureFlags.ts (NEW FILE)
export const featureFlags = {
  /** Gemini lab analysis - OFF until BAA obtained or Vertex AI migration */
  geminiLabAnalysis: process.env.FEATURE_GEMINI_LAB_ANALYSIS === 'true',
} as const;

// apps/api/src/routes/labs.ts - modify the analyze route
import { featureFlags } from '../config/featureFlags.js';

app.post('/:id/analyze', async (request, reply) => {
  if (!featureFlags.geminiLabAnalysis) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Lab analysis feature is not currently available',
    });
  }
  // ... existing implementation
});
```

### SEC-03: Replace DECRYPTION_FAILED Sentinel
```typescript
// apps/api/src/middleware/encryption.ts - in decryptSingleItem
// BEFORE:
catch (error) {
  decryptedItem[field] = '[DECRYPTION_FAILED]';
}

// AFTER:
catch (error) {
  // Log the error server-side for investigation
  console.error(`[ENCRYPTION] Decryption failed for ${model}.${field}:`,
    error instanceof Error ? error.message : 'Unknown error');
  // Return null instead of a sentinel string
  decryptedItem[field] = null;
  // Remove the broken encrypted field from the response
  delete decryptedItem[`${field}_encrypted`];
}
```

### SEC-05: Prisma $extends Migration Structure
```typescript
// db/src/index.ts - the extended client becomes the export
import { PrismaClient } from '@prisma/client';
import { encryptDataObject, decryptRecord, shouldProcessModel } from './encryption.js';

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: { db: { url: process.env.DATABASE_URL } },
});

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async create({ model, args, query }) {
        if (shouldProcessModel(model)) {
          args.data = await encryptDataObject(model, args.data);
        }
        return query(args);
      },
      async createMany({ model, args, query }) {
        if (shouldProcessModel(model) && Array.isArray(args.data)) {
          args.data = await Promise.all(args.data.map(d => encryptDataObject(model, d)));
        }
        return query(args);
      },
      async update({ model, args, query }) {
        if (shouldProcessModel(model)) {
          args.data = await encryptDataObject(model, args.data);
        }
        return query(args);
      },
      async upsert({ model, args, query }) {
        if (shouldProcessModel(model)) {
          if (args.create) args.create = await encryptDataObject(model, args.create);
          if (args.update) args.update = await encryptDataObject(model, args.update);
        }
        return query(args);
      },
      async findMany({ model, args, query }) {
        const results = await query(args);
        if (shouldProcessModel(model) && Array.isArray(results)) {
          return Promise.all(results.map(r => decryptRecord(model, r)));
        }
        return results;
      },
      async findFirst({ model, args, query }) {
        const result = await query(args);
        if (shouldProcessModel(model) && result) return decryptRecord(model, result);
        return result;
      },
      async findUnique({ model, args, query }) {
        const result = await query(args);
        if (shouldProcessModel(model) && result) return decryptRecord(model, result);
        return result;
      },
    },
  },
});
```

### SEC-06: Connection Pool Wiring
```typescript
// db/src/index.ts - connection limit via DATABASE_URL query parameter
// The correct approach for Neon is via the connection string, not Prisma constructor:
// DATABASE_URL="postgresql://...?connection_limit=20&pool_timeout=15"

// OR in code, append to URL if not present:
function getConnectionUrl(): string {
  const url = process.env.DATABASE_URL || '';
  if (url && !url.includes('connection_limit')) {
    const separator = url.includes('?') ? '&' : '?';
    const limit = process.env.NODE_ENV === 'production' ? 20 : 5;
    return `${url}${separator}connection_limit=${limit}&pool_timeout=15`;
  }
  return url;
}
```

### SEC-07: S3 Post-Upload Content-Type Validation
```typescript
// apps/api/src/middleware/s3Validation.ts (NEW FILE)
import { fileTypeFromBuffer } from 'file-type';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export async function validateUploadedFileType(
  s3Client: S3Client,
  bucket: string,
  key: string,
): Promise<{ valid: boolean; detectedType: string | undefined }> {
  // Read only first 4KB for magic byte detection
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    Range: 'bytes=0-4095',
  });

  const response = await s3Client.send(command);
  if (!response.Body) {
    return { valid: false, detectedType: undefined };
  }

  const bytes = await response.Body.transformToByteArray();
  const buffer = Buffer.from(bytes);
  const fileType = await fileTypeFromBuffer(buffer);

  const detectedMime = fileType?.mime;
  const valid = detectedMime ? ALLOWED_MIME_TYPES.has(detectedMime) : false;

  return { valid, detectedType: detectedMime };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `prisma.$use()` middleware | `prisma.$extends({ query })` | Prisma 4.16.0 (2023) | Full type safety, composable, per-request instances |
| S3 presigned URL Content-Type trust | Post-upload magic byte validation | Always required | Prevents MIME type spoofing attacks |
| Conditional audit logging | Always-log access attempts | HIPAA requirement from day 1 | Satisfies 45 CFR 164.312(b) audit controls |
| Sentinel strings for errors | Proper error propagation | Security best practice | Prevents information leakage |

**Deprecated/outdated:**
- `prisma.$use()`: Deprecated in Prisma 5.x, removed in Prisma 6. Must migrate before any Prisma upgrade.
- Client-side-only content-type validation: Never sufficient for security-critical file uploads.

## Open Questions

1. **Is encryption middleware actually active in production?**
   - What we know: `setupEncryptionMiddleware()` is never called outside of tests. The `$use` in `app.ts:174` is for request context logging, not encryption.
   - What's unclear: Is there a deployment script or startup hook that calls it? Or is encryption genuinely not active?
   - Recommendation: Run a raw SQL query against the database to check if `_encrypted` columns contain ciphertext or are null/empty. If they are null, encryption was never active and this is a much larger issue.

2. **LabMarker.value schema migration risk**
   - What we know: Changing `value Float` to `value Float?` requires a Prisma migration. Existing data would keep its Float values.
   - What's unclear: How much client code (mobile app, dashboard) depends on `value` always being a non-null number?
   - Recommendation: Search all consumers of LabMarker.value in the mobile app. The migration itself is safe (existing values preserved), but API response handling may need adjustment.

3. **OpenAI food analysis -- BAA vs. de-identification**
   - What we know: OpenAI offers BAA for API with zero-retention. Food photos typically don't contain PHI identifiers.
   - What's unclear: Does the food analysis request include any user context (userId, health conditions) that constitutes PHI?
   - Recommendation: Audit the exact request payload in foodAnalysis.ts. Currently it only sends the image + a nutrition analysis prompt with no user identifiers. Document this as a risk assessment. The conservative approach is to obtain a BAA anyway (free to request, email baa@openai.com).

## Sources

### Primary (HIGH confidence)
- Prisma Client Extensions - Query Component: [Official Docs](https://www.prisma.io/docs/orm/prisma-client/client-extensions/query) -- exact API for `$extends` migration
- Prisma Middleware Deprecation: [Official Docs](https://www.prisma.io/docs/orm/prisma-client/client-extensions/middleware) -- confirms `$use` deprecated, recommends `$extends`
- Neon Connection Pooling with Prisma: [Neon Docs](https://neon.com/docs/guides/prisma) -- `connection_limit` URL param, `directUrl` for migrations
- OpenAI BAA Availability: [OpenAI Help Center](https://help.openai.com/en/articles/8660679-how-can-i-get-a-business-associate-agreement-baa-with-openai) -- API eligible, email baa@openai.com, requires zero retention
- S3 Presigned URL Content-Type Behavior: [AWS re:Post](https://repost.aws/questions/QU8PZcrxbhTPq8defuJBF0fA/determine-real-file-type-mime-of-an-uploaded-object-in-s3) -- S3 does NOT enforce Content-Type on presigned PUT

### Secondary (MEDIUM confidence)
- file-type npm package for magic bytes: Referenced in project's own `docs/security-best-practices.md:269` -- already known to the team
- OpenAI HIPAA compliance details: [HIPAA Journal](https://www.hipaajournal.com/is-chatgpt-hipaa-compliant/) -- ChatGPT for Healthcare launched Jan 2026, API BAA available

### Codebase Analysis (HIGH confidence)
- `apps/api/src/middleware/encryption.ts` -- full source read, confirmed 4x `$use()`, `[DECRYPTION_FAILED]` at line 205
- `apps/api/src/services/analysis.ts` -- full source read, confirmed Gemini standard API with no feature gate
- `apps/api/src/services/foodAnalysis.ts` -- full source read, confirmed GPT-4o with no identifiers in request
- `db/src/index.ts` -- full source read, confirmed PrismaClient with no pool config and no encryption wiring
- `apps/api/src/routes/labs.ts` -- full source read, confirmed `if (reports.length > 0)` audit guard at lines 43 and 149
- `apps/api/src/app.ts` -- full source read, confirmed 3 additional `if (length > 0)` audit guards at lines 85, 105, 124
- `.planning/codebase/CONCERNS.md` -- full read, confirmed all 8 issues independently documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries are already in use or well-documented for the project
- Architecture: HIGH -- patterns come from official Prisma docs and direct codebase analysis
- Pitfalls: HIGH -- each pitfall is derived from reading the actual source code and confirmed behaviors
- SEC-01 (feature flag): HIGH -- straightforward env var check
- SEC-02 (dual storage): HIGH -- schema migration path clear, but consumer impact needs verification
- SEC-03 (sentinel): HIGH -- simple code change, no dependencies
- SEC-04 (audit empty): HIGH -- 8 specific locations identified across 4 files
- SEC-05 ($extends migration): HIGH -- official Prisma docs provide exact API, code examples verified
- SEC-06 (connection pool): HIGH -- Neon docs confirm URL param approach
- SEC-07 (S3 content-type): MEDIUM -- file-type approach is proven but integration point (when to validate: at presign? after upload?) needs design decision
- SEC-08 (OpenAI audit): MEDIUM -- BAA availability confirmed but whether food photos constitute PHI requires risk assessment judgment

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days -- stable domain, no fast-moving dependencies)
