import { create } from 'zustand';
import { api } from '../services/api';

interface Profile {
    id: string;
    userId: string;
    sex: 'male' | 'female' | 'other' | null;
    dateOfBirth: string | null;
    heightCm: number | null;
    baselineWeightKg: number | null;
    goals: string[];
    dietStyle: string | null;
    currentInterventions: string | null;
    onboardingComplete: boolean;
}

interface ProfileState {
    profile: Profile | null;
    isLoading: boolean;
    error: string | null;

    fetchProfile: () => Promise<void>;
    updateProfile: (data: Partial<Profile>) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
    profile: null,
    isLoading: false,
    error: null,

    fetchProfile: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get('/profile');
            set({ profile: response.data, isLoading: false });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || 'Failed to fetch profile',
                isLoading: false
            });
        }
    },

    updateProfile: async (data) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.put('/profile', data);
            set({ profile: response.data, isLoading: false });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || 'Failed to update profile',
                isLoading: false
            });
            throw error;
        }
    },
}));
