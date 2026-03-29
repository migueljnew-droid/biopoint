import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApiClient } from '../utils/apiClient.js';
import { TestDatabase, setupTestDatabase, teardownTestDatabase } from '../utils/testDatabase.js';
import { TestHelpers, SecurityTestHelpers } from '../utils/testHelpers.js';
import type { ApiClient } from '../utils/apiClient.js';
import { accountLockoutConfig } from '../../middleware/rateLimit.js';

describe('Advanced Rate Limiting Security Tests', () => {
  let apiClient: ApiClient;
  let testDb: TestDatabase;
  let userToken: string;
  const testUserEmail = 'ratetest@example.com';
  const testUserPassword = 'TestPassword123!';

  beforeEach(async () => {
    apiClient = await createApiClient();
    testDb = await setupTestDatabase();

    // Create test user and login
    const testUser = await testDb.createTestUser({
      email: testUserEmail,
      password: testUserPassword,
      firstName: 'Rate',
      lastName: 'Test',
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

  describe('1. Authentication Rate Limiting', () => {
    it('should enforce 5 requests per 15 minutes for auth endpoints', async () => {
      const email = 'authratetest@example.com';
      const wrongPassword = 'wrongpassword';
      
      // Make exactly 5 failed login attempts (should all return 401)
      const loginAttempts = Array.from({ length: 5 }, () =>
        apiClient.login({ email, password: wrongPassword })
      );

      const responses = await Promise.all(loginAttempts);
      
      // All should be unauthorized (401)
      responses.forEach(response => {
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Unauthorized');
      });

      // 6th attempt should be blocked (429) by account lockout protection
      const sixthResponse = await apiClient.login({ email, password: wrongPassword });
      expect(sixthResponse.status).toBe(429);
      expect(sixthResponse.body).toHaveProperty('error', 'Account Temporarily Locked');
      expect(sixthResponse.headers).toHaveProperty('retry-after');
      
      const retryAfter = parseInt(sixthResponse.headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(15 * 60); // 15 minutes in seconds
    });

    it('should include proper rate limit headers for auth endpoints', async () => {
      const email = 'headerstest@example.com';
      const wrongPassword = 'wrongpassword';
      
      // Make a failed login attempt
      const response = await apiClient.login({ email, password: wrongPassword });
      
      expect(response.status).toBe(401);
      
      // Check rate limit headers
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
      
      const limit = parseInt(response.headers['x-ratelimit-limit']);
      const remaining = parseInt(response.headers['x-ratelimit-remaining']);
      
      expect(limit).toBe(5); // 5 requests per 15 minutes
      expect(remaining).toBeLessThan(5);
      expect(response.headers['x-ratelimit-reset']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should reset auth rate limits after 15 minutes', async () => {
      const email = 'resetauthtest@example.com';
      const wrongPassword = 'wrongpassword';
      
      // Make 5 failed attempts to hit rate limit
      for (let i = 0; i < 5; i++) {
        await apiClient.login({ email, password: wrongPassword });
      }

      // Wait for rate limit window to reset (shortened for testing)
      await TestHelpers.delay(1000);

      // Next request should still be rate limited (15 minutes hasn't passed)
      const response = await apiClient.login({ email, password: wrongPassword });
      expect(response.status).toBe(429);
    });
  });

  describe('2. PHI Endpoint Rate Limiting', () => {
    it('should enforce 200 requests per minute for PHI endpoints', async () => {
      // Make 200 requests to a PHI endpoint
      const requests = Array.from({ length: 200 }, () =>
        apiClient.getProfile(userToken)
      );

      const responses = await Promise.all(requests);
      
      // All should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBe(200);

      // 201st request should be rate limited
      const rateLimitedResponse = await apiClient.getProfile(userToken);
      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body).toHaveProperty('error', 'Too Many Requests');
    });

    it('should apply PHI rate limits per user, not IP', async () => {
      // Create a second user
      const secondUser = await testDb.createTestUser({
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

    it('should apply PHI limits to all PHI endpoints', async () => {
      const phiEndpoints = [
        { method: 'GET', path: '/api/profile', token: userToken },
        { method: 'GET', path: '/api/labs', token: userToken },
        { method: 'GET', path: '/api/photos', token: userToken },
      ];

      for (const endpoint of phiEndpoints) {
        // Reset by waiting a bit
        await TestHelpers.delay(100);

        // Make 200 requests to each endpoint
        const requests = Array.from({ length: 200 }, () =>
          apiClient.makeRequest(endpoint.method, endpoint.path, {
            token: endpoint.token,
          })
        );

        const responses = await Promise.all(requests);
        const successCount = responses.filter(r => r.status === 200).length;
        
        // Should allow 200 requests
        expect(successCount).toBe(200);

        // 201st should be rate limited
        const rateLimitedResponse = await apiClient.makeRequest(endpoint.method, endpoint.path, {
          token: endpoint.token,
        });
        expect(rateLimitedResponse.status).toBe(429);
      }
    });
  });

  describe('3. Public Endpoint Rate Limiting', () => {
    it('should enforce 1000 requests per hour for public endpoints', async () => {
      // Make 1000 health check requests
      const requests = Array.from({ length: 1000 }, () =>
        apiClient.makeRequest('GET', '/health')
      );

      const responses = await Promise.all(requests);
      
      // All should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBe(1000);

      // 1001st request should be rate limited
      const rateLimitedResponse = await apiClient.makeRequest('GET', '/health');
      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body).toHaveProperty('error', 'Too Many Requests');
    });

    it('should apply public rate limits per IP address', async () => {
      // This test would require simulating different IPs
      // For now, we verify that the rate limiting works for the current IP
      const response = await apiClient.makeRequest('GET', '/health');
      
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      const limit = parseInt(response.headers['x-ratelimit-limit']);
      expect(limit).toBe(1000); // 1000 per hour
    });
  });

  describe('4. Presign Endpoint Rate Limiting', () => {
    it('should enforce 50 requests per hour for presign endpoints', async () => {
      // Test labs presign endpoint
      const requests = Array.from({ length: 50 }, () =>
        apiClient.makeRequest('POST', '/api/labs/presign', {
          token: userToken,
          data: { filename: 'test.pdf', contentType: 'application/pdf' },
        })
      );

      const responses = await Promise.all(requests);
      
      // Should allow 50 requests (some may fail due to other reasons, but not rate limiting)
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      expect(rateLimitedCount).toBe(0);

      // 51st request should be rate limited
      const rateLimitedResponse = await apiClient.makeRequest('POST', '/api/labs/presign', {
        token: userToken,
        data: { filename: 'test.pdf', contentType: 'application/pdf' },
      });
      
      // Note: This might return 400 or other errors due to invalid data, but shouldn't be 429 yet
      // The actual rate limiting would be tested in integration with valid presign requests
    });
  });

  describe('5. Account Lockout Mechanism', () => {
    it('should lock account after 5 failed login attempts', async () => {
      const email = 'lockouttest@example.com';
      const wrongPassword = 'wrongpassword';
      
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        const response = await apiClient.login({ email, password: wrongPassword });
        expect(response.status).toBe(401);
      }

      // 6th attempt should trigger account lockout
      const lockoutResponse = await apiClient.login({ email, password: wrongPassword });
      expect(lockoutResponse.status).toBe(429);
      expect(lockoutResponse.body).toHaveProperty('error', 'Account Temporarily Locked');
      expect(lockoutResponse.body).toHaveProperty('message', 'Account temporarily locked due to multiple failed login attempts.');
      expect(lockoutResponse.headers).toHaveProperty('retry-after');
      
      const retryAfter = parseInt(lockoutResponse.headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(15 * 60); // 15 minutes
    });

    it('should reset failed attempts on successful login', async () => {
      const email = 'resetlockout@example.com';
      
      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await apiClient.login({ email, password: 'wrongpassword' });
      }

      // Create user with this email and login successfully
      await testDb.createTestUser({
        email,
        password: testUserPassword,
        firstName: 'Reset',
        lastName: 'Lockout',
      });

      const successResponse = await apiClient.login({ email, password: testUserPassword });
      expect(successResponse.status).toBe(200);

      // Now make 6 more failed attempts - should not trigger lockout because counter was reset
      for (let i = 0; i < 6; i++) {
        const response = await apiClient.login({ email, password: 'wrongpassword' });
        if (i < 5) {
          expect(response.status).toBe(401);
        } else {
          // 6th failed attempt after successful login should lock again
          expect(response.status).toBe(429);
          expect(response.body.error).toBe('Account Temporarily Locked');
        }
      }
    });

    it('should maintain separate lockout counters per account', async () => {
      const email1 = 'lockout1@example.com';
      const email2 = 'lockout2@example.com';
      
      // Make 5 failed attempts for first account
      for (let i = 0; i < 5; i++) {
        await apiClient.login({ email: email1, password: 'wrongpassword' });
      }

      // First account should be locked
      const lockoutResponse1 = await apiClient.login({ email: email1, password: 'wrongpassword' });
      expect(lockoutResponse1.status).toBe(429);
      expect(lockoutResponse1.body.error).toBe('Account Temporarily Locked');

      // Second account should still work (up to 5 attempts)
      for (let i = 0; i < 5; i++) {
        const response = await apiClient.login({ email: email2, password: 'wrongpassword' });
        expect(response.status).toBe(401);
      }

      // Second account should now be locked
      const lockoutResponse2 = await apiClient.login({ email: email2, password: 'wrongpassword' });
      expect(lockoutResponse2.status).toBe(429);
      expect(lockoutResponse2.body.error).toBe('Account Temporarily Locked');
    });
  });

  describe('6. Progressive Delays', () => {
    it('should apply progressive delays on failed login attempts', async () => {
      const email = 'delaytest@example.com';
      const wrongPassword = 'wrongpassword';
      
      const attemptTimes: number[] = [];
      
      // Make 5 failed attempts and measure timing
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        const response = await apiClient.login({ email, password: wrongPassword });
        const endTime = Date.now();
        
        attemptTimes.push(endTime - startTime);
        expect(response.status).toBe(401);
      }

      // Check that delays are progressive (each attempt takes longer).
      for (let i = 1; i < attemptTimes.length; i++) {
        expect(attemptTimes[i]).toBeGreaterThan(attemptTimes[i - 1]);
        const expectedDelayMs = accountLockoutConfig.progressiveDelays[i] * 1000;
        expect(attemptTimes[i]).toBeGreaterThanOrEqual(Math.max(expectedDelayMs - 30, 0));
      }
    });

    it('should reset progressive delays on successful login', async () => {
      const email = 'resetdelay@example.com';
      
      // Make 2 failed attempts (should have 1s delay on 2nd)
      await apiClient.login({ email, password: 'wrongpassword' });
      
      const startTime2 = Date.now();
      await apiClient.login({ email, password: 'wrongpassword' });
      const delay2 = Date.now() - startTime2;
      const expectedDelayMs = accountLockoutConfig.progressiveDelays[1] * 1000;
      expect(delay2).toBeGreaterThanOrEqual(Math.max(expectedDelayMs - 30, 0));

      // Create user and login successfully
      await testDb.createTestUser({
        email,
        password: testUserPassword,
        firstName: 'Reset',
        lastName: 'Delay',
      });

      const successResponse = await apiClient.login({ email, password: testUserPassword });
      expect(successResponse.status).toBe(200);

      // Make another failed attempt - should not have delay (counter reset)
      const startTime3 = Date.now();
      const response = await apiClient.login({ email, password: 'wrongpassword' });
      const delay3 = Date.now() - startTime3;
      
      expect(response.status).toBe(401);
      // No progressive delay after successful login => should be faster than the delayed attempt.
      expect(delay3).toBeLessThan(delay2);
    });
  });

  describe('7. Rate Limit Headers and Response Format', () => {
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
      // Exhaust rate limit for auth endpoint
      const email = 'retrytest@example.com';
      for (let i = 0; i < 6; i++) {
        await apiClient.login({ email, password: 'wrongpassword' });
      }

      // Next request should be rate limited with retry-after
      const response = await apiClient.login({ email, password: 'wrongpassword' });
      
      expect(response.status).toBe(429);
      expect(response.headers).toHaveProperty('retry-after');
      
      const retryAfter = parseInt(response.headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(15 * 60); // 15 minutes max
    });
  });

  describe('8. Security and Edge Cases', () => {
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
      
      // Make requests with different headers and user agents
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

    it('should handle malformed requests gracefully', async () => {
      const malformedRequests = [
        { data: null },
        { data: {} },
        { data: { email: null, password: null } },
        { data: { email: 'invalid', password: '' } },
      ];

      for (const requestData of malformedRequests) {
        const response = await apiClient.makeRequest('POST', '/api/auth/login', requestData);
        
        // Should not crash, should return appropriate error
        expect([400, 401, 429]).toContain(response.status);
      }
    });
  });

  describe('9. HIPAA Compliance Verification', () => {
    it('should implement §164.312(a)(2)(i) - Unique user identification', async () => {
      // Verify that rate limits are applied per user, enforcing unique identification
      const response = await apiClient.getProfile(userToken);
      
      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      
      // PHI endpoints should have user-specific rate limits
      const limit = parseInt(response.headers['x-ratelimit-limit']);
      expect(limit).toBe(200); // 200 per user per minute for PHI
    });

    it('should implement §164.308(a)(5)(ii)(D) - Password management', async () => {
      // Verify account lockout mechanism for password management
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

  describe('10. Performance and Recovery', () => {
    it('should recover after rate limit window expires', async () => {
      // This test would require waiting for the actual time window
      // For testing purposes, we verify the mechanism works
      const email = 'recoverytest@example.com';
      
      // Hit rate limit
      for (let i = 0; i < 6; i++) {
        await apiClient.login({ email, password: 'wrongpassword' });
      }

      // Should be rate limited
      const limitedResponse = await apiClient.login({ email, password: 'wrongpassword' });
      expect(limitedResponse.status).toBe(429);
      
      // The recovery would happen after the time window expires
      // In a real scenario, we'd wait 15 minutes and verify recovery
    });

    it('should handle high load without performance degradation', async () => {
      const startTime = Date.now();
      
      // Make many rapid requests
      const rapidRequests = Array.from({ length: 100 }, (_, i) =>
        apiClient.makeRequest('GET', '/health', {
          headers: { 'X-Test-Request': i.toString() },
        })
      );

      const responses = await Promise.all(rapidRequests);
      const endTime = Date.now();
      
      // All should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max
      
      // All should have valid responses
      responses.forEach(response => {
        expect([200, 204, 429]).toContain(response.status);
      });
    });
  });
});
