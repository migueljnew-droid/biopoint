import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApiClient } from "../utils/apiClient.js";
import { TestDatabase, setupTestDatabase, teardownTestDatabase } from "../utils/testDatabase.js";
import type { ApiClient } from "../utils/apiClient.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("HIPAA Compliance Audit Logging Tests", () => {
  let apiClient: ApiClient;
  let testDb: TestDatabase;
  let userToken: string;
  let testUser: any;

  beforeEach(async () => {
    apiClient = await createApiClient();
    testDb = await setupTestDatabase();

    testUser = await testDb.createTestUser({
      email: "audituser@example.com",
      password: "TestPassword123!",
    });

    await testDb.prisma.profile.create({
      data: { userId: testUser.id },
    });

    const loginResponse = await apiClient.login({
      email: "audituser@example.com",
      password: "TestPassword123!",
    });
    userToken = loginResponse.body.tokens.accessToken;
  });

  afterEach(async () => {
    await apiClient.teardown();
    await teardownTestDatabase();
  });

  describe("PHI Access Audit Logging", () => {
    it("should log lab report access attempts", async () => {
      const labReport = await testDb.createTestLabReport(testUser.id, {
        filename: "audit-test-report.pdf",
        s3Key: "test-reports/audit-test-report.pdf",
      });

      await apiClient.getLabReport(userToken, labReport.id);

      const auditLogs = await testDb.getAuditLogs(testUser.id);
      const accessLogs = auditLogs.filter((log) => log.action === "READ" && log.entityType === "LabReport");

      expect(accessLogs.length).toBeGreaterThan(0);
      expect(accessLogs[0]).toHaveProperty("entityId", labReport.id);
    });

    it("should log profile access attempts", async () => {
      await apiClient.getProfile(userToken);

      const auditLogs = await testDb.getAuditLogs(testUser.id);
      const profileLogs = auditLogs.filter((log) => log.action === "READ" && log.entityType === "Profile");

      expect(profileLogs.length).toBeGreaterThan(0);
    });

    it("should log daily log access attempts", async () => {
      await apiClient.createDailyLog(userToken, {
        date: new Date().toISOString().slice(0, 10),
        notes: "Test daily log notes",
      });

      await apiClient.getDailyLogs(userToken);

      const auditLogs = await testDb.getAuditLogs(testUser.id);
      const logAccessLogs = auditLogs.filter((log) => log.action === "READ" && log.entityType === "DailyLog");

      expect(logAccessLogs.length).toBeGreaterThan(0);
    });

    it("should log dashboard access attempts", async () => {
      await apiClient.getDashboard(userToken);

      const auditLogs = await testDb.getAuditLogs(testUser.id);
      const dashboardLogs = auditLogs.filter((log) => log.action === "READ" && log.entityType === "BioPointScore");

      expect(dashboardLogs.length).toBeGreaterThan(0);
    });
  });

  describe("PHI Modification Audit Logging", () => {
    it("should log lab report creation", async () => {
      const response = await apiClient.createLabReport(userToken, {
        filename: "new-report.pdf",
        s3Key: "labs/test/new-report.pdf",
      });

      expect(response.status).toBe(200);

      const auditLogs = await testDb.getAuditLogs(testUser.id);
      const createLogs = auditLogs.filter((log) => log.action === "CREATE" && log.entityType === "LabReport");

      expect(createLogs.length).toBeGreaterThan(0);
    });

    it("should log lab report deletions", async () => {
      const labReport = await testDb.createTestLabReport(testUser.id, {
        filename: "delete-me.pdf",
        s3Key: "test-reports/delete-me.pdf",
      });

      await apiClient.deleteLabReport(userToken, labReport.id);

      const auditLogs = await testDb.getAuditLogs(testUser.id);
      const deleteLogs = auditLogs.filter((log) => log.action === "DELETE" && log.entityType === "LabReport");

      expect(deleteLogs.length).toBeGreaterThan(0);
    });
  });
});
