import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { colors, spacing, typography, borderRadius, gradients, shadows } from '../src/theme';
import { ScreenWrapper, GlassView } from '../src/components';
import { api } from '../src/services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CorrelationDirection = 'improved' | 'worsened' | 'changed' | 'unchanged';

interface MarkerCorrelation {
    markerName: string;
    beforeValue: number;
    afterValue: number;
    unit: string;
    percentChange: number;       // signed: positive = went up, negative = went down
    direction: CorrelationDirection;
}

interface CorrelationResponse {
    stackName: string;
    stackStartDate: string;
    markersWithCorrelation: number;
    correlations: MarkerCorrelation[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function directionColor(direction: CorrelationDirection): string {
    switch (direction) {
        case 'improved':  return colors.success;
        case 'worsened':  return colors.error;
        case 'changed':   return colors.warning;
        case 'unchanged': return colors.textMuted;
    }
}

function directionBg(direction: CorrelationDirection): string {
    switch (direction) {
        case 'improved':  return colors.glassColored.success;
        case 'worsened':  return colors.glassColored.error;
        case 'changed':   return colors.glassColored.warning;
        case 'unchanged': return colors.glass.medium;
    }
}

function directionBorder(direction: CorrelationDirection): string {
    switch (direction) {
        case 'improved':  return colors.glassColored.successBorder;
        case 'worsened':  return colors.glassColored.errorBorder;
        case 'changed':   return colors.glassColored.warningBorder;
        case 'unchanged': return colors.glass.border;
    }
}

function directionIcon(direction: CorrelationDirection): string {
    switch (direction) {
        case 'improved':  return 'trending-up';
        case 'worsened':  return 'trending-down';
        case 'changed':   return 'swap-vertical';
        case 'unchanged': return 'remove';
    }
}

function directionLabel(direction: CorrelationDirection): string {
    switch (direction) {
        case 'improved':  return 'Improved';
        case 'worsened':  return 'Worsened';
        case 'changed':   return 'Changed';
        case 'unchanged': return 'Unchanged';
    }
}

function formatDate(isoDate: string): string {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPercent(pct: number): string {
    const abs = Math.abs(pct);
    const sign = pct > 0 ? '+' : pct < 0 ? '-' : '';
    return `${sign}${abs.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CorrelationCard({ item, index }: { item: MarkerCorrelation; index: number }) {
    const dColor  = directionColor(item.direction);
    const dBg     = directionBg(item.direction);
    const dBorder = directionBorder(item.direction);
    const dIcon   = directionIcon(item.direction);
    const dLabel  = directionLabel(item.direction);

    const pctColor = item.direction === 'improved'
        ? colors.success
        : item.direction === 'worsened'
        ? colors.error
        : colors.textMuted;

    return (
        <Animated.View entering={FadeInDown.delay(index * 70).springify()}>
            <GlassView variant="medium" style={styles.correlationCard} borderRadius={borderRadius.xl}>
                {/* Top row: marker name + direction badge */}
                <View style={styles.correlationHeader}>
                    <Text style={styles.markerName}>{item.markerName}</Text>
                    <View style={[styles.directionBadge, { backgroundColor: dBg, borderColor: dBorder }]}>
                        <Ionicons name={dIcon as any} size={12} color={dColor} />
                        <Text style={[styles.directionBadgeText, { color: dColor }]}>{dLabel}</Text>
                    </View>
                </View>

                {/* Value change row */}
                <View style={styles.valueRow}>
                    {/* Before */}
                    <View style={styles.valueBlock}>
                        <Text style={styles.valueLabel}>Before</Text>
                        <Text style={styles.valueNumber}>
                            {item.beforeValue}
                            <Text style={styles.valueUnit}> {item.unit}</Text>
                        </Text>
                    </View>

                    {/* Arrow */}
                    <View style={styles.arrowWrap}>
                        <View style={styles.arrowLine} />
                        <Ionicons name="arrow-forward" size={16} color={dColor} />
                    </View>

                    {/* After */}
                    <View style={styles.valueBlock}>
                        <Text style={styles.valueLabel}>After</Text>
                        <Text style={[styles.valueNumber, { color: dColor }]}>
                            {item.afterValue}
                            <Text style={styles.valueUnit}> {item.unit}</Text>
                        </Text>
                    </View>

                    {/* Percent change */}
                    <View style={styles.percentBlock}>
                        <Text style={[styles.percentChange, { color: pctColor }]}>
                            {item.direction === 'unchanged' ? 'No change' : formatPercent(item.percentChange)}
                        </Text>
                    </View>
                </View>

                {/* Phase 2.1: Add Victory Native timeline chart showing before/after values over time */}
                {/* TODO: Phase 2.1 — Add Victory Native timeline chart for this marker */}
            </GlassView>
        </Animated.View>
    );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

type ScreenPhase = 'loading' | 'empty' | 'results' | 'error';

export default function StackCorrelationScreen() {
    const { stackId } = useLocalSearchParams<{ stackId: string }>();

    const [phase, setPhase] = useState<ScreenPhase>('loading');
    const [data, setData]   = useState<CorrelationResponse | null>(null);

    const fetchCorrelation = useCallback(async () => {
        if (!stackId) return;
        setPhase('loading');
        try {
            const response = await api.get(`/stacks/${stackId}/correlate`);
            const payload: CorrelationResponse = response.data;
            if (payload.markersWithCorrelation === 0) {
                setData(payload);
                setPhase('empty');
            } else {
                // Sort by biggest movers: largest absolute percent change first, unchanged last
                const sorted = [...payload.correlations].sort((a, b) => {
                    if (a.direction === 'unchanged' && b.direction !== 'unchanged') return 1;
                    if (b.direction === 'unchanged' && a.direction !== 'unchanged') return -1;
                    return Math.abs(b.percentChange) - Math.abs(a.percentChange);
                });
                setData({ ...payload, correlations: sorted });
                setPhase('results');
            }
        } catch {
            setPhase('error');
        }
    }, [stackId]);

    useEffect(() => {
        fetchCorrelation();
    }, [fetchCorrelation]);

    // Shared header options factory
    const headerOptions = {
        headerShown: true,
        headerTransparent: true,
        headerTitle: 'Stack Correlation',
        headerTitleStyle: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' as const },
        headerLeft: () => (
            <Pressable
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.back();
                }}
                style={({ pressed }: { pressed: boolean }) => [styles.headerBackBtn, pressed && { opacity: 0.7 }]}
                hitSlop={12}
            >
                <GlassView variant="light" style={styles.headerBackInner} borderRadius={borderRadius.full}>
                    <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                </GlassView>
            </Pressable>
        ),
        headerBackground: () => (
            <LinearGradient
                colors={['rgba(10,10,15,0.95)', 'rgba(10,10,15,0)']}
                style={StyleSheet.absoluteFill}
            />
        ),
    };

    // ---------------------------------------------------------------------------
    // Render: Loading
    // ---------------------------------------------------------------------------
    if (phase === 'loading') {
        return (
            <ScreenWrapper withGradient>
                <Stack.Screen options={headerOptions} />
                <View style={styles.centeredState}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading correlation data...</Text>
                </View>
            </ScreenWrapper>
        );
    }

    // ---------------------------------------------------------------------------
    // Render: Error
    // ---------------------------------------------------------------------------
    if (phase === 'error') {
        return (
            <ScreenWrapper withGradient>
                <Stack.Screen options={headerOptions} />
                <View style={styles.centeredState}>
                    <GlassView variant="medium" style={styles.stateIconWrap} borderRadius={borderRadius.xxl}>
                        <Ionicons name="cloud-offline-outline" size={40} color={colors.error} />
                    </GlassView>
                    <Text style={styles.stateTitle}>Could Not Load Correlation Data</Text>
                    <Text style={styles.stateSubtext}>
                        Something went wrong while fetching your stack correlations. Please try again.
                    </Text>
                    <Pressable
                        onPress={fetchCorrelation}
                        style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.8 }]}
                    >
                        <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </Pressable>
                </View>
            </ScreenWrapper>
        );
    }

    // ---------------------------------------------------------------------------
    // Render: Empty
    // ---------------------------------------------------------------------------
    if (phase === 'empty') {
        return (
            <ScreenWrapper withGradient>
                <Stack.Screen options={headerOptions} />
                <View style={styles.centeredState}>
                    <Animated.View entering={FadeInDown.delay(0).springify()}>
                        <GlassView variant="medium" style={styles.stateIconWrap} borderRadius={borderRadius.xxl}>
                            <Ionicons name="analytics-outline" size={40} color={colors.textMuted} />
                        </GlassView>
                    </Animated.View>
                    <Animated.Text entering={FadeInDown.delay(80).springify()} style={styles.stateTitle}>
                        No Correlation Data Yet
                    </Animated.Text>
                    <Animated.Text entering={FadeInDown.delay(120).springify()} style={styles.stateSubtext}>
                        Upload labs before and after starting this stack to see correlations between
                        your biomarkers and your protocol.
                    </Animated.Text>

                    <Animated.View entering={FadeInUp.delay(180).springify()}>
                        <Pressable
                            onPress={() => router.push('/(tabs)/labs' as any)}
                            style={({ pressed }) => [styles.uploadLabsButton, pressed && { opacity: 0.85 }]}
                        >
                            <LinearGradient
                                colors={gradients.primary}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            />
                            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                            <Text style={styles.uploadLabsButtonText}>Upload Lab Report</Text>
                        </Pressable>
                    </Animated.View>
                </View>
            </ScreenWrapper>
        );
    }

    // ---------------------------------------------------------------------------
    // Render: Results
    // ---------------------------------------------------------------------------
    return (
        <ScreenWrapper withGradient>
            <Stack.Screen options={headerOptions} />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Stack header info */}
                {data && (
                    <Animated.View entering={FadeInDown.delay(0).springify()}>
                        <GlassView variant="medium" style={styles.stackInfoCard} borderRadius={borderRadius.xl}>
                            <View style={styles.stackIconWrap}>
                                <Ionicons name="layers-outline" size={24} color={colors.primary} />
                            </View>
                            <View style={styles.stackInfoText}>
                                <Text style={styles.stackName}>{data.stackName}</Text>
                                <Text style={styles.stackDate}>
                                    Started {formatDate(data.stackStartDate)}
                                </Text>
                            </View>
                            <View style={styles.markerCountWrap}>
                                <Text style={[styles.markerCountValue, { color: colors.accent }]}>
                                    {data.markersWithCorrelation}
                                </Text>
                                <Text style={styles.markerCountLabel}>markers</Text>
                            </View>
                        </GlassView>
                    </Animated.View>
                )}

                {/* Disclaimer banner */}
                <Animated.View entering={FadeInDown.delay(60).springify()}>
                    <View style={styles.disclaimerBanner}>
                        <Ionicons name="information-circle-outline" size={14} color={colors.info} style={{ marginTop: 1 }} />
                        <Text style={styles.disclaimerText}>
                            Correlation does not imply causation. Many factors affect biomarker values.
                            These comparisons are observational only.
                        </Text>
                    </View>
                </Animated.View>

                {/* Correlation cards */}
                {data?.correlations.map((item, index) => (
                    <CorrelationCard
                        key={`${item.markerName}-${index}`}
                        item={item}
                        index={index + 2}
                    />
                ))}

                <View style={{ height: spacing.xxl }} />
            </ScrollView>
        </ScreenWrapper>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    // Header
    headerBackBtn:   { marginLeft: spacing.sm },
    headerBackInner: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

    // Scroll
    scroll:        { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingTop: 110, gap: spacing.md },

    // Centered states
    centeredState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        gap: spacing.md,
    },
    loadingText: {
        ...typography.h4,
        color: colors.textPrimary,
        textAlign: 'center',
    },
    stateIconWrap: {
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    stateTitle: {
        ...typography.h3,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    stateSubtext: {
        ...typography.body,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 22,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        backgroundColor: colors.glassColored.primary,
        borderRadius: borderRadius.lg,
        borderWidth: 0,
        borderColor: 'transparent',
        marginTop: spacing.sm,
    },
    retryButtonText: {
        ...typography.label,
        color: colors.primary,
        fontWeight: '600',
    },
    uploadLabsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        marginTop: spacing.sm,
        ...shadows.primaryGlow,
    },
    uploadLabsButtonText: {
        ...typography.label,
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },

    // Stack info card
    stackInfoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        gap: spacing.md,
    },
    stackIconWrap: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.md,
        backgroundColor: colors.glassColored.primary,
        borderWidth: 0,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stackInfoText: {
        flex: 1,
        gap: spacing.xs,
    },
    stackName: {
        ...typography.h4,
        color: colors.textPrimary,
        fontWeight: '700',
    },
    stackDate: {
        ...typography.caption,
        color: colors.textMuted,
    },
    markerCountWrap: {
        alignItems: 'center',
    },
    markerCountValue: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    markerCountLabel: {
        ...typography.caption,
        color: colors.textMuted,
    },

    // Disclaimer banner
    disclaimerBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        padding: spacing.md,
        backgroundColor: colors.infoMuted,
        borderRadius: borderRadius.lg,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    disclaimerText: {
        ...typography.caption,
        color: colors.infoLight,
        flex: 1,
        lineHeight: 18,
    },

    // Correlation card
    correlationCard: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    correlationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    markerName: {
        ...typography.h4,
        color: colors.textPrimary,
        fontWeight: '700',
        fontSize: 16,
        flex: 1,
    },
    directionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        borderWidth: 0,
    },
    directionBadgeText: {
        ...typography.caption,
        fontWeight: '700',
        fontSize: 11,
        letterSpacing: 0.2,
    },

    // Value row
    valueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    valueBlock: {
        alignItems: 'center',
        gap: 2,
        minWidth: 64,
    },
    valueLabel: {
        ...typography.caption,
        color: colors.textMuted,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    valueNumber: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
        letterSpacing: -0.3,
    },
    valueUnit: {
        fontSize: 12,
        fontWeight: '400',
        color: colors.textMuted,
    },
    arrowWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    arrowLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.glass.border,
    },
    percentBlock: {
        alignItems: 'flex-end',
        minWidth: 60,
    },
    percentChange: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
});
