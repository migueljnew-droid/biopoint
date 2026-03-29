// Authentication utilities for load testing
import http from 'k6/http';
import { CONFIG, ENDPOINTS } from '../config.js';

export class AuthManager {
    constructor() {
        this.tokens = new Map();
        this.users = [];
    }

    // Create test users for load testing
    createTestUsers(count) {
        const users = [];
        for (let i = 0; i < count; i++) {
            const user = {
                email: `loadtest${i}@biopoint.com`,
                password: `LoadTest${i}!`,
                name: `Load Test User ${i}`
            };
            users.push(user);
        }
        return users;
    }

    // Authenticate a user and get JWT token
    async authenticateUser(user) {
        const payload = JSON.stringify({
            email: user.email,
            password: user.password
        });

        const params = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const response = http.post(
            `${CONFIG.BASE_URL}${ENDPOINTS.LOGIN}`,
            payload,
            params
        );

        if (response.status !== 200) {
            console.error(`Authentication failed for ${user.email}: ${response.status}`);
            return null;
        }

        const responseData = JSON.parse(response.body);
        const token = responseData.token;
        
        if (!token) {
            console.error(`No token received for ${user.email}`);
            return null;
        }

        return {
            token: token,
            refreshToken: responseData.refreshToken,
            expiresIn: responseData.expiresIn || 3600
        };
    }

    // Get authentication headers
    getAuthHeaders(token) {
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
    }

    // Setup authentication for multiple users
    setupAuthentication(users) {
        const authData = [];
        
        users.forEach(user => {
            const authResult = this.authenticateUser(user);
            if (authResult) {
                authData.push({
                    user: user,
                    token: authResult.token,
                    refreshToken: authResult.refreshToken
                });
            }
        });

        return authData;
    }

    // Refresh token if needed
    async refreshToken(refreshToken) {
        const payload = JSON.stringify({
            refreshToken: refreshToken
        });

        const params = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const response = http.post(
            `${CONFIG.BASE_URL}${ENDPOINTS.REFRESH}`,
            payload,
            params
        );

        if (response.status !== 200) {
            console.error(`Token refresh failed: ${response.status}`);
            return null;
        }

        const responseData = JSON.parse(response.body);
        return responseData.token;
    }

    // Validate token
    async validateToken(token) {
        const params = {
            headers: this.getAuthHeaders(token),
        };

        const response = http.get(
            `${CONFIG.BASE_URL}${ENDPOINTS.DASHBOARD}`,
            params
        );

        return response.status === 200;
    }
}

// Global auth manager instance
export const authManager = new AuthManager();

// Helper function to setup authentication for load test
export function setupLoadTestAuth(userCount = 100) {
    const users = authManager.createTestUsers(userCount);
    const authData = authManager.setupAuthentication(users);
    
    console.log(`Successfully authenticated ${authData.length} out of ${userCount} users`);
    
    return {
        users: users,
        authData: authData,
        successRate: authData.length / userCount
    };
}

// Helper function to get random authenticated user
export function getRandomAuthUser(authData) {
    if (!authData || authData.length === 0) {
        return null;
    }
    
    const randomIndex = Math.floor(Math.random() * authData.length);
    return authData[randomIndex];
}

// Helper function to make authenticated request
export function authenticatedRequest(method, url, token, data = null, params = {}) {
    const headers = authManager.getAuthHeaders(token);
    
    // Merge headers with any existing params.headers
    const requestParams = {
        ...params,
        headers: {
            ...headers,
            ...params.headers
        }
    };

    let response;
    switch (method.toLowerCase()) {
        case 'get':
            response = http.get(url, requestParams);
            break;
        case 'post':
            response = http.post(url, data, requestParams);
            break;
        case 'put':
            response = http.put(url, data, requestParams);
            break;
        case 'delete':
            response = http.del(url, data, requestParams);
            break;
        default:
            throw new Error(`Unsupported HTTP method: ${method}`);
    }

    return response;
}