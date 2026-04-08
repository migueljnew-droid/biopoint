import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { api, setTokens, clearTokens, getAccessToken } from '../services/api';
import { supabase } from '../lib/supabase';
import type { UserResponse } from '@biopoint/shared';

interface User extends UserResponse {
    onboardingComplete: boolean;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    login: (email: string, password: string) => Promise<void>;
    loginWithGoogle: (supabaseAccessToken?: string) => Promise<void>;
    loginWithApple: (supabaseAccessToken?: string, fullName?: { givenName?: string | null, familyName?: string | null }) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    clearError: () => void;
}

// SecureStore adapter defined inline to avoid circular deps or extra files
const secureStorage = {
    getItem: async (name: string): Promise<string | null> => {
        return await SecureStore.getItemAsync(name);
    },
    setItem: async (name: string, value: string): Promise<void> => {
        await SecureStore.setItemAsync(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
        await SecureStore.deleteItemAsync(name);
    },
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,
            isLoading: true,
            error: null,

            login: async (email, password) => {
                set({ isLoading: true, error: null });
                try {
                    // Clear any stale tokens so the request interceptor doesn't
                    // attach an expired Authorization header to the login request
                    await clearTokens();
                    const response = await api.post('/auth/login', { email, password });
                    const { user, tokens } = response.data;
                    await setTokens(tokens.accessToken, tokens.refreshToken);
                    set({
                        user: { ...user, onboardingComplete: user.onboardingComplete ?? false },
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error: any) {
                    const msg = error.response?.data?.message || error.message || 'Login failed';
                    console.error('Login error:', msg, error?.response?.status);
                    set({
                        error: msg,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            loginWithGoogle: async (supabaseAccessToken?: string) => {
                // Google token already verified by Supabase in socialAuth.ts
                // Now sync user with our custom API using the Supabase session token
                set({ isLoading: true, error: null });
                try {
                    await clearTokens();
                    let accessToken = supabaseAccessToken;
                    if (!accessToken) {
                        const { data: { session } } = await supabase.auth.getSession();
                        accessToken = session?.access_token;
                    }
                    const response = await api.post('/auth/social', { provider: 'google' }, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    });
                    const { user, tokens } = response.data;
                    await setTokens(tokens.accessToken, tokens.refreshToken);
                    set({
                        user: { ...user, onboardingComplete: user.onboardingComplete ?? false },
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error: any) {
                    set({
                        error: error.response?.data?.message || 'Google Login failed',
                        isLoading: false,
                    });
                    throw error;
                }
            },

            loginWithApple: async (supabaseAccessToken?: string, fullName?: { givenName?: string | null, familyName?: string | null }) => {
                set({ isLoading: true, error: null });
                try {
                    await clearTokens();
                    let accessToken = supabaseAccessToken;
                    if (!accessToken) {
                        const { data: { session } } = await supabase.auth.getSession();
                        accessToken = session?.access_token;
                    }
                    const fullNameStr = fullName ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() : undefined;

                    // Retry up to 3 times for backend sync (handles transient failures)
                    let lastError: any;
                    for (let attempt = 0; attempt < 3; attempt++) {
                        try {
                            const response = await api.post('/auth/social', {
                                provider: 'apple',
                                fullName: fullNameStr || undefined,
                            }, {
                                headers: { Authorization: `Bearer ${accessToken}` },
                            });
                            const { user, tokens } = response.data;
                            await setTokens(tokens.accessToken, tokens.refreshToken);
                            set({
                                user: { ...user, onboardingComplete: user.onboardingComplete ?? false },
                                isAuthenticated: true,
                                isLoading: false,
                                error: null,
                            });
                            return; // Success — exit
                        } catch (err: any) {
                            lastError = err;
                            if (err.response?.status && err.response.status < 500) break;
                            if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
                        }
                    }
                    set({ error: lastError?.response?.data?.message || 'Apple Login failed', isLoading: false });
                    throw lastError;
                } catch (error: any) {
                    set({ isLoading: false });
                    throw error;
                }
            },

            register: async (email, password) => {
                set({ isLoading: true, error: null });
                try {
                    await clearTokens();
                    const response = await api.post('/auth/register', { email, password });
                    const { user, tokens } = response.data;
                    await setTokens(tokens.accessToken, tokens.refreshToken);
                    set({
                        user: { ...user, onboardingComplete: false },
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error: any) {
                    set({
                        error: error.response?.data?.message || 'Registration failed',
                        isLoading: false,
                    });
                    throw error;
                }
            },

            logout: async () => {
                try {
                    const refreshToken = await SecureStore.getItemAsync('biopoint_refresh_token');
                    if (refreshToken) {
                        await api.post('/auth/logout', { refreshToken });
                    }
                } catch {
                    // Best-effort logout — clear local state regardless
                }
                await clearTokens();
                set({ user: null, isAuthenticated: false, isLoading: false });
            },

            checkAuth: async () => {
                // If we are already authenticated from persistence, we don't need to show loading
                // But we should verify in background
                const currentAuth = get().isAuthenticated;
                if (!currentAuth) {
                    set({ isLoading: true });
                }

                try {
                    const token = await getAccessToken();
                    if (!token) {
                        set({ isAuthenticated: false, isLoading: false });
                        return;
                    }

                    // Attempt to fetch fresh user data
                    const response = await api.get('/auth/me');
                    set({
                        user: response.data,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error: any) {
                    // Only clear tokens if we get an explicit 401 Unauthorized
                    // If it's a network error, we stay logged in (offline mode)
                    if (error.response?.status === 401) {
                        await clearTokens();
                        set({ user: null, isAuthenticated: false, isLoading: false });
                    } else {
                        console.log('checkAuth failed but not 401, keeping session:', error.message);
                        set({ isLoading: false });
                    }
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => secureStorage),
            partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
        }
    )
);
