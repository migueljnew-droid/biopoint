import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, { type PurchasesPackage, LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_API_KEY = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '',
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '',
});

const ENTITLEMENT_ID = 'premium';

interface SubscriptionState {
    isPremium: boolean;
    plan: 'free' | 'monthly' | 'yearly';
    expiryDate: string | null;
    isLoading: boolean;
    error: string | null;
    packages: PurchasesPackage[];
    initialized: boolean;
    initialize: () => Promise<void>;
    fetchOfferings: () => Promise<void>;
    purchase: (pkg: PurchasesPackage) => Promise<void>;
    purchaseByType: (packageType: string) => Promise<void>;
    restorePurchases: () => Promise<void>;
}

let configuredOnce = false;

async function ensureConfigured(): Promise<boolean> {
    if (!REVENUECAT_API_KEY) return false;
    if (configuredOnce) return true;
    try {
        Purchases.setLogLevel(LOG_LEVEL.ERROR);
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
        configuredOnce = true;
        return true;
    } catch (e: any) {
        if (e.message?.includes('configured')) {
            configuredOnce = true;
            return true;
        }
        console.log('RevenueCat configure failed:', e);
        return false;
    }
}

export const useSubscriptionStore = create<SubscriptionState>()(
    persist(
        (set, get) => ({
            isPremium: false,
            plan: 'free',
            expiryDate: null,
            isLoading: false,
            error: null,
            packages: [],
            initialized: false,

            initialize: async () => {
                if (get().initialized) return;
                try {
                    const ok = await ensureConfigured();
                    if (!ok) {
                        set({ isPremium: false, plan: 'free', expiryDate: null, initialized: true });
                        return;
                    }
                    set({ initialized: true });
                    // Check entitlement
                    const customerInfo = await Purchases.getCustomerInfo();
                    const isPremium = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
                    if (isPremium) {
                        set({ isPremium: true });
                    } else {
                        set({ isPremium: false, plan: 'free', expiryDate: null });
                    }
                    // Pre-fetch offerings
                    await get().fetchOfferings();
                } catch (e) {
                    console.log('RevenueCat init failed:', e);
                    set({ isPremium: false, plan: 'free', expiryDate: null, initialized: true });
                }
            },

            fetchOfferings: async () => {
                try {
                    const offerings = await Purchases.getOfferings();
                    if (offerings.current) {
                        set({ packages: offerings.current.availablePackages });
                    }
                } catch (e) {
                    console.log('Fetch offerings error:', e);
                }
            },

            purchase: async (pkg: PurchasesPackage) => {
                set({ isLoading: true, error: null });
                try {
                    const { customerInfo } = await Purchases.purchasePackage(pkg);
                    const isPremium = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
                    if (isPremium) {
                        const planType = (pkg.packageType === 'MONTHLY' || pkg.identifier === '$rc_monthly')
                            ? 'monthly' : 'yearly';
                        set({
                            isPremium: true,
                            plan: planType,
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

            // Fallback: find package by type string then purchase
            purchaseByType: async (packageType: string) => {
                set({ isLoading: true, error: null });
                try {
                    const ok = await ensureConfigured();
                    if (!ok) {
                        set({ error: 'Subscription service not configured.' });
                        return;
                    }

                    let pkgs = get().packages;
                    if (!pkgs.length) {
                        await get().fetchOfferings();
                        pkgs = get().packages;
                    }

                    if (!pkgs.length) {
                        set({ error: 'No subscription plans available. Please try again later.' });
                        return;
                    }

                    // Match exactly how Omni does it
                    let packageToBuy: PurchasesPackage | undefined;
                    if (packageType === 'monthly') {
                        packageToBuy = pkgs.find(
                            (p) => p.packageType === 'MONTHLY' || p.identifier === '$rc_monthly' || p.identifier === 'monthly'
                        );
                    } else {
                        packageToBuy = pkgs.find(
                            (p) => p.packageType === 'ANNUAL' || p.identifier === '$rc_annual' || p.identifier === 'yearly'
                        );
                    }

                    if (!packageToBuy) {
                        set({ error: `${packageType} plan is not available. Please try again later.` });
                        return;
                    }

                    await get().purchase(packageToBuy);
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
                    const ok = await ensureConfigured();
                    if (!ok) {
                        set({ error: 'Subscription service not configured.' });
                        return;
                    }
                    const customerInfo = await Purchases.restorePurchases();
                    const isPremium = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
                    if (isPremium) {
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
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                isPremium: state.isPremium,
                plan: state.plan,
                expiryDate: state.expiryDate,
            }),
        }
    )
);
