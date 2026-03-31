import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000';
if (__DEV__) console.log('[BioPoint] API_URL:', API_URL);

export const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Token storage keys
const ACCESS_TOKEN_KEY = 'biopoint_access_token';
const REFRESH_TOKEN_KEY = 'biopoint_refresh_token';

// Token management
export async function getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

// Request interceptor - add auth header
api.interceptors.request.use(
    async (config) => {
        const token = await getAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token!);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Don't try token refresh on auth endpoints — they handle their own auth
        const isAuthRoute = originalRequest.url?.startsWith('/auth/');
        if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshToken = await getRefreshToken();
                if (!refreshToken) {
                    throw new Error('No refresh token');
                }

                const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
                const { accessToken, refreshToken: newRefreshToken } = response.data.tokens;

                await setTokens(accessToken, newRefreshToken);
                processQueue(null, accessToken);

                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);
            } catch (refreshError: any) {
                processQueue(refreshError, null);
                // Only clear tokens if refresh was explicitly rejected (401/403)
                // Network errors should NOT log the user out
                const refreshStatus = refreshError?.response?.status;
                if (refreshStatus === 401 || refreshStatus === 403) {
                    await clearTokens();
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

// API Service wrapper for type-safe requests
export const apiService = {
    get: async <T>(url: string, params?: any): Promise<T> => {
        const response = await api.get(url, { params });
        return response.data;
    },

    post: async <T>(url: string, data?: any): Promise<T> => {
        const response = await api.post(url, data);
        return response.data;
    },

    put: async <T>(url: string, data?: any): Promise<T> => {
        const response = await api.put(url, data);
        return response.data;
    },

    delete: async <T>(url: string): Promise<T> => {
        const response = await api.delete(url);
        return response.data;
    },

    // For binary data (PDF exports, etc.)
    getBlob: async (url: string, params?: any): Promise<Blob> => {
        const response = await api.get(url, { 
            params,
            responseType: 'blob' 
        });
        return response.data;
    },

    // For file uploads
    upload: async <T>(url: string, formData: FormData): Promise<T> => {
        const response = await api.post(url, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    }
};
