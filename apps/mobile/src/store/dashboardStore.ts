import { create } from 'zustand';
import { api } from '../services/api';

interface BioPointBreakdown {
    sleep: number;
    energy: number;
    focus: number;
    mood: number;
    compliance: number;
    fasting: number;
    nutrition: number;
}

interface DailyLog {
    id: string;
    date: string;
    weightKg: number | null;
    sleepHours: number | null;
    sleepQuality: number | null;
    energyLevel: number | null;
    focusLevel: number | null;
    moodLevel: number | null;
    notes: string | null;
}

interface DashboardState {
    bioPointScore: { score: number; breakdown: BioPointBreakdown; date: string } | null;
    todayLog: DailyLog | null;
    recentLogs: DailyLog[];
    scoreHistory: { date: string; score: number }[];
    weeklyTrend: number | null;
    activeFasting: {
        id: string;
        protocolName: string;
        startedAt: string;
        targetEndAt: string;
    } | null;
    todayNutrition: {
        totalCalories: number;
        mealCount: number;
    } | null;
    isLoading: boolean;
    error: string | null;

    fetchDashboard: () => Promise<void>;
    logToday: (data: Partial<DailyLog>) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
    bioPointScore: null,
    todayLog: null,
    recentLogs: [],
    scoreHistory: [],
    weeklyTrend: null,
    activeFasting: null,
    todayNutrition: null,
    isLoading: false,
    error: null,

    fetchDashboard: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get('/dashboard');
            set({
                bioPointScore: response.data.bioPointScore,
                todayLog: response.data.todayLog,
                recentLogs: response.data.recentLogs,
                scoreHistory: response.data.scoreHistory,
                weeklyTrend: response.data.weeklyTrend,
                activeFasting: response.data.activeFasting,
                todayNutrition: response.data.todayNutrition,
                isLoading: false,
            });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || 'Failed to fetch dashboard',
                isLoading: false,
            });
        }
    },

    logToday: async (data) => {
        set({ isLoading: true, error: null });
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await api.post('/logs', { date: today, ...data });
            set(() => ({
                todayLog: response.data,
                isLoading: false,
            }));
            // Re-fetch to get updated score
            const dashResponse = await api.get('/dashboard');
            set({
                bioPointScore: dashResponse.data.bioPointScore,
                recentLogs: dashResponse.data.recentLogs,
                weeklyTrend: dashResponse.data.weeklyTrend,
            });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || 'Failed to log',
                isLoading: false,
            });
        }
    },
}));
