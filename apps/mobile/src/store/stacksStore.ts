import { create } from 'zustand';
import { api } from '../services/api';

interface StackItem {
    id: string;
    stackId: string;
    name: string;
    dose: number;
    unit: string;
    route: string | null;
    frequency: string;
    timing: string | null;
    cycleJson: { daysOn: number; daysOff: number } | null;
    notes: string | null;
    isActive: boolean;
}

export interface CreateStackItemInput {
    name: string;
    dose: number;
    unit: string;
    frequency: string;
    route?: string;
    timing?: string;
    cycleJson?: any;
    notes?: string;
    isActive?: boolean;
}

interface Stack {
    id: string;
    userId: string;
    name: string;
    goal: string | null;
    startDate: string;
    isActive: boolean;
    items: StackItem[];
}

interface StacksState {
    stacks: Stack[];
    isLoading: boolean;
    error: string | null;

    fetchStacks: () => Promise<void>;
    createStack: (data: { name: string; goal?: string }) => Promise<Stack>;
    addItem: (stackId: string, item: CreateStackItemInput) => Promise<StackItem>;
    updateItem: (stackId: string, itemId: string, item: Partial<CreateStackItemInput>) => Promise<StackItem>;
    logCompliance: (stackItemId: string, notes?: string) => Promise<void>;
    addReminder: (itemId: string, time: string, daysOfWeek?: number[]) => Promise<void>;
    getReminders: (itemId: string) => Promise<any[]>;
}

export const useStacksStore = create<StacksState>((set) => ({
    stacks: [],
    isLoading: false,
    error: null,

    fetchStacks: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get('/stacks');
            set({ stacks: response.data, isLoading: false });
        } catch (error: any) {
            set({ error: error.response?.data?.message || 'Failed to fetch stacks', isLoading: false });
        }
    },

    createStack: async (data) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post('/stacks', data);
            set((state) => ({ stacks: [response.data, ...state.stacks], isLoading: false }));
            return response.data;
        } catch (error: any) {
            set({ error: error.response?.data?.message || 'Failed to create stack', isLoading: false });
            throw error;
        }
    },

    addItem: async (stackId, item) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post(`/stacks/${stackId}/items`, item);
            set((state) => ({
                stacks: state.stacks.map((s) =>
                    s.id === stackId ? { ...s, items: [...s.items, response.data] } : s
                ),
                isLoading: false,
            }));
            return response.data;
        } catch (error: any) {
            set({ error: error.response?.data?.message || 'Failed to add item', isLoading: false });
            throw error;
        }
    },

    updateItem: async (stackId, itemId, item) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.put(`/stacks/${stackId}/items/${itemId}`, item);
            set((state) => ({
                stacks: state.stacks.map((s) =>
                    s.id === stackId ? {
                        ...s,
                        items: s.items.map(i => i.id === itemId ? response.data : i)
                    } : s
                ),
                isLoading: false,
            }));
            return response.data;
        } catch (error: any) {
            set({ error: error.response?.data?.message || 'Failed to update item', isLoading: false });
            throw error;
        }
    },

    logCompliance: async (stackItemId, notes) => {
        try {
            await api.post('/stacks/compliance', { stackItemId, notes });
        } catch (error: any) {
            set({ error: error.response?.data?.message || 'Failed to log compliance' });
            throw error;
        }
    },

    // Reminders
    addReminder: async (itemId: string, time: string, daysOfWeek: number[] = [0, 1, 2, 3, 4, 5, 6]) => {
        try {
            await api.post(`/stacks/items/${itemId}/reminders`, { time, daysOfWeek });
        } catch (error: any) {
            set({ error: error.response?.data?.message || 'Failed to add reminder' });
            throw error;
        }
    },

    getReminders: async (itemId: string) => {
        try {
            const response = await api.get(`/stacks/items/${itemId}/reminders`);
            return response.data;
        } catch (error: any) {
            console.error(error);
            return [];
        }
    }
}));
