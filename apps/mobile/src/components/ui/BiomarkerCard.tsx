import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { GlassView } from './GlassView';

interface BiomarkerCardProps {
    name: string;
    value: number;
    unit: string;
    category: keyof typeof colors.biomarker; // simplified for now, or match theme
    icon: keyof typeof Ionicons.glyphMap;
    trend?: 'up' | 'down' | 'neutral';
    min: number;
    max: number;
}

export function BiomarkerCard({
    name,
    value,
    unit,
    category = 'optimal',
    icon,
    trend,
    min,
    max
}: BiomarkerCardProps) {
    const statusColors = colors.biomarker[category] || colors.biomarker.unknown;
    const progress = Math.min(Math.max((value - min) / (max - min), 0), 1) * 100;

    return (
        <GlassView
            variant="medium"
            intensity={40}
            borderRadius={borderRadius.lg}
            style={styles.container}
        >
            <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: statusColors.background }]}>
                    <Ionicons name={icon} size={18} color={statusColors.primary} />
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.name}>{name}</Text>
                    {trend && (
                        <Ionicons
                            name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'}
                            size={14}
                            color={colors.textTertiary}
                        />
                    )}
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.valueRow}>
                    <Text style={[styles.value, { color: statusColors.primary }]}>{value}</Text>
                    <Text style={styles.unit}>{unit}</Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                    <LinearGradient
                        colors={[statusColors.primary, statusColors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressBar, { width: `${progress}%` }]}
                    />
                </View>
            </View>
        </GlassView>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        paddingBottom: spacing.xs,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    headerText: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    name: {
        ...typography.body,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    content: {
        padding: spacing.md,
        paddingTop: spacing.xs,
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
        marginBottom: spacing.sm,
    },
    value: {
        fontSize: 28,
        fontWeight: '700',
    },
    unit: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    progressContainer: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 2,
    },
});
