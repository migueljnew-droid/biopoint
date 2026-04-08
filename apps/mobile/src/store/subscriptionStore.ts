import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_API_KEY = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '',
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '',
});

let configuredOnce = false;

async function ensureConfigured(): Promise<boolean> {
    if (!REVENUECAT_API_KEY) return false;
    if (configuredOnce) return true;
    try {
        Purchases.setLogLevel(Purchases.LOG_LEVEL.ERROR);
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
        configuredOnce = true;
        return true;
    } catch (e: any) {
        // Already configured from a previous session/hot reload
        if (e.message?.includes('configured')) {
            configuredOnce = true;
            return true;
        }
        console.log('RevenueCat configure failed:', e);
        return false;
    }
}

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
                    const ok = await ensureConfigured();
                    if (!ok) {
                        set({ isPremium: false, plan: 'free', expiryDate: null });
                        return;
                    }
                    const customerInfo = await Purchases.getCustomerInfo();
                    const isPremium = typeof customerInfo.entitlements.active['premium'] !== "undefined";
                    if (isPremium) {
                        set({ isPremium: true });
                    } else {
                        set({ isPremium: false, plan: 'free', expiryDate: null });
                    }
                } catch (e) {
                    console.log('RevenueCat init failed:', e);
                    set({ isPremium: false, plan: 'free', expiryDate: null });
                }
            },

            purchase: async (packageType: string) => { // 'monthly' or 'yearly'
                set({ isLoading: true, error: null });
                try {
                    const ok = await ensureConfigured();
                    if (!ok) {
                        set({ error: 'Subscription service not configured.' });
                        return;
                    }
                    const offerings = await Purchases.getOfferings();
                    if (!offerings.current || !offerings.current.availablePackages.length) {
                        set({ error: 'No subscription plans available. Please try again later.' });
                        return;
                    }

                    // Find package by packageType enum, standard identifier, or custom identifier
                    const pkgs = offerings.current.availablePackages;
                    let packageToBuy: PurchasesPackage | null | undefined = null;

                    if (packageType === 'monthly') {
                        packageToBuy = offerings.current.monthly
                            || pkgs.find((p) => p.packageType === Purchases.PACKAGE_TYPE.MONTHLY)
                            || pkgs.find((p) => p.identifier === 'monthly' || p.identifier === '$rc_monthly');
                    } else {
                        packageToBuy = offerings.current.annual
                            || pkgs.find((p) => p.packageType === Purchases.PACKAGE_TYPE.ANNUAL)
                            || pkgs.find((p) => p.identifier === 'yearly' || p.identifier === '$rc_annual');
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
                    const ok = await ensureConfigured();
                    if (!ok) {
                        set({ error: 'Subscription service not configured.' });
                        return;
                    }
                    const customerInfo = await Purchases.restorePurchases();
                    const isPremium = typeof customerInfo.entitlements.active['premium'] !== "undefined";
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
            storage: createJSONStorage(() => AsyncStorage)
        }
    )
);
