import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApiClient } from "../utils/apiClient.js";
import { setupTestDatabase, teardownTestDatabase, TestDatabase } from "../utils/testDatabase.js";
import { TestHelpers } from "../utils/testHelpers.js";
import type { ApiClient } from "../utils/apiClient.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("Input Validation Security Tests", () => {
  let apiClient: ApiClient;
  let testDb: TestDatabase;
  let authToken: string;

  beforeEach(async () => {
    apiClient = await createApiClient();
    testDb = await setupTestDatabase();

    await testDb.createTestUser({
      email: "security@example.com",
      password: "TestPassword123!",
    });

    const loginResponse = await apiClient.login({
      email: "security@example.com",
      password: "TestPassword123!",
    });

    authToken = loginResponse.body.tokens.accessToken;
  });

  afterEach(async () => {
    await apiClient.teardown();
    await teardownTestDatabase();
  });

  it("rejects invalid emails (basic injection prevention)", async () => {
    const sqlInjectionPayloads = TestHelpers.generateSqlInjectionPayloads();

    for (const payload of sqlInjectionPayloads) {
      const response = await apiClient.login({
        email: payload,
        password: "wrong",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation Error");
    }
  });

  it("validates profile update schema", async () => {
    const response = await apiClient.updateProfile(authToken, {
      heightCm: 10, // below min 50
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation Error");
  });

  it("validates daily log date format", async () => {
    const response = await apiClient.createDailyLog(authToken, {
      date: "02/03/2026",
      notes: "bad date format",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation Error");
  });

  it("validates labs presign content type", async () => {
    const response = await apiClient.makeRequest("POST", "/api/labs/presign", {
      token: authToken,
      data: { filename: "test.exe", contentType: "application/x-msdownload" },
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation Error");
  });
});
