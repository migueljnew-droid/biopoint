import React from 'react';
import { View, Text, StyleSheet, Pressable, Switch, Alert, Platform } from 'react-native';
import { router, Stack } from 'expo-router';
import { colors, spacing, borderRadius } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import { biometricService } from '../src/services/biometricService';
import { useAuditStore } from '../src/services/auditService';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper, GlassView, AnimatedButton } from '../src/components';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '../src/store/settingsStore';
import { useSubscriptionStore } from '../src/store/subscriptionStore';

export default function SettingsScreen() {
    const { user, logout } = useAuthStore();
    const { isPremium } = useSubscriptionStore();
    const { logEvent } = useAuditStore();
    const {
        notificationsEnabled, setNotificationsEnabled,
        bioLockEnabled, setBioLockEnabled,
        units, setUnits
    } = useSettingsStore();

    const handleBioLockToggle = async (value: boolean) => {
        if (value) {
            // Enable
            try {
                const authenticated = await biometricService.authenticate('Authenticate to enable Bio-Lock');
                if (authenticated) {
                    setBioLockEnabled(true);
                    logEvent('BIO_LOCK_ACCESS', 'SUCCESS', 'Enabled Bio-Lock');
                    Alert.alert("Bio-Lock Enabled", "Your health data is now secured.");
                } else {
                    setBioLockEnabled(false);
                    logEvent('BIO_LOCK_ACCESS', 'FAILURE', 'Auth failed during enable');
                }
            } catch (error) {
                Alert.alert("Error", "Biometrics not available.");
                setBioLockEnabled(false);
            }
        } else {
            // Disable
            const authenticated = await biometricService.authenticate('Authenticate to disable Bio-Lock');
            if (authenticated) {
                setBioLockEnabled(false);
            } else {
                setBioLockEnabled(true); // Revert
            }
        }
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    await logout();
                    router.replace('/');
                }
            },
        ]);
    };

    const SettingItem = ({ icon, label, value, onPress, type = 'link' }: any) => (
        <Pressable
            style={({ pressed }) => [styles.settingItem, pressed && styles.pressed]}
            onPress={() => {
                if (type !== 'switch') {
                    Haptics.selectionAsync();
                }
                onPress?.(type === 'switch' ? !value : undefined);
            }}
        >
            <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                    <Ionicons name={icon} size={20} color={colors.primary} />
                </View>
                <Text style={styles.settingLabel}>{label}</Text>
            </View>

            {type === 'link' && (
                <View style={styles.settingRight}>
                    {value && <Text style={styles.settingValue}>{value}</Text>}
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
            )}

            {type === 'switch' && (
                <Switch
                    value={value}
                    onValueChange={(v) => {
                        Haptics.selectionAsync();
                        onPress?.(v);
                    }}
                    trackColor={{ false: colors.glass.border, true: colors.primary }}
                    thumbColor={'#fff'}
                />
            )}
        </Pressable>
    );

    const SectionHeader = ({ title }: { title: string }) => (
        <Text style={styles.sectionHeader}>{title}</Text>
    );

    return (
        <ScreenWrapper withGradient={true}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <GlassView variant="light" borderRadius={borderRadius.full} style={styles.iconButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </GlassView>
                </Pressable>
                <Text style={styles.title}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <Animated.ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                layout={LinearTransition}
            >
                {/* Profile Card */}
                <Animated.View entering={FadeInDown.delay(100).springify()}>
                    <GlassView variant="medium" borderRadius={borderRadius.xl} style={styles.profileCard}>
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{user?.email?.[0]?.toUpperCase() ?? 'U'}</Text>
                            </View>
                            <Pressable style={styles.editAvatarButton} onPress={() => router.push('/settings/profile' as any)}>
                                <Ionicons name="camera" size={14} color="#fff" />
                            </Pressable>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>Athlete</Text>
                            <Text style={styles.profileEmail}>{user?.email}</Text>
                            <View style={styles.badgeContainer}>
                                <GlassView variant="light" borderRadius={borderRadius.full} style={styles.planBadge}>
                                    <Text style={styles.planText}>{isPremium ? 'BIOPOINT+' : 'FREE PLAN'}</Text>
                                </GlassView>
                            </View>
                        </View>
                    </GlassView>
                </Animated.View>

                {/* Premium Banner */}
                {!isPremium && <Animated.View entering={FadeInDown.delay(200).springify()}>
                    <Pressable style={styles.premiumBanner} onPress={() => router.push('/premium' as any)}>
                        <GlassView variant="heavy" borderRadius={borderRadius.xl} style={styles.premiumContent}>
                            <View style={styles.premiumHeader}>
                                <Ionicons name="star" size={24} color={colors.warning} />
                                <Text style={styles.premiumTitle}>Upgrade to BioPoint+</Text>
                            </View>
                            <Text style={styles.premiumDesc}>Unlock advanced analytics, unlimited stacks, and AI lab analysis.</Text>
                            <AnimatedButton
                                title="Upgrade Now"
                                onPress={() => router.push('/premium' as any)}
                                variant="primary"
                                style={{ marginTop: spacing.md }}
                            />
                        </GlassView>
                    </Pressable>
                </Animated.View>}

                {/* Account Settings */}
                <Animated.View entering={FadeInDown.delay(300).springify()}>
                    <SectionHeader title="Account" />
                    <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.sectionContainer}>
                        <SettingItem
                            icon="person-outline"
                            label="Personal Details"
                            onPress={() => router.push('/settings/profile' as any)}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="barbell-outline"
                            label="My Goals"
                            onPress={() => router.push('/settings/goals' as any)}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="medical-outline"
                            label="Health Profile"
                            onPress={() => router.push('/settings/health' as any)}
                        />
                    </GlassView>
                </Animated.View>

                {/* Apple Health Integration */}
                {Platform.OS === 'ios' && (
                    <Animated.View entering={FadeInDown.delay(350).springify()}>
                        <SectionHeader title="Apple Health (HealthKit)" />
                        <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.sectionContainer}>
                            <View style={styles.healthKitInfo}>
                                <View style={styles.healthKitHeader}>
                                    <Ionicons name="heart" size={20} color="#FF2D55" />
                                    <Text style={styles.healthKitTitle}>HealthKit Integration</Text>
                                </View>
                                <Text style={styles.healthKitDesc}>
                                    BioPoint reads the following data from Apple Health to calculate your BioPoint score:
                                </Text>
                                <Text style={styles.healthKitItem}>{'\u2022'} Step Count (daily activity)</Text>
                                <Text style={styles.healthKitItem}>{'\u2022'} Sleep Analysis (sleep duration)</Text>
                                <Text style={styles.healthKitItem}>{'\u2022'} Heart Rate (resting heart rate)</Text>
                                <Text style={styles.healthKitDesc}>
                                    This data is read with your explicit permission and is displayed on your dashboard. It is never shared with third parties or used for advertising.
                                </Text>
                                <Text style={styles.healthKitPowered}>Powered by Apple HealthKit</Text>
                            </View>
                        </GlassView>
                    </Animated.View>
                )}

                {/* App Preferences */}
                <Animated.View entering={FadeInDown.delay(400).springify()}>
                    <SectionHeader title="Preferences" />
                    <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.sectionContainer}>
                        <SettingItem
                            icon="notifications-outline"
                            label="Push Notifications"
                            type="switch"
                            value={notificationsEnabled}
                            onPress={setNotificationsEnabled}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="finger-print-outline"
                            label="Face ID / Touch ID"
                            type="switch"
                            value={bioLockEnabled}
                            onPress={handleBioLockToggle}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="scale-outline"
                            label="Units"
                            value={units === 'metric' ? 'Metric (kg/cm)' : 'Imperial (lb/in)'}
                            onPress={() => setUnits(units === 'metric' ? 'imperial' : 'metric')}
                        />
                    </GlassView>
                </Animated.View>

                {/* Support & Legal */}
                <Animated.View entering={FadeInDown.delay(500).springify()}>
                    <SectionHeader title="Support" />
                    <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.sectionContainer}>
                        <SettingItem
                            icon="help-circle-outline"
                            label="Help Center"
                            onPress={() => router.push('/settings/help' as any)}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="shield-checkmark-outline"
                            label="Privacy Policy"
                            onPress={() => router.push('/settings/privacy' as any)}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="list-outline"
                            label="Access Logs (HIPAA)"
                            onPress={() => router.push('/settings/audit' as any)}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="download-outline"
                            label="Export My Data"
                            onPress={() => router.push('/settings/data-export' as any)}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="trash-outline"
                            label="Delete Account"
                            onPress={() => router.push('/settings/account-deletion' as any)}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="log-out-outline"
                            label="Log Out"
                            onPress={handleLogout}
                        />
                    </GlassView>
                </Animated.View>

                <Text style={styles.version}>Version 1.0.0 (Build 124)</Text>
                <View style={{ height: 40 }} />

            </Animated.ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    iconButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
    },
    profileCard: {
        padding: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0,
        borderColor: 'transparent',
    },
    avatarText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    editAvatarButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.accent,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0,
        borderColor: 'transparent',
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    profileEmail: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 8,
    },
    badgeContainer: {
        flexDirection: 'row',
    },
    planBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    planText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.textSecondary,
        letterSpacing: 0.5,
    },
    premiumBanner: {
        marginBottom: spacing.xl,
    },
    premiumContent: {
        padding: spacing.lg,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    premiumHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    premiumTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    premiumDesc: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.md,
        lineHeight: 20,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    sectionContainer: {
        marginBottom: spacing.xl,
        overflow: 'hidden',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
    },
    pressed: {
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingLabel: {
        fontSize: 16,
        color: colors.textPrimary,
    },
    settingRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    settingValue: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    divider: {
        height: 1,
        backgroundColor: colors.glass.border,
        marginLeft: 56, // Align with text start
    },
    version: {
        textAlign: 'center',
        color: colors.textMuted,
        fontSize: 12,
        marginBottom: spacing.lg,
    },
    healthKitInfo: {
        padding: spacing.md,
    },
    healthKitHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    healthKitTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    healthKitDesc: {
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 19,
        marginBottom: spacing.sm,
    },
    healthKitItem: {
        fontSize: 13,
        color: colors.textPrimary,
        lineHeight: 20,
        paddingLeft: spacing.sm,
    },
    healthKitPowered: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.35)',
        fontWeight: '500',
        textAlign: 'center',
        marginTop: spacing.sm,
        letterSpacing: 0.3,
    },
});
