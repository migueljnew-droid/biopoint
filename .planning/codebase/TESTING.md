# Testing Patterns

**Analysis Date:** 2026-02-19

## Test Frameworks

**API (Fastify):**
- Runner: Vitest 1.2.0
- Config: `apps/api/vitest.config.ts`
- Coverage: v8 provider
- Timeout: 120 seconds (per test and hook — for integration tests with DB setup)
- Thread mode: `singleThread: true` (prevents concurrent DB conflicts)

**Mobile (React Native):**
- Runner: Jest with `react-native` preset
- Config: `apps/mobile/jest.config.js`
- Transform: `ts-jest` for TypeScript, `babel-jest` for JS
- Testing Library: `@testing-library/react-native`
- Timeout: 30 seconds

**Run Commands:**
```bash
# API
cd apps/api
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
npm run test:security       # Security tests only (verbose)
npm run test:compliance     # HIPAA compliance tests only (verbose)
npm run test:integration    # Integration tests only (verbose)

# Mobile
cd apps/mobile
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
npm run test:security       # Security tests (--testPathPattern=security)
npm run test:integration    # Integration tests (--testPathPattern=integration)
```

---

## Test File Organization

**API:** All tests in `apps/api/src/__tests__/` (NOT co-located with source files)

```
apps/api/src/__tests__/
├── compliance/
│   └── audit-logging.test.ts       # HIPAA audit trail tests
├── integration/
│   ├── auth.test.ts                # Auth flows end-to-end
│   ├── dashboard.test.ts
│   ├── labs.test.ts
│   ├── rate-limiting-integration.test.ts
│   ├── requestTracing.test.ts
│   └── stacks.test.ts
├── middleware/
│   ├── auth.test.ts                # Unit tests for middleware functions
│   └── rateLimit.test.ts
├── mocks/
│   ├── aiService.ts                # Shared mock factories (NOT test files)
│   └── s3Service.ts
├── security/
│   ├── input-sanitization.test.ts
│   ├── input-validation.test.ts
│   ├── rate-limiting-complete.test.ts
│   ├── rate-limiting.test.ts
│   └── s3-security.test.ts
├── unit/
│   └── phi-access.test.ts          # PHI data isolation tests
├── utils/
│   ├── apiClient.ts                # Shared test API client (NOT a test file)
│   ├── testApp.ts                  # App builder helper
│   ├── testDatabase.ts             # DB setup/teardown + factory methods
│   └── testHelpers.ts              # Data generators and test utilities
├── auditIntegration.test.ts        # Root-level integration tests
├── auditLog.test.ts
├── auth.test.ts
├── cors.security.test.ts
├── encryption.test.ts
├── gdpr-compliance.test.ts
├── performance.test.ts
└── schemas.test.ts
```

**Mobile:** Tests in `apps/mobile/src/__tests__/` with separate mock folders:
```
apps/mobile/src/__tests__/
├── components.test.tsx             # All component tests in one file
├── mocks/
│   ├── react-native.js             # RN native module mocks
│   └── react-navigation.js         # Navigation mocks
└── setup.ts                        # Jest setup file
```

**Naming convention:** `*.test.ts` / `*.test.tsx` — no `.spec.*` files used.

---

## Test Structure Pattern

**API integration and middleware tests:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createApiClient } from "../utils/apiClient.js";
import { setupTestDatabase, teardownTestDatabase } from "../utils/testDatabase.js";
import { TestHelpers } from "../utils/testHelpers.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret"; // Always set at module level

describe("Feature Area Tests", () => {
    let apiClient: ApiClient;
    let testDb: TestDatabase;

    beforeEach(async () => {
        apiClient = await createApiClient();    // Spins up Fastify in-process
        testDb = await setupTestDatabase();     // Resets test DB to clean state
    });

    afterEach(async () => {
        await apiClient.teardown();             // Closes Fastify server
        await teardownTestDatabase();           // Cleans DB records
    });

    describe("POST /api/resource", () => {
        it("should do something successfully", async () => {
            const response = await apiClient.someMethod({ ... });
            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty("key", "value");
        });

        it("should return 400 for invalid input", async () => {
            const response = await apiClient.someMethod({ invalid: true });
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error", "Validation Error");
        });
    });
});
```

**API unit tests (middleware):**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@biopoint/db", () => ({     // Mock before import
    prisma: { user: { findUnique: vi.fn() } },
}));

import { prisma } from "@biopoint/db";
import { authMiddleware } from "../../middleware/auth.js";

const prismaMock = prisma as any;

describe("Middleware Tests", () => {
    let mockRequest: Partial<FastifyRequest> & { ... };
    let mockReply: Partial<FastifyReply> & { sent?: boolean };

    beforeEach(() => {
        prismaMock.user.findUnique.mockReset();

        mockRequest = {
            headers: {},
            ip: "127.0.0.1",
            id: "req-test-1",
            log: {
                debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
            },
        };

        mockReply = {
            sent: false,
            status: vi.fn().mockReturnThis(),
            send: vi.fn().mockImplementation(function () {
                mockReply.sent = true;
                return mockReply;
            }),
            header: vi.fn().mockReturnThis(),
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });
});
```

**Mobile component tests (Jest + @testing-library/react-native):**
```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

describe('ComponentName', () => {
    const mockData = { ... };

    it('should render correctly', () => {
        const { getByTestId } = render(<Component prop={mockData} />);
        expect(getByTestId('component-id')).toBeTruthy();
    });

    it('should call handler when pressed', () => {
        const onPress = jest.fn();
        const { getByText } = render(<Component onPress={onPress} />);
        fireEvent.press(getByText('Button Text'));
        expect(onPress).toHaveBeenCalledWith(mockData);
    });

    it('should handle async operations', async () => {
        const onComplete = jest.fn();
        const { getByText } = render(<Component onComplete={onComplete} />);
        fireEvent.press(getByText('Start'));
        await waitFor(() => {
            expect(onComplete).toHaveBeenCalled();
        }, { timeout: 200 });
    });
});
```

---

## Test Infrastructure

### `TestDatabase` Class (`apps/api/src/__tests__/utils/testDatabase.ts`)

Singleton that manages a separate test Postgres instance (`DATABASE_URL_TEST`, defaults to port 5433):

```typescript
const testDb = await setupTestDatabase();  // resetDatabase + return singleton

// Factory methods — all accept optional overrides
await testDb.createTestUser({ email, password?, role? });
await testDb.createTestLabReport(userId, { filename?, s3Key?, notes?, reportDate? });
await testDb.createStack({ userId, name, goal?, startDate?, items? });
await testDb.createStackItem({ stackId, name, dose, unit, frequency, ... });
await testDb.createTestDailyLog(userId, { date?, notes?, sleepHours?, ... });

// Query helpers
await testDb.getUserByEmail(email);
await testDb.getAuditLogs(userId?);         // Ordered by createdAt desc

// Cleanup (called in beforeEach/afterEach)
await testDb.cleanDatabase();               // Deletes all records in FK-safe order
await testDb.close();                       // Disconnects Prisma
```

**DB schema reset:** On first call, runs `prisma db push --force-reset`. Subsequent calls only clean data.

### `ApiClient` Class (`apps/api/src/__tests__/utils/apiClient.ts`)

Wraps Fastify's `.inject()` for in-process HTTP testing (no actual network):

```typescript
const apiClient = await createApiClient();

// Auth methods
await apiClient.register({ email, password });
await apiClient.login({ email, password });
await apiClient.refreshToken(refreshToken);
await apiClient.logout(refreshToken);

// Resource methods
await apiClient.getProfile(token);
await apiClient.updateProfile(token, data);
await apiClient.getDashboard(token);
await apiClient.getDailyLogs(token);
await apiClient.createDailyLog(token, data);
await apiClient.getLabReport(token, reportId);

// Generic request
await apiClient.makeRequest("POST", "/api/endpoint", { token?, data?, headers? });

// All methods return: { status, headers, body, text }
await apiClient.teardown();  // Close server
```

**Logger suppression:** `VITEST_DEBUG_LOGS=1` env var enables Fastify logs in tests (silent by default).

### `TestHelpers` Class (`apps/api/src/__tests__/utils/testHelpers.ts`)

Static factory methods using `@faker-js/faker`:

```typescript
TestHelpers.generateUserData(overrides?)       // { email, password: 'TestPassword123!', role }
TestHelpers.generateLabReportData(overrides?)  // { filename, s3Key, notes, reportDate }
TestHelpers.generateDailyLogData(overrides?)   // { date, notes, sleepHours, ... }
TestHelpers.generateValidToken(userId, role?)   // JWT signed with JWT_SECRET
TestHelpers.generateExpiredToken(userId, role?) // JWT with expiresIn: '-1h'
TestHelpers.generateInvalidToken()              // 'invalid.token.here'
TestHelpers.generateMalformedToken()            // 'not.a.jwt'
TestHelpers.generateSqlInjectionPayloads()      // Array of SQL injection strings
TestHelpers.generateXssPayloads()               // Array of XSS attack strings
TestHelpers.generatePathTraversalPayloads()     // Array of path traversal strings
TestHelpers.generateLargePayload(sizeInKB)      // Random string of given KB size
TestHelpers.delay(ms)                           // Promise-based sleep
```

### `SecurityTestHelpers` Class (`apps/api/src/__tests__/utils/testHelpers.ts`)

```typescript
SecurityTestHelpers.generateAuthHeaders(token?)     // Bearer token + Content-Type + X-Forwarded-For
SecurityTestHelpers.generateMalformedHeaders()       // Invalid content-type + non-IP forwarded-for
SecurityTestHelpers.generateCorsTestOrigins()        // Mix of valid and malicious origins
```

### `ComplianceTestHelpers` Class (`apps/api/src/__tests__/utils/testHelpers.ts`)

```typescript
ComplianceTestHelpers.generatePHIData()                         // Fake PHI (name, DOB, SSN, MRN)
ComplianceTestHelpers.generateAuditLogData(action, entityType)  // Audit log entry
ComplianceTestHelpers.generateHIPAABreachScenarios()            // Array of breach test cases
```

---

## Mocking

**Framework:** Vitest `vi.mock()` / `vi.fn()` for API tests; Jest `jest.fn()` / `jest.mock()` for mobile tests.

**Module mocking pattern (Vitest):**
```typescript
// Must appear BEFORE the import that uses the module
vi.mock("@biopoint/db", () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
        },
    },
}));

// Import AFTER mock declaration
import { prisma } from "@biopoint/db";
const prismaMock = prisma as any;

// In beforeEach, reset mocks
prismaMock.user.findUnique.mockReset();

// In test, configure return values
prismaMock.user.findUnique.mockResolvedValue({ id: userId, email: "...", role: "USER" });
```

**Service mock files** (not auto-imported — imported explicitly by tests that need them):
- `apps/api/src/__tests__/mocks/aiService.ts` — `mockAIService`, `createMockAIAnalysisResponse()`, `setupAIMocks()`, `resetAIMocks()`
- `apps/api/src/__tests__/mocks/s3Service.ts` — `mockS3Service`, `createMockS3UploadResponse()`, `setupS3Mocks()`, `resetS3Mocks()`

**Mobile mock files** (loaded via `setupFiles` in jest.config.js):
- `apps/mobile/src/__tests__/mocks/react-native.js` — Native module stubs
- `apps/mobile/src/__tests__/mocks/react-navigation.js` — Navigation stubs

**What to mock:**
- External services: AI (OpenAI/Gemini), S3/AWS SDK, email — use mock files
- Prisma/DB: Mock in unit tests only. Integration tests use real test DB via `TestDatabase`
- React Native native modules: Always mock via `setupFiles`

**What NOT to mock:**
- Zod schemas (test real validation)
- Auth utils like `generateAccessToken`, `hashPassword` (test real crypto)
- The Fastify server itself in integration tests (use `ApiClient.inject()`)

---

## Coverage Requirements

**API (Vitest thresholds in `apps/api/vitest.config.ts`):**
```
Lines:      80%
Functions:  80%
Branches:   75%
Statements: 80%
```

**Mobile (Jest thresholds in `apps/mobile/jest.config.js`):**
```
Lines:      80%
Functions:  80%
Branches:   75%
Statements: 80%
```

**Coverage excluded:**
- `src/**/*.test.ts` — test files themselves
- `src/index.ts` — entry point
- `src/scripts/**` — one-off scripts
- `dist/**`, `node_modules/**`

**View Coverage:**
```bash
# API
npm run test:coverage     # Outputs text table + HTML to apps/api/coverage/

# Mobile
npm run test:coverage     # Outputs text table + HTML to apps/mobile/coverage/
```

---

## Test Types

### Unit Tests (`__tests__/unit/`, `__tests__/middleware/`)

Scope: Individual functions/middleware in isolation. Prisma mocked with `vi.mock`.

Focus areas:
- Middleware logic (auth, rateLimit)
- PHI data isolation (query patterns)
- Encryption/decryption utilities
- Audit log creation

### Integration Tests (`__tests__/integration/`)

Scope: Full request lifecycle through real Fastify server against test DB.

Setup: `createApiClient()` + `setupTestDatabase()` in `beforeEach`.
Teardown: `apiClient.teardown()` + `teardownTestDatabase()` in `afterEach`.

Tests verify: HTTP status codes, response body shape, DB state changes, token behavior.

### Security Tests (`__tests__/security/`)

Scope: Attack vector validation — SQL injection, XSS, path traversal, rate limiting, CORS.

Uses: `TestHelpers.generateSqlInjectionPayloads()`, `generateXssPayloads()`, `generatePathTraversalPayloads()`.

Pattern:
```typescript
it("rejects invalid emails (basic injection prevention)", async () => {
    const sqlInjectionPayloads = TestHelpers.generateSqlInjectionPayloads();
    for (const payload of sqlInjectionPayloads) {
        const response = await apiClient.login({ email: payload, password: "wrong" });
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Validation Error");
    }
});
```

### Compliance Tests (`__tests__/compliance/`)

Scope: HIPAA audit trail verification. Verify that PHI access always writes to `auditLog` table.

Pattern:
```typescript
it("should log lab report access attempts", async () => {
    const labReport = await testDb.createTestLabReport(testUser.id, { ... });
    await apiClient.getLabReport(userToken, labReport.id);

    const auditLogs = await testDb.getAuditLogs(testUser.id);
    const accessLogs = auditLogs.filter(l => l.action === "READ" && l.entityType === "LabReport");
    expect(accessLogs.length).toBeGreaterThan(0);
    expect(accessLogs[0]).toHaveProperty("entityId", labReport.id);
});
```

### Mobile Component Tests (`apps/mobile/src/__tests__/components.test.tsx`)

Single file covering all UI components. Components are inlined as simplified mock versions (not importing actual implementations) to avoid native module dependency issues.

---

## Async Testing

**API async tests:**
```typescript
// All test functions are async; Vitest handles promise resolution
it("should do async thing", async () => {
    const response = await apiClient.someMethod();
    expect(response.status).toBe(200);
});
```

**Concurrent requests (rate limit tests):**
```typescript
const loginAttempts = Array.from({ length: 15 }, () =>
    apiClient.login({ email, password: wrongPassword })
);
const responses = await Promise.all(loginAttempts);
const rateLimitedResponses = responses.filter(r => r.status === 429);
expect(rateLimitedResponses.length).toBeGreaterThan(0);
```

**Mobile waitFor:**
```typescript
await waitFor(() => {
    expect(onComplete).toHaveBeenCalled();
}, { timeout: 200 });
```

**Artificial delay:**
```typescript
await TestHelpers.delay(ms);
```

---

## Error Testing

**Expected HTTP status pattern:**
```typescript
it("should return 401 for invalid password", async () => {
    const response = await apiClient.login({ email, password: "wrong" });
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("error", "Unauthorized");
    expect(response.body.message).toContain("Invalid email or password");
});
```

**Middleware rejection pattern:**
```typescript
await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
expect(mockReply.status).toHaveBeenCalledWith(401);
expect(mockReply.send).toHaveBeenCalledWith({
    statusCode: 401,
    error: "Unauthorized",
    message: "Missing or invalid authorization header",
    requestId: "req-test-1",
});
```

**Token variants tested:**
- `TestHelpers.generateValidToken(userId)` — working JWT
- `TestHelpers.generateExpiredToken(userId)` — JWT with `expiresIn: '-1h'`
- `TestHelpers.generateInvalidToken()` — `'invalid.token.here'`
- `TestHelpers.generateMalformedToken()` — `'not.a.jwt'`

---

## Test Environment Setup

**API:** Setup file at `apps/api/src/__tests__/setupEnv.ts` (referenced in `vitest.config.ts` `setupFiles`).

**Mobile:** Setup at `apps/mobile/src/__tests__/setup.ts` (referenced in `jest.config.js` `setupFilesAfterEnv`). Native module mocks loaded via `setupFiles` (before framework setup).

**Environment variables set in tests:**
```typescript
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
// Set at module level, outside describe() blocks
```

**Test database URL:**
```
DATABASE_URL_TEST=postgresql://biopoint_test:test_password@localhost:5433/biopoint_test
```

---

*Testing analysis: 2026-02-19*
