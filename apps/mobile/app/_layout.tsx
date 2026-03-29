import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens(true);

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/theme';
import { requestPermissions } from '../src/services/notificationService';

export default function RootLayout() {
    const checkAuth = useAuthStore((s) => s.checkAuth);

    useEffect(() => {
        SystemUI.setBackgroundColorAsync(colors.background);
        checkAuth();
        requestPermissions();
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
