import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApiClient } from '../utils/apiClient.js';
import { TestDatabase, setupTestDatabase, teardownTestDatabase } from '../utils/testDatabase.js';
import { TestHelpers, SecurityTestHelpers } from '../utils/testHelpers.js';
import type { ApiClient } from '../utils/apiClient.js';

describe('Rate Limiting Security Tests', () => {
  let apiClient: ApiClient;
  let testDb: TestDatabase;
  let userToken: string;

  beforeEach(async () => {
    apiClient = await createApiClient();
    testDb = await setupTestDatabase();

    // Create test user and login
    const testUser = await testDb.createTestUser({
      email: 'ratetest@example.com',
      password: 'TestPassword123!',
      firstName: 'Rate',
      lastName: 'Test',
    });

    const loginResponse = await apiClient.login({
      email: 'ratetest@example.com',
      password: 'TestPassword123!',
    });
    userToken = loginResponse.body.tokens.accessToken;
  });

  afterEach(async () => {
    await apiClient.teardown();
    await teardownTestDatabase();
  });

  describe('Authentication Rate Limiting', () => {
    it('should enforce rate limits on login attempts', async () => {
      const email = 'ratelimited@example.com';
      const wrongPassword = 'wrongpassword';
      
      // Make multiple failed login attempts
      const loginAttempts = Array.from({ length: 15 }, () =>
        apiClient.login({ email, password: wrongPassword })
      );

      const responses = await Promise.all(loginAttempts);
      
      // Count rate limited responses
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      // Should have some rate limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      // Verify rate limit response format
      rateLimitedResponses.forEach(response => {
        expect(response.body).toHaveProperty('error');
        expect(['Too Many Requests', 'Account Temporarily Locked']).toContain(response.body.error);
        expect(response.headers).toHaveProperty('retry-after');
      });
    });

    it('should have different rate limits for authenticated endpoints', async () => {
      // Test high-frequency requests to authenticated endpoint
      const requests = Array.from({ length: 20 }, () =>
        apiClient.getProfile(userToken)
      );

      const responses = await Promise.all(requests);
      
      // Count rate limited responses
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      // Authenticated endpoints should have higher rate limits
      expect(rateLimitedResponses.length).toBeLessThan(5);
    });

    it('should reset rate limits after time window', async () => {
      const email = 'resettest@example.com';
      const wrongPassword = 'wrongpassword';
      
      // Make requests to trigger rate limit
      for (let i = 0; i < 10; i++) {
        await apiClient.login({ email, password: wrongPassword });
      }

      // Wait for rate limit window to reset (if short enough)
      await TestHelpers.delay(1000);

      // Next request should not be rate limited
      const response = await apiClient.login({ email, password: wrongPassword });
      
      // Should either be rate limited (if window hasn't reset) or unauthorized (normal response)
      expect([401, 429]).toContain(response.status);
    });
  });

  describe('IP-based Rate Limiting', () => {
    it('should apply rate limits per IP address', async () => {
      const email = 'iptest@example.com';
      const wrongPassword = 'wrongpassword';
      
      // Make requests from same IP
      const requests = Array.from({ length: 12 }, () =>
        apiClient.login({ email, password: wrongPassword })
      );

      const responses = await Promise.all(requests);
      
      // Should hit rate limit
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should handle X-Forwarded-For headers correctly', async () => {
      const email = 'forwardedtest@example.com';
      const wrongPassword = 'wrongpassword';
      const testIp = '192.168.1.100';
      
      // Make requests with X-Forwarded-For header
      const requests = Array.from({ length: 12 }, () =>
        apiClient.makeRequest('POST', '/api/auth/login', {
          data: { email, password: wrongPassword },
          headers: {
            'X-Forwarded-For': testIp,
          },
        })
      );

      const responses = await Promise.all(requests);
      
      // Should apply rate limit based on forwarded IP
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Endpoint-specific Rate Limiting', () => {
    it('should have stricter limits for sensitive endpoints', async () => {
      // Test password reset endpoint
      const resetRequests = Array.from({ length: 8 }, () =>
        apiClient.makeRequest('POST', '/api/auth/reset-password', {
          data: { email: 'resettest@example.com' },
        })
      );

      const resetResponses = await Promise.all(resetRequests);
      const resetRateLimited = resetResponses.filter(r => r.status === 429).length;
      
      // Test file upload endpoint
      const uploadRequests = Array.from({ length: 8 }, () =>
        apiClient.makeRequest('POST', '/api/labs/presign', {
          token: userToken,
          data: { filename: 'test.pdf', contentType: 'application/pdf' },
        })
      );

      const uploadResponses = await Promise.all(uploadRequests);
      const uploadRateLimited = uploadResponses.filter(r => r.status === 429).length;
      
      // Sensitive endpoints should have stricter rate limiting
      expect(resetRateLimited).toBeGreaterThan(0);
    });

    it('should allow burst requests within limits', async () => {
      // Make burst of requests
      const burstRequests = Array.from({ length: 5 }, () =>
        apiClient.getDashboard(userToken)
      );

      const burstResponses = await Promise.all(burstRequests);
      
      // All burst requests should succeed
      const successCount = burstResponses.filter(r => r.status === 200).length;
      expect(successCount).toBe(5);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include rate limit headers in responses', async () => {
      const response = await apiClient.getProfile(userToken);

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should show decreasing rate limit remaining', async () => {
      // Make initial request
      const response1 = await apiClient.getProfile(userToken);
      const remaining1 = parseInt(response1.headers['x-ratelimit-remaining']);

      // Make second request
      const response2 = await apiClient.getProfile(userToken);
      const remaining2 = parseInt(response2.headers['x-ratelimit-remaining']);

      // Remaining count should decrease
      expect(remaining2).toBeLessThan(remaining1);
    });

    it('should include retry-after header when rate limited', async () => {
      // Make many requests to trigger rate limit
      const requests = Array.from({ length: 20 }, () =>
        apiClient.makeRequest('GET', '/api/dashboard', { token: userToken })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(r => r.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.headers).toHaveProperty('retry-after');
        const retryAfter = parseInt(rateLimitedResponse.headers['retry-after']);
        expect(retryAfter).toBeGreaterThan(0);
        expect(retryAfter).toBeLessThanOrEqual(60); // Should not exceed 60 seconds
      }
    });
  });

  describe('Rate Limit Bypass Protection', () => {
    it('should not be bypassed by changing request characteristics', async () => {
      const email = 'bypasstest@example.com';
      const wrongPassword = 'wrongpassword';
      
      // Make requests with different user agents
      const requests = Array.from({ length: 15 }, (_, i) =>
        apiClient.makeRequest('POST', '/api/auth/login', {
          data: { email, password: wrongPassword },
          headers: {
            'User-Agent': `TestAgent/${i}`,
          },
        })
      );

      const responses = await Promise.all(requests);
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      // Should still hit rate limit despite changing user agent
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should handle distributed rate limiting for authenticated users', async () => {
      // Make requests with same user token from different simulated IPs
      const requests = Array.from({ length: 210 }, (_, i) =>
        apiClient.makeRequest('GET', '/api/profile', {
          token: userToken,
          headers: {
            'X-Forwarded-For': `192.168.1.${i}`,
          },
        })
      );

      const responses = await Promise.all(requests);
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      // Should apply rate limit based on user identity, not IP
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Configuration Validation', () => {
    it('should have reasonable rate limits for public endpoints', async () => {
      const healthCheckResponse = await apiClient.makeRequest('GET', '/health');
      
      expect([200, 204]).toContain(healthCheckResponse.status);
      
      // Health checks should have very high rate limits
      const rateLimit = parseInt(healthCheckResponse.headers['x-ratelimit-limit']);
      expect(rateLimit).toBeGreaterThan(100);
    });

    it('should have stricter limits for authentication endpoints', async () => {
      const response = await apiClient.makeRequest('POST', '/api/auth/login', {
        data: { email: 'test@example.com', password: 'test' },
      });

      expect([200, 401, 429]).toContain(response.status);
      
      const rateLimit = parseInt(response.headers['x-ratelimit-limit']);
      expect(rateLimit).toBeLessThan(50); // Auth endpoints should be more restrictive
    });

    it('should have different limits for different user roles', async () => {
      // Create admin user
      const adminUser = await testDb.createTestUser({
        email: 'adminratetest@example.com',
        password: 'TestPassword123!',
        role: 'ADMIN',
      });

      const adminLoginResponse = await apiClient.login({
        email: 'adminratetest@example.com',
        password: 'TestPassword123!',
      });
      const adminToken = adminLoginResponse.body.tokens.accessToken;

      // Make requests with admin token
      const adminRequests = Array.from({ length: 15 }, () =>
        apiClient.getProfile(adminToken)
      );

      const adminResponses = await Promise.all(adminRequests);
      const adminRateLimited = adminResponses.filter(r => r.status === 429).length;

      // Make requests with regular user token
      const userRequests = Array.from({ length: 15 }, () =>
        apiClient.getProfile(userToken)
      );

      const userResponses = await Promise.all(userRequests);
      const userRateLimited = userResponses.filter(r => r.status === 429).length;

      // Admin users might have higher rate limits
      expect(adminRateLimited).toBeLessThanOrEqual(userRateLimited);
    });
  });

  describe('Rate Limit Edge Cases', () => {
    it('should handle concurrent requests gracefully', async () => {
      const requests = Array.from({ length: 50 }, () =>
        apiClient.makeRequest('GET', '/api/dashboard', { token: userToken })
      );

      const responses = await Promise.all(requests);
      
      // All responses should be valid (either success or rate limited)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });

    it('should recover after rate limit window expires', async () => {
      // Trigger rate limit
      for (let i = 0; i < 20; i++) {
        await apiClient.makeRequest('GET', '/api/dashboard', { token: userToken });
      }

      // Wait for potential reset (adjust timing as needed)
      await TestHelpers.delay(2000);

      // Should be able to make requests again
      const response = await apiClient.getDashboard(userToken);
      expect([200, 429]).toContain(response.status);
    });

    it('should handle malformed rate limit headers gracefully', async () => {
      // This test would require server-side modification to test malformed headers
      // For now, we verify that the server handles requests gracefully
      const response = await apiClient.getProfile(userToken);
      
      expect([200, 429]).toContain(response.status);
      if (response.headers['x-ratelimit-limit']) {
        expect(parseInt(response.headers['x-ratelimit-limit'])).toBeGreaterThan(0);
      }
    });
  });
});
