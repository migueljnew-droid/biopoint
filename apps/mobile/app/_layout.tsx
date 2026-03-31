import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens(true);

import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../src/store/authStore';
import { useSubscriptionStore } from '../src/store/subscriptionStore';
import { colors } from '../src/theme';
import { requestPermissions } from '../src/services/notificationService';

function useProtectedRoute() {
    const segments = useSegments();
    const router = useRouter();
    const { isAuthenticated, isLoading } = useAuthStore();

    useEffect(() => {
        if (isLoading) return;

        const inProtectedGroup = segments[0] === '(tabs)' || segments[0] === 'community' || segments[0] === 'settings';

        if (!isAuthenticated && inProtectedGroup) {
            router.replace('/');
        }
    }, [isAuthenticated, isLoading, segments]);
}

export default function RootLayout() {
    const checkAuth = useAuthStore((s) => s.checkAuth);
    const initSubscription = useSubscriptionStore((s) => s.initialize);

    useEffect(() => {
        SystemUI.setBackgroundColorAsync(colors.background);
        checkAuth().then(() => {
            if (useAuthStore.getState().isAuthenticated) {
                initSubscription();
                requestPermissions();
            }
        });
    }, []);

    useProtectedRoute();

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style="light" />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                    animation: 'slide_from_right',
                }}
            />
        </GestureHandlerRootView>
    );
}
