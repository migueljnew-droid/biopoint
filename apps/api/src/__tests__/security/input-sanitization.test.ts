import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApiClient } from "../utils/apiClient.js";
import { setupTestDatabase, teardownTestDatabase, TestDatabase } from "../utils/testDatabase.js";
import { TestHelpers } from "../utils/testHelpers.js";
import type { ApiClient } from "../utils/apiClient.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("Input Sanitization Tests", () => {
  let apiClient: ApiClient;
  let testDb: TestDatabase;
  let authToken: string;

  beforeEach(async () => {
    apiClient = await createApiClient();
    testDb = await setupTestDatabase();

    await testDb.createTestUser({
      email: "sanitize@example.com",
      password: "TestPassword123!",
    });

    const loginResponse = await apiClient.login({
      email: "sanitize@example.com",
      password: "TestPassword123!",
    });

    authToken = loginResponse.body.tokens.accessToken;
  });

  afterEach(async () => {
    await apiClient.teardown();
    await teardownTestDatabase();
  });

  it("should sanitize XSS payloads in profile updates", async () => {
    const payloads = TestHelpers.generateXssPayloads();

    for (const payload of payloads) {
      const response = await apiClient.updateProfile(authToken, {
        dietStyle: payload,
        currentInterventions: payload,
      });

      if (response.status === 200) {
        expect(response.body.dietStyle || "").not.toContain("<script>");
        expect(response.body.currentInterventions || "").not.toContain("<script>");
      }
    }
  });

  it("should sanitize XSS payloads in daily logs", async () => {
    const payloads = TestHelpers.generateXssPayloads();

    for (const payload of payloads) {
      const response = await apiClient.createDailyLog(authToken, {
        date: new Date().toISOString().slice(0, 10),
        notes: payload,
      });

      if (response.status === 200) {
        expect(response.body.notes || "").not.toContain("<script>");
      }
    }
  });
});
