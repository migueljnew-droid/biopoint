import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { GlassView } from './GlassView';

interface GlassDaySelectorProps {
    selectedDays: number[]; // 0-6 where 0 is Sunday
    onToggleDay: (dayIndex: number) => void;
    label?: string;
}

const DAYS = [
    { label: 'S', value: 0 },
    { label: 'M', value: 1 },
    { label: 'T', value: 2 },
    { label: 'W', value: 3 },
    { label: 'T', value: 4 },
    { label: 'F', value: 5 },
    { label: 'S', value: 6 },
];

export function GlassDaySelector({ selectedDays, onToggleDay, label }: GlassDaySelectorProps) {
    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={styles.daysContainer}>
                {DAYS.map((day) => {
                    const isSelected = selectedDays.includes(day.value);
                    return (
                        <Pressable
                            key={day.value}
                            onPress={() => onToggleDay(day.value)}
                            style={({ pressed }) => [
                                styles.dayButton,
                                pressed && styles.dayButtonPressed
                            ]}
                        >
                            <GlassView
                                variant={isSelected ? 'primary' : 'light'}
                                intensity={isSelected ? 60 : 20}
                                borderRadius={borderRadius.full}
                                style={[
                                    styles.dayGlass,
                                    isSelected && { backgroundColor: colors.primary }
                                ]}
                            >
                                <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                                    {day.label}
                                </Text>
                            </GlassView>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    label: {
        ...typography.label,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        marginLeft: 4,
    },
    daysContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.xs,
    },
    dayButton: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    },
    dayButtonPressed: {
        transform: [{ scale: 0.95 }],
        opacity: 0.8,
    },
    dayGlass: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayText: {
        ...typography.caption,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    dayTextSelected: {
        color: '#fff',
        fontWeight: '700',
    },
});
