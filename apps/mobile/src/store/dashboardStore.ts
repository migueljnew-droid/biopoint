import { create } from 'zustand';
import { api } from '../services/api';
import { updateWidgetData } from '../services/widgetService';

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
            // Recalculate score before fetching
            await api.post('/dashboard/calculate').catch(() => {});
            const response = await api.get('/dashboard');
            const d = response.data;
            set({
                bioPointScore: d.bioPointScore,
                todayLog: d.todayLog,
                recentLogs: d.recentLogs,
                scoreHistory: d.scoreHistory,
                weeklyTrend: d.weeklyTrend,
                activeFasting: d.activeFasting,
                todayNutrition: d.todayNutrition,
                isLoading: false,
            });
            // Push to iOS widget via App Group
            updateWidgetData({
                score: d.bioPointScore?.score ?? 0,
                trend: d.weeklyTrend != null ? (d.weeklyTrend >= 0 ? `+${d.weeklyTrend}` : `${d.weeklyTrend}`) : '--',
                calories: d.todayNutrition?.totalCalories ?? 0,
                calorieTarget: 2000,
            }).catch(() => {});
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
            // Calculate score and re-fetch in parallel
            await api.post('/dashboard/calculate');
            const dashResponse = await api.get('/dashboard');
            const dr = dashResponse.data;
            set({
                bioPointScore: dr.bioPointScore,
                recentLogs: dr.recentLogs,
                weeklyTrend: dr.weeklyTrend,
            });
            updateWidgetData({
                score: dr.bioPointScore?.score ?? 0,
                trend: dr.weeklyTrend != null ? (dr.weeklyTrend >= 0 ? `+${dr.weeklyTrend}` : `${dr.weeklyTrend}`) : '--',
            }).catch(() => {});
        } catch (error: any) {
            set({
                error: error.response?.data?.message || 'Failed to log',
                isLoading: false,
            });
        }
    },
}));
