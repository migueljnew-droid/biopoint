import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_API_KEY = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '',
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '',
});

interface SubscriptionState {
    isPremium: boolean;
    plan: 'free' | 'monthly' | 'yearly';
    expiryDate: string | null;
    isLoading: boolean;
    error: string | null;
    initialize: () => Promise<void>;
    purchase: (packageId: string) => Promise<void>;
    restorePurchases: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>()(
    persist(
        (set) => ({
            isPremium: false,
            plan: 'free',
            expiryDate: null,
            isLoading: false,
            error: null,

            initialize: async () => {
                // Grant premium to founder/admin accounts
                const { useAuthStore } = require('./authStore');
                const user = useAuthStore.getState().user;
                const adminEmails = ['migueljnew@gmail.com', 'booklouisgold@gmail.com'];
                if (user?.email && adminEmails.includes(user.email.toLowerCase())) {
                    set({ isPremium: true, plan: 'yearly' });
                    return;
                }

                if (!REVENUECAT_API_KEY) return;
                try {
                    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
                    const customerInfo = await Purchases.getCustomerInfo();
                    const isPremium = typeof customerInfo.entitlements.active['premium'] !== "undefined";
                    set({ isPremium });
                } catch (e) {
                    // RevenueCat not configured — IAP disabled gracefully
                }
            },

            purchase: async (packageType: string) => { // 'monthly' or 'yearly'
                set({ isLoading: true, error: null });
                try {
                    const offerings = await Purchases.getOfferings();
                    if (offerings.current !== null) {
                        const packageToBuy = packageType === 'monthly'
                            ? offerings.current.monthly
                            : offerings.current.annual;

                        if (packageToBuy) {
                            const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
                            const isPremium = typeof customerInfo.entitlements.active['premium'] !== "undefined";

                            if (isPremium) {
                                set({
                                    isPremium: true,
                                    plan: packageType as 'monthly' | 'yearly',
                                    expiryDate: customerInfo.latestExpirationDate
                                });
                            }
                        }
                    }
                } catch (e: any) {
                    if (!e.userCancelled) {
                        set({ error: e.message || 'Purchase failed' });
                    }
                } finally {
                    set({ isLoading: false });
                }
            },

            restorePurchases: async () => {
                set({ isLoading: true, error: null });
                try {
                    const customerInfo = await Purchases.restorePurchases();
                    const isPremium = typeof customerInfo.entitlements.active['premium'] !== "undefined";
                    if (isPremium) {
                        // Logic to determine plan from entitlements could go here
                        set({ isPremium: true });
                    } else {
                        set({ error: 'No active subscription found to restore.' });
                    }
                } catch (e: any) {
                    set({ error: e.message || 'Restore failed' });
                } finally {
                    set({ isLoading: false });
                }
            }
        }),
        {
            name: 'subscription-storage',
            storage: createJSONStorage(() => AsyncStorage)
        }
    )
);
