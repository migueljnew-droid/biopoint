import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, SafeAreaView, ScrollView, Switch, Alert } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '../src/theme';
import { api } from '../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { HeightPicker, WeightPicker } from '../src/components';

const STEPS = ['Basic Info', 'Goals', 'Interventions', 'Consent'];

export default function OnboardingScreen() {
    const [step, setStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // Form data
    const [sex, setSex] = useState<'male' | 'female' | 'other' | null>(null);
    const [heightCm, setHeightCm] = useState('');
    const [weightKg, setWeightKg] = useState('');
    const [goals, setGoals] = useState<string[]>([]);
    const [dietStyle, setDietStyle] = useState('');
    const [interventions, setInterventions] = useState('');
    const [consentNotMedical, setConsentNotMedical] = useState(false);
    const [consentDataStorage, setConsentDataStorage] = useState(false);
    const [consentResearch, setConsentResearch] = useState(false);

    const goalOptions = ['Optimize Health', 'Build Muscle', 'Lose Fat', 'Improve Sleep', 'Increase Energy', 'Enhance Focus', 'Longevity'];

    const toggleGoal = (goal: string) => {
        setGoals((prev) => prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]);
    };

    const handleNext = () => {
        if (step === 0 && !sex) {
            Alert.alert('Required', 'Please select your biological sex');
            return;
        }
        if (step < STEPS.length - 1) {
            setStep(step + 1);
        } else {
            handleSubmit();
        }
    };

    const handleSubmit = async () => {
        if (!consentNotMedical || !consentDataStorage) {
            Alert.alert('Required', 'You must acknowledge the disclaimers to continue');
            return;
        }
        setIsLoading(true);
        try {
            await api.put('/profile/onboarding', {
                sex,
                heightCm: heightCm ? parseFloat(heightCm) : undefined,
                baselineWeightKg: weightKg ? parseFloat(weightKg) : undefined,
                goals,
                dietStyle: dietStyle || undefined,
                currentInterventions: interventions || undefined,
                consentNotMedical,
                consentDataStorage,
                consentResearch,
            });
            router.replace('/(tabs)');
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to save profile');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Progress */}
            <View style={styles.progress}>
                {STEPS.map((_, i) => (
                    <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
                ))}
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.stepTitle}>{STEPS[step]}</Text>

                {step === 0 && (
                    <View style={styles.stepContent}>
                        <Text style={styles.label}>Biological Sex</Text>
                        <View style={styles.options}>
                            {(['male', 'female', 'other'] as const).map((s) => (
                                <Pressable key={s} style={[styles.option, sex === s && styles.optionActive]} onPress={() => setSex(s)}>
                                    <Text style={[styles.optionText, sex === s && styles.optionTextActive]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
                                </Pressable>
                            ))}
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Height</Text>
                            <HeightPicker value={heightCm} onChange={setHeightCm} />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Weight</Text>
                            <WeightPicker value={weightKg} onChange={setWeightKg} />
                        </View>
                    </View>
                )}

                {step === 1 && (
                    <View style={styles.stepContent}>
                        <Text style={styles.label}>What are your goals?</Text>
                        <View style={styles.goalsGrid}>
                            {goalOptions.map((goal) => (
                                <Pressable key={goal} style={[styles.goalChip, goals.includes(goal) && styles.goalChipActive]} onPress={() => toggleGoal(goal)}>
                                    <Text style={[styles.goalChipText, goals.includes(goal) && styles.goalChipTextActive]}>{goal}</Text>
                                </Pressable>
                            ))}
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Diet Style (optional)</Text>
                            <TextInput style={styles.input} value={dietStyle} onChangeText={setDietStyle} placeholder="e.g., Keto, Paleo, High Protein" placeholderTextColor={colors.textMuted} />
                        </View>
                    </View>
                )}

                {step === 2 && (
                    <View style={styles.stepContent}>
                        <Text style={styles.label}>Current Interventions (optional)</Text>
                        <Text style={styles.hint}>List any supplements, peptides, or protocols you're currently using</Text>
                        <TextInput style={[styles.input, styles.textArea]} value={interventions} onChangeText={setInterventions} placeholder="e.g., Vitamin D 5000IU, BPC-157 250mcg SubQ" placeholderTextColor={colors.textMuted} multiline numberOfLines={4} textAlignVertical="top" />
                    </View>
                )}

                {step === 3 && (
                    <View style={styles.stepContent}>
                        <View style={styles.consentItem}>
                            <View style={styles.consentTextContainer}>
                                <Text style={styles.consentTitle}>Not Medical Advice *</Text>
                                <Text style={styles.consentDesc}>I understand that BioPoint is for informational purposes only and does not provide medical advice, diagnosis, or treatment.</Text>
                            </View>
                            <Switch value={consentNotMedical} onValueChange={setConsentNotMedical} trackColor={{ true: colors.primary }} />
                        </View>
                        <View style={styles.consentItem}>
                            <View style={styles.consentTextContainer}>
                                <Text style={styles.consentTitle}>Data Storage Consent *</Text>
                                <Text style={styles.consentDesc}>I consent to storing my health data for self-tracking purposes within BioPoint.</Text>
                            </View>
                            <Switch value={consentDataStorage} onValueChange={setConsentDataStorage} trackColor={{ true: colors.primary }} />
                        </View>
                        <View style={styles.consentItem}>
                            <View style={styles.consentTextContainer}>
                                <Text style={styles.consentTitle}>Research Program (optional)</Text>
                                <Text style={styles.consentDesc}>I opt-in to contribute anonymized, aggregated data to research. No raw labs, photos, or identifiers shared. Revocable anytime.</Text>
                            </View>
                            <Switch value={consentResearch} onValueChange={setConsentResearch} trackColor={{ true: colors.primary }} />
                        </View>
                    </View>
                )}
            </ScrollView>

            <View style={styles.actions}>
                {step > 0 && (
                    <Pressable style={styles.backButton} onPress={() => setStep(step - 1)}>
                        <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
                        <Text style={styles.backButtonText}>Back</Text>
                    </Pressable>
                )}
                <Pressable style={[styles.nextButton, isLoading && styles.buttonDisabled]} onPress={handleNext} disabled={isLoading}>
                    <Text style={styles.nextButtonText}>{step === STEPS.length - 1 ? (isLoading ? 'Saving...' : 'Complete') : 'Next'}</Text>
                    {step < STEPS.length - 1 && <Ionicons name="arrow-forward" size={20} color={colors.textPrimary} />}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    progress: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, padding: spacing.md },
    progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    progressDotActive: { backgroundColor: colors.primary, width: 24 },
    content: { flex: 1, padding: spacing.lg },
    stepTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.lg },
    stepContent: { gap: spacing.md },
    label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
    hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
    options: { flexDirection: 'row', gap: spacing.sm },
    option: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.backgroundCard, borderWidth: 0, borderColor: 'transparent', alignItems: 'center' },
    optionActive: { borderColor: colors.primary, backgroundColor: 'rgba(99, 102, 241, 0.1)' },
    optionText: { ...typography.label, color: colors.textSecondary },
    optionTextActive: { color: colors.primary },
    inputGroup: { marginTop: spacing.md },
    input: { backgroundColor: colors.backgroundCard, borderWidth: 0, borderColor: 'transparent', borderRadius: borderRadius.md, padding: spacing.md, color: colors.textPrimary, ...typography.body },
    textArea: { minHeight: 120 },
    goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    goalChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.backgroundCard, borderWidth: 0, borderColor: 'transparent' },
    goalChipActive: { borderColor: colors.primary, backgroundColor: 'rgba(99, 102, 241, 0.1)' },
    goalChipText: { ...typography.bodySmall, color: colors.textSecondary },
    goalChipTextActive: { color: colors.primary },
    consentItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.backgroundCard, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm },
    consentTextContainer: { flex: 1 },
    consentTitle: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs },
    consentDesc: { ...typography.caption, color: colors.textMuted },
    actions: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, gap: spacing.md },
    backButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    backButtonText: { ...typography.label, color: colors.textSecondary },
    nextButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md },
    buttonDisabled: { opacity: 0.6 },
    nextButtonText: { ...typography.label, color: '#ffffff', fontWeight: '700' },
});
