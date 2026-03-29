import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, closeTestApp } from "../utils/testApp.js";
import { setupTestDatabase, teardownTestDatabase, TestDatabase } from "../utils/testDatabase.js";
import { generateAccessToken } from "../../utils/auth.js";
import type { FastifyInstance } from "fastify";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("Request Tracing Integration", () => {
  let app: FastifyInstance;
  let testDb: TestDatabase;
  let adminToken: string;
  let userToken: string;
  let adminUserId: string;
  let userId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    testDb = await setupTestDatabase();

    const adminUser = await testDb.createTestUser({
      email: "admin@example.com",
      password: "AdminPass123!",
      role: "ADMIN",
    });
    const regularUser = await testDb.createTestUser({
      email: "user@example.com",
      password: "UserPass123!",
      role: "USER",
    });

    adminUserId = adminUser.id;
    userId = regularUser.id;

    adminToken = generateAccessToken({
      userId: adminUser.id,
      email: adminUser.email,
      role: "ADMIN",
    });

    userToken = generateAccessToken({
      userId: regularUser.id,
      email: regularUser.email,
      role: "USER",
    });
  });

  afterAll(async () => {
    await closeTestApp(app);
    await teardownTestDatabase();
  });

  describe("Request ID Generation", () => {
    it("should generate request ID for requests without X-Request-ID header", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-request-id"]).toBeDefined();
      expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it("should use provided X-Request-ID header", async () => {
      const customRequestId = "custom-request-id-123";
      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: {
          "X-Request-ID": customRequestId,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-request-id"]).toBe(customRequestId);
    });

    it("should include request ID in error responses", async () => {
      const customRequestId = "error-test-request-id";
      const response = await app.inject({
        method: "GET",
        url: "/nonexistent-endpoint",
        headers: {
          "X-Request-ID": customRequestId,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.requestId).toBe(customRequestId);
    });
  });

  describe("Request Logging", () => {
    it("should log request details with request ID", async () => {
      const customRequestId = "logging-test-request-id";
      const logs: any[] = [];

      const originalLog = app.log.info;
      app.log.info = (obj: any, msg: string) => {
        logs.push({ obj, msg });
        return originalLog.call(app.log, obj, msg);
      };

      await app.inject({
        method: "GET",
        url: "/health",
        headers: {
          "X-Request-ID": customRequestId,
          "User-Agent": "TestClient/1.0",
        },
      });

      app.log.info = originalLog;

      const requestLog = logs.find((log) => log.msg === "Incoming request");
      expect(requestLog).toBeDefined();
      expect(requestLog.obj.reqId).toBe(customRequestId);
      expect(requestLog.obj.method).toBe("GET");
      expect(requestLog.obj.url).toBe("/health");
      expect(requestLog.obj.userAgent).toBe("TestClient/1.0");

      const responseLog = logs.find((log) => log.msg === "Request completed");
      expect(responseLog).toBeDefined();
      expect(responseLog.obj.reqId).toBe(customRequestId);
      expect(responseLog.obj.method).toBe("GET");
      expect(responseLog.obj.url).toBe("/health");
      expect(responseLog.obj.statusCode).toBe(200);
      expect(responseLog.obj.responseTime).toBeGreaterThan(0);
    });
  });

  describe("Authentication with Request Tracing", () => {
    it("should include request ID in authentication error responses", async () => {
      const customRequestId = "auth-error-test-request-id";
      const response = await app.inject({
        method: "GET",
        url: "/profile",
        headers: {
          "X-Request-ID": customRequestId,
          "Authorization": "Bearer invalid-token",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.requestId).toBe(customRequestId);
    });
  });

  describe("Admin Request Tracing Endpoints", () => {
    it("should require admin access for request tracing endpoints", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/admin/request/test-request-id/logs",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return request trace for admin users", async () => {
      const customRequestId = "admin-trace-test-request-id";

      await app.inject({
        method: "GET",
        url: "/biopoint/history",
        headers: {
          "X-Request-ID": customRequestId,
          Authorization: `Bearer ${userToken}`,
        },
      });

      const traceResponse = await app.inject({
        method: "GET",
        url: `/admin/request/${customRequestId}/logs`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(traceResponse.statusCode).toBe(200);
      const traceBody = JSON.parse(traceResponse.body);
      expect(traceBody.requestId).toBe(customRequestId);
      expect(traceBody.auditLogs).toBeDefined();
      expect(traceBody.metadata).toBeDefined();
    });

    it("should list recent requests for admin users", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/admin/requests?limit=10",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.requests).toBeDefined();
      expect(Array.isArray(body.requests)).toBe(true);
      expect(body.pagination).toBeDefined();
    });

    it("should filter requests by user ID for admin users", async () => {
      const userResponse = await app.inject({
        method: "GET",
        url: "/profile",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(userResponse.statusCode).toBe(200);

      const response = await app.inject({
        method: "GET",
        url: `/admin/requests?userId=${userId}&limit=10`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.requests).toBeDefined();
    });

    it("should return detailed system health for admin users", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/admin/health/detailed",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.timestamp).toBeDefined();
      expect(body.requests).toBeDefined();
    });
  });
});
