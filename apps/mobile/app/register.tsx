import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { RegisterSchema } from '@biopoint/shared';
import { colors, spacing, typography, borderRadius, gradients, shadows } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import { ScreenWrapper, GlassView, AnimatedButton, GradientText } from '../src/components/ui';

export default function RegisterScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const { register, isLoading, error, clearError } = useAuthStore();

    React.useEffect(() => {
        clearError();
    }, []);

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

    const InputField = ({ label, value, onChangeText, placeholder, icon, keyboardType, secureTextEntry, showToggle, field, index }: any) => {
        const isFocused = focusedField === field;
        return (
            <Animated.View entering={FadeInDown.delay(300 + (index * 100)).duration(400)} style={styles.inputGroup as any}>
                <Text style={styles.label}>{label}</Text>
                <GlassView
                    variant={isFocused ? "selected" : "light"}
                    intensity={30}
                    borderRadius={borderRadius.lg}
                    style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}
                >
                    <Ionicons name={icon} size={18} color={isFocused ? colors.primary : colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        value={value}
                        onChangeText={onChangeText}
                        placeholder={placeholder}
                        placeholderTextColor={colors.textMuted}
                        keyboardType={keyboardType}
                        secureTextEntry={secureTextEntry && !showPassword}
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
                        onFocus={() => setFocusedField(field)}
                        onBlur={() => setFocusedField(null)}
                    />
                    {showToggle && (
                        <Pressable style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
                        </Pressable>
                    )}
                </GlassView>
            </Animated.View>
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
                        <InputField
                            index={0}
                            label="Email"
                            value={email}
                            onChangeText={setEmail}
                            placeholder="you@example.com"
                            icon="mail-outline"
                            keyboardType="email-address"
                            field="email"
                        />
                        <InputField
                            index={1}
                            label="Password"
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Min. 6 characters"
                            icon="lock-closed-outline"
                            secureTextEntry
                            showToggle
                            field="password"
                        />
                        <InputField
                            index={2}
                            label="Confirm Password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Repeat password"
                            icon="shield-checkmark-outline"
                            secureTextEntry
                            field="confirm"
                        />

                        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
                            <AnimatedButton
                                title={isLoading ? "Creating Account..." : "Create Account"}
                                onPress={handleRegister}
                                disabled={isLoading}
                                icon={!isLoading ? <Ionicons name="arrow-forward" size={18} color="#fff" /> : null}
                                variant="primary"
                            />
                        </Animated.View>
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
        borderWidth: 1,
        borderColor: colors.glass.border,
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
    inputContainerFocused: {
        backgroundColor: colors.primary, // Simplified since glassColored.primary.backgroundColor access is tricky if type mismatch
        borderColor: colors.primary,
        ...shadows.primaryGlow,
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
});
