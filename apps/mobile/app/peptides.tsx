import React, { useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    Pressable,
    ScrollView,
    ListRenderItemInfo,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { colors, spacing, typography, borderRadius, gradients, shadows } from '../src/theme';
import { ScreenWrapper, GlassView } from '../src/components';
import { usePeptideStore, type Peptide } from '../src/store/peptideStore';
import { getCategoryColor, formatCategoryLabel } from '../src/utils/categoryColors';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface CategoryFilter {
    label: string;
    value: string | null;
}

const CATEGORY_FILTERS: CategoryFilter[] = [
    { label: 'All', value: null },
    { label: 'Recovery', value: 'recovery' },
    { label: 'Fat Loss', value: 'fat-loss' },
    { label: 'Anti-Aging', value: 'anti-aging' },
    { label: 'Cognitive', value: 'cognitive' },
    { label: 'Hormonal', value: 'hormonal' },
    { label: 'Gut Health', value: 'gut-health' },
    { label: 'Muscle Growth', value: 'muscle-growth' },
    { label: 'Sleep', value: 'sleep' },
    { label: 'Immune', value: 'immune' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CategoryChip({
    filter,
    isActive,
    onPress,
}: {
    filter: CategoryFilter;
    isActive: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.chip,
                isActive && styles.chipActive,
                pressed && styles.chipPressed,
            ]}
        >
            {isActive && (
                <LinearGradient
                    colors={gradients.primary}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                />
            )}
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {filter.label}
            </Text>
        </Pressable>
    );
}

function PeptideCard({ item, index }: { item: Peptide; index: number }) {
    const categoryColor = getCategoryColor(item.category);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/peptide-detail' as any, params: { id: item.id } });
    };

    return (
        <Animated.View entering={FadeInDown.delay(index * 50).springify()} layout={LinearTransition}>
            <Pressable
                onPress={handlePress}
                style={({ pressed }) => [pressed && styles.cardPressed]}
            >
                <GlassView variant="medium" style={styles.card} borderRadius={borderRadius.xl}>
                    {/* Left accent bar */}
                    <View style={[styles.cardAccentBar, { backgroundColor: categoryColor }]} />

                    <View style={styles.cardBody}>
                        {/* Name row */}
                        <View style={styles.cardNameRow}>
                            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                            <View style={[styles.categoryBadge, { backgroundColor: `${categoryColor}22`, borderColor: `${categoryColor}44` }]}>
                                <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>
                                    {formatCategoryLabel(item.category)}
                                </Text>
                            </View>
                        </View>

                        {/* Description */}
                        <Text style={styles.cardDescription} numberOfLines={2}>
                            {item.description}
                        </Text>

                        {/* Metadata row */}
                        <View style={styles.cardMeta}>
                            <View style={styles.metaItem}>
                                <Ionicons name="medical-outline" size={12} color={colors.textMuted} />
                                <Text style={styles.metaText}>
                                    {item.typicalDose.min}–{item.typicalDose.max} {item.typicalDose.unit}
                                </Text>
                            </View>
                            <View style={styles.metaSep} />
                            <View style={styles.metaItem}>
                                <Ionicons name="git-branch-outline" size={12} color={colors.textMuted} />
                                <Text style={styles.metaText}>{item.route}</Text>
                            </View>
                            <View style={styles.metaSep} />
                            <View style={styles.metaItem}>
                                <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                                <Text style={styles.metaText}>{item.frequency}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Chevron */}
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.cardChevron} />
                </GlassView>
            </Pressable>
        </Animated.View>
    );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function PeptidesScreen() {
    const { compounds, search, filterByCategoryAndGoal } = usePeptideStore();
    const [query, setQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    const results = useMemo<Peptide[]>(() => {
        if (query.trim()) {
            return search(query);
        }
        return filterByCategoryAndGoal(activeCategory, null);
    }, [query, activeCategory, compounds]);

    const handleCategoryPress = useCallback((value: string | null) => {
        Haptics.selectionAsync();
        setActiveCategory(value);
        setQuery('');
    }, []);

    const renderItem = useCallback(
        ({ item, index }: ListRenderItemInfo<Peptide>) => (
            <PeptideCard item={item} index={index} />
        ),
        []
    );

    const keyExtractor = useCallback((item: Peptide) => item.id, []);

    return (
        <ScreenWrapper withGradient>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTransparent: true,
                    headerTitle: 'Peptide Database',
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

            <View style={styles.container}>
                {/* Search bar */}
                <Animated.View
                    entering={FadeInDown.delay(0).springify()}
                    style={styles.searchContainer}
                >
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={18} color={colors.textMuted} />
                        <TextInput
                            style={styles.searchInput}
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Search peptides, aliases..."
                            placeholderTextColor={colors.textMuted}
                            returnKeyType="search"
                            clearButtonMode="while-editing"
                            autoCorrect={false}
                            autoCapitalize="none"
                        />
                        {query.length > 0 && (
                            <Pressable onPress={() => setQuery('')} hitSlop={8}>
                                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                            </Pressable>
                        )}
                    </View>
                </Animated.View>

                {/* Category filter chips */}
                <Animated.View entering={FadeInDown.delay(60).springify()}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipsContainer}
                        style={styles.chipsScroll}
                    >
                        {CATEGORY_FILTERS.map((filter) => (
                            <CategoryChip
                                key={filter.label}
                                filter={filter}
                                isActive={activeCategory === filter.value}
                                onPress={() => handleCategoryPress(filter.value)}
                            />
                        ))}
                    </ScrollView>
                </Animated.View>

                {/* Results count */}
                <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.resultsHeader}>
                    <Text style={styles.resultsCount}>
                        {results.length} {results.length === 1 ? 'compound' : 'compounds'}
                    </Text>
                    {activeCategory && (
                        <Text style={styles.resultsFilter}>
                            in {formatCategoryLabel(activeCategory)}
                        </Text>
                    )}
                </Animated.View>

                {/* List */}
                <FlatList<Peptide>
                    data={results}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <GlassView variant="light" style={styles.emptyIconContainer} borderRadius={borderRadius.xl}>
                                <Ionicons name="search-outline" size={40} color={colors.textMuted} />
                            </GlassView>
                            <Text style={styles.emptyTitle}>No compounds found</Text>
                            <Text style={styles.emptySubtitle}>Try a different search or category</Text>
                        </View>
                    }
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                />
            </View>
        </ScreenWrapper>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 100, // transparent header offset
    },

    // Header
    headerBackBtn: { marginLeft: spacing.sm },
    headerBackInner: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

    // Search
    searchContainer: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.sm,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.glass.medium,
        borderWidth: 0,
        borderColor: 'transparent',
        borderRadius: borderRadius.xl,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
    },
    searchInput: {
        flex: 1,
        ...typography.body,
        color: colors.textPrimary,
        fontSize: 16,
        padding: 0,
    },

    // Category chips
    chipsScroll: { flexGrow: 0 },
    chipsContainer: {
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
        paddingBottom: spacing.sm,
    },
    chip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.light,
        borderWidth: 0,
        borderColor: 'transparent',
        overflow: 'hidden',
    },
    chipActive: {
        borderColor: 'transparent',
        ...shadows.primaryGlow,
    },
    chipPressed: { opacity: 0.75 },
    chipText: {
        ...typography.caption,
        color: colors.textMuted,
        fontWeight: '500',
        fontSize: 12,
    },
    chipTextActive: {
        color: '#fff',
        fontWeight: '700',
    },

    // Results header
    resultsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.sm,
    },
    resultsCount: {
        ...typography.caption,
        color: colors.textMuted,
        fontWeight: '600',
    },
    resultsFilter: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '500',
    },

    // List
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 120,
        gap: spacing.sm,
    },

    // Card
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        paddingRight: spacing.md,
    },
    cardPressed: {
        opacity: 0.85,
    },
    cardAccentBar: {
        width: 3,
        alignSelf: 'stretch',
        borderRadius: 2,
        marginRight: spacing.md,
        marginVertical: spacing.md,
        marginLeft: spacing.md,
    },
    cardBody: {
        flex: 1,
        paddingVertical: spacing.md,
        gap: spacing.xs,
    },
    cardNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    cardName: {
        ...typography.label,
        color: colors.textPrimary,
        fontWeight: '700',
        fontSize: 15,
        flex: 1,
    },
    categoryBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
        borderWidth: 0,
    },
    categoryBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    cardDescription: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    cardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
        gap: spacing.xs,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    metaText: {
        ...typography.caption,
        color: colors.textMuted,
        fontSize: 11,
    },
    metaSep: {
        width: 1,
        height: 10,
        backgroundColor: colors.glass.border,
        marginHorizontal: spacing.xs,
    },
    cardChevron: {
        marginLeft: spacing.xs,
    },

    // Empty state
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
        gap: spacing.sm,
    },
    emptyIconContainer: {
        width: 72,
        height: 72,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    emptyTitle: {
        ...typography.h4,
        color: colors.textSecondary,
    },
    emptySubtitle: {
        ...typography.body,
        color: colors.textMuted,
        textAlign: 'center',
    },
});
