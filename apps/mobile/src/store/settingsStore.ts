import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
    units: 'metric' | 'imperial';
    notificationsEnabled: boolean;
    bioLockEnabled: boolean;
    hapticsEnabled: boolean;

    setUnits: (units: 'metric' | 'imperial') => void;
    setNotificationsEnabled: (enabled: boolean) => void;
    setBioLockEnabled: (enabled: boolean) => void;
    setHapticsEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            units: 'metric',
            notificationsEnabled: true,
            bioLockEnabled: false,
            hapticsEnabled: true,

            setUnits: (units) => set({ units }),
            setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
            setBioLockEnabled: (enabled) => set({ bioLockEnabled: enabled }),
            setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),
        }),
        {
            name: 'biopoint-settings',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
