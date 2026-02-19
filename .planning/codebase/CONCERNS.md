# Codebase Concerns

**Analysis Date:** 2026-02-19
**Current Risk Score:** 2.5/10 (down from 7.8/10 after 4 security phases)
**Production Readiness Threshold:** 2.0/10 (not yet met)
**Data Status:** No real PHI processed yet - clean slate

---

## REMAINING HIGH-RISK FINDINGS

### Google Gemini — No BAA Available (HIPAA §164.502(e) Violation)

- Risk: PHI (lab report images) is transmitted to Google Gemini for OCR/analysis without a signed Business Associate Agreement
- Files: `apps/api/src/services/analysis.ts:1-62`, `apps/api/src/routes/labs.ts` (calls `analyzeLabReport`)
- Current mitigation: None. The `analyzeLabReport()` function is live and callable via `POST /labs/:id/analyze`
- Impact: Each invocation is a HIPAA violation (45 CFR §164.502(e)). Exposure up to $50,000 per incident. Google has no HIPAA BAA for standard Gemini API — only Google Cloud Healthcare API offers BAA
- Fix approach: Gate the `/labs/:id/analyze` endpoint behind a feature flag set to `false` in all environments until either (a) a Google Cloud Healthcare API migration is complete or (b) an alternative OCR service with BAA is integrated. The function at `apps/api/src/services/analysis.ts:17` must not be called with real PHI data

### Business Associate Agreements — Not Executed for Any Vendor

- Risk: Even though Neon PostgreSQL and Cloudflare R2 both support BAAs, none have been executed. All PHI storage is technically non-compliant until BAAs are signed
- Files: `README_BAA_COMPLIANCE_PACKAGE.md`, `docs/compliance-evidence/` (BAA tracker shows 0% executed)
- Current mitigation: Documents drafted, vendor contact info identified. BAA execution process documented but not completed
- Impact: Operating without BAAs violates HIPAA §164.308(b). Estimated $2.6M fine exposure per the compliance package
- Fix approach: Execute BAA with Neon PostgreSQL (HIPAA tier at ~$300/month) and Cloudflare Enterprise for R2 before any real user data is stored. Documented contact: `sales@neon.tech`, `enterprise@cloudflare.com`

---

## TECH DEBT

### Connection Pool Not Wired Into Prisma at Runtime

- Issue: `apps/api/src/config/database.ts` defines `getPrismaConfig()` with per-environment connection limits (5/10/20), but `db/src/index.ts:13-26` instantiates `PrismaClient` with an empty object — pool settings are declared but never passed to the client constructor
- Files: `db/src/index.ts:15-26`, `apps/api/src/config/database.ts:101-126`
- Impact: Default Neon serverless pool limit (typically 5) is used in production. Under load, this causes connection exhaustion starting at ~50 concurrent users. Response times degrade from 150ms to 3200ms+ at 100 concurrent users
- Fix approach: Pass `connection_limit=20` as a query parameter in `DATABASE_URL` for production (Neon supports this): `postgresql://...@.../neondb?connection_limit=20&pool_timeout=15`. The `getPrismaConfig()` result is unused dead code and should either be wired up or removed

### `as any` Overuse — TypeScript Safety Bypassed Pervasively

- Issue: 142 instances of `as any` in production API source (excluding tests). All route handlers access `request.userId`, `request.userRole`, `request.id` via `(request as any).field` because Fastify's request type is not augmented
- Files: Every route file under `apps/api/src/routes/`, `apps/api/src/middleware/auth.ts:94-97`, `apps/api/src/middleware/auditLog.ts:19-21`
- Impact: TypeScript provides no safety guarantee for these fields. A typo like `(request as any).userID` instead of `userId` would silently produce `undefined` in production
- Fix approach: Augment Fastify's `FastifyRequest` interface once in a `types.d.ts` file: `declare module 'fastify' { interface FastifyRequest { userId?: string; userEmail?: string; userRole?: 'USER' | 'ADMIN'; } }`. This eliminates all `as any` access patterns across 20+ files

### `noImplicitAny` Disabled in API tsconfig

- Issue: `apps/api/tsconfig.json` explicitly sets `"noImplicitAny": false`, `"noUnusedParameters": false`, `"noUnusedLocals": false` — overriding the stricter base config in `tsconfig.base.json`
- Files: `apps/api/tsconfig.json:8-10`, `tsconfig.base.json:17-18`
- Impact: Functions with untyped parameters accept any value without error. Combined with the `as any` pervasiveness, this means type errors can appear at runtime instead of build time
- Fix approach: Re-enable `noImplicitAny: true` in `apps/api/tsconfig.json` and fix resulting type errors. Begin with middleware files, then routes

### `automaticLogoff.ts` — In-Memory Session Store with Unbounded Growth

- Issue: `apps/api/src/middleware/automaticLogoff.ts` uses a `SessionStore` object (`sessions: SessionStore = {}`) that lives in process memory. Sessions are only cleaned up every 60 seconds. The session ID is derived from the first 16 chars of the JWT + user-agent + IP — collisions are possible
- Files: `apps/api/src/middleware/automaticLogoff.ts:23-197`
- Impact: Memory grows unboundedly until cleanup. Under load (1000 concurrent users), this store can consume significant heap. Session deduplication is not guaranteed. In multi-process deployments (k8s), each pod has its own store, breaking session tracking
- Fix approach: Replace in-memory store with Redis-backed session store for production. Until then, remove the middleware entirely and rely on JWT expiry (15m access tokens) for session management, which already handles automatic logoff

### Notification Service — Email Not Implemented (Stub)

- Issue: `apps/api/src/services/notificationService.ts:185-197` contains `console.log()` instead of actual email delivery. All HIPAA breach notifications, account deletion confirmations, and GDPR export notifications are logged to stdout only
- Files: `apps/api/src/services/notificationService.ts:185-220`
- Impact: Breach notification deadlines (72 hours for GDPR, 60 days for HIPAA) cannot be met if the email system is a stub. Account deletion confirmations don't actually reach users
- Fix approach: Integrate a transactional email provider (SendGrid, AWS SES, Resend). The stub comment references nodemailer — that implementation is partially drafted in comments at line 199-225. An `EMAIL_FROM` and `SMTP_*` or `SENDGRID_API_KEY` env var needs to be added

### RevenueCat API Keys — Placeholder Values in Mobile Source

- Issue: `apps/mobile/src/store/subscriptionStore.ts:7-9` contains hardcoded placeholder keys: `'appl_REVENUECAT_PUBLIC_KEY'` and `'goog_REVENUECAT_PUBLIC_KEY'`
- Files: `apps/mobile/src/store/subscriptionStore.ts:7-10`
- Impact: The entire subscription/monetization system is non-functional. Premium feature gating fails silently
- Fix approach: Replace with actual RevenueCat project API keys from the RevenueCat dashboard. These are public keys (safe to commit) but must be real values before App Store submission

---

## KNOWN BUGS

### CORS Open When `CORS_ORIGIN` is Not Set

- Symptoms: When `CORS_ORIGIN` environment variable is empty or unset, `allowedOrigins` resolves to `[]`, and the condition `if (!origin || allowedOrigins.includes(origin))` passes for requests with no `origin` header (including all same-origin and server-to-server requests), but also silently blocks all browser cross-origin requests instead of failing loudly
- Files: `apps/api/src/app.ts:200-210`
- Trigger: Deploy without `CORS_ORIGIN` set in production environment
- Workaround: Set `CORS_ORIGIN` in Doppler before deployment. The `.env.example` shows the correct format. Without it, the mobile app (which runs on localhost in dev) would be blocked

### Audit Log Skipped When PHI List is Empty

- Symptoms: The `GET /labs` and `GET /labs/trends` endpoints only create an audit log `if (reports.length > 0)` and `if (allMarkers.length > 0)`. A user with no data generates no audit record, but access was still attempted
- Files: `apps/api/src/routes/labs.ts:43`, `apps/api/src/routes/labs.ts:149`
- Trigger: New user with no lab data accesses `/labs` — no audit log created
- Workaround: None currently. While low-risk for empty results, HIPAA auditing requires logging access attempts, not just successful data retrievals

### Prisma Encryption Middleware — Decryption Silently Returns `[DECRYPTION_FAILED]`

- Symptoms: When encrypted data is corrupted or the `ENCRYPTION_KEY` is rotated without re-encrypting existing records, the Prisma decryption middleware at `apps/api/src/middleware/encryption.ts:202-205` replaces the field value with the literal string `'[DECRYPTION_FAILED]'` and continues. The API response contains this sentinel string instead of throwing
- Files: `apps/api/src/middleware/encryption.ts:188-207`
- Trigger: Key rotation without re-encrypting all records; database corruption; wrong key version
- Workaround: Monitor for `[DECRYPTION_FAILED]` strings in API responses. A key rotation script exists at `scripts/rotate-encryption-keys.sh` but must be run before changing `ENCRYPTION_KEY`

### Lab Marker `value` Field — Encryption Conflicts With Numeric Type

- Symptoms: `LabMarker.value` is a `Float` in the Prisma schema but `ENCRYPTED_FIELDS` in `apps/api/src/middleware/encryption.ts:14` includes `'value'` for `LabMarker`. After encryption, the `value` field is encrypted and stored in `value_encrypted`, but the original `Float` column remains in the schema and may hold the plaintext float
- Files: `apps/api/src/middleware/encryption.ts:14`, `db/prisma/schema.prisma:196-216`
- Trigger: Every lab marker write and read
- Workaround: The `CLEAR_PLAINTEXT_FIELDS` map does NOT include `LabMarker.value` (it's a required `Float`, can't be nulled), meaning plaintext values remain alongside encrypted ones. This undermines the encryption goal for the most sensitive biomarker field

---

## SECURITY CONSIDERATIONS

### S3 Content-Type Not Validated Server-Side

- Risk: The `PresignUploadSchema` in `packages/shared/src/schemas/labs.ts:24` validates content type as `application/pdf|image/(jpeg|png|webp)` at the Zod layer, but this is client-provided. Nothing prevents a client from requesting a presigned URL with `contentType: 'application/pdf'` then uploading a `.exe` or `.html` file
- Files: `packages/shared/src/schemas/labs.ts:22-25`, `apps/api/src/utils/s3.ts:37-53`
- Current mitigation: Client-side Zod schema validation only. S3 `ContentType` field in `PutObjectCommand` is set from client input without server verification
- Recommendations: After upload, trigger a server-side MIME type check using the file's magic bytes (or use S3 Lambda trigger). Add `Content-Type: application/pdf` enforcement to the `PutObjectCommand` rather than trusting client-provided type

### Session ID Derived From JWT Prefix — Predictable

- Risk: `apps/api/src/middleware/automaticLogoff.ts:213` constructs session IDs as `${token.substring(0, 16)}:${userAgent}:${ipAddress}`. JWT tokens have a predictable header structure; the first 16 chars of a JWT are always the base64-encoded header, which may be identical across tokens signed with the same algorithm
- Files: `apps/api/src/middleware/automaticLogoff.ts:205-218`
- Current mitigation: This middleware is optional and JWT expiry provides actual session timeout. The session store is not security-critical
- Recommendations: Use a cryptographically random session identifier or derive it from the full token hash

### `X-Forwarded-For` Header — IP Spoofing Risk in Audit Logs

- Risk: `apps/api/src/middleware/auditLog.ts:89-94` and `apps/api/src/middleware/automaticLogoff.ts:242-248` extract client IP from `X-Forwarded-For` header first. This header is trivially spoofable if no trusted proxy is configured
- Files: `apps/api/src/middleware/auditLog.ts:89-94`, `apps/api/src/utils/s3.ts` (indirectly)
- Current mitigation: Fastify's `request.ip` is used as fallback, but the forwarded header takes priority
- Recommendations: Configure Fastify's `trustProxy` setting to only trust IPs of known load balancers/CDN egress nodes. In k8s with Cloudflare, whitelist Cloudflare's IP ranges

### CORS Allows Same-Origin Requests Without `Origin` Header

- Risk: `apps/api/src/app.ts:203` allows all requests where `!origin` — meaning any request without an `Origin` header bypasses the allowlist. This includes all server-to-server, cURL, and Postman requests
- Files: `apps/api/src/app.ts:200-210`
- Current mitigation: Authentication via JWT still applies to protected routes. CORS bypass only affects preflight checks, not actual auth
- Recommendations: For a pure API (no browser-direct usage), consider requiring an `X-API-Client` header and treating missing `Origin` as suspicious

---

## PERFORMANCE BOTTLENECKS

### `/labs/trends` — Unbounded Full Table Scan

- Problem: `apps/api/src/routes/labs.ts:131-146` fetches ALL lab markers for a user with no `take` limit, then groups and sorts in JavaScript memory
- Files: `apps/api/src/routes/labs.ts:131-180`
- Cause: `prisma.labMarker.findMany({ where: { userId } })` with no `take` clause. O(n) in-memory grouping loop follows
- Improvement path: Add `take: 1000` as a hard cap. Move grouping to a SQL `GROUP BY name` query with `MAX(recordedAt)`. Add response caching with a 5-minute TTL. Endpoint currently rated at 500ms+ with 20 reports and 50 markers each

### Database Metrics Loop Uses `console.warn` and `console.error`

- Problem: `db/src/index.ts:30-43` runs a `setInterval` every 30 seconds in production that calls `console.warn` and `console.error` instead of the structured Pino logger
- Files: `db/src/index.ts:30-43`
- Cause: The `prisma` singleton is in the `@biopoint/db` package which doesn't have access to the Fastify logger instance
- Improvement path: Pass a logger reference to the db package, or emit a structured event that the API server can log via Pino

### Encryption Overhead on Every PHI Write/Read

- Problem: AES-256-GCM encryption via `apps/api/src/middleware/encryption.ts` runs on every Prisma read and write for 6 models (Profile, LabMarker, LabReport, DailyLog, StackItem, ProgressPhoto). Each encrypt/decrypt adds ~34ms per field
- Files: `apps/api/src/middleware/encryption.ts:40-77`, `apps/api/src/utils/encryption.ts:47-72`
- Cause: Synchronous-style encryption operations on every database operation with no field-level caching
- Improvement path: Cache decrypted values in a short-lived LRU cache keyed by `entityId + fieldName`. Batch encryption for bulk operations. The 34ms target is already met per the test report; the concern is additive overhead when multiple encrypted fields are read in one request

---

## FRAGILE AREAS

### Prisma `$use` Middleware — Deprecated in Prisma 5

- Files: `apps/api/src/middleware/encryption.ts:40-77`, `db/src/index.ts`
- Why fragile: Prisma 5.x marks `$use` as deprecated in favor of Prisma Client Extensions. The encryption middleware uses 4 separate `$use` calls. Any Prisma version upgrade to 6.x will require rewriting the entire encryption layer
- Safe modification: Do not upgrade Prisma past 5.22.0 (current version) without first migrating to Prisma Client Extensions. Test encryption round-trips after any Prisma update
- Test coverage: `apps/api/src/__tests__/encryption.test.ts` covers basic round-trips but not Prisma middleware integration

### In-Memory Rate Limit Store — Lost on Restart

- Files: `apps/api/src/middleware/rateLimit.ts:67-103`
- Why fragile: `InMemoryRateLimitStore` and `InMemoryAccountLockoutStore` hold state only in process memory. Pod restarts, crashes, or k8s rolling deployments reset all rate limit counters and account lockout state. An attacker can bypass lockout by triggering a pod restart
- Safe modification: This store is intentionally used "for tests" per the comment, but it's also the active store in production (no Redis integration). Never increase lockout thresholds without first implementing a persistent store
- Test coverage: 3 test files in `__tests__/security/` exercise rate limiting logic against the in-memory store

### `dataIntegrity.ts` — Checksums Not Wired to Schema

- Files: `apps/api/src/utils/dataIntegrity.ts`
- Why fragile: The data integrity checksum system is fully implemented (SHA-256 per record) but the corresponding `data_integrity_checksum` and `data_integrity_version` columns do not exist in `db/prisma/schema.prisma`. The utility is dead code
- Safe modification: Do not call `calculateChecksum()` in production code without first adding the migration. Do not add the migration without testing the verification flow end to end
- Test coverage: None for this utility

### `automaticLogoff.ts` — `getStats()` Bug

- Files: `apps/api/src/middleware/automaticLogoff.ts:179-196`
- Why fragile: `getStats()` at line 188 calls `this.isSessionExpired(s.userId)` instead of `this.isSessionExpired(sessionId)`. It passes the `userId` (not the session key) to a method that looks up by session key, returning `true` for all sessions (since no session exists keyed by userId). The `expiredSessions` count is always equal to `totalSessions`
- Safe modification: Fix the bug before using `getStats()` for monitoring or alerting

---

## SCALING LIMITS

### Neon Serverless — Default 5-Connection Pool

- Current capacity: 5 concurrent database connections (default Prisma + Neon)
- Limit: Connection errors begin at ~50 concurrent API requests (each request may hold a connection for multiple queries)
- Scaling path: Add `?connection_limit=20&pool_timeout=15` to `DATABASE_URL`. For production scale beyond 500 concurrent users, use PgBouncer or Neon's built-in connection pooler (enabled at the connection string level). The schema comment at `db/prisma/schema.prisma:10-12` documents the intent but it is not implemented

### S3 Presigned URL Revocation — Full Table Scan

- Current capacity: The `checkUrlRevocation()` function queries `prisma.revokedUrl.findUnique({ where: { url } })`. The `RevokedUrl` table has a `@@index([url])` index so individual lookups are fast, but the `logDownloadAttempt` and `detectSuspiciousActivity` calls run on EVERY lab listing, generating 3 database writes per report returned in the `/labs` list endpoint
- Limit: A user with 50 lab reports triggers 150 additional database writes per `/labs` request
- Scaling path: Batch the download log writes; use an async queue. Skip `detectSuspiciousActivity` for normal single-user access patterns

---

## DEPENDENCIES AT RISK

### `react-native-purchases` — 2 Major Versions Behind

- Risk: `apps/mobile/package.json` specifies `^9.6.13`. Current version is 11.x. Version 9.x may have unpatched payment security vulnerabilities. App Store review requires current SDKs for subscription products
- Impact: App Store rejection risk; potential payment processing issues
- Migration plan: Upgrade to RevenueCat SDK v11 following their migration guide. API is backward-compatible for basic purchase flows

### `@google/generative-ai` v0.24.1 — Tied to Standard API Without BAA

- Risk: The package itself is current, but using it for PHI analysis without a BAA is the compliance violation. The standard Gemini API (`generativelanguage.googleapis.com`) has no HIPAA BAA path
- Impact: Entire AI analysis feature is non-compliant
- Migration plan: Replace with `@google-cloud/aiplatform` (Vertex AI) which supports HIPAA BAA under Google Cloud's standard agreement. Requires GCP project setup and service account credentials instead of an API key

### `prisma` v5.22.0 — `$use` Deprecated

- Risk: The encryption middleware in `apps/api/src/middleware/encryption.ts` uses 4 `prisma.$use()` calls, which are deprecated in Prisma 5 and removed in Prisma 6
- Impact: Upgrading to Prisma 6 breaks the entire PHI encryption layer without a rewrite
- Migration plan: Rewrite encryption as a Prisma Client Extension using the `query` extension point before any Prisma upgrade. Do not bump Prisma past 5.x without completing this migration

---

## MISSING CRITICAL FEATURES

### Real Email Delivery for Compliance Notifications

- Problem: HIPAA breach notifications (72-hour window for GDPR, 60-day for HIPAA) and GDPR deletion confirmations are never sent. The notification service stubs to `console.log()`
- Blocks: HIPAA breach notification compliance (§164.404), GDPR Article 33 72-hour reporting, account deletion UX
- Files: `apps/api/src/services/notificationService.ts:185-197`

### Gemini AI Feature Gate

- Problem: The lab report AI analysis endpoint (`POST /labs/:id/analyze`) calls Google Gemini without a BAA. There is no feature flag to disable it in production
- Blocks: HIPAA compliance (any user who triggers analysis creates a violation)
- Files: `apps/api/src/routes/labs.ts`, `apps/api/src/services/analysis.ts`

### Production CORS_ORIGIN Configuration

- Problem: If `CORS_ORIGIN` is not set in the production environment (Doppler), all browser cross-origin requests are blocked. The mobile app (React Native) is not browser-based so this mainly affects web admin interfaces, but it must be explicitly configured
- Blocks: Any future web dashboard or admin UI
- Files: `apps/api/src/app.ts:200-210`

---

## TEST COVERAGE GAPS

### API Route Handlers — Partial Coverage

- What's not tested: Full happy-path and error-path tests for `fasting.ts` (499 LOC), `nutrition.ts` (328 LOC), `compliance.ts` (374 LOC), `community.ts`, `admin-s3.ts` (394 LOC), `research.ts`, and `photos.ts`
- Files: `apps/api/src/routes/fasting.ts`, `apps/api/src/routes/nutrition.ts`, `apps/api/src/routes/compliance.ts`, `apps/api/src/routes/admin-s3.ts`
- Risk: Regression bugs in these routes would not be caught by CI
- Priority: High — these routes include PHI-handling photo upload and HIPAA compliance management endpoints

### Mobile Components — Minimal Coverage

- What's not tested: 1,728-line theme (`apps/mobile/src/theme/index.ts`), all nutrition components (`FastingView`, `AddMealModal`, `FoodLogView`, `FoodAnalysisModal`), subscription store, state management
- Files: `apps/mobile/src/components/nutrition/`, `apps/mobile/src/store/`
- Risk: UI regressions undetected; subscription flow broken silently
- Priority: Medium before App Store launch

### Error Handling and Edge Cases — 30% Coverage

- What's not tested: Database connection failures, S3 timeout handling, Gemini API errors, partial write failures during audit logging, network timeouts in the mobile service layer
- Files: `apps/api/src/middleware/errorHandler.ts`, `apps/api/src/utils/s3.ts` error paths
- Risk: Production failures may produce unhandled exceptions or expose stack traces
- Priority: High — these are reliability gaps that affect uptime

### Prisma Encryption Integration — Not Tested End-to-End

- What's not tested: The full Prisma `$use` middleware chain with actual database operations. Existing tests in `apps/api/src/__tests__/encryption.test.ts` test the utility functions directly, not the middleware integration
- Files: `apps/api/src/middleware/encryption.ts`, `apps/api/src/__tests__/encryption.test.ts`
- Risk: Key rotation could silently break decryption for existing records
- Priority: High — encryption is the primary HIPAA safeguard for data at rest

---

## CURRENT RISK SCORE BREAKDOWN

| Area | Status | Risk Contribution |
|------|--------|------------------|
| Google Gemini BAA | ACTIVE VIOLATION | High |
| Vendor BAAs (Neon, Cloudflare) | NOT EXECUTED | High |
| Encryption at rest | IMPLEMENTED (partial gaps) | Low |
| CORS wildcard | FIXED | Resolved |
| JWT default secret | FIXED | Resolved |
| Auth rate limiting | IMPLEMENTED | Resolved |
| S3 URL expiry | FIXED (5 min PHI, 10 min photos) | Resolved |
| Read audit logging | IMPLEMENTED | Resolved |
| Version control | IMPLEMENTED | Resolved |
| Test coverage | 41% actual (80% target) | Medium |
| Email notifications | STUB only | Medium |
| Connection pool | CONFIG NOT WIRED | Medium |
| RevenueCat keys | PLACEHOLDER | High (blocks monetization) |

**Path to 2.0/10:** Disable Gemini endpoint + execute Neon and Cloudflare BAAs = drops remaining high-risk items. Estimated effort: 4-8 hours for Gemini gate, 1-2 weeks for BAA execution (business process, not code)

---

*Concerns audit: 2026-02-19*
