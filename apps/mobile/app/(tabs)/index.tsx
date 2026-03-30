import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Modal, Platform, Alert, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';
import { useDashboardStore } from '../../src/store/dashboardStore';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { WeightPicker, ScreenWrapper, GlassView, AnimatedButton, GlassPicker, ScoreChart, DigitalTwinViewer, BreathingGuide } from '../../src/components';
import { TodayStack } from '../../src/components/TodayStack';
import { useStacksStore } from '../../src/store/stacksStore';
import Animated, { FadeInDown, FadeInRight, SlideInDown, SlideOutDown, LinearTransition } from 'react-native-reanimated';
import { healthKitService } from '../../src/services/healthKitService';

export default function DashboardScreen() {
    const { bioPointScore, weeklyTrend, scoreHistory, activeFasting, todayNutrition, isLoading, fetchDashboard, logToday } = useDashboardStore();
    const fetchStacks = useStacksStore((s) => s.fetchStacks);
    const [showLogModal, setShowLogModal] = useState(false);
    const [showTwinModal, setShowTwinModal] = useState(false);
    const [showBreathing, setShowBreathing] = useState(false);

    const chartData = scoreHistory?.map(s => s.score) || [];
    const chartLabels = scoreHistory?.map(s => new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' })) || [];
    const [logData, setLogData] = useState({
        sleepHours: '7.5',
        sleepQuality: '7',
        energyLevel: '7',
        focusLevel: '7',
        moodLevel: '7',
        weightKg: '75'
    });

    const handleBioSync = async () => {
        Alert.alert(
            "Bio-Sync",
            "Requesting access to HealthKit...",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Connect",
                    onPress: async () => {
                        const authorized = await healthKitService.init();
                        if (authorized) {
                            const [sleep, steps] = await Promise.all([
                                healthKitService.getSleep(),
                                healthKitService.getSteps()
                            ]);

                            // Update Log Data State (for visual confirmation before save)
                            setLogData(prev => ({
                                ...prev,
                                sleepHours: sleep > 0 ? sleep.toFixed(1) : prev.sleepHours,
                                // Note: Steps aren't displayed in log modal but sync confirms connection
                            }));

                            Alert.alert("Sync Successful", `Retrieved:\n- Sleep: ${sleep.toFixed(1)} hrs\n- Steps: ${steps}`);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } else {
                            Alert.alert("Sync Failed", "HealthKit permissions denied or unavailable.");
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        }
                    }
                }
            ]
        );
    };

    useEffect(() => { fetchDashboard(); fetchStacks(); }, []);

    const handleLogSubmit = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await logToday({
            sleepHours: logData.sleepHours ? parseFloat(logData.sleepHours) : undefined,
            sleepQuality: logData.sleepQuality ? parseInt(logData.sleepQuality) : undefined,
            energyLevel: logData.energyLevel ? parseInt(logData.energyLevel) : undefined,
            focusLevel: logData.focusLevel ? parseInt(logData.focusLevel) : undefined,
            moodLevel: logData.moodLevel ? parseInt(logData.moodLevel) : undefined,
            weightKg: logData.weightKg ? parseFloat(logData.weightKg) : undefined,
        });
        setShowLogModal(false);
        setLogData({ sleepHours: '', sleepQuality: '', energyLevel: '', focusLevel: '', moodLevel: '', weightKg: '' });
    };



    const score = bioPointScore?.score ?? 0;
    const getScoreVariant = () => {
        if (score >= 80) return { color: colors.success, glow: shadows.successGlow, borderColor: colors.success };
        if (score >= 60) return { color: colors.warning, glow: shadows.warningGlow, borderColor: colors.warning };
        return { color: colors.error, glow: shadows.errorGlow, borderColor: colors.error };
    };
    const scoreStyles = getScoreVariant();

    return (
        <ScreenWrapper withGradient={true}>


            <View style={styles.header}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start' }}>
                    <Image
                        source={require('../../assets/logo-new.png')}
                        style={{ width: 500, height: 140, resizeMode: 'contain' }}
                    />
                </View>
                <View style={{ position: 'absolute', right: 0, top: 0, flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={handleBioSync} style={styles.iconButton}>
                        <GlassView variant="light" borderRadius={borderRadius.full} style={styles.iconButtonInner}>
                            <Ionicons name="sync" size={20} color={colors.accent} />
                        </GlassView>
                    </Pressable>
                    <Pressable onPress={() => router.push('/settings' as any)} style={styles.iconButton}>
                        <GlassView variant="light" borderRadius={borderRadius.full} style={styles.iconButtonInner}>
                            <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
                        </GlassView>
                    </Pressable>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchDashboard} tintColor={colors.primary} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* BioPoint Score Hero */}
                <Animated.View entering={FadeInDown.duration(600)}>
                    <GlassView variant="medium" borderRadius={borderRadius.xl} style={[styles.scoreCard, { borderColor: scoreStyles.borderColor }]}>
                        <View style={styles.scoreHeader}>
                            <Text style={styles.scoreLabel}>BIOPOINT SCORE</Text>
                            <View style={[styles.trendBadge, { backgroundColor: weeklyTrend !== null && weeklyTrend >= 0 ? colors.successMuted : colors.errorMuted }]}>
                                <Ionicons name={weeklyTrend !== null && weeklyTrend >= 0 ? 'trending-up' : 'trending-down'} size={12} color={weeklyTrend !== null && weeklyTrend >= 0 ? colors.success : colors.error} />
                                <Text style={[styles.trendText, { color: weeklyTrend !== null && weeklyTrend >= 0 ? colors.success : colors.error }]}>
                                    {weeklyTrend !== null ? `${weeklyTrend > 0 ? '+' : ''}${weeklyTrend}` : '0'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.scoreDisplay}>
                            <Text style={[styles.scoreValue, { color: scoreStyles.color }]}>{score}</Text>
                            <Text style={styles.scoreTotal}>/100</Text>
                        </View>


                        <View style={{ marginTop: spacing.md, width: '100%', alignItems: 'center' }}>
                            {chartData.length > 1 && (
                                <ScoreChart data={chartData} labels={chartLabels} />
                            )}
                        </View>
                    </GlassView>
                </Animated.View>

                {/* Today's Stack Checklist */}
                <TodayStack />

                {/* The Oracle - Coming Soon */}
                <Animated.View entering={FadeInDown.delay(100).springify()}>
                    <Pressable onPress={() => Alert.alert('Coming Soon', 'The Oracle AI assistant is launching soon. Stay tuned!')} style={styles.oracleCard}>
                        <GlassView variant="heavy" borderRadius={borderRadius.lg} style={styles.oracleContent}>
                            <View style={styles.oracleIconContainer}>
                                <Ionicons name="sparkles" size={24} color={colors.primary} />
                            </View>
                            <View style={styles.oracleTextContainer}>
                                <Text style={styles.oracleTitle}>The Oracle</Text>
                                <Text style={styles.oracleDesc}>AI-Powered Analysis — Coming Soon</Text>
                            </View>
                            <View style={{ backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                <Text style={{ color: '#FBBF24', fontSize: 11, fontWeight: '600' }}>SOON</Text>
                            </View>
                        </GlassView>
                    </Pressable>
                </Animated.View>



                {/* Active Fast Mini-Card */}
                {activeFasting && (
                    <Animated.View entering={FadeInDown.delay(150)}>
                        <Pressable onPress={() => router.push('/(tabs)/nutrition' as any)}>
                            <GlassView variant="medium" borderRadius={borderRadius.lg} style={[styles.miniCard, { borderLeftColor: '#f59e0b', borderLeftWidth: 3 }]}>
                                <View style={styles.miniCardIcon}>
                                    <Ionicons name="timer" size={22} color="#f59e0b" />
                                </View>
                                <View style={styles.miniCardText}>
                                    <Text style={styles.miniCardTitle}>{activeFasting.protocolName}</Text>
                                    <Text style={styles.miniCardSub}>Fasting active</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                            </GlassView>
                        </Pressable>
                    </Animated.View>
                )}

                {/* Today's Nutrition Mini-Card */}
                {todayNutrition && todayNutrition.mealCount > 0 && (
                    <Animated.View entering={FadeInDown.delay(175)}>
                        <Pressable onPress={() => router.push('/(tabs)/nutrition' as any)}>
                            <GlassView variant="medium" borderRadius={borderRadius.lg} style={[styles.miniCard, { borderLeftColor: colors.accent, borderLeftWidth: 3 }]}>
                                <View style={[styles.miniCardIcon, { backgroundColor: 'rgba(74, 222, 128, 0.1)' }]}>
                                    <Ionicons name="restaurant" size={22} color={colors.accent} />
                                </View>
                                <View style={styles.miniCardText}>
                                    <Text style={styles.miniCardTitle}>{todayNutrition.totalCalories} cal</Text>
                                    <Text style={styles.miniCardSub}>{todayNutrition.mealCount} meal{todayNutrition.mealCount !== 1 ? 's' : ''} logged</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                            </GlassView>
                        </Pressable>
                    </Animated.View>
                )}

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <Animated.View style={styles.actionsGrid} layout={LinearTransition.springify()}>
                    <Animated.View entering={FadeInRight.delay(200)}>
                        <ActionButton icon="create" label="Log" onPress={() => setShowLogModal(true)} delay={0} />
                    </Animated.View>
                    <Animated.View entering={FadeInRight.delay(225)}>
                        <ActionButton icon="restaurant" label="Eat" onPress={() => router.push('/(tabs)/nutrition' as any)} delay={1} />
                    </Animated.View>
                    <Animated.View entering={FadeInRight.delay(250)}>
                        <ActionButton icon="layers" label="Stack" onPress={() => router.push('/(tabs)/stacks')} delay={2} />
                    </Animated.View>
                    <Animated.View entering={FadeInRight.delay(300)}>
                        <ActionButton icon="flask" label="Labs" onPress={() => router.push('/(tabs)/labs')} delay={3} />
                    </Animated.View>
                    <Animated.View entering={FadeInRight.delay(350)}>
                        <ActionButton icon="infinite" label="Breathe" onPress={() => setShowBreathing(true)} delay={4} />
                    </Animated.View>
                </Animated.View>

                <Animated.View entering={FadeInRight.delay(400)} layout={LinearTransition}>
                    <Pressable style={styles.breatheCard} onPress={() => setShowTwinModal(true)}>
                        <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.breatheContent}>
                            <View style={styles.breatheIcon}>
                                <Ionicons name="body" size={24} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.breatheTitle}>Digital Twin</Text>
                                <Text style={styles.breatheDesc}>Visualize your physiological state</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
                        </GlassView>
                    </Pressable>
                </Animated.View>

                <View style={{ height: 100 }} />
            </ScrollView>



            {/* Digital Twin Modal */}
            <Modal visible={showTwinModal} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
                        <GlassView variant="heavy" style={{ padding: 0, borderRadius: borderRadius.xl, overflow: 'hidden' }} borderRadius={borderRadius.xl}>
                            <View style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
                                <Pressable onPress={() => setShowTwinModal(false)} style={styles.closeButton}>
                                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                                </Pressable>
                            </View>
                            <DigitalTwinViewer />
                        </GlassView>
                    </Animated.View>
                </View>
            </Modal>

            {/* Log Modal */}
            <Modal visible={showLogModal} animationType="fade" transparent>
                {/* ... existing log modal content ... */}
                <View style={styles.modalOverlay}>
                    <Animated.View
                        entering={SlideInDown}
                        exiting={SlideOutDown}
                        style={{ flex: 1, justifyContent: 'flex-end' }}
                    >
                        <GlassView variant="heavy" style={styles.modalContent} borderRadius={borderRadius.xxl}>
                            <View style={styles.modalHandle} />
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Daily Log</Text>
                                <Pressable onPress={() => setShowLogModal(false)} style={styles.closeButton}>
                                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                                </Pressable>
                            </View>
                            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                                <GlassPicker
                                    label="Sleep Duration"
                                    value={logData.sleepHours}
                                    onChange={(v) => setLogData({ ...logData, sleepHours: v })}
                                    options={Array.from({ length: 24 }, (_, i) => ({ label: `${(i / 2 + 4).toFixed(1)} hrs`, value: (i / 2 + 4).toString() }))}
                                />
                                <GlassPicker
                                    label="Energy Level"
                                    value={logData.energyLevel}
                                    onChange={(v) => setLogData({ ...logData, energyLevel: v })}
                                    options={Array.from({ length: 10 }, (_, i) => ({ label: `${i + 1}`, value: (i + 1).toString() }))}
                                />
                                <GlassPicker
                                    label="Focus Level"
                                    value={logData.focusLevel}
                                    onChange={(v) => setLogData({ ...logData, focusLevel: v })}
                                    options={Array.from({ length: 10 }, (_, i) => ({ label: `${i + 1}`, value: (i + 1).toString() }))}
                                />
                                <GlassPicker
                                    label="Mood"
                                    value={logData.moodLevel}
                                    onChange={(v) => setLogData({ ...logData, moodLevel: v })}
                                    options={Array.from({ length: 10 }, (_, i) => ({ label: `${i + 1}`, value: (i + 1).toString() }))}
                                />

                                <View style={styles.logInputGroup}>
                                    <Text style={styles.logInputLabel}>Weight</Text>
                                    <WeightPicker value={logData.weightKg} onChange={(v) => setLogData({ ...logData, weightKg: v })} placeholder="Select weight" />
                                </View>
                            </ScrollView>
                            <View style={styles.modalFooter}>
                                <AnimatedButton title="Save Entry" onPress={handleLogSubmit} variant="primary" />
                            </View>
                        </GlassView>
                    </Animated.View>
                </View>
            </Modal>

            <BreathingGuide visible={showBreathing} onClose={() => setShowBreathing(false)} />
        </ScreenWrapper >
    );
}

function ActionButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void, delay: number }) {
    return (
        <Pressable onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
        }}>
            <GlassView variant="light" intensity={30} borderRadius={borderRadius.xl} style={styles.actionButton}>
                <View style={styles.actionIcon}>
                    <Ionicons name={icon as any} size={24} color={colors.primary} />
                </View>
                <Text style={styles.actionLabel}>{label}</Text>
            </GlassView>
        </Pressable>
    );
}





const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: 0,
        paddingBottom: 0,
        height: 30, // Header minimized, Logo maximized
        zIndex: 100, // Ensure logo floats above scrolling content
    },
    greetingSubtitle: {
        ...typography.bodySmall,
        color: colors.textSecondary,
    },
    greetingTitle: {
        fontSize: 24,
        fontWeight: '700',
    },
    settingsButton: {

    },
    iconButton: {
        // Wrapper
    },
    iconButtonInner: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingTop: 20, // Reduced to move cards up
    },
    scoreCard: {
        padding: spacing.xl,
        marginBottom: spacing.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        shadowColor: '#1B4B7A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
    },
    scoreHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: spacing.xs,
    },
    scoreLabel: {
        ...typography.overline,
        color: colors.textSecondary,
        letterSpacing: 1,
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        gap: 4,
    },
    trendText: {
        fontSize: 12,
        fontWeight: '700',
    },
    scoreDisplay: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    scoreValue: {
        fontSize: 64,
        fontWeight: '800',
        lineHeight: 72,
        letterSpacing: -2,
    },
    scoreTotal: {
        fontSize: 18,
        color: colors.textMuted,
        fontWeight: '500',
        marginLeft: 4,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    sectionTitle: {
        ...typography.h4,
        color: colors.textPrimary,
    },
    sectionLink: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '600',
    },

    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: spacing.sm,
        marginBottom: spacing.xxl,
    },
    actionButton: {
        width: 72,
        height: 72,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    actionIcon: {
        marginBottom: 4,
    },
    actionLabel: {
        fontSize: 11,
        color: colors.textSecondary,
        fontWeight: '500',
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        height: '85%',
        padding: spacing.lg,
        borderWidth: 0,
        borderColor: 'transparent',
        backgroundColor: colors.backgroundSecondary, // Fallback opacity
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    closeButton: {
        padding: 4,
    },
    modalScroll: {
        flex: 1,
    },
    modalFooter: {
        paddingTop: spacing.md,
        paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    },
    // Log Input
    logInputGroup: {
        marginBottom: spacing.lg,
    },
    logInputLabel: {
        ...typography.label,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        marginLeft: 4,
    },
    logInputLabelFocused: {
        color: colors.primary,
    },
    logInput: {
        padding: spacing.md,
        color: colors.textPrimary,
        ...typography.body,
    },
    breatheCard: {
        marginBottom: spacing.xl,
    },
    breatheContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        gap: spacing.md,
    },
    breatheIcon: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.full,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    breatheTitle: {
        ...typography.h4,
        color: colors.textPrimary,
    },
    breatheDesc: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    // Mini Cards (Fasting/Nutrition on Dashboard)
    miniCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        marginBottom: spacing.md,
        gap: spacing.md,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    miniCardIcon: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.full,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    miniCardText: {
        flex: 1,
    },
    miniCardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    miniCardSub: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 1,
    },
    // Oracle
    oracleCard: {
        marginBottom: spacing.xl,
    },
    oracleContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        gap: spacing.md,
        borderWidth: 0,
        borderColor: colors.primary + '40', // Low opacity primary
    },
    oracleIconContainer: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    oracleTextContainer: {
        flex: 1,
    },
    oracleTitle: {
        ...typography.h4,
        color: colors.textPrimary,
        marginBottom: 2,
    },
    oracleDesc: {
        ...typography.caption,
        color: colors.textSecondary,
    },
});
