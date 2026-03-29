import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApiClient } from "./utils/apiClient.js";
import { TestDatabase, setupTestDatabase, teardownTestDatabase } from "./utils/testDatabase.js";
import type { ApiClient } from "./utils/apiClient.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("Performance Tests", () => {
  let apiClient: ApiClient;
  let testDb: TestDatabase;
  let authToken: string;

  const PERFORMANCE_THRESHOLDS = {
    AUTHENTICATION: 500,
    DASHBOARD_LOAD: 500,
    DATA_QUERY: 500,
  };

  beforeEach(async () => {
    apiClient = await createApiClient();
    testDb = await setupTestDatabase();

    await testDb.createTestUser({
      email: "performance@example.com",
      password: "TestPassword123!",
    });

    const loginResponse = await apiClient.login({
      email: "performance@example.com",
      password: "TestPassword123!",
    });

    authToken = loginResponse.body.tokens.accessToken;
  });

  afterEach(async () => {
    await apiClient.teardown();
    await teardownTestDatabase();
  });

  describe("Authentication Performance", () => {
    it("should authenticate users within acceptable time", async () => {
      const startTime = Date.now();

      const response = await apiClient.login({
        email: "performance@example.com",
        password: "TestPassword123!",
      });

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.AUTHENTICATION);
    });
  });

  describe("Dashboard Performance", () => {
    it("should load dashboard data within acceptable time", async () => {
      const dateStr = new Date().toISOString().slice(0, 10);
      await apiClient.createDailyLog(authToken, {
        date: dateStr,
        sleepHours: 8,
        sleepQuality: 8,
        energyLevel: 8,
        focusLevel: 7,
        moodLevel: 8,
        weightKg: 75.5,
      });

      const startTime = Date.now();
      const response = await apiClient.getDashboard(authToken);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DASHBOARD_LOAD);
    });
  });

  describe("Database Query Performance", () => {
    it("should fetch logs efficiently", async () => {
      const baseDate = new Date();
      for (let i = 0; i < 25; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - i);
        await apiClient.createDailyLog(authToken, {
          date: d.toISOString().slice(0, 10),
          sleepHours: 7,
          energyLevel: 7,
          focusLevel: 7,
          moodLevel: 7,
        });
      }

      const startTime = Date.now();
      const response = await apiClient.getDailyLogs(authToken, { limit: "30" });
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DATA_QUERY);
      expect(response.body).toHaveProperty("data");
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
