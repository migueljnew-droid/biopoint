import { Alert, Platform } from 'react-native';

// Safe Google Sign In Import
let GoogleSignin: any = {
    configure: () => console.log('GoogleSignin.configure (Mock)'),
    hasPlayServices: async () => true,
    signIn: async () => {
        Alert.alert('Dev Mode', 'Google Sign In not available in Expo Go. Use a Development Build.');
        return { idToken: null };
    },
    statusCodes: {
        SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
        IN_PROGRESS: 'IN_PROGRESS',
        PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    }
};

try {
    const googleModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = googleModule.GoogleSignin;
} catch (e) {
    console.log('Google Signin native module not found, using mock.');
}

// Safe Apple Authentication Import
let AppleAuthentication: any = {
    signInAsync: async () => {
        Alert.alert('Dev Mode', 'Apple Sign In requires a Development Build or Simulator with appropriate setup.');
        return { identityToken: null, fullName: null };
    },
    AppleAuthenticationScope: {
        FULL_NAME: 0,
        EMAIL: 1,
    }
};

try {
    const appleModule = require('expo-apple-authentication');
    if (appleModule && appleModule.signInAsync) {
        AppleAuthentication = appleModule;
    }
} catch (e) {
    console.log('Apple Authentication native module not found, using mock.');
}

export const socialAuth = {
    google: {
        configure: (config: any) => {
            try {
                GoogleSignin.configure(config);
            } catch (e) {
                console.warn('GoogleSignin configure failed (likely missing native module)');
            }
        },
        signIn: async () => {
            try {
                await GoogleSignin.hasPlayServices();
                const userInfo = await GoogleSignin.signIn();
                return userInfo;
            } catch (error: any) {
                // Re-throw specific status codes or handle generic errors
                throw error;
            }
        },
        statusCodes: GoogleSignin.statusCodes || {},
    },
    apple: {
        signIn: async () => {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });
            return credential;
        },
        scope: AppleAuthentication.AppleAuthenticationScope,
    }
};
