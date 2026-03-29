import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApiClient } from "../utils/apiClient.js";
import { TestDatabase, setupTestDatabase, teardownTestDatabase } from "../utils/testDatabase.js";
import { setupS3Mocks, resetS3Mocks } from "../mocks/s3Service.js";
import type { ApiClient } from "../utils/apiClient.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("Labs Integration Tests", () => {
  let apiClient: ApiClient;
  let testDb: TestDatabase;
  let userToken: string;
  let testUser: any;

  beforeEach(async () => {
    apiClient = await createApiClient();
    testDb = await setupTestDatabase();
    setupS3Mocks();

    testUser = await testDb.createTestUser({
      email: "labuser@example.com",
      password: "TestPassword123!",
    });

    const loginResponse = await apiClient.login({
      email: "labuser@example.com",
      password: "TestPassword123!",
    });
    userToken = loginResponse.body.tokens.accessToken;
  });

  afterEach(async () => {
    await apiClient.teardown();
    await teardownTestDatabase();
    resetS3Mocks();
  });

  describe("GET /api/labs", () => {
    it("should return user lab reports", async () => {
      await testDb.createTestLabReport(testUser.id, {
        filename: "report1.pdf",
        s3Key: "test-reports/report1.pdf",
      });
      await testDb.createTestLabReport(testUser.id, {
        filename: "report2.pdf",
        s3Key: "test-reports/report2.pdf",
      });

      const response = await apiClient.getLabReports(userToken);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty("id");
      expect(response.body[0]).toHaveProperty("filename");
    });

    it("should only return reports for the authenticated user", async () => {
      const otherUser = await testDb.createTestUser({
        email: "otheruser@example.com",
        password: "TestPassword123!",
      });
      await testDb.createTestLabReport(otherUser.id, {
        filename: "other-report.pdf",
        s3Key: "test-reports/other-report.pdf",
      });

      await testDb.createTestLabReport(testUser.id, {
        filename: "user-report.pdf",
        s3Key: "test-reports/user-report.pdf",
      });

      const response = await apiClient.getLabReports(userToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].filename).toBe("user-report.pdf");
    });
  });

  describe("POST /api/labs", () => {
    it("should create lab report", async () => {
      const response = await apiClient.createLabReport(userToken, {
        filename: "new-report.pdf",
        s3Key: "labs/test-user/new-report.pdf",
        notes: "Test lab report notes",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("filename", "new-report.pdf");
      expect(response.body).toHaveProperty("downloadUrl");
    });
  });

  describe("GET /api/labs/:id", () => {
    it("should return specific lab report", async () => {
      const labReport = await testDb.createTestLabReport(testUser.id, {
        filename: "specific-report.pdf",
        s3Key: "test-reports/specific-report.pdf",
        notes: "Test lab report notes",
      });

      const response = await apiClient.getLabReport(userToken, labReport.id);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id", labReport.id);
      expect(response.body).toHaveProperty("filename", "specific-report.pdf");
      expect(response.body).toHaveProperty("notes", "Test lab report notes");
      expect(response.body).toHaveProperty("downloadUrl");
    });

    it("should return 404 for non-existent report", async () => {
      const response = await apiClient.makeRequest("GET", "/api/labs/non-existent-id", {
        token: userToken,
      });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Not Found");
    });
  });

  describe("POST /api/labs/presign", () => {
    it("should return presigned upload URL", async () => {
      const response = await apiClient.makeRequest("POST", "/api/labs/presign", {
        token: userToken,
        data: { filename: "test.pdf", contentType: "application/pdf" },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("uploadUrl");
      expect(response.body).toHaveProperty("s3Key");
      expect(response.body).toHaveProperty("expiresIn");
    });
  });

  describe("DELETE /api/labs/:id", () => {
    it("should delete own lab report", async () => {
      const labReport = await testDb.createTestLabReport(testUser.id, {
        filename: "delete-me.pdf",
        s3Key: "test-reports/delete-me.pdf",
      });

      const response = await apiClient.deleteLabReport(userToken, labReport.id);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
    });
  });
});
