import { create } from "zustand";
import { api, setTokens, clearTokens, getAccessToken } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name?: string;
  onboardingComplete: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      clearTokens();
      const res = await api.post("/auth/login", { email, password });
      const { user, tokens } = res.data;
      setTokens(tokens.accessToken, tokens.refreshToken);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.message || "Login failed", isLoading: false });
      throw err;
    }
  },

  register: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      clearTokens();
      const res = await api.post("/auth/register", { email, password });
      const { user, tokens } = res.data;
      setTokens(tokens.accessToken, tokens.refreshToken);
      set({ user: { ...user, onboardingComplete: false }, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.message || "Registration failed", isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try { await api.post("/auth/logout", {}); } catch {}
    clearTokens();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  checkAuth: async () => {
    const token = getAccessToken();
    const refresh = typeof window !== "undefined" ? localStorage.getItem("bp_refresh") : null;
    if (!token && !refresh) {
      set({ isAuthenticated: false, isLoading: false });
      return;
    }
    try {
      const res = await api.get("/auth/me");
      set({ user: res.data, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      if (err.response?.status === 401) {
        clearTokens();
        set({ user: null, isAuthenticated: false, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    }
  },

  clearError: () => set({ error: null }),
}));
