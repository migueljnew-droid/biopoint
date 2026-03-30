import React, { useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
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
import { usePeptideStore, type Peptide } from '../src/store/peptideStore';
import { getCategoryColor } from '../src/utils/categoryColors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLabel(slug: string): string {
    return slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ icon, title, delay = 0 }: { icon: string; title: string; delay?: number }) {
    return (
        <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
                <Ionicons name={icon as any} size={14} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>{title}</Text>
        </Animated.View>
    );
}

function InfoRow({ label, value, delay = 0 }: { label: string; value: string; delay?: number }) {
    return (
        <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
        </Animated.View>
    );
}

function GoalChip({ goal }: { goal: string }) {
    return (
        <View style={styles.goalChip}>
            <Text style={styles.goalChipText}>{formatLabel(goal)}</Text>
        </View>
    );
}

function NotFoundState() {
    return (
        <View style={styles.notFoundContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
            <Text style={styles.notFoundTitle}>Compound Not Found</Text>
            <Text style={styles.notFoundSubtitle}>This compound does not exist in the database.</Text>
            <Pressable onPress={() => router.back()} style={styles.notFoundBack}>
                <Text style={styles.notFoundBackText}>Go Back</Text>
            </Pressable>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function PeptideDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const getById = usePeptideStore((s) => s.getById);
    const compound: Peptide | undefined = id ? getById(id) : undefined;

    const categoryColor = compound ? getCategoryColor(compound.category) : colors.primary;

    // Navigate to calculator with pre-filled values
    const handleCalculate = useCallback(() => {
        if (!compound) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({
            pathname: '/calculator' as any,
            params: {
                peptideMg: '',
                peptideName: compound.name,
                desiredDoseMcg: compound.typicalDose.unit === 'mcg'
                    ? String(compound.typicalDose.min)
                    : '',
            },
        });
    }, [compound]);

    // Navigate to stacks tab with pre-filled query params so the tab can open
    // the Add Item modal pre-populated. We pass all item fields as params.
    const handleAddToStack = useCallback(() => {
        if (!compound) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push({
            pathname: '/(tabs)/stacks' as any,
            params: {
                prefill_name: compound.name,
                prefill_dose: String(compound.typicalDose.min),
                prefill_unit: compound.typicalDose.unit,
                prefill_frequency: compound.frequency,
                prefill_route: compound.route,
                prefill_open: '1',
            },
        });
    }, [compound]);

    const handleCitationPress = useCallback(async (url: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            Alert.alert('Cannot Open Link', 'This URL cannot be opened on your device.');
        }
    }, []);

    return (
        <ScreenWrapper withGradient>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTransparent: true,
                    headerTitle: compound?.name ?? 'Compound Detail',
                    headerTitleStyle: {
                        color: colors.textPrimary,
                        fontSize: 17,
                        fontWeight: '600',
                    },
                    headerLeft: () => (
                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.back();
                            }}
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

            {!compound ? (
                <NotFoundState />
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Hero */}
                    <Animated.View entering={FadeInUp.delay(0).springify()} style={styles.hero}>
                        <View style={[styles.heroIconWrap, { backgroundColor: `${categoryColor}18`, borderColor: `${categoryColor}33` }]}>
                            <Ionicons name="flask" size={32} color={categoryColor} />
                        </View>
                        <View style={styles.heroText}>
                            <Text style={styles.heroName}>{compound.name}</Text>
                            <View style={[styles.categoryBadge, { backgroundColor: `${categoryColor}22`, borderColor: `${categoryColor}44` }]}>
                                <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>
                                    {formatLabel(compound.category)}
                                </Text>
                            </View>
                        </View>
                    </Animated.View>

                    {/* Description */}
                    <Animated.View entering={FadeInDown.delay(60).springify()}>
                        <GlassView variant="medium" style={styles.descriptionCard} borderRadius={borderRadius.xl}>
                            <Text style={styles.description}>{compound.description}</Text>
                            {compound.aliases.length > 0 && (
                                <View style={styles.aliasRow}>
                                    <Ionicons name="bookmark-outline" size={12} color={colors.textMuted} />
                                    <Text style={styles.aliasText}>
                                        {compound.aliases.join(' · ')}
                                    </Text>
                                </View>
                            )}
                        </GlassView>
                    </Animated.View>

                    {/* Goals */}
                    {compound.goals.length > 0 && (
                        <>
                            <SectionHeader icon="trophy-outline" title="Goals" delay={80} />
                            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.goalsWrap}>
                                {compound.goals.map((goal) => (
                                    <GoalChip key={goal} goal={goal} />
                                ))}
                            </Animated.View>
                        </>
                    )}

                    {/* Dosing */}
                    <SectionHeader icon="medical-outline" title="Dosing" delay={120} />
                    <Animated.View entering={FadeInDown.delay(140).springify()}>
                        <GlassView variant="medium" style={styles.infoCard} borderRadius={borderRadius.xl}>
                            <InfoRow
                                label="Typical Dose"
                                value={`${compound.typicalDose.min}–${compound.typicalDose.max} ${compound.typicalDose.unit}`}
                                delay={160}
                            />
                            <View style={styles.infoRowDivider} />
                            <InfoRow label="Route" value={compound.route} delay={180} />
                            <View style={styles.infoRowDivider} />
                            <InfoRow label="Frequency" value={compound.frequency} delay={200} />
                            <View style={styles.infoRowDivider} />
                            <InfoRow
                                label="Half-Life"
                                value={compound.halfLife}
                                delay={220}
                            />
                        </GlassView>
                    </Animated.View>

                    {/* Cycle Protocol */}
                    <SectionHeader icon="repeat-outline" title="Cycle Protocol" delay={240} />
                    <Animated.View entering={FadeInDown.delay(260).springify()}>
                        <GlassView variant="medium" style={styles.cycleCard} borderRadius={borderRadius.xl}>
                            <View style={styles.cycleIconRow}>
                                <View style={styles.cycleIconWrap}>
                                    <Ionicons name="sync-circle-outline" size={20} color={colors.accent} />
                                </View>
                                <Text style={styles.cycleText}>{compound.cycleProtocol}</Text>
                            </View>
                        </GlassView>
                    </Animated.View>

                    {/* Stacking Notes */}
                    {compound.stackingNotes && (
                        <>
                            <SectionHeader icon="layers-outline" title="Stacking Notes" delay={280} />
                            <Animated.View entering={FadeInDown.delay(300).springify()}>
                                <GlassView variant="medium" style={styles.stackingCard} borderRadius={borderRadius.xl}>
                                    <View style={styles.stackingRow}>
                                        <Ionicons name="information-circle-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
                                        <Text style={styles.stackingText}>{compound.stackingNotes}</Text>
                                    </View>
                                </GlassView>
                            </Animated.View>
                        </>
                    )}

                    {/* Citations */}
                    {compound.citations.length > 0 && (
                        <>
                            <SectionHeader icon="document-text-outline" title="Research Citations" delay={320} />
                            <Animated.View entering={FadeInDown.delay(340).springify()} style={styles.citationsWrap}>
                                {compound.citations.map((citation, i) => (
                                    <Pressable
                                        key={i}
                                        onPress={() => handleCitationPress(citation.url)}
                                        style={({ pressed }) => pressed && styles.citationPressed}
                                    >
                                        <GlassView variant="light" style={styles.citationCard} borderRadius={borderRadius.lg}>
                                            <View style={styles.citationBody}>
                                                <Text style={styles.citationTitle} numberOfLines={2}>
                                                    {citation.title}
                                                </Text>
                                                <Text style={styles.citationYear}>{citation.year}</Text>
                                            </View>
                                            <View style={styles.citationLinkWrap}>
                                                <Ionicons name="open-outline" size={14} color={colors.primary} />
                                                <Text style={styles.citationLinkText}>PubMed</Text>
                                            </View>
                                        </GlassView>
                                    </Pressable>
                                ))}
                            </Animated.View>
                        </>
                    )}

                    {/* Spacer above sticky buttons */}
                    <View style={{ height: 140 }} />
                </ScrollView>
            )}

            {/* Sticky action buttons */}
            {compound && (
                <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.actionBar}>
                    <GlassView variant="heavy" style={styles.actionBarInner} borderRadius={borderRadius.xxl}>
                        {/* Calculate Dose */}
                        <Pressable
                            onPress={handleCalculate}
                            style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}
                        >
                            <Ionicons name="flask-outline" size={18} color={colors.primary} />
                            <Text style={styles.actionButtonSecondaryText}>Calculate Dose</Text>
                        </Pressable>

                        {/* Add to Stack */}
                        <Pressable
                            onPress={handleAddToStack}
                            style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, pressed && styles.actionButtonPressed]}
                        >
                            <LinearGradient
                                colors={gradients.primary}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            />
                            <Ionicons name="add-circle-outline" size={18} color="#fff" />
                            <Text style={styles.actionButtonPrimaryText}>Add to Stack</Text>
                        </Pressable>
                    </GlassView>
                </Animated.View>
            )}
        </ScreenWrapper>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    // Header
    headerBackBtn: { marginLeft: spacing.sm },
    headerBackInner: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

    // Scroll
    scroll: { flex: 1 },
    scrollContent: {
        padding: spacing.lg,
        paddingTop: 110,
        gap: spacing.sm,
    },

    // Hero
    hero: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.xs,
    },
    heroIconWrap: {
        width: 64,
        height: 64,
        borderRadius: borderRadius.xl,
        borderWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroText: {
        flex: 1,
        gap: spacing.xs,
    },
    heroName: {
        fontSize: 26,
        fontWeight: '800',
        color: colors.textPrimary,
        letterSpacing: -0.5,
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
        borderWidth: 0,
    },
    categoryBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

    // Description card
    descriptionCard: {
        padding: spacing.lg,
        gap: spacing.sm,
    },
    description: {
        ...typography.body,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    aliasRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.xs,
    },
    aliasText: {
        ...typography.caption,
        color: colors.textMuted,
        flex: 1,
        fontStyle: 'italic',
    },

    // Goals
    goalsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    goalChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glassColored.primary,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    goalChipText: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '600',
        fontSize: 11,
    },

    // Section header
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    sectionIconWrap: {
        width: 22,
        height: 22,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.glassColored.primary,
        borderWidth: 0,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        ...typography.label,
        color: colors.textSecondary,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        fontSize: 11,
    },

    // Info card rows
    infoCard: {
        padding: spacing.md,
        gap: 0,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    infoRowDivider: {
        height: 1,
        backgroundColor: colors.glass.border,
    },
    infoLabel: {
        ...typography.bodySmall,
        color: colors.textMuted,
        fontWeight: '500',
    },
    infoValue: {
        ...typography.bodySmall,
        color: colors.textPrimary,
        fontWeight: '600',
        textAlign: 'right',
        flex: 1,
        marginLeft: spacing.sm,
    },

    // Cycle card
    cycleCard: {
        padding: spacing.lg,
    },
    cycleIconRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    cycleIconWrap: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.md,
        backgroundColor: colors.glassColored.accent,
        borderWidth: 0,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    cycleText: {
        ...typography.body,
        color: colors.textSecondary,
        flex: 1,
        lineHeight: 22,
    },

    // Stacking card
    stackingCard: {
        padding: spacing.lg,
    },
    stackingRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    stackingText: {
        ...typography.body,
        color: colors.textSecondary,
        flex: 1,
        lineHeight: 22,
    },

    // Citations
    citationsWrap: {
        gap: spacing.sm,
    },
    citationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        gap: spacing.sm,
    },
    citationPressed: {
        opacity: 0.75,
    },
    citationBody: {
        flex: 1,
        gap: 2,
    },
    citationTitle: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        fontWeight: '500',
        lineHeight: 18,
    },
    citationYear: {
        ...typography.caption,
        color: colors.textMuted,
    },
    citationLinkWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        backgroundColor: colors.glassColored.primary,
        borderRadius: borderRadius.md,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    citationLinkText: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '700',
        fontSize: 11,
    },

    // Action bar
    actionBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: spacing.lg,
        paddingBottom: 34, // safe area
        paddingTop: spacing.sm,
    },
    actionBarInner: {
        flexDirection: 'row',
        gap: spacing.sm,
        padding: spacing.md,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
    },
    actionButtonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }],
    },
    actionButtonSecondary: {
        backgroundColor: colors.glass.medium,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    actionButtonPrimary: {
        ...shadows.primaryGlow,
    },
    actionButtonSecondaryText: {
        ...typography.label,
        color: colors.primary,
        fontWeight: '700',
        fontSize: 13,
    },
    actionButtonPrimaryText: {
        ...typography.label,
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },

    // Not found
    notFoundContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xxl,
        gap: spacing.md,
    },
    notFoundTitle: {
        ...typography.h3,
        color: colors.textSecondary,
    },
    notFoundSubtitle: {
        ...typography.body,
        color: colors.textMuted,
        textAlign: 'center',
    },
    notFoundBack: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        backgroundColor: colors.glass.medium,
        borderRadius: borderRadius.lg,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    notFoundBackText: {
        ...typography.label,
        color: colors.primary,
        fontWeight: '600',
    },
});
