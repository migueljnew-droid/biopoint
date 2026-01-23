import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// AEGIS PROTOCOL: ENCRYPTED STORAGE ADAPTER
const isWeb = Platform.OS === 'web';

export const secureStorage = {
    async setItem(key: string, value: string) {
        if (isWeb) {
            try {
                // @ts-ignore
                if (typeof window !== 'undefined' && window.localStorage) {
                    // @ts-ignore
                    window.localStorage.setItem(key, value);
                }
            } catch (e) {
                console.warn('LocalStorage not available');
            }
        } else {
            await SecureStore.setItemAsync(key, value);
        }
    },

    async getItem(key: string) {
        if (isWeb) {
            // @ts-ignore
            if (typeof window !== 'undefined' && window.localStorage) {
                // @ts-ignore
                return window.localStorage.getItem(key);
            }
            return null;
        } else {
            return await SecureStore.getItemAsync(key);
        }
    },

    async deleteItem(key: string) {
        if (isWeb) {
            // @ts-ignore
            if (typeof window !== 'undefined' && window.localStorage) {
                // @ts-ignore
                window.localStorage.removeItem(key);
            }
        } else {
            await SecureStore.deleteItemAsync(key);
        }
    }
};
