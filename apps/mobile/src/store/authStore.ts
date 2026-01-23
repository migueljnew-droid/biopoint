import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { api, setTokens, clearTokens, getAccessToken } from '../services/api';

interface User {
    id: string;
    email: string;
    role: 'USER' | 'ADMIN';
    onboardingComplete: boolean;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    login: (email: string, password: string) => Promise<void>;
    loginWithGoogle: (idToken: string) => Promise<void>;
    loginWithApple: (identityToken: string, fullName?: { givenName?: string | null, familyName?: string | null }) => Promise<void>;
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
                    const response = await api.post('/auth/login', { email, password });
                    const { user, tokens } = response.data;
                    await setTokens(tokens.accessToken, tokens.refreshToken);
                    set({
                        user: { ...user, onboardingComplete: user.onboardingComplete ?? false },
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error: any) {
                    set({
                        error: error.response?.data?.message || 'Login failed',
                        isLoading: false,
                    });
                    throw error;
                }
            },

            loginWithGoogle: async (idToken: string) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.post('/auth/google', { idToken });
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

            loginWithApple: async (identityToken: string, fullName?: { givenName?: string | null, familyName?: string | null }) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.post('/auth/apple', { identityToken, fullName });
                    const { user, tokens } = response.data;
                    await setTokens(tokens.accessToken, tokens.refreshToken);
                    set({
                        user: { ...user, onboardingComplete: user.onboardingComplete ?? false },
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error: any) {
                    set({
                        error: error.response?.data?.message || 'Apple Login failed',
                        isLoading: false,
                    });
                    throw error;
                }
            },

            register: async (email, password) => {
                set({ isLoading: true, error: null });
                try {
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
                    await api.post('/auth/logout', {});
                } catch {
                    // Ignore logout errors
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
