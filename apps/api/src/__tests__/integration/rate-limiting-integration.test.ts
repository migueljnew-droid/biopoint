import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApiClient } from '../utils/apiClient.js';
import { TestDatabase, setupTestDatabase, teardownTestDatabase } from '../utils/testDatabase.js';
import type { ApiClient } from '../utils/apiClient.js';
import { accountLockoutConfig } from '../../middleware/rateLimit.js';

describe('Rate Limiting Integration Tests', () => {
  let apiClient: ApiClient;
  let testDb: TestDatabase;
  let userToken: string;
  const testUserEmail = 'ratelimit@example.com';
  const testUserPassword = 'TestPassword123!';

  beforeEach(async () => {
    apiClient = await createApiClient();
    testDb = await setupTestDatabase();

    // Create test user and login
    await testDb.createTestUser({
      email: testUserEmail,
      password: testUserPassword,
      firstName: 'Rate',
      lastName: 'Limit',
    });

    const loginResponse = await apiClient.login({
      email: testUserEmail,
      password: testUserPassword,
    });
    userToken = loginResponse.body.tokens.accessToken;
  });

  afterEach(async () => {
    await apiClient.teardown();
    await teardownTestDatabase();
  });

  describe('Auth Rate Limiting', () => {
    it('should enforce 5 requests per 15 minutes for login attempts', async () => {
      const email = 'authtest@example.com';
      const wrongPassword = 'wrongpassword';
      
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        const response = await apiClient.login({ email, password: wrongPassword });
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Unauthorized');
      }

      // 6th attempt should be rate limited
      const rateLimitedResponse = await apiClient.login({ email, password: wrongPassword });
      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body).toHaveProperty('error');
      expect(rateLimitedResponse.headers).toHaveProperty('retry-after');
      
      const retryAfter = parseInt(rateLimitedResponse.headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
    });

    it('should include rate limit headers in auth responses', async () => {
      const email = 'headerstest@example.com';
      const response = await apiClient.login({ email, password: 'wrongpassword' });
      
      expect(response.status).toBe(401);
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
      
      const limit = parseInt(response.headers['x-ratelimit-limit']);
      expect(limit).toBe(5); // 5 requests per 15 minutes for auth
    });
  });

  describe('PHI Endpoint Rate Limiting', () => {
    it('should enforce 200 requests per minute for profile endpoint', async () => {
      // Make 200 requests to profile endpoint
      const requests = Array.from({ length: 200 }, () =>
        apiClient.getProfile(userToken)
      );

      const responses = await Promise.all(requests);
      
      // All should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBe(200);

      // Check rate limit headers
      responses.forEach(response => {
        expect(response.headers).toHaveProperty('x-ratelimit-limit');
        expect(response.headers).toHaveProperty('x-ratelimit-remaining');
        const limit = parseInt(response.headers['x-ratelimit-limit']);
        expect(limit).toBe(200); // 200 per minute for PHI
      });
    });

    it('should apply PHI rate limits per user', async () => {
      // Create a second user
      await testDb.createTestUser({
        email: 'phiuser2@example.com',
        password: testUserPassword,
        firstName: 'PHI',
        lastName: 'User2',
      });

      const secondLoginResponse = await apiClient.login({
        email: 'phiuser2@example.com',
        password: testUserPassword,
      });
      const secondUserToken = secondLoginResponse.body.tokens.accessToken;

      // Exhaust rate limit for first user
      for (let i = 0; i < 200; i++) {
        await apiClient.getProfile(userToken);
      }

      // First user should be rate limited
      const firstUserResponse = await apiClient.getProfile(userToken);
      expect(firstUserResponse.status).toBe(429);

      // Second user should still be able to make requests
      const secondUserResponse = await apiClient.getProfile(secondUserToken);
      expect(secondUserResponse.status).toBe(200);
    });
  });

  describe('Public Endpoint Rate Limiting', () => {
    it('should enforce 1000 requests per hour for health endpoint', async () => {
      // Make multiple health check requests
      const requests = Array.from({ length: 10 }, () =>
        apiClient.makeRequest('GET', '/health')
      );

      const responses = await Promise.all(requests);
      
      // All should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBe(10);

      // Check rate limit headers
      responses.forEach(response => {
        expect(response.headers).toHaveProperty('x-ratelimit-limit');
        const limit = parseInt(response.headers['x-ratelimit-limit']);
        expect(limit).toBe(1000); // 1000 per hour for public endpoints
      });
    });
  });

  describe('Account Lockout', () => {
    it('should lock account after 5 failed login attempts', async () => {
      const email = 'lockouttest@example.com';
      
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        const response = await apiClient.login({ email, password: 'wrongpassword' });
        expect(response.status).toBe(401);
      }

      // 6th attempt should trigger account lockout
      const lockoutResponse = await apiClient.login({ email, password: 'wrongpassword' });
      expect(lockoutResponse.status).toBe(429);
      expect(lockoutResponse.body.error).toBe('Account Temporarily Locked');
      expect(lockoutResponse.headers).toHaveProperty('retry-after');
    });

    it('should reset failed attempts on successful login', async () => {
      const email = 'resetlockout@example.com';
      
      // Make 2 failed attempts
      await apiClient.login({ email, password: 'wrongpassword' });
      await apiClient.login({ email, password: 'wrongpassword' });

      // Create user and login successfully
      await testDb.createTestUser({
        email,
        password: testUserPassword,
        firstName: 'Reset',
        lastName: 'Lockout',
      });

      const successResponse = await apiClient.login({ email, password: testUserPassword });
      expect(successResponse.status).toBe(200);

      // Now make 6 more failed attempts - should lock again on the 6th attempt
      for (let i = 0; i < 6; i++) {
        const response = await apiClient.login({ email, password: 'wrongpassword' });
        if (i < 5) {
          expect(response.status).toBe(401);
        } else {
          expect(response.status).toBe(429);
          expect(response.body.error).toBe('Account Temporarily Locked');
        }
      }
    });
  });

  describe('Progressive Delays', () => {
    it('should apply progressive delays on failed login attempts', async () => {
      const email = 'delaytest@example.com';
      
      const attemptTimes: number[] = [];
      
      // Make 3 failed attempts and measure timing
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        const response = await apiClient.login({ email, password: 'wrongpassword' });
        const endTime = Date.now();
        
        attemptTimes.push(endTime - startTime);
        expect(response.status).toBe(401);
      }

      // Check that delays are progressive (each attempt takes longer).
      const expectedDelay1Ms = accountLockoutConfig.progressiveDelays[1] * 1000;
      const expectedDelay2Ms = accountLockoutConfig.progressiveDelays[2] * 1000;

      expect(attemptTimes[1]).toBeGreaterThan(attemptTimes[0]);
      expect(attemptTimes[2]).toBeGreaterThan(attemptTimes[1]);

      expect(attemptTimes[1]).toBeGreaterThanOrEqual(Math.max(expectedDelay1Ms - 30, 0));
      expect(attemptTimes[2]).toBeGreaterThanOrEqual(Math.max(expectedDelay2Ms - 30, 0));
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include comprehensive rate limit headers', async () => {
      const response = await apiClient.getProfile(userToken);
      
      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
      
      // Verify header formats
      const limit = parseInt(response.headers['x-ratelimit-limit']);
      const remaining = parseInt(response.headers['x-ratelimit-remaining']);
      const reset = response.headers['x-ratelimit-reset'];
      
      expect(limit).toBeGreaterThan(0);
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(limit);
      expect(reset).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO date format
    });

    it('should show decreasing remaining count', async () => {
      // Make initial request
      const response1 = await apiClient.getProfile(userToken);
      const remaining1 = parseInt(response1.headers['x-ratelimit-remaining']);
      
      // Make second request
      const response2 = await apiClient.getProfile(userToken);
      const remaining2 = parseInt(response2.headers['x-ratelimit-remaining']);
      
      expect(remaining2).toBeLessThan(remaining1);
    });

    it('should include retry-after header when rate limited', async () => {
      const email = 'retrytest@example.com';
      
      // Exhaust auth rate limit
      for (let i = 0; i < 6; i++) {
        await apiClient.login({ email, password: 'wrongpassword' });
      }

      // Next request should be rate limited with retry-after
      const response = await apiClient.login({ email, password: 'wrongpassword' });
      
      expect(response.status).toBe(429);
      expect(response.headers).toHaveProperty('retry-after');
      
      const retryAfter = parseInt(response.headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle concurrent requests gracefully', async () => {
      const email = 'concurrenttest@example.com';
      
      // Make many concurrent login attempts
      const concurrentAttempts = Array.from({ length: 20 }, () =>
        apiClient.login({ email, password: 'wrongpassword' })
      );

      const responses = await Promise.all(concurrentAttempts);
      
      // All responses should be valid (either 401 or 429)
      responses.forEach(response => {
        expect([401, 429]).toContain(response.status);
      });

      // Should have some rate limited responses
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should not be bypassed by changing request characteristics', async () => {
      const email = 'bypasstest@example.com';
      
      // Make requests with different headers
      const requests = Array.from({ length: 10 }, (_, i) =>
        apiClient.makeRequest('POST', '/api/auth/login', {
          data: { email, password: 'wrongpassword' },
          headers: {
            'User-Agent': `TestAgent/${i}`,
            'X-Custom-Header': `custom-${i}`,
          },
        })
      );

      const responses = await Promise.all(requests);
      
      // Should still hit rate limit despite changing headers
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('HIPAA Compliance', () => {
    it('should implement unique user identification for PHI endpoints', async () => {
      const response = await apiClient.getProfile(userToken);
      
      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      
      // PHI endpoints should have user-specific rate limits
      const limit = parseInt(response.headers['x-ratelimit-limit']);
      expect(limit).toBe(200); // 200 per user per minute for PHI
    });

    it('should implement password management with account lockout', async () => {
      const email = 'passwordmgmt@example.com';
      
      // Make 5 failed login attempts (password guessing)
      for (let i = 0; i < 5; i++) {
        const response = await apiClient.login({ email, password: `wrongpassword${i}` });
        expect(response.status).toBe(401);
      }

      // Account should be locked after 5 failed attempts
      const lockoutResponse = await apiClient.login({ email, password: 'wrongpassword5' });
      expect(lockoutResponse.status).toBe(429);
      expect(lockoutResponse.body.error).toBe('Account Temporarily Locked');
      
      // Should include retry information
      expect(lockoutResponse.headers).toHaveProperty('retry-after');
      const retryAfter = parseInt(lockoutResponse.headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
    });
  });
});
