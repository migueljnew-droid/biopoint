import { create } from 'zustand';
import { api } from '../services/api';
import { Alert } from 'react-native';

interface FastingProtocol {
    id: string;
    slug: string;
    name: string;
    fastingHours: number;
    eatingHours: number;
    description: string | null;
    isSystem: boolean;
}

interface FastingSession {
    id: string;
    protocolId: string;
    protocolName: string;
    startedAt: string;
    targetEndAt: string;
    endedAt: string | null;
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    elapsedHours: number;
    progress: number;
    currentZone: {
        name: string;
        color: string;
        icon: string;
        description: string;
    } | null;
    nextZone: {
        name: string;
        hoursUntil: number;
        startsAtHour: number;
    } | null;
    zonesReached: { zone: string; reachedAt: string }[];
    notes: string | null;
    moodBefore: number | null;
    energyBefore: number | null;
    moodAfter: number | null;
    energyAfter: number | null;
}

interface FastingStats {
    totalCompleted: number;
    totalHoursFasted: number;
    longestFastHours: number;
    currentStreak: number;
    bestStreak: number;
    completionRate: number;
    averageDurationHours: number;
}

interface FastingState {
    activeSession: FastingSession | null;
    protocols: FastingProtocol[];
    history: FastingSession[];
    stats: FastingStats | null;
    isLoading: boolean;
    error: string | null;

    fetchActiveSession: () => Promise<void>;
    fetchProtocols: () => Promise<void>;
    startFast: (protocolSlug: string, notes?: string, moodBefore?: number, energyBefore?: number) => Promise<void>;
    endFast: (id: string, notes?: string, moodAfter?: number, energyAfter?: number) => Promise<void>;
    cancelFast: (id: string) => Promise<void>;
    fetchHistory: (page?: number) => Promise<void>;
    fetchStats: () => Promise<void>;
}

export const useFastingStore = create<FastingState>((set, get) => ({
    activeSession: null,
    protocols: [],
    history: [],
    stats: null,
    isLoading: false,
    error: null,

    fetchActiveSession: async () => {
        try {
            const response = await api.get('/fasting/active');
            set({ activeSession: response.data });
        } catch (error: any) {
            // 404 means no active session — not an error
            if (error.response?.status === 404) {
                set({ activeSession: null });
            }
        }
    },

    fetchProtocols: async () => {
        try {
            const response = await api.get('/fasting/protocols');
            set({ protocols: response.data });
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch protocols');
        }
    },

    startFast: async (protocolSlug, notes, moodBefore, energyBefore) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post('/fasting/start', {
                protocolSlug,
                notes,
                moodBefore,
                energyBefore,
            });
            set({ activeSession: response.data, isLoading: false });
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Failed to start fast';
            set({ error: msg, isLoading: false });
            Alert.alert('Error', msg);
        }
    },

    endFast: async (id, notes, moodAfter, energyAfter) => {
        set({ isLoading: true, error: null });
        try {
            await api.post(`/fasting/${id}/end`, { notes, moodAfter, energyAfter });
            set({ activeSession: null, isLoading: false });
            // Refresh stats after ending
            get().fetchStats();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Failed to end fast';
            set({ error: msg, isLoading: false });
            Alert.alert('Error', msg);
        }
    },

    cancelFast: async (id) => {
        set({ isLoading: true, error: null });
        try {
            await api.post(`/fasting/${id}/cancel`);
            set({ activeSession: null, isLoading: false });
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Failed to cancel fast';
            set({ error: msg, isLoading: false });
            Alert.alert('Error', msg);
        }
    },

    fetchHistory: async (page = 1) => {
        try {
            const response = await api.get(`/fasting/history?page=${page}&limit=20`);
            set({ history: response.data.data });
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch history');
        }
    },

    fetchStats: async () => {
        try {
            const response = await api.get('/fasting/stats');
            set({ stats: response.data });
        } catch (error: any) {
            // Non-critical — ignore
        }
    },
}));
