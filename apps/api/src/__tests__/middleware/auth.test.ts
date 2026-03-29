import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TestHelpers } from "../utils/testHelpers.js";
import { FastifyRequest, FastifyReply } from "fastify";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

vi.mock("@biopoint/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@biopoint/db";
import { authMiddleware, adminMiddleware } from "../../middleware/auth.js";

const prismaMock = vi.mocked(prisma);

describe("Authentication Middleware Tests", () => {
  let mockRequest: Partial<FastifyRequest> & { log?: any; id?: string; userId?: string; userRole?: string };
  let mockReply: Partial<FastifyReply> & { sent?: boolean };

  beforeEach(() => {
    prismaMock.user.findUnique.mockReset();

    mockRequest = {
      headers: {},
      ip: "127.0.0.1",
      id: "req-test-1",
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };

    mockReply = {
      sent: false,
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockImplementation(function () {
        mockReply.sent = true;
        return mockReply;
      }),
      header: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("authMiddleware", () => {
    it("should authenticate valid token", async () => {
      const userId = "test-user-id";
      const validToken = TestHelpers.generateValidToken(userId);

      mockRequest.headers = {
        authorization: `Bearer ${validToken}`,
      };

      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        email: "test@example.com",
        role: "USER",
      });

      await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.userId).toBe(userId);
      expect(mockRequest.userRole).toBe("USER");
    });

    it("should reject missing authorization header", async () => {
      mockRequest.headers = {};

      await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        statusCode: 401,
        error: "Unauthorized",
        message: "Missing or invalid authorization header",
        requestId: "req-test-1",
      });
    });

    it("should reject invalid token format", async () => {
      mockRequest.headers = {
        authorization: "InvalidFormat",
      };

      await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        statusCode: 401,
        error: "Unauthorized",
        message: "Missing or invalid authorization header",
        requestId: "req-test-1",
      });
    });

    it("should reject expired tokens", async () => {
      const expiredToken = TestHelpers.generateExpiredToken("test-user-id");

      mockRequest.headers = {
        authorization: `Bearer ${expiredToken}`,
      };

      await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid or expired token",
        requestId: "req-test-1",
      });
    });

    it("should reject tokens for non-existent users", async () => {
      const validToken = TestHelpers.generateValidToken("non-existent-user-id");

      mockRequest.headers = {
        authorization: `Bearer ${validToken}`,
      };

      prismaMock.user.findUnique.mockResolvedValue(null);

      await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        statusCode: 401,
        error: "Unauthorized",
        message: "User not found",
        requestId: "req-test-1",
      });
    });
  });

  describe("adminMiddleware", () => {
    it("should deny access for non-admin users", async () => {
      const validToken = TestHelpers.generateValidToken("user-id", "USER");

      mockRequest.headers = {
        authorization: `Bearer ${validToken}`,
      };

      prismaMock.user.findUnique.mockResolvedValue({
        id: "user-id",
        email: "user@example.com",
        role: "USER",
      });

      await adminMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        statusCode: 403,
        error: "Forbidden",
        message: "Admin access required",
        requestId: "req-test-1",
      });
    });
  });
});
