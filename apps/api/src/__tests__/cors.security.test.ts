import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';

describe('CORS Security Configuration', () => {
    let app: any;

    beforeEach(async () => {
        app = Fastify();
        
        // Set up test environment
        process.env.CORS_ORIGIN = 'https://app.example.com,https://admin.example.com';
        
        // Register CORS with the secure configuration
        await app.register(cors, {
            origin: (origin: string, callback: Function) => {
                const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean) || [];
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error(`CORS not allowed for origin: ${origin}`), false);
                }
            },
            credentials: true,
        });
        
        // Add a test route
        app.get('/test', async () => {
            return { message: 'test' };
        });
    });

    afterEach(async () => {
        await app.close();
        delete process.env.CORS_ORIGIN;
    });

    it('should allow requests from whitelisted origins', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/test',
            headers: {
                origin: 'https://app.example.com'
            }
        });
        
        expect(response.statusCode).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe('https://app.example.com');
        expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should allow requests from second whitelisted origin', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/test',
            headers: {
                origin: 'https://admin.example.com'
            }
        });
        
        expect(response.statusCode).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe('https://admin.example.com');
        expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should block requests from non-whitelisted origins', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/test',
            headers: {
                origin: 'https://malicious-site.com'
            }
        });
        
        expect(response.statusCode).toBe(500); // CORS error should result in 500
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should allow requests with no origin (same-origin requests)', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/test'
            // No origin header
        });
        
        expect(response.statusCode).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBeUndefined(); // No origin header means no CORS headers needed
    });

    it('should handle comma-separated origins with spaces', async () => {
        process.env.CORS_ORIGIN = 'https://app.example.com, https://admin.example.com,https://api.example.com';
        
        const origins = ['https://app.example.com', 'https://admin.example.com', 'https://api.example.com'];
        
        for (const origin of origins) {
            const response = await app.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    origin: origin
                }
            });
            
            expect(response.statusCode).toBe(200);
            expect(response.headers['access-control-allow-origin']).toBe(origin);
        }
    });

    it('should reject wildcard origin even with credentials', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/test',
            headers: {
                origin: '*'
            }
        });
        
        expect(response.statusCode).toBe(500);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should handle empty CORS_ORIGIN environment variable', async () => {
        delete process.env.CORS_ORIGIN;
        
        const response = await app.inject({
            method: 'GET',
            url: '/test',
            headers: {
                origin: 'https://any-origin.com'
            }
        });
        
        expect(response.statusCode).toBe(500); // Should block all origins when no whitelist is configured
    });
});