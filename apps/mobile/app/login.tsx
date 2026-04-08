import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { LoginSchema } from '@biopoint/shared';
import { colors, spacing, typography, borderRadius, gradients } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import { ScreenWrapper, GlassView, AnimatedButton, GradientText } from '../src/components/ui';

import { socialAuth } from '../src/services/socialAuth';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { login, loginWithGoogle, loginWithApple, isLoading, error, clearError } = useAuthStore();

    React.useEffect(() => {
        const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
        if (webClientId) {
            socialAuth.google.configure({
                webClientId,
                iosClientId,
                offlineAccess: true,
            });
        }
        clearError();
    }, []);

    const handleLogin = async () => {
        const result = LoginSchema.safeParse({ email, password });
        if (!result.success) {
            Alert.alert('Error', result.error.errors[0]?.message ?? 'Invalid input');
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        try {
            await login(email, password);
            router.replace('/(tabs)');
        } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handleGoogleLogin = async () => {
        if (!socialAuth.google.isAvailable()) {
            Alert.alert("Unavailable", "Google Sign-In is not configured on this device.");
            return;
        }
        try {
            const sessionData = await socialAuth.google.signIn();
            if (sessionData?.session?.access_token) {
                await loginWithGoogle(sessionData.session.access_token);
                router.replace('/(tabs)');
            }
        } catch (error: any) {
            const statusCodes = socialAuth.google.statusCodes;
            if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === 'ERR_REQUEST_CANCELED') {
                // user cancelled
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                Alert.alert("Error", "Google Play Services not available");
            } else {
                console.log('Google login error:', error);
                Alert.alert(
                    "Sign-In Issue",
                    "We couldn't complete Google Sign-In right now. Please try again in a moment.",
                    [{ text: "OK" }]
                );
            }
        }
    };

    const handleAppleLogin = async () => {
        if (!socialAuth.apple.isAvailable()) {
            Alert.alert("Unavailable", "Apple Sign-In is not available on this device.");
            return;
        }
        clearError();
        try {
            const sessionData = await socialAuth.apple.signIn();
            if (sessionData?.session?.access_token) {
                await loginWithApple(sessionData.session.access_token, sessionData.fullName || undefined);
                router.replace('/(tabs)');
            }
        } catch (e: any) {
            if (e.code === 'ERR_REQUEST_CANCELED') return;
            // Show real error for debugging — remove DEBUG prefix before final submission
            Alert.alert("DEBUG Apple Error", e.message || JSON.stringify(e));
        }
    };

    return (
        <ScreenWrapper>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                        <Link href="/" asChild>
                            <Pressable style={styles.backButton}>
                                <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                            </Pressable>
                        </Link>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.header}>
                        <GradientText colors={gradients.primaryExtended} style={styles.title}>Welcome Back</GradientText>
                        <Text style={styles.subtitle}>Sign in to continue tracking your biology</Text>
                    </Animated.View>

                    {error && (
                        <Animated.View entering={FadeInUp.duration(300)}>
                            <GlassView variant="error" intensity={20} style={styles.errorBox}>
                                <Ionicons name="alert-circle" size={18} color={colors.error} />
                                <Text style={styles.errorText}>{error}</Text>
                                <Pressable onPress={clearError} hitSlop={10}>
                                    <Ionicons name="close" size={18} color={colors.error} />
                                </Pressable>
                            </GlassView>
                        </Animated.View>
                    )}

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="you@example.com"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    autoCorrect={false}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="••••••••"
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="password"
                                    textContentType="password"
                                />
                                <Pressable style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
                                </Pressable>
                            </View>
                        </View>

                        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
                            <AnimatedButton
                                title={isLoading ? "Signing in..." : "Sign In"}
                                onPress={handleLogin}
                                disabled={isLoading}
                                icon={!isLoading ? <Ionicons name="arrow-forward" size={18} color="#fff" /> : null}
                                variant="primary"
                            />
                        </Animated.View>

                        <Animated.View entering={FadeInDown.delay(600).duration(400)} style={{ alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, width: '100%' }}>
                                <View style={{ height: 1, flex: 1, backgroundColor: colors.glass.border }} />
                                <Text style={{ ...typography.caption, color: colors.textMuted }}>Or continue with</Text>
                                <View style={{ height: 1, flex: 1, backgroundColor: colors.glass.border }} />
                            </View>

                            <View style={{ flexDirection: 'row', gap: spacing.md, width: '100%' }}>
                                {/* Google Button */}
                                <Pressable style={{ flex: 1 }} onPress={handleGoogleLogin}>
                                    <GlassView variant="light" intensity={30} style={styles.socialButton} borderRadius={borderRadius.lg}>
                                        <Ionicons name="logo-google" size={20} color={colors.textPrimary} />
                                        <Text style={styles.socialButtonText}>Google</Text>
                                    </GlassView>
                                </Pressable>

                                {/* Apple Button */}
                                <Pressable style={{ flex: 1 }} onPress={handleAppleLogin}>
                                    <GlassView variant="light" intensity={30} style={styles.socialButton} borderRadius={borderRadius.lg}>
                                        <Ionicons name="logo-apple" size={20} color={colors.textPrimary} />
                                        <Text style={styles.socialButtonText}>Apple</Text>
                                    </GlassView>
                                </Pressable>
                            </View>
                        </Animated.View>
                    </View>

                    <Animated.View entering={FadeInUp.delay(600).duration(400)} style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account?</Text>
                        <Link href="/register" asChild>
                            <Pressable>
                                <Text style={styles.footerLink}>Sign Up</Text>
                            </Pressable>
                        </Link>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenWrapper >
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: spacing.lg,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.light,
        borderWidth: 0,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    header: {
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        marginBottom: spacing.xs,
        letterSpacing: -0.5,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
    },
    errorText: {
        ...typography.bodySmall,
        color: colors.error,
        flex: 1,
    },
    form: {
        gap: spacing.lg,
    },
    inputGroup: {
        gap: spacing.xs,
    },
    label: {
        ...typography.label,
        color: colors.textSecondary,
        marginLeft: spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 0,
        borderColor: 'transparent',
    },
    inputIcon: {
        marginRight: spacing.sm,
    },
    input: {
        flex: 1,
        paddingVertical: spacing.md,
        color: colors.textPrimary,
        ...typography.body,
    },
    eyeButton: {
        padding: spacing.xs,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.xs,
        marginTop: 'auto',
        paddingTop: spacing.xl,
    },
    footerText: {
        ...typography.body,
        color: colors.textSecondary,
    },
    footerLink: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '600',
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12, // slightly smaller than main input
        gap: spacing.sm,
    },
    socialButtonText: {
        ...typography.bodySmall,
        fontWeight: '600',
        color: colors.textPrimary,
    },
});
