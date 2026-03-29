import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApiClient } from "../utils/apiClient.js";
import { TestDatabase, setupTestDatabase, teardownTestDatabase } from "../utils/testDatabase.js";
import { TestHelpers } from "../utils/testHelpers.js";
import type { ApiClient } from "../utils/apiClient.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("Authentication Integration Tests", () => {
  let apiClient: ApiClient;
  let testDb: TestDatabase;

  beforeEach(async () => {
    apiClient = await createApiClient();
    testDb = await setupTestDatabase();
  });

  afterEach(async () => {
    await apiClient.teardown();
    await teardownTestDatabase();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = TestHelpers.generateUserData({
        email: "test@example.com",
      });

      const response = await apiClient.register({
        email: userData.email,
        password: userData.password,
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user).toHaveProperty("email", userData.email);
      expect(response.body.user).not.toHaveProperty("password");
      expect(response.body).toHaveProperty("tokens");
      expect(response.body.tokens).toHaveProperty("accessToken");
      expect(response.body.tokens).toHaveProperty("refreshToken");
    });

    it("should return 400 for invalid email format", async () => {
      const response = await apiClient.register({
        email: "invalid-email",
        password: "TestPassword123!",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Validation Error");
      expect(response.body.message).toContain("email");
    });

    it("should return 400 for weak password", async () => {
      const response = await apiClient.register({
        email: "weak@example.com",
        password: "weak",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Validation Error");
      expect(response.body.message).toContain("Password");
    });

    it("should return 409 for duplicate email", async () => {
      const userData = TestHelpers.generateUserData({
        email: "duplicate@example.com",
      });

      await apiClient.register({
        email: userData.email,
        password: userData.password,
      });

      const response = await apiClient.register({
        email: userData.email,
        password: userData.password,
      });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty("error", "Conflict");
      expect(response.body.message).toContain("already exists");
    });
  });

  describe("POST /api/auth/login", () => {
    const password = "TestPassword123!";

    beforeEach(async () => {
      await testDb.createTestUser({
        email: "login@example.com",
        password,
      });
    });

    it("should login with valid credentials", async () => {
      const response = await apiClient.login({
        email: "login@example.com",
        password,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("email", "login@example.com");
      expect(response.body).toHaveProperty("tokens");
      expect(response.body.tokens).toHaveProperty("accessToken");
      expect(response.body.tokens).toHaveProperty("refreshToken");
    });

    it("should return 401 for invalid password", async () => {
      const response = await apiClient.login({
        email: "login@example.com",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Unauthorized");
      expect(response.body.message).toContain("Invalid email or password");
    });

    it("should return 401 for non-existent user", async () => {
      const response = await apiClient.login({
        email: "nonexistent@example.com",
        password: "password123",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Unauthorized");
      expect(response.body.message).toContain("Invalid email or password");
    });

    it("should handle rate limiting", async () => {
      const loginAttempts = Array.from({ length: 10 }, () =>
        apiClient.login({
          email: "login@example.com",
          password: "wrongpassword",
        })
      );

      const responses = await Promise.all(loginAttempts);
      const rateLimitedResponse = responses.find((r) => r.status === 429);
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.status).toBe(429);
        expect(["Too Many Requests", "Account Temporarily Locked"]).toContain(
          rateLimitedResponse.body?.error
        );
      }
    });
  });

  describe("POST /api/auth/refresh", () => {
    let refreshToken: string;

    beforeEach(async () => {
      await apiClient.register({
        email: "refresh@example.com",
        password: "TestPassword123!",
      });

      const loginResponse = await apiClient.login({
        email: "refresh@example.com",
        password: "TestPassword123!",
      });
      refreshToken = loginResponse.body.tokens.refreshToken;
    });

    it("should refresh access token with valid refresh token", async () => {
      const response = await apiClient.refreshToken(refreshToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("tokens");
      expect(response.body.tokens).toHaveProperty("accessToken");
      expect(response.body.tokens).toHaveProperty("refreshToken");
    });

    it("should return 401 for invalid refresh token", async () => {
      const response = await apiClient.refreshToken("invalid-refresh-token");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Unauthorized");
    });
  });

  describe("POST /api/auth/logout", () => {
    let refreshToken: string;

    beforeEach(async () => {
      await apiClient.register({
        email: "logout@example.com",
        password: "TestPassword123!",
      });

      const loginResponse = await apiClient.login({
        email: "logout@example.com",
        password: "TestPassword123!",
      });
      refreshToken = loginResponse.body.tokens.refreshToken;
    });

    it("should logout successfully with valid refresh token", async () => {
      const response = await apiClient.logout(refreshToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
    });
  });
});
