import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { GlassView } from '../ui';
import { useNutritionStore } from '../../store/nutritionStore';
import { useFastingStore } from '../../store/fastingStore';
import { CalorieGauge } from './CalorieGauge';
import { MacroBar } from './MacroBar';
import { MealCard } from './MealCard';
import { AddMealModal } from './AddMealModal';
import { FoodAnalysisModal } from './FoodAnalysisModal';

const MEAL_ORDER = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;

export function FoodLogView() {
    const {
        dailySummary, selectedDate, isLoading, isAnalyzing, analysisResult,
        fetchDailySummary, deleteMeal, setSelectedDate,
    } = useNutritionStore();
    const { activeSession, endFast } = useFastingStore();

    const [showAddMeal, setShowAddMeal] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);

    useEffect(() => {
        fetchDailySummary();
    }, []);

    // Show analysis modal when analyzing starts or result arrives
    useEffect(() => {
        if (isAnalyzing || analysisResult) setShowAnalysis(true);
    }, [isAnalyzing, analysisResult]);

    const handleDeleteMeal = (id: string) => {
        Alert.alert('Delete Meal', 'Remove this meal entry?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => deleteMeal(id),
            },
        ]);
    };

    const handleAddMealPress = () => {
        // If actively fasting, warn user
        if (activeSession) {
            Alert.alert(
                'Currently Fasting',
                'Logging food will end your current fast. Continue?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'End Fast & Log',
                        onPress: async () => {
                            await endFast(activeSession.id);
                            setShowAddMeal(true);
                        },
                    },
                ]
            );
        } else {
            setShowAddMeal(true);
        }
    };

    const summary = dailySummary;
    const meals = summary?.meals ?? [];

    // Group meals by type
    const grouped = MEAL_ORDER.map(type => ({
        type,
        label: type.charAt(0) + type.slice(1).toLowerCase(),
        meals: meals.filter(m => m.mealType === type),
    })).filter(g => g.meals.length > 0);

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Calorie Gauge */}
                <Animated.View entering={FadeInDown.duration(400)}>
                    <GlassView variant="medium" borderRadius={borderRadius.xl} style={styles.gaugeCard}>
                        <CalorieGauge
                            consumed={summary?.totalCalories ?? 0}
                            target={summary?.targets?.calories ?? null}
                        />
                    </GlassView>
                </Animated.View>

                {/* Macro Bars */}
                <Animated.View entering={FadeInDown.delay(100)}>
                    <GlassView variant="light" borderRadius={borderRadius.xl} style={styles.macroCard}>
                        <MacroBar
                            label="Protein"
                            value={summary?.totalProteinG ?? 0}
                            target={summary?.targets?.proteinG ?? null}
                            color="#3b82f6"
                        />
                        <MacroBar
                            label="Carbs"
                            value={summary?.totalCarbsG ?? 0}
                            target={summary?.targets?.carbsG ?? null}
                            color="#f59e0b"
                        />
                        <MacroBar
                            label="Fat"
                            value={summary?.totalFatG ?? 0}
                            target={summary?.targets?.fatG ?? null}
                            color="#ef4444"
                        />
                    </GlassView>
                </Animated.View>

                {/* Meals */}
                <Text style={styles.sectionTitle}>
                    Meals {summary?.mealCount ? `(${summary.mealCount})` : ''}
                </Text>

                {grouped.length === 0 ? (
                    <GlassView variant="light" borderRadius={borderRadius.xl} style={styles.emptyCard}>
                        <Ionicons name="restaurant-outline" size={32} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No meals logged today</Text>
                        <Text style={styles.emptySubtext}>Snap a photo or log manually</Text>
                    </GlassView>
                ) : (
                    grouped.map((group) => (
                        <Animated.View key={group.type} entering={FadeInDown.delay(200)}>
                            <Text style={styles.groupTitle}>{group.label}</Text>
                            {group.meals.map((meal) => (
                                <MealCard
                                    key={meal.id}
                                    id={meal.id}
                                    name={meal.name}
                                    calories={meal.calories}
                                    proteinG={meal.proteinG}
                                    carbsG={meal.carbsG}
                                    fatG={meal.fatG}
                                    servingSize={meal.servingSize}
                                    aiAnalyzed={meal.aiAnalyzed}
                                    onDelete={handleDeleteMeal}
                                />
                            ))}
                        </Animated.View>
                    ))
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* FAB */}
            <Pressable
                style={styles.fab}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleAddMealPress();
                }}
                accessibilityRole="button"
            >
                <Ionicons name="add" size={28} color="#fff" />
            </Pressable>

            <AddMealModal
                visible={showAddMeal}
                onClose={() => setShowAddMeal(false)}
                onShowAnalysis={() => setShowAnalysis(true)}
            />
            <FoodAnalysisModal
                visible={showAnalysis}
                onClose={() => setShowAnalysis(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 120,
    },
    gaugeCard: {
        padding: spacing.lg,
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    macroCard: {
        padding: spacing.lg,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    sectionTitle: {
        ...typography.h4,
        color: colors.textPrimary,
        marginBottom: spacing.md,
    },
    groupTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.sm,
        marginTop: spacing.sm,
    },
    emptyCard: {
        padding: spacing.xxl,
        alignItems: 'center',
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    emptyText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    emptySubtext: {
        fontSize: 13,
        color: colors.textMuted,
    },
    fab: {
        position: 'absolute',
        bottom: 100,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowRadius: 16,
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
    },
});
