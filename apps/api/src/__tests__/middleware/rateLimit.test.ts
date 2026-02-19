import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";
import {
  __testResetSecurityState,
  createRateLimitMiddleware,
  createAccountLockoutMiddleware,
  createProgressiveDelayMiddleware,
  recordFailedLogin,
  recordSuccessfulLogin,
  rateLimitConfigs,
  accountLockoutConfig,
} from "../../middleware/rateLimit.js";

describe("Rate Limiting Middleware", () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockLog: any;

  beforeEach(() => {
    // Clear in-memory stores when running under NODE_ENV=test.
    __testResetSecurityState();

    mockLog = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    mockRequest = {
      ip: "192.168.1.100",
      url: "/test",
      method: "GET",
      headers: {},
      log: mockLog,
      body: {},
    };

    mockReply = {
      header: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
      sent: false,
      statusCode: 200,
    };
  });

  describe("createRateLimitMiddleware", () => {
    it("should allow requests under the limit", async () => {
      const config = {
        windowMs: 60_000,
        max: 10,
        keyGenerator: (req: FastifyRequest) => `test:${req.ip}`,
      };

      const middleware = createRateLimitMiddleware(config);

      for (let i = 0; i < 5; i++) {
        await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      }

      expect(mockReply.status).not.toHaveBeenCalledWith(429);
      expect(mockReply.send).not.toHaveBeenCalledWith(
        expect.objectContaining({ error: "Too Many Requests" })
      );
      expect(mockReply.header).toHaveBeenCalledWith("X-RateLimit-Limit", 10);
    });

    it("should block requests over the limit", async () => {
      const config = {
        windowMs: 60_000,
        max: 5,
        keyGenerator: (req: FastifyRequest) => `test:${req.ip}`,
      };

      const middleware = createRateLimitMiddleware(config);

      for (let i = 0; i < 6; i++) {
        await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      }

      expect(mockReply.status).toHaveBeenCalledWith(429);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: 60,
      });
    });
  });

  describe("createAccountLockoutMiddleware", () => {
    it("should block login when account is locked", async () => {
      const identifier = "locked@example.com";
      const ip = "192.168.1.100";

      // Record enough failures to lock the account.
      for (let i = 0; i < accountLockoutConfig.maxAttempts; i++) {
        await recordFailedLogin(identifier, ip, accountLockoutConfig);
      }

      mockRequest.body = { email: identifier };

      const middleware = createAccountLockoutMiddleware(accountLockoutConfig);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(429);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Account Temporarily Locked",
        })
      );
      expect(mockReply.header).toHaveBeenCalledWith("Retry-After", expect.any(Number));
    });
  });

  describe("createProgressiveDelayMiddleware", () => {
    it("should apply progressive delays based on failed attempts", async () => {
      const identifier = "delaytest@example.com";
      const ip = "192.168.1.100";

      // Two prior failures -> next attempt should be delayed by ~2s.
      await recordFailedLogin(identifier, ip, accountLockoutConfig);
      await recordFailedLogin(identifier, ip, accountLockoutConfig);

      mockRequest.body = { email: identifier };

      const middleware = createProgressiveDelayMiddleware(accountLockoutConfig);
      const startTime = Date.now();
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      const endTime = Date.now();

      const actualDelay = endTime - startTime;
      const expectedDelayMs = accountLockoutConfig.progressiveDelays[2] * 1000;
      // Timers can overshoot under load; they should not significantly undershoot.
      expect(actualDelay).toBeGreaterThanOrEqual(Math.max(expectedDelayMs - 30, 0));
      expect(actualDelay).toBeLessThan(expectedDelayMs + 500);
    });
  });

  describe("recordSuccessfulLogin", () => {
    it("should reset failed attempts on successful login", async () => {
      const identifier = "successlogin@example.com";
      const ip = "192.168.1.100";

      await recordFailedLogin(identifier, ip, accountLockoutConfig);
      await recordFailedLogin(identifier, ip, accountLockoutConfig);

      await recordSuccessfulLogin(identifier);

      // After reset, there should be no progressive delay (attemptCount=0 -> delay=0).
      mockRequest.body = { email: identifier };
      const delayMiddleware = createProgressiveDelayMiddleware(accountLockoutConfig);
      const startTime = Date.now();
      await delayMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(150);
    });
  });

  describe("rateLimitConfigs", () => {
    it("should have correct auth configuration", () => {
      expect(rateLimitConfigs.auth.windowMs).toBe(15 * 60 * 1000);
      expect(rateLimitConfigs.auth.max).toBe(5);
      expect(typeof rateLimitConfigs.auth.keyGenerator).toBe("function");
      expect(rateLimitConfigs.auth.skipSuccessfulRequests).toBe(true);

      const request = { ip: "192.168.1.100", headers: {} } as unknown as import("fastify").FastifyRequest;
      expect(rateLimitConfigs.auth.keyGenerator(request)).toBe("auth:192.168.1.100");
    });

    it("should have correct PHI configuration", () => {
      expect(rateLimitConfigs.phi.windowMs).toBe(60 * 1000);
      expect(rateLimitConfigs.phi.max).toBe(200);
      expect(typeof rateLimitConfigs.phi.keyGenerator).toBe("function");

      const requestWithUser = { ip: "192.168.1.100", headers: {}, userId: "user123" } as unknown as import("fastify").FastifyRequest;
      expect(rateLimitConfigs.phi.keyGenerator(requestWithUser)).toBe("phi:user123:unknown");

      const requestNoUser = { ip: "192.168.1.100", headers: {} } as unknown as import("fastify").FastifyRequest;
      expect(rateLimitConfigs.phi.keyGenerator(requestNoUser)).toBe("phi:192.168.1.100:unknown");
    });
  });
});
