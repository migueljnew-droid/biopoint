import { create } from 'zustand';
import { api } from '../services/api';
import { Alert } from 'react-native';

interface MealEntry {
    id: string;
    mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
    name: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    servingSize: string | null;
    photoUrl: string | null;
    aiAnalyzed: boolean;
    aiConfidence: number | null;
    createdAt: string;
}

interface DailySummary {
    date: string;
    totalCalories: number;
    totalProteinG: number;
    totalCarbsG: number;
    totalFatG: number;
    totalFiberG: number;
    mealCount: number;
    meals: MealEntry[];
    targets: {
        calories: number | null;
        proteinG: number | null;
        carbsG: number | null;
        fatG: number | null;
    };
}

interface FoodAnalysisResult {
    name: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    items: {
        name: string;
        calories: number;
        proteinG: number;
        carbsG: number;
        fatG: number;
        servingSize: string;
    }[];
    confidence: number;
}

interface NutritionState {
    dailySummary: DailySummary | null;
    selectedDate: string;
    analysisResult: FoodAnalysisResult | null;
    isAnalyzing: boolean;
    isLoading: boolean;
    error: string | null;

    setSelectedDate: (date: string) => void;
    fetchDailySummary: (date?: string) => Promise<void>;
    addMeal: (meal: {
        date: string;
        mealType: string;
        name: string;
        calories: number;
        proteinG?: number;
        carbsG?: number;
        fatG?: number;
        fiberG?: number;
        servingSize?: string;
    }) => Promise<void>;
    updateMeal: (id: string, data: Partial<MealEntry>) => Promise<void>;
    deleteMeal: (id: string) => Promise<void>;
    analyzeText: (foodDescription: string) => Promise<void>;
    analyzePhoto: (imageBase64: string, mimeType?: string) => Promise<void>;
    saveMealFromAnalysis: (meal: {
        date: string;
        mealType: string;
        name: string;
        calories: number;
        proteinG?: number;
        carbsG?: number;
        fatG?: number;
        fiberG?: number;
        servingSize?: string;
    }) => Promise<void>;
    clearAnalysis: () => void;
}

function todayStr(): string {
    return new Date().toISOString().split('T')[0]!;
}

export const useNutritionStore = create<NutritionState>((set, get) => ({
    dailySummary: null,
    selectedDate: todayStr(),
    analysisResult: null,
    isAnalyzing: false,
    isLoading: false,
    error: null,

    setSelectedDate: (date) => {
        set({ selectedDate: date });
        get().fetchDailySummary(date);
    },

    fetchDailySummary: async (date?: string) => {
        const d = date || get().selectedDate;
        set({ isLoading: true, error: null });
        try {
            const response = await api.get(`/nutrition/daily/${d}`);
            set({ dailySummary: response.data, isLoading: false });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || 'Failed to fetch nutrition data',
                isLoading: false,
            });
        }
    },

    addMeal: async (meal) => {
        set({ isLoading: true, error: null });
        try {
            await api.post('/nutrition/meals', meal);
            set({ isLoading: false });
            get().fetchDailySummary();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Failed to add meal';
            set({ error: msg, isLoading: false });
            Alert.alert('Error', msg);
        }
    },

    updateMeal: async (id, data) => {
        set({ isLoading: true, error: null });
        try {
            await api.put(`/nutrition/meals/${id}`, data);
            set({ isLoading: false });
            get().fetchDailySummary();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Failed to update meal';
            set({ error: msg, isLoading: false });
            Alert.alert('Error', msg);
        }
    },

    deleteMeal: async (id) => {
        set({ isLoading: true, error: null });
        try {
            await api.delete(`/nutrition/meals/${id}`);
            set({ isLoading: false });
            get().fetchDailySummary();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Failed to delete meal';
            set({ error: msg, isLoading: false });
            Alert.alert('Error', msg);
        }
    },

    analyzeText: async (foodDescription: string) => {
        set({ isAnalyzing: true, error: null, analysisResult: null });
        try {
            const response = await api.post('/nutrition/analyze-text', { description: foodDescription });
            set({ analysisResult: response.data, isAnalyzing: false });
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Failed to analyze food';
            set({ error: msg, isAnalyzing: false });
            Alert.alert('Error', msg);
        }
    },

    analyzePhoto: async (imageBase64, mimeType = 'image/jpeg') => {
        set({ isAnalyzing: true, error: null, analysisResult: null });
        try {
            const response = await api.post('/nutrition/analyze-photo', { imageBase64, mimeType });
            set({ analysisResult: response.data, isAnalyzing: false });
        } catch (error: any) {
            const msg = error.response?.data?.message || error.message || 'Failed to analyze photo';
            set({ error: msg, isAnalyzing: false });
            Alert.alert('Analysis Failed', msg + '\n\nTry again or add your meal manually.');
        }
    },

    saveMealFromAnalysis: async (meal) => {
        set({ isLoading: true, error: null });
        try {
            await api.post('/nutrition/meals/from-analysis', meal);
            set({ isLoading: false, analysisResult: null });
            get().fetchDailySummary();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Failed to save meal';
            set({ error: msg, isLoading: false });
            Alert.alert('Error', msg);
        }
    },

    clearAnalysis: () => set({ analysisResult: null }),
}));
