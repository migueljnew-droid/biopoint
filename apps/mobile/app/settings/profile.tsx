import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { useProfileStore } from '../../src/store/profileStore';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper, GlassView, AnimatedButton, HeightPicker, WeightPicker } from '../../src/components';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function EditProfileScreen() {
    const { profile, fetchProfile, updateProfile } = useProfileStore();
    const [formData, setFormData] = useState({
        sex: '',
        heightCm: '',
        baselineWeightKg: '',
        goals: [] as string[],
        dietStyle: '',
        currentInterventions: ''
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    useEffect(() => {
        if (profile) {
            setFormData({
                sex: profile.sex || '',
                heightCm: profile.heightCm?.toString() || '',
                baselineWeightKg: profile.baselineWeightKg?.toString() || '',
                goals: profile.goals || [],
                dietStyle: profile.dietStyle || '',
                currentInterventions: profile.currentInterventions || ''
            });
        }
    }, [profile]);

    const handleSave = async () => {
        try {
            await updateProfile({
                ...(formData.sex ? { sex: formData.sex as any } : {}),
                heightCm: formData.heightCm ? parseFloat(formData.heightCm) : null,
                baselineWeightKg: formData.baselineWeightKg ? parseFloat(formData.baselineWeightKg) : null,
                goals: formData.goals,
                dietStyle: formData.dietStyle || null,
                currentInterventions: formData.currentInterventions || null
            });
            Alert.alert('Success', 'Profile updated successfully');
            router.back();
        } catch (error) {
            Alert.alert('Error', 'Failed to update profile');
        }
    };

    const goalOptions = ['Optimize Health', 'Build Muscle', 'Lose Fat', 'Improve Sleep', 'Increase Energy', 'Enhance Focus', 'Longevity'];

    const toggleGoal = (goal: string) => {
        setFormData(prev => ({
            ...prev,
            goals: prev.goals.includes(goal)
                ? prev.goals.filter(g => g !== goal)
                : [...prev.goals, goal]
        }));
    };

    return (
        <ScreenWrapper withGradient={true}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <GlassView variant="light" borderRadius={borderRadius.full} style={styles.iconButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </GlassView>
                </Pressable>
                <Text style={styles.title}>Edit Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeInDown.delay(100).springify()}>

                    {/* Basic Info */}
                    <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.section}>
                        <Text style={styles.sectionTitle}>Basic Info</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Biological Sex</Text>
                            <View style={styles.options}>
                                {(['male', 'female', 'other'] as const).map((s) => (
                                    <Pressable
                                        key={s}
                                        style={[styles.option, formData.sex === s && styles.optionActive]}
                                        onPress={() => setFormData({ ...formData, sex: s })}
                                    >
                                        <Text style={[styles.optionText, formData.sex === s && styles.optionTextActive]}>
                                            {s.charAt(0).toUpperCase() + s.slice(1)}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Height</Text>
                            <HeightPicker
                                value={formData.heightCm}
                                onChange={(v: string) => setFormData(prev => ({ ...prev, heightCm: v }))}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Baseline Weight</Text>
                            <WeightPicker
                                value={formData.baselineWeightKg}
                                onChange={(v: string) => setFormData(prev => ({ ...prev, baselineWeightKg: v }))}
                            />
                        </View>
                    </GlassView>

                    {/* Goals */}
                    <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.section}>
                        <Text style={styles.sectionTitle}>Goals</Text>
                        <View style={styles.goalsGrid}>
                            {goalOptions.map((goal) => (
                                <Pressable
                                    key={goal}
                                    style={[styles.goalChip, formData.goals.includes(goal) && styles.goalChipActive]}
                                    onPress={() => toggleGoal(goal)}
                                >
                                    <Text style={[styles.goalChipText, formData.goals.includes(goal) && styles.goalChipTextActive]}>
                                        {goal}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </GlassView>

                    {/* Additional Details */}
                    <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.section}>
                        <Text style={styles.sectionTitle}>Details</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Diet Style</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.dietStyle}
                                onChangeText={(v) => setFormData({ ...formData, dietStyle: v })}
                                placeholder="e.g. Keto, Paleo"
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Current Interventions</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={formData.currentInterventions}
                                onChangeText={(v) => setFormData({ ...formData, currentInterventions: v })}
                                placeholder="Supplements, protocols..."
                                placeholderTextColor={colors.textMuted}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />
                        </View>
                    </GlassView>

                    <AnimatedButton
                        title="Save Changes"
                        onPress={handleSave}
                        variant="primary"
                        style={{ marginBottom: spacing.xxl }}
                    />
                </Animated.View>
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
        flex: 1,
        padding: spacing.lg,
    },
    section: {
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        ...typography.h4,
        color: colors.textPrimary,
        marginBottom: spacing.md,
    },
    inputGroup: {
        marginBottom: spacing.md,
    },
    label: {
        ...typography.label,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    input: {
        backgroundColor: colors.glass.light,
        borderWidth: 0,
        borderColor: 'transparent',
        borderRadius: borderRadius.md,
        padding: spacing.md,
        color: colors.textPrimary,
        ...typography.body,
    },
    textArea: {
        minHeight: 80,
    },
    options: { flexDirection: 'row', gap: spacing.sm },
    option: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.glass.light, borderWidth: 0, borderColor: 'transparent', alignItems: 'center' },
    optionActive: { borderColor: colors.primary, backgroundColor: 'rgba(99, 102, 241, 0.1)' },
    optionText: { ...typography.label, color: colors.textSecondary },
    optionTextActive: { color: colors.primary },
    goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    goalChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.glass.light, borderWidth: 0, borderColor: 'transparent' },
    goalChipActive: { borderColor: colors.primary, backgroundColor: 'rgba(99, 102, 241, 0.1)' },
    goalChipText: { ...typography.bodySmall, color: colors.textSecondary },
    goalChipTextActive: { color: colors.primary },
});
