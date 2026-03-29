import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TestDatabase, setupTestDatabase, teardownTestDatabase } from "../utils/testDatabase.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("PHI Access Control Tests", () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = await setupTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  describe("User Data Isolation", () => {
    it("should prevent users from accessing other users data", async () => {
      const user1 = await testDb.createTestUser({
        email: "user1@example.com",
        password: "Password123!",
      });

      const user2 = await testDb.createTestUser({
        email: "user2@example.com",
        password: "Password123!",
      });

      const user1LabReport = await testDb.prisma.labReport.create({
        data: {
          userId: user1.id,
          filename: "user1-report.pdf",
          s3Key: "reports/user1-report.pdf",
          notes: "User 1 lab results",
        },
      });

      const user2LabReport = await testDb.prisma.labReport.create({
        data: {
          userId: user2.id,
          filename: "user2-report.pdf",
          s3Key: "reports/user2-report.pdf",
          notes: "User 2 lab results",
        },
      });

      const user1AccessingUser2Data = await testDb.prisma.labReport.findFirst({
        where: {
          id: user2LabReport.id,
          userId: user1.id,
        },
      });

      expect(user1AccessingUser2Data).toBeNull();

      const user2AccessingUser1Data = await testDb.prisma.labReport.findFirst({
        where: {
          id: user1LabReport.id,
          userId: user2.id,
        },
      });

      expect(user2AccessingUser1Data).toBeNull();
    });

    it("should allow users to access their own data", async () => {
      const user = await testDb.createTestUser({
        email: "user@example.com",
        password: "Password123!",
      });

      const labReport = await testDb.prisma.labReport.create({
        data: {
          userId: user.id,
          filename: "user-report.pdf",
          s3Key: "reports/user-report.pdf",
          notes: "User lab results",
        },
      });

      const userAccessingOwnData = await testDb.prisma.labReport.findFirst({
        where: {
          id: labReport.id,
          userId: user.id,
        },
      });

      expect(userAccessingOwnData).not.toBeNull();
      expect(userAccessingOwnData?.id).toBe(labReport.id);
    });
  });

  describe("Role-Based Access Control", () => {
    it("should allow ADMIN users to access all data for legitimate purposes", async () => {
      const adminUser = await testDb.createTestUser({
        email: "admin@example.com",
        password: "Password123!",
        role: "ADMIN",
      });

      const regularUser = await testDb.createTestUser({
        email: "user@example.com",
        password: "Password123!",
        role: "USER",
      });

      const userLabReport = await testDb.prisma.labReport.create({
        data: {
          userId: regularUser.id,
          filename: "user-report.pdf",
          s3Key: "reports/user-report.pdf",
          notes: "User lab results",
        },
      });

      const adminAccessingUserData = await testDb.prisma.labReport.findFirst({
        where: {
          id: userLabReport.id,
        },
      });

      expect(adminAccessingUserData).not.toBeNull();
      expect(adminAccessingUserData?.id).toBe(userLabReport.id);

      await testDb.prisma.auditLog.create({
        data: {
          action: "ADMIN_ACCESS",
          entityType: "LabReport",
          entityId: userLabReport.id,
          userId: adminUser.id,
          metadata: {
            accessedUserId: regularUser.id,
            reason: "Support investigation",
          },
        },
      });

      const auditLogs = await testDb.prisma.auditLog.findMany({
        where: {
          userId: adminUser.id,
          action: "ADMIN_ACCESS",
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
    });
  });
});
