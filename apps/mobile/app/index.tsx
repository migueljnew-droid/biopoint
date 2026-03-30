import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { colors, spacing, typography, borderRadius, gradients } from '../src/theme';
import { ScreenWrapper, GlassView, AnimatedButton, GradientText } from '../src/components/ui';

export default function WelcomeScreen() {
    const { isAuthenticated, isLoading } = useAuthStore();

    // Auto-redirect to dashboard if already signed in
    useEffect(() => {
        if (isAuthenticated && !isLoading) {
            router.replace('/(tabs)');
        }
    }, [isAuthenticated, isLoading]);

    // Logo rotation animation
    const rotation = useSharedValue(0);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 20000, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    const logoStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }]
    }));

    return (
        <ScreenWrapper>
            <View style={styles.container}>
                {/* Hero Section */}
                <View style={styles.hero}>
                    <Animated.View
                        entering={FadeInDown.delay(200).springify()}
                        style={[styles.logoContainer, logoStyle]}
                    >
                        <GlassView
                            variant="primary"
                            intensity={40}
                            borderRadius={borderRadius.xxl}
                            style={styles.logoGlass}
                        >
                            <Ionicons name="analytics" size={48} color={colors.primaryLight} />
                        </GlassView>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(300).springify()}>
                        <GradientText
                            style={styles.title}
                            colors={gradients.primaryExtended}
                        >
                            BioPoint
                        </GradientText>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(400).springify()}>
                        <Text style={styles.subtitle}>Track Your Biology, Optimize Your Life</Text>
                    </Animated.View>
                </View>

                {/* Disclaimer */}
                <Animated.View entering={FadeInUp.delay(600).springify()} style={styles.disclaimerContainer}>
                    <GlassView variant="light" intensity={20} style={styles.disclaimer}>
                        <View style={styles.disclaimerIcon}>
                            <Ionicons name="information-circle" size={18} color={colors.info} />
                        </View>
                        <Text style={styles.disclaimerText}>
                            This app is for informational purposes only and does not provide medical advice, diagnosis, or treatment.
                        </Text>
                    </GlassView>
                </Animated.View>

                {/* Actions */}
                <View style={styles.actions}>
                    <Animated.View entering={FadeInUp.delay(700).springify()}>
                        <Link href="/register" asChild>
                            <AnimatedButton
                                title="Get Started"
                                onPress={() => { }}
                                variant="primary"
                                icon={<Ionicons name="arrow-forward" size={18} color="#fff" />}
                            />
                        </Link>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(800).springify()}>
                        <Link href="/login" asChild>
                            <AnimatedButton
                                title="I Already Have an Account"
                                onPress={() => { }}
                                variant="accent" // Using accent gradient for variety or keep consistent style
                                style={styles.secondaryButton}
                                textStyle={{ color: colors.textSecondary }}
                            />
                        </Link>
                    </Animated.View>
                </View>
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: spacing.lg,
        justifyContent: 'space-between',
    },
    hero: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoContainer: {
        marginBottom: spacing.xl,
    },
    logoGlass: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 0,
        borderColor: 'transparent',
    },
    title: {
        fontSize: 48,
        fontWeight: '800',
        marginBottom: spacing.sm,
        letterSpacing: -1,
        textAlign: 'center',
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        maxWidth: 280,
    },
    disclaimerContainer: {
        marginBottom: spacing.xl,
    },
    disclaimer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: spacing.md,
        gap: spacing.sm,
    },
    disclaimerIcon: {
        marginTop: 2,
    },
    disclaimerText: {
        ...typography.caption,
        color: colors.textMuted,
        flex: 1,
        lineHeight: 18,
    },
    actions: {
        gap: spacing.md,
    },
    secondaryButton: {
        backgroundColor: colors.glass.light, // Fallback if gradient overrides not used correctly in AnimatedButton props logic, but explicit variant works
        borderWidth: 0,
        borderColor: 'transparent',
        shadowOpacity: 0,
    }
});
