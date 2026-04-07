import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    isLoading?: boolean;
}

interface ChatState {
    messages: Message[];
    isTyping: boolean;
    aiConsentGiven: boolean;
    addMessage: (role: Message['role'], content: string) => void;
    setTyping: (typing: boolean) => void;
    clearHistory: () => void;
    giveAiConsent: () => void;
    generateResponse: (userMessage: string) => Promise<void>;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set, get) => ({
            messages: [{
                id: 'init-1',
                role: 'assistant',
                content: "Greetings. I am The Oracle. Ask me anything about your health, trends, or optimal performance protocols.\n\n*Disclaimer: The Oracle provides general wellness information only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before making health decisions.*",
                timestamp: Date.now()
            }],
            isTyping: false,
            aiConsentGiven: false,

            addMessage: (role, content) => {
                const newMessage: Message = {
                    id: Math.random().toString(36).substring(7),
                    role,
                    content,
                    timestamp: Date.now()
                };
                set((state) => ({ messages: [...state.messages, newMessage] }));
            },

            setTyping: (isTyping) => set({ isTyping }),

            clearHistory: () => set({
                messages: [{
                    id: 'init-' + Date.now(),
                    role: 'assistant',
                    content: "Greetings. I am The Oracle. Ask me anything about your health, trends, or optimal performance protocols.\n\n*Disclaimer: The Oracle provides general wellness information only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before making health decisions.*",
                    timestamp: Date.now()
                }]
            }),

            giveAiConsent: () => set({ aiConsentGiven: true }),

            generateResponse: async (userMessage: string) => {
                const { addMessage, setTyping, messages } = get();

                setTyping(true);

                try {
                    // Build conversation history (skip system/init messages, last 10 turns)
                    const history = messages
                        .filter(m => m.role !== 'system' && !m.id.startsWith('init'))
                        .slice(-10)
                        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content }));

                    const response = await api.post('/oracle/chat', {
                        message: userMessage,
                        history,
                    });

                    const aiResponse = (response.data as { response: string }).response;
                    const withDisclaimer = aiResponse + '\n\n---\n*Sources: NIH, Mayo Clinic, PubMed. This is general wellness information, not medical advice. Consult your healthcare provider.*';
                    addMessage('assistant', withDisclaimer);
                } catch (error: any) {
                    const errMsg = error.response?.status === 503
                        ? "AI service is not configured. Please contact support."
                        : "I couldn't process that request. Please try again.";
                    addMessage('assistant', errMsg);
                } finally {
                    setTyping(false);
                }
            }
        }),
        {
            name: 'biopoint-oracle-memory',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
