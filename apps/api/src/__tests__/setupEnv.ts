const defaultKey = Buffer.alloc(32, 1).toString("base64");

if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = defaultKey;
}

if (!process.env.ENCRYPTION_KEY_VERSION) {
  process.env.ENCRYPTION_KEY_VERSION = "test";
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret";
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

// Ensure all Prisma clients (including @biopoint/db) point at the test DB.
// The docker-compose test database maps postgres -> localhost:5433.
process.env.DATABASE_URL_TEST =
  "postgresql://biopoint_test:test_password@localhost:5433/biopoint_test?connection_limit=50&pool_timeout=0";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

// Ensure any in-memory security state (rate limit counters, lockouts) does not leak between tests.
// Use dynamic import so env vars above are set before module evaluation.
import { beforeEach } from "vitest";

beforeEach(async () => {
  const mod = await import("../middleware/rateLimit.js");
  if (typeof mod.__testResetSecurityState === "function") {
    mod.__testResetSecurityState();
  }

  const authMod = await import("../middleware/auth.js");
  if (typeof authMod.__testResetAuthCache === "function") {
    authMod.__testResetAuthCache();
  }
});
