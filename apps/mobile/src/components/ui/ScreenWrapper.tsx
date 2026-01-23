import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing
} from 'react-native-reanimated';
import { colors, gradients } from '../../theme';

interface ScreenWrapperProps extends SafeAreaViewProps {
    children: React.ReactNode;
    style?: ViewStyle;
    contentContainerStyle?: ViewStyle;
    withGradient?: boolean;
}

export function ScreenWrapper({
    children,
    style,
    withGradient = true,
    ...props
}: ScreenWrapperProps) {
    // Ambient animations for the glow orbs
    const orb1Opacity = useSharedValue(0.3);
    const orb2Opacity = useSharedValue(0.3);

    useEffect(() => {
        orb1Opacity.value = withRepeat(
            withTiming(0.6, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
        orb2Opacity.value = withRepeat(
            withTiming(0.5, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const orb1Style = useAnimatedStyle(() => ({
        opacity: orb1Opacity.value,
        transform: [{ scale: 1 + (orb1Opacity.value * 0.2) }],
    }));

    const orb2Style = useAnimatedStyle(() => ({
        opacity: orb2Opacity.value,
        transform: [{ scale: 1 + (orb2Opacity.value * 0.1) }],
    }));

    return (
        <View style={[styles.container, style]}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            {withGradient && (
                <>
                    <LinearGradient
                        colors={gradients.background.primary}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />

                    {/* Ambient Orbs */}
                    <Animated.View style={[styles.orb1, orb1Style]} />
                    <Animated.View style={[styles.orb2, orb2Style]} />
                </>
            )}

            <SafeAreaView style={[styles.safeArea, style]} {...props}>
                {children}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    safeArea: {
        flex: 1,
    },
    orb1: {
        position: 'absolute',
        top: -100,
        left: -100,
        width: 400,
        height: 400,
        borderRadius: 200,
        backgroundColor: colors.primary,
        opacity: 0.15,
    },
    orb2: {
        position: 'absolute',
        bottom: -50,
        right: -50,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: colors.accent,
        opacity: 0.1,
    },
});
