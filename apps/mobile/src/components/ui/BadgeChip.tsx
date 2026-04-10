import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { BADGE_DEFINITIONS } from '@biopoint/shared';

interface BadgeChipProps {
    badgeId: string;
    earned: boolean;
    size?: 'sm' | 'md';
}

export function BadgeChip({ badgeId, earned, size = 'md' }: BadgeChipProps) {
    const badge = BADGE_DEFINITIONS.find(b => b.id === badgeId);
    if (!badge) return null;

    const iconSize = size === 'sm' ? 14 : 18;
    const chipStyle = size === 'sm' ? styles.chipSm : styles.chipMd;

    return (
        <View style={[chipStyle, earned ? styles.earned : styles.unearned]}>
            <Ionicons
                name={(earned ? badge.icon : 'lock-closed') as any}
                size={iconSize}
                color={earned ? colors.warning : colors.textMuted}
            />
            <Text style={[styles.label, size === 'sm' && styles.labelSm, !earned && styles.unearnedText]}>
                {badge.label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    chipMd: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    chipSm: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    earned: {
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        borderColor: 'rgba(234, 179, 8, 0.3)',
    },
    unearned: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        opacity: 0.4,
    },
    label: {
        ...typography.caption,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    labelSm: {
        fontSize: 10,
    },
    unearnedText: {
        color: colors.textMuted,
    },
});
