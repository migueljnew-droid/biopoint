import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, borderRadius, typography, withAlpha } from '../../theme';
import { GlassView, AnimatedButton } from '../ui';
import { useFastingStore } from '../../store/fastingStore';
import { FastingTimer } from './FastingTimer';
import { FastingZoneTimeline } from './FastingZoneTimeline';
import { ProtocolSelector } from './ProtocolSelector';
import { getZoneForHours } from '../../constants/fastingZones';

export function FastingView() {
    const {
        activeSession, protocols, stats,
        fetchActiveSession, fetchProtocols, fetchStats,
        startFast, endFast, cancelFast,
    } = useFastingStore();

    const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);

    useEffect(() => {
        fetchActiveSession();
        fetchProtocols();
        fetchStats();
    }, []);

    const handleStartFast = async () => {
        if (!selectedProtocol) {
            Alert.alert('Select Protocol', 'Choose a fasting protocol to start.');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await startFast(selectedProtocol);
    };

    const handleEndFast = () => {
        if (!activeSession) return;
        Alert.alert(
            'End Fast',
            'Are you sure you want to complete this fast?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Complete',
                    onPress: async () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        await endFast(activeSession.id);
                        fetchActiveSession();
                    },
                },
            ]
        );
    };

    const handleCancelFast = () => {
        if (!activeSession) return;
        Alert.alert(
            'Cancel Fast',
            'This will discard your current fast.',
            [
                { text: 'Keep Going', style: 'cancel' },
                {
                    text: 'Cancel Fast',
                    style: 'destructive',
                    onPress: async () => {
                        await cancelFast(activeSession.id);
                        fetchActiveSession();
                    },
                },
            ]
        );
    };

    // Active fast view
    if (activeSession) {
        const elapsedHours = (Date.now() - new Date(activeSession.startedAt).getTime()) / (1000 * 60 * 60);
        const targetHours = (new Date(activeSession.targetEndAt).getTime() - new Date(activeSession.startedAt).getTime()) / (1000 * 60 * 60);

        return (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <Animated.View entering={FadeInDown.duration(400)}>
                    <GlassView variant="medium" borderRadius={borderRadius.xl} style={[
                        styles.timerCard,
                        { borderColor: withAlpha(getZoneForHours(elapsedHours).glowColor, 0.25) },
                    ]}>
                        <Text style={[styles.protocolName, { color: getZoneForHours(elapsedHours).glowColor }]}>{activeSession.protocolName}</Text>
                        <FastingTimer
                            startedAt={activeSession.startedAt}
                            targetEndAt={activeSession.targetEndAt}
                            status={activeSession.status}
                        />
                        <View style={styles.actionRow}>
                            <AnimatedButton title="Complete Fast" onPress={handleEndFast} variant="primary" />
                            <Pressable onPress={handleCancelFast} style={styles.cancelLink} accessibilityRole="button">
                                <Text style={styles.cancelText}>Cancel</Text>
                            </Pressable>
                        </View>
                    </GlassView>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(100)}>
                    <Text style={styles.sectionTitle}>Metabolic Zones</Text>
                    <GlassView variant="light" borderRadius={borderRadius.xl} style={[
                        styles.zoneCard,
                        { borderColor: withAlpha(getZoneForHours(elapsedHours).glowColor, 0.2) },
                    ]}>
                        <FastingZoneTimeline elapsedHours={elapsedHours} targetHours={targetHours} />
                    </GlassView>
                </Animated.View>
            </ScrollView>
        );
    }

    // Idle view - select protocol and start
    return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Streak */}
            {stats && stats.currentStreak > 0 && (
                <Animated.View entering={FadeInDown}>
                    <GlassView variant="medium" borderRadius={borderRadius.xl} style={styles.streakCard}>
                        <Ionicons name="flame" size={28} color="#f59e0b" />
                        <View>
                            <Text style={styles.streakNumber}>{stats.currentStreak}</Text>
                            <Text style={styles.streakLabel}>day streak</Text>
                        </View>
                        <View style={styles.streakStats}>
                            <Text style={styles.statValue}>{stats.totalCompleted}</Text>
                            <Text style={styles.statLabel}>completed</Text>
                        </View>
                        <View style={styles.streakStats}>
                            <Text style={styles.statValue}>{Math.round(stats.totalHoursFasted)}h</Text>
                            <Text style={styles.statLabel}>total</Text>
                        </View>
                    </GlassView>
                </Animated.View>
            )}

            <Text style={styles.sectionTitle}>Choose Protocol</Text>
            <ProtocolSelector
                protocols={protocols}
                selectedSlug={selectedProtocol}
                onSelect={setSelectedProtocol}
            />

            <View style={styles.startContainer}>
                <AnimatedButton
                    title={selectedProtocol ? 'Start Fasting' : 'Select a Protocol'}
                    onPress={handleStartFast}
                    variant="primary"
                />
            </View>

            {/* Quick stats */}
            {stats && (
                <Animated.View entering={FadeInDown.delay(200)}>
                    <GlassView variant="light" borderRadius={borderRadius.xl} style={styles.statsCard}>
                        <View style={styles.statsRow}>
                            <StatItem label="Best Streak" value={`${stats.bestStreak}d`} />
                            <StatItem label="Longest Fast" value={`${stats.longestFastHours.toFixed(1)}h`} />
                            <StatItem label="Completion" value={`${Math.round(stats.completionRate * 100)}%`} />
                        </View>
                    </GlassView>
                </Animated.View>
            )}
        </ScrollView>
    );
}

function StatItem({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.statItem}>
            <Text style={styles.statItemValue}>{value}</Text>
            <Text style={styles.statItemLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 120,
    },
    timerCard: {
        padding: spacing.xl,
        alignItems: 'center',
        marginBottom: spacing.xl,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    protocolName: {
        ...typography.overline,
        color: colors.textSecondary,
        letterSpacing: 1,
        marginBottom: spacing.xs,
    },
    actionRow: {
        width: '100%',
        marginTop: spacing.lg,
        gap: spacing.sm,
    },
    cancelLink: {
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    cancelText: {
        fontSize: 14,
        color: colors.textMuted,
    },
    sectionTitle: {
        ...typography.h4,
        color: colors.textPrimary,
        marginBottom: spacing.md,
        marginTop: spacing.sm,
    },
    zoneCard: {
        padding: spacing.md,
        marginBottom: spacing.xl,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    streakCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        gap: spacing.md,
        marginBottom: spacing.xl,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    streakNumber: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    streakLabel: {
        fontSize: 12,
        color: colors.textMuted,
    },
    streakStats: {
        alignItems: 'center',
        marginLeft: 'auto',
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    statLabel: {
        fontSize: 11,
        color: colors.textMuted,
    },
    startContainer: {
        paddingHorizontal: spacing.lg,
        marginTop: spacing.xl,
        marginBottom: spacing.xl,
    },
    statsCard: {
        padding: spacing.lg,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statItemValue: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    statItemLabel: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 2,
    },
});
