import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens(true);

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../src/store/authStore';
import { useSubscriptionStore } from '../src/store/subscriptionStore';
import { colors } from '../src/theme';
import { requestPermissions, scheduleAllEngagementNotifications } from '../src/services/notificationService';
import { api } from '../src/services/api';

export default function RootLayout() {
    const checkAuth = useAuthStore((s) => s.checkAuth);
    const initSubscription = useSubscriptionStore((s) => s.initialize);

    useEffect(() => {
        SystemUI.setBackgroundColorAsync(colors.background);
        // Wake up backend (Render cold-start) so auth is ready when user taps login
        api.get('/health').catch(() => {});
        checkAuth()
            .then(() => {
                if (useAuthStore.getState().isAuthenticated) {
                    initSubscription().catch(() => {});
                    requestPermissions()
                        .then((granted) => {
                            if (granted) scheduleAllEngagementNotifications().catch(() => {});
                        })
                        .catch(() => {});
                }
            })
            .catch(() => {});
    }, []);

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
