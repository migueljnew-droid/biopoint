import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { RegisterSchema } from '@biopoint/shared';
import { colors, spacing, typography, borderRadius, gradients } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import { ScreenWrapper, GlassView, AnimatedButton, GradientText } from '../src/components/ui';
import { socialAuth } from '../src/services/socialAuth';

export default function RegisterScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { register, loginWithGoogle, loginWithApple, isLoading, error, clearError } = useAuthStore();

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

    const handleGoogleSignUp = async () => {
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
            } else {
                Alert.alert(
                    "Sign-In Issue",
                    "We couldn't complete Google Sign-In right now. Please try again in a moment.",
                    [{ text: "OK" }]
                );
            }
        }
    };

    const handleAppleSignUp = async () => {
        if (!socialAuth.apple.isAvailable()) {
            Alert.alert("Unavailable", "Apple Sign-In is not available on this device.");
            return;
        }
        try {
            const sessionData2 = await socialAuth.apple.signIn();
            if (sessionData2?.session?.access_token) {
                await loginWithApple(sessionData2.session.access_token, sessionData2.fullName || undefined);
                router.replace('/(tabs)');
            }
        } catch (e: any) {
            if (e.code === 'ERR_REQUEST_CANCELED') return;
            if (__DEV__) console.log('Apple signup error:', e);
            Alert.alert("Sign-In Failed", "Apple Sign-In could not be completed. Please try again.");
        }
    };

    const handleRegister = async () => {
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }
        const result = RegisterSchema.safeParse({ email, password });
        if (!result.success) {
            Alert.alert('Error', result.error.errors[0]?.message ?? 'Invalid input');
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        try {
            await register(email, password);
            router.replace('/onboarding');
        } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const renderInputField = (label: string, value: string, onChangeText: (t: string) => void, placeholder: string, icon: string, field: string, options?: { keyboardType?: any; secureTextEntry?: boolean; showToggle?: boolean }) => {
        return (
            <View style={styles.inputGroup as any}>
                <Text style={styles.label}>{label}</Text>
                <View style={styles.inputBox}>
                    <Ionicons name={icon as any} size={18} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        value={value}
                        onChangeText={onChangeText}
                        placeholder={placeholder}
                        placeholderTextColor={colors.textMuted}
                        keyboardType={options?.keyboardType}
                        secureTextEntry={options?.secureTextEntry && !showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete={
                            field === 'email' ? 'email' :
                                field === 'password' || field === 'confirm' ? 'password' :
                                    'off'
                        }
                        textContentType={
                            field === 'email' ? 'emailAddress' :
                                field === 'password' || field === 'confirm' ? 'password' :
                                    'none'
                        }
                    />
                    {options?.showToggle && (
                        <Pressable style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
                        </Pressable>
                    )}
                </View>
            </View>
        );
    };

    return (
        <ScreenWrapper>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                        <Link href="/" asChild>
                            <Pressable style={styles.backButton}>
                                <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                            </Pressable>
                        </Link>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.header}>
                        <GradientText colors={gradients.primaryExtended} style={styles.title}>Create Account</GradientText>
                        <Text style={styles.subtitle}>Start tracking your biology today</Text>
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
                        {renderInputField("Email", email, setEmail, "you@example.com", "mail-outline", "email", { keyboardType: "email-address" })}
                        {renderInputField("Password", password, setPassword, "Min. 6 characters", "lock-closed-outline", "password", { secureTextEntry: true, showToggle: true })}
                        {renderInputField("Confirm Password", confirmPassword, setConfirmPassword, "Repeat password", "shield-checkmark-outline", "confirm", { secureTextEntry: true })}

                        <View>
                            <AnimatedButton
                                title={isLoading ? "Creating Account..." : "Create Account"}
                                onPress={handleRegister}
                                disabled={isLoading}
                                icon={!isLoading ? <Ionicons name="arrow-forward" size={18} color="#fff" /> : null}
                                variant="primary"
                            />
                        </View>

                        <View style={{ alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, width: '100%' }}>
                                <View style={{ height: 1, flex: 1, backgroundColor: colors.glass.border }} />
                                <Text style={{ ...typography.caption, color: colors.textMuted }}>Or sign up with</Text>
                                <View style={{ height: 1, flex: 1, backgroundColor: colors.glass.border }} />
                            </View>

                            <View style={{ flexDirection: 'row', gap: spacing.md, width: '100%' }}>
                                <Pressable style={{ flex: 1 }} onPress={handleGoogleSignUp}>
                                    <View style={styles.socialButton}>
                                        <Ionicons name="logo-google" size={20} color={colors.textPrimary} />
                                        <Text style={styles.socialButtonText}>Google</Text>
                                    </View>
                                </Pressable>

                                <Pressable style={{ flex: 1 }} onPress={handleAppleSignUp}>
                                    <View style={styles.socialButton}>
                                        <Ionicons name="logo-apple" size={20} color={colors.textPrimary} />
                                        <Text style={styles.socialButtonText}>Apple</Text>
                                    </View>
                                </Pressable>
                            </View>
                        </View>
                    </View>

                    <Animated.View entering={FadeInUp.delay(700).duration(400)} style={styles.footer}>
                        <Text style={styles.footerText}>Already have an account?</Text>
                        <Link href="/login" asChild>
                            <Pressable><Text style={styles.footerLink}>Sign In</Text></Pressable>
                        </Link>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenWrapper>
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
        paddingVertical: spacing.xl,
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
        paddingVertical: 12,
        gap: spacing.sm,
        borderRadius: borderRadius.lg,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 0,
        borderColor: 'transparent',
    },
    socialButtonText: {
        ...typography.bodySmall,
        fontWeight: '600',
        color: colors.textPrimary,
    },
});
