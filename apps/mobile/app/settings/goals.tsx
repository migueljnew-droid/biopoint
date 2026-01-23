import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { ScreenWrapper, GlassView } from '../../src/components';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../../src/store/profileStore';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function GoalsScreen() {
    const { profile, updateProfile } = useProfileStore();
    const goals = profile?.goals || [];

    const goalOptions = [
        { id: 'optimize_health', label: 'Optimize Overall Health', icon: 'heart-outline' },
        { id: 'build_muscle', label: 'Build Muscle', icon: 'barbell-outline' },
        { id: 'lose_fat', label: 'Lose Fat', icon: 'flame-outline' },
        { id: 'improve_sleep', label: 'Improve Sleep', icon: 'moon-outline' },
        { id: 'increase_energy', label: 'Increase Energy', icon: 'flash-outline' },
        { id: 'enhance_focus', label: 'Enhance Focus', icon: 'bulb-outline' },
        { id: 'longevity', label: 'Longevity & Anti-Aging', icon: 'time-outline' },
        { id: 'stress_management', label: 'Stress Management', icon: 'water-outline' },
    ];

    const toggleGoal = (goalLabel: string) => {
        const newGoals = goals.includes(goalLabel)
            ? goals.filter((g: string) => g !== goalLabel)
            : [...goals, goalLabel];

        updateProfile({ goals: newGoals });
    };

    return (
        <ScreenWrapper withGradient={true}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <GlassView variant="light" borderRadius={borderRadius.full} style={styles.iconButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </GlassView>
                </Pressable>
                <Text style={styles.title}>My Goals</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.subtitle}>Select the areas you want to prioritize.</Text>

                <View style={styles.grid}>
                    {goalOptions.map((option, index) => {
                        const isSelected = goals.includes(option.label); // Profile store uses string labels currently
                        return (
                            <Animated.View key={option.id} entering={FadeInDown.delay(index * 50)} style={{ width: '48%', marginBottom: spacing.md }}>
                                <Pressable onPress={() => toggleGoal(option.label)}>
                                    <GlassView
                                        variant={isSelected ? 'medium' : 'light'}
                                        style={[styles.card, isSelected && styles.cardActive]}
                                        borderRadius={borderRadius.lg}
                                    >
                                        <Ionicons
                                            name={option.icon as any}
                                            size={32}
                                            color={isSelected ? colors.primary : colors.textSecondary}
                                        />
                                        <Text style={[styles.cardLabel, isSelected && styles.cardLabelActive]}>
                                            {option.label}
                                        </Text>
                                        {isSelected && (
                                            <View style={styles.checkIcon}>
                                                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                                            </View>
                                        )}
                                    </GlassView>
                                </Pressable>
                            </Animated.View>
                        );
                    })}
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {},
    iconButton: {
        width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    },
    title: {
        fontSize: 20, fontWeight: '600', color: colors.textPrimary,
    },
    content: {
        padding: spacing.lg,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        marginBottom: spacing.xl,
        textAlign: 'center',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    card: {
        aspectRatio: 1,
        padding: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    cardActive: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
    },
    cardLabel: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    cardLabelActive: {
        color: colors.primary,
        fontWeight: '600',
    },
    checkIcon: {
        position: 'absolute',
        top: 8,
        right: 8,
    }
});
