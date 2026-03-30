import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TextInput, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    SlideInDown, SlideOutDown, FadeIn, FadeOut,
    useSharedValue, useAnimatedStyle, useAnimatedProps, withRepeat, withTiming, withSequence,
    Easing, interpolate,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { GlassView, AnimatedButton } from '../ui';
import { useNutritionStore } from '../../store/nutritionStore';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ANALYSIS_STEPS = [
    { icon: 'scan-outline' as const, text: 'Scanning image...' },
    { icon: 'restaurant-outline' as const, text: 'Identifying food items...' },
    { icon: 'nutrition-outline' as const, text: 'Estimating portions...' },
    { icon: 'calculator-outline' as const, text: 'Calculating macros...' },
    { icon: 'sparkles' as const, text: 'Finalizing analysis...' },
];

const RING_SIZE = 140;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

function AnalyzingAnimation() {
    const rotation = useSharedValue(0);
    const pulse = useSharedValue(1);
    const ringProgress = useSharedValue(0);
    const [stepIndex, setStepIndex] = useState(0);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 3000, easing: Easing.linear }),
            -1, false,
        );
        pulse.value = withRepeat(
            withSequence(
                withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            ),
            -1, true,
        );
        ringProgress.value = withRepeat(
            withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
            -1, true,
        );

        const interval = setInterval(() => {
            setStepIndex(prev => (prev + 1) % ANALYSIS_STEPS.length);
        }, 2200);
        return () => clearInterval(interval);
    }, []);

    const spinStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
        opacity: interpolate(pulse.value, [1, 1.15], [0.7, 1]),
    }));

    const ringAnimatedProps = useAnimatedProps(() => ({
        strokeDashoffset: RING_CIRC * (1 - ringProgress.value * 0.75),
    }));

    const step = ANALYSIS_STEPS[stepIndex]!;

    return (
        <View style={styles.analyzingContainer}>
            {/* Outer glow */}
            <Animated.View style={[styles.analyzingGlow, pulseStyle]} />

            {/* Ring + center icon */}
            <View style={styles.analyzingRingWrap}>
                <Animated.View style={[styles.analyzingRing, spinStyle]}>
                    <Svg width={RING_SIZE} height={RING_SIZE}>
                        <Defs>
                            <LinearGradient id="aiRingGrad" x1="0" y1="0" x2="1" y2="1">
                                <Stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                                <Stop offset="50%" stopColor="#6366f1" stopOpacity={1} />
                                <Stop offset="100%" stopColor="#4f46e5" stopOpacity={0.4} />
                            </LinearGradient>
                        </Defs>
                        <Circle
                            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
                            stroke="rgba(99,102,241,0.15)" strokeWidth={RING_STROKE} fill="none"
                        />
                        <AnimatedCircle
                            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
                            stroke="url(#aiRingGrad)" strokeWidth={RING_STROKE} strokeLinecap="round"
                            fill="none" strokeDasharray={RING_CIRC}
                            animatedProps={ringAnimatedProps}
                        />
                    </Svg>
                </Animated.View>
                <Animated.View style={[styles.analyzingIconWrap, pulseStyle]}>
                    <Ionicons name="sparkles" size={44} color="#818cf8" />
                </Animated.View>
            </View>

            {/* Step text */}
            <Animated.View key={stepIndex} entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.analyzingStepRow}>
                <Ionicons name={step.icon} size={18} color="#a5b4fc" />
                <Text style={styles.analyzingStepText}>{step.text}</Text>
            </Animated.View>

            <Text style={styles.analyzingTitle}>AI Analyzing Your Meal</Text>
            <Text style={styles.analyzingSubtext}>GPT-4o Vision is breaking down nutrients</Text>
        </View>
    );
}

interface FoodAnalysisModalProps {
    visible: boolean;
    onClose: () => void;
}

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;

export function FoodAnalysisModal({ visible, onClose }: FoodAnalysisModalProps) {
    const { analysisResult, saveMealFromAnalysis, clearAnalysis, isAnalyzing, selectedDate } = useNutritionStore();
    const [mealType, setMealType] = useState<typeof MEAL_TYPES[number]>('LUNCH');
    const [name, setName] = useState('');
    const [calories, setCalories] = useState('');
    const [proteinG, setProteinG] = useState('');
    const [carbsG, setCarbsG] = useState('');
    const [fatG, setFatG] = useState('');
    const [fiberG, setFiberG] = useState('');

    useEffect(() => {
        if (analysisResult) {
            setName(analysisResult.name);
            setCalories(analysisResult.calories.toString());
            setProteinG(analysisResult.proteinG.toString());
            setCarbsG(analysisResult.carbsG.toString());
            setFatG(analysisResult.fatG.toString());
            setFiberG(analysisResult.fiberG.toString());
        }
    }, [analysisResult]);

    const handleSave = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await saveMealFromAnalysis({
            date: selectedDate,
            mealType,
            name,
            calories: parseInt(calories) || 0,
            proteinG: parseFloat(proteinG) || 0,
            carbsG: parseFloat(carbsG) || 0,
            fatG: parseFloat(fatG) || 0,
            fiberG: parseFloat(fiberG) || 0,
        });
        onClose();
    };

    const handleCancel = () => {
        clearAnalysis();
        onClose();
    };

    const confidence = analysisResult?.confidence ?? 0;
    const confidenceColor = confidence >= 0.8 ? colors.success : confidence >= 0.5 ? '#f59e0b' : colors.error;

    if (!visible) return null;

    // Show analyzing animation while API call is in progress
    if (isAnalyzing || !analysisResult) {
        return (
            <Modal visible animationType="fade" transparent>
                <View style={styles.overlay}>
                    <AnalyzingAnimation />
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible animationType="fade" transparent>
            <View style={styles.overlay}>
                <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <GlassView variant="heavy" style={styles.content} borderRadius={borderRadius.xxl}>
                        <View style={styles.handle} />
                        <View style={styles.header}>
                            <Text style={styles.title}>AI Analysis</Text>
                            <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor + '20' }]}>
                                <Text style={[styles.confidenceText, { color: confidenceColor }]}>
                                    {Math.round(confidence * 100)}% confident
                                </Text>
                            </View>
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

                            <EditableField label="Food Name" value={name} onChange={setName} />
                            <EditableField label="Calories" value={calories} onChange={setCalories} keyboardType="numeric" />
                            <EditableField label="Protein (g)" value={proteinG} onChange={setProteinG} keyboardType="numeric" />
                            <EditableField label="Carbs (g)" value={carbsG} onChange={setCarbsG} keyboardType="numeric" />
                            <EditableField label="Fat (g)" value={fatG} onChange={setFatG} keyboardType="numeric" />
                            <EditableField label="Fiber (g)" value={fiberG} onChange={setFiberG} keyboardType="numeric" />

                            {/* Detected Items */}
                            {analysisResult.items.length > 0 && (
                                <View style={styles.itemsSection}>
                                    <Text style={styles.itemsTitle}>Detected Items</Text>
                                    {analysisResult.items.map((item, i) => (
                                        <View key={i} style={styles.itemRow}>
                                            <Text style={styles.itemName}>{item.name}</Text>
                                            <Text style={styles.itemCal}>{item.calories} cal</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>

                        <View style={styles.footer}>
                            <AnimatedButton title="Save Meal" onPress={handleSave} variant="primary" />
                            <Pressable onPress={handleCancel} style={styles.cancelBtn} accessibilityRole="button">
                                <Text style={styles.cancelText}>Cancel</Text>
                            </Pressable>
                        </View>
                    </GlassView>
                </Animated.View>
            </View>
        </Modal>
    );
}

function EditableField({ label, value, onChange, keyboardType }: {
    label: string; value: string; onChange: (v: string) => void; keyboardType?: 'numeric' | 'default';
}) {
    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <GlassView variant="light" borderRadius={borderRadius.lg} style={styles.fieldWrapper}>
                <TextInput
                    style={styles.fieldInput}
                    value={value}
                    onChangeText={onChange}
                    keyboardType={keyboardType}
                    keyboardAppearance="dark"
                />
            </GlassView>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end',
    },
    content: {
        height: '85%', padding: spacing.lg,
        borderWidth: 0, borderColor: 'transparent', backgroundColor: colors.backgroundSecondary,
    },
    handle: {
        width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg,
    },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg,
    },
    title: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
    confidenceBadge: {
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full,
    },
    confidenceText: { fontSize: 12, fontWeight: '700' },
    scroll: { flex: 1 },
    typeRow: {
        flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg, flexWrap: 'wrap',
    },
    typeChip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full,
        backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0, borderColor: 'transparent',
    },
    typeChipActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
    typeText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
    typeTextActive: { color: colors.primary, fontWeight: '700' },
    fieldGroup: { marginBottom: spacing.md },
    fieldLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs, marginLeft: 4 },
    fieldWrapper: { borderWidth: 0, borderColor: 'transparent' },
    fieldInput: { padding: spacing.md, color: colors.textPrimary, fontSize: 15 },
    itemsSection: { marginTop: spacing.md },
    itemsTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
    itemRow: {
        flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
        borderBottomWidth: 0, borderBottomColor: 'transparent',
    },
    itemName: { fontSize: 13, color: colors.textSecondary },
    itemCal: { fontSize: 13, color: colors.textMuted },
    footer: {
        paddingTop: spacing.md, paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    },
    cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
    cancelText: { fontSize: 15, color: colors.textMuted },
    analyzingContainer: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
    },
    analyzingGlow: {
        position: 'absolute',
        width: 200, height: 200, borderRadius: 100,
        backgroundColor: 'rgba(99,102,241,0.08)',
    },
    analyzingRingWrap: {
        width: RING_SIZE, height: RING_SIZE,
        alignItems: 'center', justifyContent: 'center',
    },
    analyzingRing: {
        position: 'absolute', width: RING_SIZE, height: RING_SIZE,
    },
    analyzingIconWrap: {
    },
    analyzingStepRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginTop: 28, height: 24,
    },
    analyzingStepText: {
        fontSize: 15, fontWeight: '600', color: '#a5b4fc',
    },
    analyzingTitle: {
        fontSize: 22, fontWeight: '800', color: colors.textPrimary,
        marginTop: 20,
    },
    analyzingSubtext: {
        fontSize: 14, color: colors.textMuted, marginTop: 6,
    },
});
