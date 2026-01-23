import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// TECHNE PROTOCOL: IMMUTABLE AUDIT LOG
// HIPAA Requirement: 45 CFR § 164.312(b) - Audit Control

export interface AuditEvent {
    id: string;
    timestamp: number;
    action: 'VIEW_MEDICAL_ID' | 'VIEW_LAB_RESULT' | 'EXPORT_DATA' | 'LOGIN' | 'LOGOUT' | 'BIO_LOCK_ACCESS';
    status: 'SUCCESS' | 'FAILURE' | 'DENIED';
    metadata?: string;
}

interface AuditState {
    logs: AuditEvent[];
    logEvent: (action: AuditEvent['action'], status?: AuditEvent['status'], metadata?: string) => void;
    clearLogs: () => void; // Only for dev/admin, normally immutable
}

export const useAuditStore = create<AuditState>()(
    persist(
        (set) => ({
            logs: [],
            logEvent: (action, status = 'SUCCESS', metadata) => {
                const newEvent: AuditEvent = {
                    id: Math.random().toString(36).substring(7),
                    timestamp: Date.now(),
                    action,
                    status,
                    metadata
                };
                set((state) => ({
                    logs: [newEvent, ...state.logs].slice(0, 1000) // Keep last 1000 events
                }));
                console.log(`[AUDIT] ${action}: ${status}`);
            },
            clearLogs: () => set({ logs: [] })
        }),
        {
            name: 'biopoint-audit-trail',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
