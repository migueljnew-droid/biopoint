import { Alert, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Safe Google Sign In Import — only used to get the ID token from native SDK
let GoogleSignin: any = null;
try {
    const googleModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = googleModule.GoogleSignin;
} catch (e) {
    // Native module not available — Google Sign-In won't work
    console.log('Google Sign-In native module not available');
}

// Safe Apple Authentication Import — only used to get the identity token from native SDK
let AppleAuthentication: any = null;
try {
    const appleModule = require('expo-apple-authentication');
    if (appleModule && appleModule.signInAsync) {
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
                console.warn('GoogleSignin configure failed');
            }
        },
        signIn: async () => {
            if (!GoogleSignin) {
                throw new Error('Google Sign-In is not available on this device');
            }
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();

            if (!userInfo.idToken) {
                throw new Error('No ID token from Google');
            }

            // Use Supabase to verify the Google token and create/sign in user
            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: userInfo.idToken,
            });

            if (error) throw error;
            return data;
        },
        statusCodes: GoogleSignin?.statusCodes || {
            SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
            IN_PROGRESS: 'IN_PROGRESS',
            PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
        },
    },
    apple: {
        isAvailable: () => AppleAuthentication !== null && Platform.OS === 'ios',
        signIn: async () => {
            if (!AppleAuthentication) {
                throw new Error('Apple Sign-In is not available on this device');
            }

            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            if (!credential.identityToken) {
                throw new Error('No identity token from Apple');
            }

            // Use Supabase to verify the Apple token and create/sign in user
            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'apple',
                token: credential.identityToken,
            });

            if (error) throw error;

            return {
                ...data,
                fullName: credential.fullName,
            };
        },
    },
};
