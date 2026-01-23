import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { ScreenWrapper, GlassView, AnimatedButton, GlassPicker } from '../../src/components';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function HealthProfileScreen() {
    // In a real app, this would optionally sync with specific backend fields or additional profile columns
    const [bloodType, setBloodType] = useState('');
    const [allergies, setAllergies] = useState('');
    const [conditions, setConditions] = useState('');
    const [medications, setMedications] = useState('');

    const handleSave = () => {
        // Placeholder for saving extended health profile
        Alert.alert('Saved', 'Health profile updated.');
        router.back();
    };

    return (
        <ScreenWrapper withGradient={true}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <GlassView variant="light" borderRadius={borderRadius.full} style={styles.iconButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </GlassView>
                </Pressable>
                <Text style={styles.title}>Health Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Animated.View entering={FadeInDown.delay(100)}>
                    <Text style={styles.subtitle}>Medical context for AI analysis.</Text>

                    <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.section}>
                        <View style={styles.inputGroup}>
                            <GlassPicker
                                label="Blood Type"
                                value={bloodType}
                                onChange={setBloodType}
                                options={[
                                    { label: 'Unknown', value: '' },
                                    { label: 'A+', value: 'A+' },
                                    { label: 'A-', value: 'A-' },
                                    { label: 'B+', value: 'B+' },
                                    { label: 'B-', value: 'B-' },
                                    { label: 'AB+', value: 'AB+' },
                                    { label: 'AB-', value: 'AB-' },
                                    { label: 'O+', value: 'O+' },
                                    { label: 'O-', value: 'O-' },
                                ]}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Allergies</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Peanuts, Penicillin..."
                                placeholderTextColor={colors.textMuted}
                                value={allergies}
                                onChangeText={setAllergies}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Existing Conditions</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Hypertension, Asthma..."
                                placeholderTextColor={colors.textMuted}
                                multiline
                                numberOfLines={3}
                                value={conditions}
                                onChangeText={setConditions}
                                textAlignVertical="top"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Current Medications</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="List any prescriptions..."
                                placeholderTextColor={colors.textMuted}
                                multiline
                                numberOfLines={3}
                                value={medications}
                                onChangeText={setMedications}
                                textAlignVertical="top"
                            />
                        </View>
                    </GlassView>

                    <AnimatedButton title="Save Health Profile" onPress={handleSave} variant="primary" />
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
    iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '600', color: colors.textPrimary },
    content: { padding: spacing.lg },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
    section: { padding: spacing.lg, marginBottom: spacing.xl },
    inputGroup: { marginBottom: spacing.lg },
    label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
    input: { backgroundColor: colors.glass.light, borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.md, padding: spacing.md, color: colors.textPrimary, ...typography.body },
    textArea: { minHeight: 80 },
    backButton: {},
});
