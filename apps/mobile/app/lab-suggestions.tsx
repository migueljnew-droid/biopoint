import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Linking,
    Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { colors, spacing, typography, borderRadius, gradients, shadows } from '../src/theme';
import { ScreenWrapper, GlassView } from '../src/components';
import { api } from '../src/services/api';
import { useSubscriptionStore } from '../src/store/subscriptionStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Confidence = 'high' | 'moderate' | 'low';

interface Suggestion {
    compoundName: string;
    peptideId?: string; // present if compound exists in the peptide DB
    confidence: Confidence;
    reason: string;
    relatedMarkers: string[];
    citations: { title: string; url: string }[];
}

interface SuggestionsResponse {
    markersAnalyzed: number;
    markersFlagged: number;
    suggestions: Suggestion[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidenceColor(confidence: Confidence): string {
    switch (confidence) {
        case 'high':     return colors.success;
        case 'moderate': return colors.warning;
        case 'low':      return colors.textMuted;
    }
}

function confidenceBg(confidence: Confidence): string {
    switch (confidence) {
        case 'high':     return colors.glassColored.success;
        case 'moderate': return colors.glassColored.warning;
        case 'low':      return colors.glass.medium;
    }
}

function confidenceBorder(confidence: Confidence): string {
    switch (confidence) {
        case 'high':     return colors.glassColored.successBorder;
        case 'moderate': return colors.glassColored.warningBorder;
        case 'low':      return colors.glass.border;
    }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DisclaimerBanner() {
    return (
        <View style={styles.disclaimerBanner}>
            <Ionicons name="warning-outline" size={14} color={colors.warning} style={{ marginTop: 1 }} />
            <Text style={styles.disclaimerBannerText}>
                For informational purposes only. Not medical advice. Always consult a qualified
                healthcare provider before making changes to your health protocol.
            </Text>
        </View>
    );
}

function MarkerChip({ label }: { label: string }) {
    return (
        <View style={styles.markerChip}>
            <Text style={styles.markerChipText}>{label}</Text>
        </View>
    );
}

function SuggestionCard({ item, index }: { item: Suggestion; index: number }) {
    const handleCitationPress = useCallback(async (url: string) => {
        if (!url.startsWith('https://')) {
            Alert.alert('Invalid Link', 'Only secure (https) citations can be opened.');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            Alert.alert('Cannot Open Link', 'This URL cannot be opened on your device.');
        }
    }, []);

    const handleCompoundPress = useCallback(() => {
        if (!item.peptideId) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({ pathname: '/peptide-detail' as any, params: { id: item.peptideId } });
    }, [item.peptideId]);

    const confColor  = confidenceColor(item.confidence);
    const confBg     = confidenceBg(item.confidence);
    const confBorder = confidenceBorder(item.confidence);

    return (
        <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
            <GlassView variant="medium" style={styles.suggestionCard} borderRadius={borderRadius.xl}>
                {/* Compound name + confidence badge */}
                <View style={styles.cardHeader}>
                    <Pressable
                        onPress={handleCompoundPress}
                        disabled={!item.peptideId}
                        style={({ pressed }) => [
                            styles.compoundNameWrap,
                            pressed && item.peptideId && { opacity: 0.7 },
                        ]}
                    >
                        <Text style={styles.compoundName}>{item.compoundName}</Text>
                        {item.peptideId && (
                            <Ionicons
                                name="chevron-forward"
                                size={14}
                                color={colors.primary}
                                style={{ marginTop: 1 }}
                            />
                        )}
                    </Pressable>

                    <View
                        style={[
                            styles.confidenceBadge,
                            { backgroundColor: confBg, borderColor: confBorder },
                        ]}
                    >
                        <View style={[styles.confidenceDot, { backgroundColor: confColor }]} />
                        <Text style={[styles.confidenceBadgeText, { color: confColor }]}>
                            {item.confidence.charAt(0).toUpperCase() + item.confidence.slice(1)}
                        </Text>
                    </View>
                </View>

                {/* Reason */}
                <Text style={styles.reasonText}>{item.reason}</Text>

                {/* Related markers */}
                {item.relatedMarkers.length > 0 && (
                    <View style={styles.markersRow}>
                        {item.relatedMarkers.map((m) => (
                            <MarkerChip key={m} label={m} />
                        ))}
                    </View>
                )}

                {/* Citations */}
                {item.citations.length > 0 && (
                    <View style={styles.citationsSection}>
                        <View style={styles.citationsDivider} />
                        {item.citations.map((c, i) => (
                            <Pressable
                                key={i}
                                onPress={() => handleCitationPress(c.url)}
                                style={({ pressed }) => [
                                    styles.citationRow,
                                    pressed && { opacity: 0.7 },
                                ]}
                            >
                                <Ionicons name="document-text-outline" size={12} color={colors.primary} />
                                <Text style={styles.citationTitle} numberOfLines={1}>
                                    {c.title}
                                </Text>
                                <Ionicons name="open-outline" size={12} color={colors.textMuted} />
                            </Pressable>
                        ))}
                    </View>
                )}
            </GlassView>
        </Animated.View>
    );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

type ScreenPhase = 'consent' | 'premium' | 'loading' | 'results' | 'error';

export default function LabSuggestionsScreen() {
    const { labReportId } = useLocalSearchParams<{ labReportId: string }>();
    const { isPremium } = useSubscriptionStore();

    const [phase, setPhase] = useState<ScreenPhase>('consent');
    const [data, setData]   = useState<SuggestionsResponse | null>(null);

    const fetchSuggestions = useCallback(async () => {
        if (!labReportId) return;
        setPhase('loading');
        try {
            const response = await api.post(`/labs/${labReportId}/suggest`);
            setData(response.data);
            setPhase('results');
        } catch {
            setPhase('error');
        }
    }, [labReportId]);

    const handleConsentAccept = useCallback(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (!isPremium) {
            setPhase('premium');
        } else {
            fetchSuggestions();
        }
    }, [isPremium, fetchSuggestions]);

    // ---------------------------------------------------------------------------
    // Render: Consent Gate
    // ---------------------------------------------------------------------------
    if (phase === 'consent') {
        return (
            <ScreenWrapper withGradient>
                <Stack.Screen
                    options={{
                        headerShown: true,
                        headerTransparent: true,
                        headerTitle: 'AI Suggestions',
                        headerTitleStyle: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
                        headerLeft: () => (
                            <Pressable
                                onPress={() => router.back()}
                                style={({ pressed }) => [styles.headerBackBtn, pressed && { opacity: 0.7 }]}
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
                    }}
                />
                <View style={styles.consentContainer}>
                    <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.consentIconWrap}>
                        <GlassView
                            variant="medium"
                            style={styles.consentIcon}
                            borderRadius={borderRadius.xxl}
                        >
                            <Ionicons name="shield-checkmark-outline" size={40} color={colors.warning} />
                        </GlassView>
                    </Animated.View>

                    <Animated.Text entering={FadeInDown.delay(80).springify()} style={styles.consentTitle}>
                        Not Medical Advice
                    </Animated.Text>

                    <Animated.View entering={FadeInDown.delay(140).springify()}>
                        <GlassView variant="medium" style={styles.consentCard} borderRadius={borderRadius.xl}>
                            <Text style={styles.consentBody}>
                                BioPoint uses AI to analyze your lab markers and surface informational
                                suggestions about compounds and protocols that may be relevant to your
                                results.
                            </Text>
                            <View style={styles.consentDivider} />
                            <Text style={styles.consentBody}>
                                These suggestions are{' '}
                                <Text style={styles.consentEmphasis}>
                                    not a diagnosis, treatment plan, or prescription.
                                </Text>{' '}
                                They are educational references only. Individual responses to any
                                compound vary significantly.
                            </Text>
                            <View style={styles.consentDivider} />
                            <Text style={styles.consentBody}>
                                Always consult a licensed physician, endocrinologist, or qualified
                                healthcare provider before making any changes to your health protocol.
                            </Text>
                        </GlassView>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.consentAcknowledgeWrap}>
                        <GlassView
                            variant="light"
                            style={styles.consentAcknowledgeCard}
                            borderRadius={borderRadius.lg}
                        >
                            <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                            <Text style={styles.consentAcknowledgeText}>
                                I understand these suggestions are for informational purposes only and
                                are not medical advice. I will consult a healthcare provider before
                                making changes to my health protocol.
                            </Text>
                        </GlassView>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(260).springify()} style={styles.consentButtonWrap}>
                        <Pressable
                            onPress={handleConsentAccept}
                            style={({ pressed }) => [styles.consentButton, pressed && { opacity: 0.85 }]}
                        >
                            <LinearGradient
                                colors={gradients.primary}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            />
                            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                            <Text style={styles.consentButtonText}>I Understand</Text>
                        </Pressable>
                    </Animated.View>
                </View>
            </ScreenWrapper>
        );
    }

    // ---------------------------------------------------------------------------
    // Render: Premium Gate
    // ---------------------------------------------------------------------------
    if (phase === 'premium') {
        return (
            <ScreenWrapper withGradient>
                <Stack.Screen
                    options={{
                        headerShown: true,
                        headerTransparent: true,
                        headerTitle: 'AI Suggestions',
                        headerTitleStyle: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
                        headerLeft: () => (
                            <Pressable
                                onPress={() => router.back()}
                                style={({ pressed }) => [styles.headerBackBtn, pressed && { opacity: 0.7 }]}
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
                    }}
                />
                <View style={styles.premiumContainer}>
                    <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.premiumIconWrap}>
                        <GlassView variant="medium" style={styles.premiumIcon} borderRadius={borderRadius.xxl}>
                            <Ionicons name="sparkles" size={40} color={colors.accent} />
                        </GlassView>
                    </Animated.View>

                    <Animated.Text entering={FadeInDown.delay(60).springify()} style={styles.premiumTitle}>
                        Unlock AI Suggestions
                    </Animated.Text>

                    <Animated.Text entering={FadeInDown.delay(100).springify()} style={styles.premiumSubtitle}>
                        AI Protocol Suggestions is a BioPoint+ feature. Upgrade to get intelligent
                        compound recommendations tailored to your biomarkers.
                    </Animated.Text>

                    <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.premiumFeaturesWrap}>
                        {[
                            { icon: 'analytics-outline',     label: 'Personalized marker analysis' },
                            { icon: 'flask-outline',          label: 'Evidence-based compound suggestions' },
                            { icon: 'document-text-outline',  label: 'Research citations included' },
                            { icon: 'trending-up-outline',    label: 'Stack correlation tracking' },
                        ].map((f, i) => (
                            <Animated.View
                                key={f.label}
                                entering={FadeInDown.delay(180 + i * 50).springify()}
                                style={styles.premiumFeatureRow}
                            >
                                <View style={styles.premiumFeatureIcon}>
                                    <Ionicons name={f.icon as any} size={16} color={colors.accent} />
                                </View>
                                <Text style={styles.premiumFeatureLabel}>{f.label}</Text>
                            </Animated.View>
                        ))}
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(360).springify()} style={styles.premiumButtonWrap}>
                        <Pressable
                            onPress={() => router.push('/premium' as any)}
                            style={({ pressed }) => [styles.premiumButton, pressed && { opacity: 0.85 }]}
                        >
                            <LinearGradient
                                colors={gradients.primary}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            />
                            <Ionicons name="star-outline" size={18} color="#fff" />
                            <Text style={styles.premiumButtonText}>Upgrade to BioPoint+</Text>
                        </Pressable>

                        <Pressable
                            onPress={() => router.back()}
                            style={({ pressed }) => [styles.premiumSecondaryButton, pressed && { opacity: 0.7 }]}
                        >
                            <Text style={styles.premiumSecondaryButtonText}>Maybe Later</Text>
                        </Pressable>
                    </Animated.View>
                </View>
            </ScreenWrapper>
        );
    }

    // ---------------------------------------------------------------------------
    // Render: Loading
    // ---------------------------------------------------------------------------
    if (phase === 'loading') {
        return (
            <ScreenWrapper withGradient>
                <Stack.Screen
                    options={{
                        headerShown: true,
                        headerTransparent: true,
                        headerTitle: 'AI Suggestions',
                        headerTitleStyle: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
                        headerLeft: () => (
                            <Pressable
                                onPress={() => router.back()}
                                style={({ pressed }) => [styles.headerBackBtn, pressed && { opacity: 0.7 }]}
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
                    }}
                />
                <View style={styles.centeredState}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Analyzing your markers...</Text>
                    <Text style={styles.loadingSubtext}>
                        This may take a moment while we cross-reference your results.
                    </Text>
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
                <Stack.Screen
                    options={{
                        headerShown: true,
                        headerTransparent: true,
                        headerTitle: 'AI Suggestions',
                        headerTitleStyle: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
                        headerLeft: () => (
                            <Pressable
                                onPress={() => router.back()}
                                style={({ pressed }) => [styles.headerBackBtn, pressed && { opacity: 0.7 }]}
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
                    }}
                />
                <View style={styles.centeredState}>
                    <GlassView variant="medium" style={styles.errorIconWrap} borderRadius={borderRadius.xxl}>
                        <Ionicons name="cloud-offline-outline" size={40} color={colors.error} />
                    </GlassView>
                    <Text style={styles.errorTitle}>Analysis Temporarily Unavailable</Text>
                    <Text style={styles.errorSubtext}>
                        We could not complete the analysis right now. Please check your connection and
                        try again.
                    </Text>
                    <Pressable
                        onPress={fetchSuggestions}
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
    // Render: Results
    // ---------------------------------------------------------------------------
    return (
        <ScreenWrapper withGradient>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTransparent: true,
                    headerTitle: 'AI Suggestions',
                    headerTitleStyle: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
                    headerLeft: () => (
                        <Pressable
                            onPress={() => router.back()}
                            style={({ pressed }) => [styles.headerBackBtn, pressed && { opacity: 0.7 }]}
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
                }}
            />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Stats header */}
                {data && (
                    <Animated.View entering={FadeInDown.delay(0).springify()}>
                        <GlassView variant="medium" style={styles.statsCard} borderRadius={borderRadius.xl}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{data.markersAnalyzed}</Text>
                                <Text style={styles.statLabel}>Markers Analyzed</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, data.markersFlagged > 0 && { color: colors.warning }]}>
                                    {data.markersFlagged}
                                </Text>
                                <Text style={styles.statLabel}>Flagged</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, { color: colors.accent }]}>
                                    {data.suggestions.length}
                                </Text>
                                <Text style={styles.statLabel}>Suggestions</Text>
                            </View>
                        </GlassView>
                    </Animated.View>
                )}

                {/* Always-visible disclaimer */}
                <Animated.View entering={FadeInDown.delay(60).springify()}>
                    <DisclaimerBanner />
                </Animated.View>

                {/* Suggestion cards */}
                {data?.suggestions.map((item, index) => (
                    <SuggestionCard key={`${item.compoundName}-${index}`} item={item} index={index + 2} />
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
    headerBackBtn:  { marginLeft: spacing.sm },
    headerBackInner: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

    // Scroll
    scroll:        { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingTop: 110, gap: spacing.md },

    // Centered states (loading, error)
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
    loadingSubtext: {
        ...typography.body,
        color: colors.textMuted,
        textAlign: 'center',
    },
    errorIconWrap: {
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    errorTitle: {
        ...typography.h3,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    errorSubtext: {
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
        borderWidth: 1,
        borderColor: colors.glassColored.primaryBorder,
        marginTop: spacing.sm,
    },
    retryButtonText: {
        ...typography.label,
        color: colors.primary,
        fontWeight: '600',
    },

    // Consent screen
    consentContainer: {
        flex: 1,
        padding: spacing.lg,
        paddingTop: 110,
        gap: spacing.lg,
    },
    consentIconWrap: { alignItems: 'center' },
    consentIcon: {
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    consentTitle: {
        ...typography.h2,
        color: colors.textPrimary,
        textAlign: 'center',
        fontWeight: '800',
    },
    consentCard: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    consentDivider: {
        height: 1,
        backgroundColor: colors.glass.border,
    },
    consentBody: {
        ...typography.body,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    consentEmphasis: {
        color: colors.textPrimary,
        fontWeight: '700',
    },
    consentAcknowledgeWrap: {},
    consentAcknowledgeCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glassColored.warningBorder,
    },
    consentAcknowledgeText: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        flex: 1,
        lineHeight: 20,
        fontStyle: 'italic',
    },
    consentButtonWrap: {},
    consentButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        ...shadows.primaryGlow,
    },
    consentButtonText: {
        ...typography.label,
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },

    // Premium screen
    premiumContainer: {
        flex: 1,
        padding: spacing.lg,
        paddingTop: 110,
        gap: spacing.lg,
    },
    premiumIconWrap: { alignItems: 'center' },
    premiumIcon: {
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    premiumTitle: {
        ...typography.h2,
        color: colors.textPrimary,
        textAlign: 'center',
        fontWeight: '800',
    },
    premiumSubtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    premiumFeaturesWrap: {
        gap: spacing.sm,
    },
    premiumFeatureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.xs,
    },
    premiumFeatureIcon: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.md,
        backgroundColor: colors.glassColored.accent,
        borderWidth: 1,
        borderColor: colors.glassColored.accentBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    premiumFeatureLabel: {
        ...typography.body,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    premiumButtonWrap: {
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    premiumButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        ...shadows.primaryGlow,
    },
    premiumButtonText: {
        ...typography.label,
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    premiumSecondaryButton: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    premiumSecondaryButtonText: {
        ...typography.body,
        color: colors.textMuted,
    },

    // Stats card
    statsCard: {
        flexDirection: 'row',
        padding: spacing.lg,
        alignItems: 'center',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        gap: spacing.xs,
    },
    statValue: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.textPrimary,
        letterSpacing: -0.5,
    },
    statLabel: {
        ...typography.caption,
        color: colors.textMuted,
        textAlign: 'center',
    },
    statDivider: {
        width: 1,
        height: 36,
        backgroundColor: colors.glass.border,
    },

    // Disclaimer banner
    disclaimerBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        padding: spacing.md,
        backgroundColor: colors.glassColored.warning,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glassColored.warningBorder,
    },
    disclaimerBannerText: {
        ...typography.caption,
        color: colors.warningLight,
        flex: 1,
        lineHeight: 18,
    },

    // Suggestion card
    suggestionCard: {
        padding: spacing.lg,
        gap: spacing.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    compoundNameWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        flex: 1,
    },
    compoundName: {
        ...typography.h4,
        color: colors.textPrimary,
        fontWeight: '700',
        fontSize: 16,
    },
    confidenceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    confidenceDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    confidenceBadgeText: {
        ...typography.caption,
        fontWeight: '700',
        fontSize: 11,
        letterSpacing: 0.2,
    },
    reasonText: {
        ...typography.body,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    markersRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    markerChip: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glassColored.primary,
        borderWidth: 1,
        borderColor: colors.glassColored.primaryBorder,
    },
    markerChipText: {
        ...typography.caption,
        color: colors.primaryLight,
        fontWeight: '600',
        fontSize: 11,
    },
    citationsSection: {
        gap: spacing.xs,
    },
    citationsDivider: {
        height: 1,
        backgroundColor: colors.glass.border,
        marginBottom: spacing.xs,
    },
    citationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: 3,
    },
    citationTitle: {
        ...typography.caption,
        color: colors.primary,
        flex: 1,
        textDecorationLine: 'underline',
    },
});
