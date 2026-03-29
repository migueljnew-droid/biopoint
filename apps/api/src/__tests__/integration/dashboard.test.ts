import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApiClient } from "../utils/apiClient.js";
import { TestDatabase, setupTestDatabase, teardownTestDatabase } from "../utils/testDatabase.js";
import type { ApiClient } from "../utils/apiClient.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("Dashboard Integration Tests", () => {
  let apiClient: ApiClient;
  let testDb: TestDatabase;
  let authToken: string;
  let testUser: any;

  beforeEach(async () => {
    apiClient = await createApiClient();
    testDb = await setupTestDatabase();

    testUser = await testDb.createTestUser({
      email: "dashboard@example.com",
      password: "TestPassword123!",
    });

    const loginResponse = await apiClient.login({
      email: "dashboard@example.com",
      password: "TestPassword123!",
    });

    authToken = loginResponse.body.tokens.accessToken;
  });

  afterEach(async () => {
    await apiClient.teardown();
    await teardownTestDatabase();
  });

  describe("GET /api/dashboard", () => {
    it("should return dashboard data for authenticated user", async () => {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);

      await apiClient.createDailyLog(authToken, {
        date: dateStr,
        sleepHours: 8,
        sleepQuality: 8,
        energyLevel: 8,
        focusLevel: 7,
        moodLevel: 8,
        weightKg: 75.5,
        notes: "Great day today",
      });

      const response = await apiClient.getDashboard(authToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("bioPointScore");
      expect(response.body).toHaveProperty("todayLog");
      expect(response.body).toHaveProperty("recentLogs");
      expect(Array.isArray(response.body.recentLogs)).toBe(true);
    });

    it("should return 401 for unauthenticated requests", async () => {
      const response = await apiClient.getDashboard("invalid-token");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Unauthorized");
    });
  });

  describe("POST /api/logs", () => {
    it("should create daily log for authenticated user", async () => {
      const dailyLogData = {
        date: new Date().toISOString().slice(0, 10),
        sleepHours: 8,
        sleepQuality: 9,
        energyLevel: 7,
        focusLevel: 6,
        moodLevel: 8,
        weightKg: 75.5,
        notes: "Good sleep and energy today",
      };

      const response = await apiClient.createDailyLog(authToken, dailyLogData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("date");
      expect(response.body.sleepHours).toBe(dailyLogData.sleepHours);
      expect(response.body.energyLevel).toBe(dailyLogData.energyLevel);
    });

    it("should validate required fields", async () => {
      const response = await apiClient.createDailyLog(authToken, {
        notes: "Missing required date",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Validation Error");
    });

    it("should validate field ranges", async () => {
      const invalidData = {
        date: new Date().toISOString().slice(0, 10),
        sleepHours: 40,
        energyLevel: 12,
        focusLevel: -1,
        moodLevel: 11,
        weightKg: -50,
        notes: "Invalid ranges",
      };

      const response = await apiClient.createDailyLog(authToken, invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Validation Error");
    });

    it("should update existing log for same date", async () => {
      const dateStr = new Date().toISOString().slice(0, 10);

      await apiClient.createDailyLog(authToken, {
        date: dateStr,
        sleepHours: 7,
        energyLevel: 7,
        focusLevel: 7,
        moodLevel: 7,
      });

      const response = await apiClient.createDailyLog(authToken, {
        date: dateStr,
        sleepHours: 8,
        energyLevel: 8,
        focusLevel: 8,
        moodLevel: 8,
        notes: "Updated",
      });

      expect(response.status).toBe(200);
      expect(response.body.sleepHours).toBe(8);
      expect(response.body.notes).toBe("Updated");
    });
  });
});
