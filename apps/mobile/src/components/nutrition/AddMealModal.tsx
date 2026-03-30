import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TextInput, Pressable, Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { GlassView, AnimatedButton } from '../ui';
import { useNutritionStore } from '../../store/nutritionStore';

interface AddMealModalProps {
    visible: boolean;
    onClose: () => void;
    onShowAnalysis: () => void;
}

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;

export function AddMealModal({ visible, onClose, onShowAnalysis }: AddMealModalProps) {
    const { addMeal, analyzePhoto, analyzeText, isAnalyzing, selectedDate } = useNutritionStore();
    const [mealType, setMealType] = useState<typeof MEAL_TYPES[number]>('LUNCH');
    const [name, setName] = useState('');
    const [calories, setCalories] = useState('');
    const [proteinG, setProteinG] = useState('');
    const [carbsG, setCarbsG] = useState('');
    const [fatG, setFatG] = useState('');

    const handleSnapPhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission needed', 'Camera access is required to snap food photos.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            // Resize for smaller payload
            const manipulated = await manipulateAsync(
                asset.uri,
                [{ resize: { width: 1024 } }],
                { compress: 0.7, format: SaveFormat.JPEG, base64: true }
            );
            if (manipulated.base64) {
                // Show animation modal BEFORE the API call
                onClose();
                onShowAnalysis();
                analyzePhoto(manipulated.base64, 'image/jpeg');
            }
        }
    };

    const handlePickGallery = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            const manipulated = await manipulateAsync(
                asset.uri,
                [{ resize: { width: 1024 } }],
                { compress: 0.7, format: SaveFormat.JPEG, base64: true }
            );
            if (manipulated.base64) {
                // Show animation modal BEFORE the API call
                onClose();
                onShowAnalysis();
                analyzePhoto(manipulated.base64, 'image/jpeg');
            }
        }
    };

    const handleManualSave = async () => {
        if (!name.trim() || !calories.trim()) {
            Alert.alert('Required', 'Name and calories are required.');
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await addMeal({
            date: selectedDate,
            mealType,
            name: name.trim(),
            calories: parseInt(calories),
            proteinG: proteinG ? parseFloat(proteinG) : undefined,
            carbsG: carbsG ? parseFloat(carbsG) : undefined,
            fatG: fatG ? parseFloat(fatG) : undefined,
        });
        resetForm();
        onClose();
    };

    const resetForm = () => {
        setName('');
        setCalories('');
        setProteinG('');
        setCarbsG('');
        setFatG('');
        setMealType('LUNCH');
    };

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View style={styles.overlay}>
                <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <GlassView variant="heavy" style={styles.content} borderRadius={borderRadius.xxl}>
                        <View style={styles.handle} />
                        <View style={styles.header}>
                            <Text style={styles.title}>Add Meal</Text>
                            <Pressable onPress={onClose} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </Pressable>
                        </View>

                        {/* AI Photo Buttons */}
                        <View style={styles.photoRow}>
                            <Pressable style={styles.photoButton} onPress={handleSnapPhoto} accessibilityRole="button">
                                <Ionicons name="camera" size={28} color={colors.primary} />
                                <Text style={styles.photoLabel}>Camera</Text>
                            </Pressable>
                            <Pressable style={styles.photoButton} onPress={handlePickGallery} accessibilityRole="button">
                                <Ionicons name="images" size={28} color={colors.primary} />
                                <Text style={styles.photoLabel}>Gallery</Text>
                            </Pressable>
                        </View>

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or log manually</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
                            {/* Meal Type */}
                            <View style={styles.typeRow}>
                                {MEAL_TYPES.map((type) => (
                                    <Pressable
                                        key={type}
                                        onPress={() => setMealType(type)}
                                        style={[styles.typeChip, mealType === type && styles.typeChipActive]}
                                        accessibilityRole="button"
                                    >
                                        <Text style={[styles.typeText, mealType === type && styles.typeTextActive]}>
                                            {type.charAt(0) + type.slice(1).toLowerCase()}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <InputField label="Food Name" value={name} onChange={setName} placeholder="e.g. Grilled Chicken Salad" />
                            {name.trim().length > 2 && !calories && (
                                <Pressable
                                    style={styles.aiEstimateButton}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        onClose();
                                        onShowAnalysis();
                                        analyzeText(name.trim());
                                    }}
                                    accessibilityRole="button"
                                >
                                    <Ionicons name="sparkles" size={16} color={colors.primary} />
                                    <Text style={styles.aiEstimateText}>AI Estimate Calories & Macros</Text>
                                </Pressable>
                            )}
                            <InputField label="Calories" value={calories} onChange={setCalories} placeholder="0" keyboardType="numeric" />
                            <InputField label="Protein (g)" value={proteinG} onChange={setProteinG} placeholder="0" keyboardType="numeric" />
                            <InputField label="Carbs (g)" value={carbsG} onChange={setCarbsG} placeholder="0" keyboardType="numeric" />
                            <InputField label="Fat (g)" value={fatG} onChange={setFatG} placeholder="0" keyboardType="numeric" />
                        </ScrollView>

                        <View style={styles.footer}>
                            <AnimatedButton title="Save Meal" onPress={handleManualSave} variant="primary" />
                        </View>
                    </GlassView>
                </Animated.View>
            </View>
        </Modal>
    );
}

function InputField({ label, value, onChange, placeholder, keyboardType }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; keyboardType?: 'numeric' | 'default';
}) {
    return (
        <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{label}</Text>
            <GlassView variant="light" borderRadius={borderRadius.lg} style={styles.inputWrapper}>
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    keyboardType={keyboardType}
                    keyboardAppearance="dark"
                />
            </GlassView>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    content: {
        height: '90%',
        padding: spacing.lg,
        borderWidth: 0,
        borderColor: 'transparent',
        backgroundColor: colors.backgroundSecondary,
    },
    handle: {
        width: 40, height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg,
    },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md,
    },
    title: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
    closeBtn: { padding: 4 },
    photoRow: {
        flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md,
    },
    photoButton: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        paddingVertical: spacing.lg,
        backgroundColor: 'rgba(59,130,246,0.08)',
        borderRadius: borderRadius.xl,
        borderWidth: 0, borderColor: 'transparent',
    },
    photoLabel: {
        fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 4,
    },
    divider: {
        flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md,
    },
    dividerLine: {
        flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)',
    },
    dividerText: {
        fontSize: 12, color: colors.textMuted, marginHorizontal: spacing.sm,
    },
    scroll: { flex: 1 },
    typeRow: {
        flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg, flexWrap: 'wrap',
    },
    typeChip: {
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: borderRadius.full,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 0, borderColor: 'transparent',
    },
    typeChipActive: {
        backgroundColor: colors.primary + '15',
        borderColor: colors.primary,
    },
    typeText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
    typeTextActive: { color: colors.primary, fontWeight: '700' },
    inputGroup: { marginBottom: spacing.md },
    inputLabel: {
        ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs, marginLeft: 4,
    },
    inputWrapper: { borderWidth: 0, borderColor: 'transparent' },
    input: {
        padding: spacing.md, color: colors.textPrimary, fontSize: 15,
    },
    aiEstimateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: 'rgba(99,102,241,0.1)',
        marginBottom: spacing.sm,
    },
    aiEstimateText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.primary,
    },
    footer: {
        paddingTop: spacing.md,
        paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    },
});
