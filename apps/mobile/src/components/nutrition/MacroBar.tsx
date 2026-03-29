import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';

interface MacroBarProps {
    label: string;
    value: number;
    target: number | null;
    color: string;
    unit?: string;
}

export function MacroBar({ label, value, target, color, unit = 'g' }: MacroBarProps) {
    const effectiveTarget = target ?? 100;
    const ratio = Math.min(1, value / effectiveTarget);

    return (
        <View style={styles.container}>
            <View style={styles.labelRow}>
                <Text style={[styles.label, { color }]}>{label}</Text>
                <Text style={styles.value}>
                    {value.toFixed(0)}{unit}{target ? ` / ${target}${unit}` : ''}
                </Text>
            </View>
            <View style={styles.track}>
                <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.sm,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
    },
    value: {
        fontSize: 12,
        color: colors.textMuted,
    },
    track: {
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: 4,
    },
});
