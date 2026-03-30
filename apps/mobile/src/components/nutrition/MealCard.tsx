import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius } from '../../theme';
import { GlassView } from '../ui';

interface MealCardProps {
    id: string;
    name: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    servingSize: string | null;
    aiAnalyzed: boolean;
    onDelete?: (id: string) => void;
    onEdit?: (id: string) => void;
}

export function MealCard({ id, name, calories, proteinG, carbsG, fatG, servingSize, aiAnalyzed, onDelete, onEdit }: MealCardProps) {
    return (
        <GlassView variant="light" borderRadius={borderRadius.xl} style={styles.card}>
            <View style={styles.row}>
                <View style={styles.info}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1}>{name}</Text>
                        {aiAnalyzed && (
                            <View style={styles.aiBadge}>
                                <Text style={styles.aiBadgeText}>AI</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.detail}>
                        {servingSize ? `${servingSize} · ` : ''}{calories} cal
                    </Text>
                    <View style={styles.macroRow}>
                        <Text style={[styles.macro, { color: '#3b82f6' }]}>P {proteinG.toFixed(0)}g</Text>
                        <Text style={[styles.macro, { color: '#f59e0b' }]}>C {carbsG.toFixed(0)}g</Text>
                        <Text style={[styles.macro, { color: '#ef4444' }]}>F {fatG.toFixed(0)}g</Text>
                    </View>
                </View>
                <View style={styles.actions}>
                    {onEdit && (
                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onEdit(id);
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                        >
                            <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
                        </Pressable>
                    )}
                    {onDelete && (
                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                onDelete(id);
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                        >
                            <Ionicons name="trash-outline" size={18} color={colors.error} />
                        </Pressable>
                    )}
                </View>
            </View>
        </GlassView>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    info: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    name: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.textPrimary,
        flex: 1,
    },
    aiBadge: {
        backgroundColor: colors.primary + '20',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    aiBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.primary,
    },
    detail: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    macroRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: 4,
    },
    macro: {
        fontSize: 11,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginLeft: spacing.sm,
    },
});
