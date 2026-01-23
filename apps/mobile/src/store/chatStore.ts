import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// DELPHI PROTOCOL: CONVERSATIONAL MEMORY

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
    addMessage: (role: Message['role'], content: string) => void;
    setTyping: (typing: boolean) => void;
    clearHistory: () => void;

    // AI Integration (Mock for now, ready for API)
    generateResponse: (userMessage: string) => Promise<void>;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set, get) => ({
            messages: [{
                id: 'init-1',
                role: 'assistant',
                content: "Greetings. I am The Oracle. I have analyzed your biological data. Ask me anything about your health, trends, or optimal performance protocols.",
                timestamp: Date.now()
            }],
            isTyping: false,

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
                    content: "Greetings. I am The Oracle. I have analyzed your biological data. Ask me anything about your health, trends, or optimal performance protocols.",
                    timestamp: Date.now()
                }]
            }),

            generateResponse: async (userMessage: string) => {
                const { addMessage, setTyping } = get();

                setTyping(true);

                // MOCK BRAIN - DELPHI SIMULATION
                // In real implementation, this calls OpenAI/Anthropic via Edge Function
                setTimeout(() => {
                    let response = "I'm analyzing your biometrics...";
                    const lowerMsg = userMessage.toLowerCase();

                    if (lowerMsg.includes('sleep')) {
                        response = "Your sleep efficiency has dropped **12%** this week. I recommend:\n- **Magnesium Glycinate** (400mg) before bed.\n- Adjusting your bedroom temperature to **65°F**.\n- Initiating a 'Digital Sunset' at 9:00 PM.";
                    } else if (lowerMsg.includes('hrv') || lowerMsg.includes('stress')) {
                        response = "Your HRV is trending **upward** (Standard Deviation: 45ms). This indicates improved autonomic balance. \n\n*Action*: Increase training intensity tomorrow by 15%.";
                    } else if (lowerMsg.includes('supplement') || lowerMsg.includes('stack')) {
                        response = "Based on your recent fatigue markers, I suggest adding **Rhodiola Rosea** (200mg) to your morning stack for cortisol regulation.";
                    } else {
                        response = "I've noted that inquiry. Based on your current BioPoint Score of **78**, optimizing your circadian rhythm is the highest leverage lever right now.";
                    }

                    addMessage('assistant', response);
                    setTyping(false);
                }, 1500);
            }
        }),
        {
            name: 'biopoint-oracle-memory',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
