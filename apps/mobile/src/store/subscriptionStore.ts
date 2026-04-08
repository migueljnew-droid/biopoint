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
                try {
                    if (!REVENUECAT_API_KEY) {
                        set({ isPremium: false, plan: 'free' });
                        return;
                    }
                    Purchases.setLogLevel(Purchases.LOG_LEVEL.ERROR);
                    await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
                    const customerInfo = await Purchases.getCustomerInfo();
                    const isPremium = typeof customerInfo.entitlements.active['premium'] !== "undefined";
                    if (isPremium) {
                        set({ isPremium: true });
                    } else {
                        set({ isPremium: false, plan: 'free', expiryDate: null });
                    }
                } catch (e) {
                    console.log('RevenueCat init failed:', e);
                    set({ isPremium: false, plan: 'free' });
                }
            },

            purchase: async (packageType: string) => { // 'monthly' or 'yearly'
                set({ isLoading: true, error: null });
                try {
                    if (!REVENUECAT_API_KEY) {
                        set({ error: 'Subscription service not configured.' });
                        return;
                    }
                    // Only configure if not already configured (prevents singleton error)
                    if (!Purchases.isConfigured()) {
                        Purchases.setLogLevel(Purchases.LOG_LEVEL.ERROR);
                        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
                    }
                    const offerings = await Purchases.getOfferings();
                    if (!offerings.current || !offerings.current.availablePackages.length) {
                        set({ error: 'No subscription plans available. Please try again later.' });
                        return;
                    }

                    // Try standard RC identifiers first, then fall back to custom identifiers
                    let packageToBuy = packageType === 'monthly'
                        ? offerings.current.monthly
                        : offerings.current.annual;

                    // Fall back: search availablePackages by identifier
                    if (!packageToBuy) {
                        const searchId = packageType === 'monthly' ? 'monthly' : 'yearly';
                        packageToBuy = offerings.current.availablePackages.find(
                            (p) => p.identifier === searchId || p.identifier === `$rc_${packageType}`
                        ) || null;
                    }

                    if (!packageToBuy) {
                        set({ error: `${packageType} plan is not available. Please try again later.` });
                        return;
                    }

                    const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
                    const isPremium = typeof customerInfo.entitlements.active['premium'] !== "undefined";

                    if (isPremium) {
                        set({
                            isPremium: true,
                            plan: packageType as 'monthly' | 'yearly',
                            expiryDate: customerInfo.latestExpirationDate
                        });
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
                    if (!Purchases.isConfigured()) {
                        if (!REVENUECAT_API_KEY) {
                            set({ error: 'Subscription service not configured.' });
                            return;
                        }
                        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
                    }
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
