import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Safe Google Sign In Import — only used to get the ID token from native SDK
let GoogleSignin: any = null;
try {
    const googleModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = googleModule.GoogleSignin;
} catch (e) {
    console.log('Google Sign-In native module not available');
}

// Safe Apple Authentication Import — only used to get the identity token from native SDK
let AppleAuthentication: any = null;
try {
    const appleModule = require('expo-apple-authentication');
    if (appleModule && typeof appleModule.signInAsync === 'function') {
        AppleAuthentication = appleModule;
    }
} catch (e) {
    console.log('Apple Authentication native module not available');
}

export const socialAuth = {
    google: {
        isAvailable: () => GoogleSignin !== null,
        configure: (config: any) => {
            if (!GoogleSignin) return;
            try {
                GoogleSignin.configure(config);
            } catch (e) {
                console.warn('GoogleSignin configure failed:', e);
            }
        },
        signIn: async () => {
            if (!GoogleSignin) {
                throw new Error('Google Sign-In is not available on this device');
            }
            try {
                if (Platform.OS === 'android') {
                    await GoogleSignin.hasPlayServices();
                }
                const userInfo = await GoogleSignin.signIn();

                // v13+ returns { type, data: { idToken, user } }
                // v12 and below returns { idToken, user } directly
                const idToken = userInfo?.data?.idToken || userInfo?.idToken;

                if (!idToken) {
                    throw new Error('No ID token from Google');
                }

                const { data, error } = await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    token: idToken,
                });

                if (error) throw error;
                return data;
            } catch (e: any) {
                // Re-throw cancellation codes so callers can ignore them
                if (e.code === GoogleSignin.statusCodes?.SIGN_IN_CANCELLED) throw e;
                if (e.code === 'ERR_REQUEST_CANCELED') throw e;
                throw new Error('Google Sign-In failed: ' + (e.message || 'Unknown error'));
            }
        },
        statusCodes: GoogleSignin?.statusCodes || {
            SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
            IN_PROGRESS: 'IN_PROGRESS',
            PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
        },
    },
    apple: {
        isAvailable: () => AppleAuthentication !== null && Platform.OS === 'ios',
        checkAvailability: async () => {
            if (!AppleAuthentication) return false;
            try {
                return await AppleAuthentication.isAvailableAsync();
            } catch {
                return false;
            }
        },
        signIn: async () => {
            if (!AppleAuthentication) {
                throw new Error('Apple Sign-In is not available on this device');
            }

            // Check availability first (important for iPad)
            try {
                const available = await AppleAuthentication.isAvailableAsync();
                if (!available) {
                    throw new Error('Apple Sign-In is not available on this device');
                }
            } catch (e: any) {
                if (e.message?.includes('not available')) throw e;
                // If check fails, still try signing in
            }

            let credential: any;
            try {
                credential = await AppleAuthentication.signInAsync({
                    requestedScopes: [
                        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                        AppleAuthentication.AppleAuthenticationScope.EMAIL,
                    ],
                });
            } catch (e: any) {
                if (e.code === 'ERR_REQUEST_CANCELED') throw e;
                throw new Error('Apple Sign-In failed: ' + (e.message || 'Unknown error'));
            }

            if (!credential.identityToken) {
                throw new Error('No identity token from Apple');
            }

            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'apple',
                token: credential.identityToken,
            });

            if (error) {
                console.log('Supabase Apple signInWithIdToken error:', error.message);
                throw new Error('AUTH_FAILED: ' + error.message);
            }

            return {
                ...data,
                fullName: credential.fullName,
            };
        },
    },
};
