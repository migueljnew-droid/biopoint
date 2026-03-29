import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { setupTestDatabase, teardownTestDatabase, TestDatabase } from "../utils/testDatabase.js";
import { buildTestApp, closeTestApp } from "../utils/testApp.js";
import { generateDownloadPresignedUrl } from "../../utils/s3.js";
import { generateAccessToken } from "../../utils/auth.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("S3 Security - URL Expiry and Revocation", () => {
  let app: FastifyInstance;
  let testDb: TestDatabase;
  let userToken: string;
  let adminToken: string;

  beforeEach(async () => {
    app = await buildTestApp();
    testDb = await setupTestDatabase();

    const testUser = await testDb.createTestUser({
      email: "user@example.com",
      password: "password123",
      role: "USER",
    });
    const testAdmin = await testDb.createTestUser({
      email: "admin@example.com",
      password: "admin123",
      role: "ADMIN",
    });

    userToken = generateAccessToken({
      userId: testUser.id,
      email: testUser.email,
      role: "USER",
    });

    adminToken = generateAccessToken({
      userId: testAdmin.id,
      email: testAdmin.email,
      role: "ADMIN",
    });
  });

  afterEach(async () => {
    await closeTestApp(app);
    await teardownTestDatabase();
  });

  describe("URL Expiry Times", () => {
    it("should generate presigned URLs with correct expiry times for different content types", async () => {
      const { url: labUrl, expiresIn: labExpiresIn } = await generateDownloadPresignedUrl(
        "labs/test.pdf",
        "labs"
      );
      expect(labExpiresIn).toBe(300);
      expect(labUrl).toContain("X-Amz-Expires=300");

      const { url: photoUrl, expiresIn: photoExpiresIn } = await generateDownloadPresignedUrl(
        "photos/test.jpg",
        "photos"
      );
      expect(photoExpiresIn).toBe(600);
      expect(photoUrl).toContain("X-Amz-Expires=600");

      const { url: generalUrl, expiresIn: generalExpiresIn } = await generateDownloadPresignedUrl(
        "general/test.txt",
        "general"
      );
      expect(generalExpiresIn).toBe(1800);
      expect(generalUrl).toContain("X-Amz-Expires=1800");
    });

    it("should return correct expiry times in photo endpoints", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/photos/presign",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          filename: "test.jpg",
          contentType: "image/jpeg",
          category: "front",
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.expiresIn).toBe(600);
    });

    it("should return correct expiry times in lab endpoints", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/labs/presign",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          filename: "test.pdf",
          contentType: "application/pdf",
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.expiresIn).toBe(300);
    });
  });

  describe("URL Revocation System", () => {
    it("should allow admin to revoke an S3 URL", async () => {
      const testUrl = "https://example.com/presigned-url";

      const response = await app.inject({
        method: "POST",
        url: "/admin/s3/revoke",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          url: testUrl,
          reason: "Security incident",
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.revokedUrl.url).toBe(testUrl);
    });

    it("should prevent duplicate revocation of the same URL", async () => {
      const testUrl = "https://example.com/presigned-url";

      await app.inject({
        method: "POST",
        url: "/admin/s3/revoke",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          url: testUrl,
          reason: "Security incident",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/admin/s3/revoke",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          url: testUrl,
          reason: "Another reason",
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it("should require admin privileges to revoke URLs", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/admin/s3/revoke",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          url: "https://example.com/presigned-url",
          reason: "Security incident",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should list revoked URLs with pagination", async () => {
      const urls = [
        "https://example.com/url1",
        "https://example.com/url2",
        "https://example.com/url3",
      ];

      for (const url of urls) {
        await app.inject({
          method: "POST",
          url: "/admin/s3/revoke",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          payload: { url, reason: "Test revocation" },
        });
      }

      const response = await app.inject({
        method: "GET",
        url: "/admin/s3/revoked?limit=2",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.revokedUrls).toHaveLength(2);
      expect(data.pagination.total).toBeGreaterThanOrEqual(3);
    });
  });
});
