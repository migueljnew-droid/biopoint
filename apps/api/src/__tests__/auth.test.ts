import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateAccessToken, hashToken } from '../utils/auth.js';

describe('Auth Utilities', () => {
    describe('hashPassword', () => {
        it('should hash a password', async () => {
            const password = 'TestPassword123!';
            const hash = await hashPassword(password);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
            expect(hash.startsWith('$2b$')).toBe(true);
        });
    });

    describe('verifyPassword', () => {
        it('should verify correct password', async () => {
            const password = 'TestPassword123!';
            const hash = await hashPassword(password);

            const isValid = await verifyPassword(password, hash);
            expect(isValid).toBe(true);
        });

        it('should reject incorrect password', async () => {
            const hash = await hashPassword('TestPassword123!');

            const isValid = await verifyPassword('WrongPassword', hash);
            expect(isValid).toBe(false);
        });
    });

    describe('generateAccessToken', () => {
        it('should generate a JWT token', () => {
            const payload = {
                userId: 'test-user-id',
                email: 'test@example.com',
                role: 'USER' as const,
            };

            const token = generateAccessToken(payload);

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
        });
    });

    describe('hashToken', () => {
        it('should hash a token deterministically', () => {
            const token = 'test-refresh-token';

            const hash1 = hashToken(token);
            const hash2 = hashToken(token);

            expect(hash1).toBe(hash2);
            expect(hash1).not.toBe(token);
        });
    });
});
