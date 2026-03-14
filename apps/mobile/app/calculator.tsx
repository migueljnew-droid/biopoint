import React, { useCallback, useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
    LinearTransition,
} from 'react-native-reanimated';

import { colors, spacing, typography, borderRadius, gradients, shadows } from '../src/theme';
import { ScreenWrapper, GlassView, AnimatedButton } from '../src/components';
import {
    reconstitute,
    convertUnits,
    type MassUnit,
    type SyringeType,
    type ReconstituteResult,
} from '../src/utils/reconstitute';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormState {
    peptideMg: string;
    bacWaterMl: string;
    desiredDose: string;
    doseUnit: MassUnit;
    syringeType: SyringeType;
}

interface ValidationErrors {
    peptideMg?: string;
    bacWaterMl?: string;
    desiredDose?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOSE_UNITS: MassUnit[] = ['mcg', 'mg', 'IU'];

const UNIT_LABELS: Record<MassUnit, string> = {
    mcg: 'mcg',
    mg: 'mg',
    IU: 'IU',
};

function formatConcentration(val: number): string {
    if (val >= 1000) return `${(val / 1000).toFixed(2)} mg/mL`;
    return `${val.toFixed(2)} mcg/mL`;
}

function formatDrawVolume(val: number): string {
    return `${val.toFixed(4)} mL`;
}

function formatSyringeUnits(val: number): string {
    return `${val.toFixed(1)} units`;
}

// Convert user-facing dose to mcg for reconstitute()
function toDoseMcg(value: number, unit: MassUnit): number | null {
    if (unit === 'mcg') return value;
    if (unit === 'mg') return value * 1000;
    // IU: we cannot convert without iuConversion factor so we fall back to treating IU numerically as mcg-equivalent
    // (user is responsible for knowing their peptide's IU factor). We document this in the UI.
    if (unit === 'IU') return value; // 1:1 numeric pass-through — no iuConversion available
    return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    unit?: string;
    error?: string;
    keyboardType?: 'numeric' | 'decimal-pad';
    hint?: string;
}

function GlassField({
    label,
    value,
    onChange,
    placeholder,
    unit,
    error,
    hint,
}: FieldProps) {
    const borderAnim = useSharedValue(0);

    const borderStyle = useAnimatedStyle(() => ({
        borderColor: borderAnim.value === 1
            ? colors.primary
            : error
                ? colors.error
                : colors.glass.border,
        borderWidth: borderAnim.value === 1 ? 1.5 : 1,
    }));

    return (
        <Animated.View style={styles.fieldGroup} layout={LinearTransition}>
            <Text style={styles.label}>{label}</Text>
            <Animated.View style={[styles.inputWrapper, borderStyle]}>
                <TextInput
                    style={[styles.input, unit && styles.inputWithUnit]}
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    onFocus={() => { borderAnim.value = withTiming(1, { duration: 200 }); }}
                    onBlur={() => { borderAnim.value = withTiming(0, { duration: 200 }); }}
                />
                {unit && (
                    <View style={styles.unitBadge}>
                        <Text style={styles.unitBadgeText}>{unit}</Text>
                    </View>
                )}
            </Animated.View>
            {error && (
                <Animated.View entering={FadeInDown.duration(200)} style={styles.errorRow}>
                    <Ionicons name="alert-circle" size={13} color={colors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
            )}
            {hint && !error && (
                <Text style={styles.hintText}>{hint}</Text>
            )}
        </Animated.View>
    );
}

interface ToggleGroupProps<T extends string> {
    label: string;
    options: T[];
    value: T;
    onChange: (v: T) => void;
    renderLabel?: (v: T) => string;
}

function ToggleGroup<T extends string>({
    label,
    options,
    value,
    onChange,
    renderLabel,
}: ToggleGroupProps<T>) {
    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.toggleRow}>
                {options.map((opt) => {
                    const active = opt === value;
                    return (
                        <Pressable
                            key={opt}
                            style={({ pressed }) => [
                                styles.toggleOption,
                                active && styles.toggleOptionActive,
                                pressed && styles.toggleOptionPressed,
                            ]}
                            onPress={() => {
                                Haptics.selectionAsync();
                                onChange(opt);
                            }}
                        >
                            {active ? (
                                <LinearGradient
                                    colors={gradients.primary}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                />
                            ) : null}
                            <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>
                                {renderLabel ? renderLabel(opt) : opt}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

interface ResultRowProps {
    icon: string;
    label: string;
    value: string;
    accent?: boolean;
    delay?: number;
}

function ResultRow({ icon, label, value, accent, delay = 0 }: ResultRowProps) {
    return (
        <Animated.View entering={FadeInUp.delay(delay).springify()} style={styles.resultRow}>
            <View style={[styles.resultIconWrap, accent && styles.resultIconWrapAccent]}>
                <Ionicons
                    name={icon as any}
                    size={18}
                    color={accent ? colors.accent : colors.primary}
                />
            </View>
            <View style={styles.resultLabelCol}>
                <Text style={styles.resultLabel}>{label}</Text>
            </View>
            <Text style={[styles.resultValue, accent && styles.resultValueAccent]}>{value}</Text>
        </Animated.View>
    );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CalculatorScreen() {
    const params = useLocalSearchParams<{
        peptideMg?: string;
        bacWaterMl?: string;
        desiredDoseMcg?: string;
        peptideName?: string;
    }>();

    const [form, setForm] = useState<FormState>({
        peptideMg: params.peptideMg ?? '',
        bacWaterMl: params.bacWaterMl ?? '',
        desiredDose: params.desiredDoseMcg ?? '',
        doseUnit: 'mcg',
        syringeType: 'U-100',
    });

    const [errors, setErrors] = useState<ValidationErrors>({});
    const [result, setResult] = useState<ReconstituteResult | null>(null);
    const [calcError, setCalcError] = useState<string | null>(null);

    // Pulse animation on result card when new result arrives
    const resultScale = useSharedValue(1);
    const resultStyle = useAnimatedStyle(() => ({
        transform: [{ scale: resultScale.value }],
    }));

    // ---------------------------------------------------------------------------
    // Validation
    // ---------------------------------------------------------------------------

    function validate(): boolean {
        const next: ValidationErrors = {};

        const pep = parseFloat(form.peptideMg);
        if (!form.peptideMg.trim()) {
            next.peptideMg = 'Peptide amount is required';
        } else if (isNaN(pep) || pep <= 0) {
            next.peptideMg = 'Must be a positive number';
        }

        const bac = parseFloat(form.bacWaterMl);
        if (!form.bacWaterMl.trim()) {
            next.bacWaterMl = 'BAC water volume is required';
        } else if (isNaN(bac) || bac <= 0) {
            next.bacWaterMl = 'Must be a positive number';
        }

        const dose = parseFloat(form.desiredDose);
        if (!form.desiredDose.trim()) {
            next.desiredDose = 'Desired dose is required';
        } else if (isNaN(dose) || dose <= 0) {
            next.desiredDose = 'Must be a positive number';
        }

        setErrors(next);
        return Object.keys(next).length === 0;
    }

    // ---------------------------------------------------------------------------
    // Live calculation — runs on every relevant input change
    // ---------------------------------------------------------------------------

    const calculate = useCallback(() => {
        const pep = parseFloat(form.peptideMg);
        const bac = parseFloat(form.bacWaterMl);
        const dose = parseFloat(form.desiredDose);

        // If any field is blank or not yet parseable just clear results silently
        if (
            !form.peptideMg.trim() ||
            !form.bacWaterMl.trim() ||
            !form.desiredDose.trim() ||
            isNaN(pep) || isNaN(bac) || isNaN(dose)
        ) {
            setResult(null);
            setCalcError(null);
            return;
        }

        if (pep <= 0 || bac <= 0 || dose <= 0) {
            setResult(null);
            setCalcError(null);
            return;
        }

        try {
            const doseMcg = toDoseMcg(dose, form.doseUnit);
            if (doseMcg === null || doseMcg <= 0) {
                setResult(null);
                setCalcError('Could not convert dose to mcg.');
                return;
            }

            const calc = reconstitute(pep, bac, doseMcg, form.syringeType);
            setResult(calc);
            setCalcError(null);

            // Animate result card
            resultScale.value = withSequence(
                withSpring(1.03, { damping: 8, stiffness: 180 }),
                withSpring(1, { damping: 12, stiffness: 180 }),
            );
        } catch (e: any) {
            setResult(null);
            setCalcError(e?.message ?? 'Calculation error');
        }
    }, [form]);

    useEffect(() => {
        calculate();
    }, [calculate]);

    // ---------------------------------------------------------------------------
    // Calculate button (with haptics + explicit validation feedback)
    // ---------------------------------------------------------------------------

    function handleCalculate() {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (!validate()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Result already computed live; just scroll to confirm
    }

    // ---------------------------------------------------------------------------
    // Helpers for form updates
    // ---------------------------------------------------------------------------

    function update(key: keyof FormState) {
        return (v: string) => setForm((prev) => ({ ...prev, [key]: v }));
    }

    function updateSyringe(v: SyringeType) {
        setForm((prev) => ({ ...prev, syringeType: v }));
    }

    function updateDoseUnit(v: MassUnit) {
        // When unit changes, attempt to convert the current dose value numerically
        const prev = form.doseUnit;
        const raw = parseFloat(form.desiredDose);

        setForm((f) => {
            if (!isNaN(raw) && raw > 0 && prev !== v) {
                // Only convert between mcg/mg — IU needs iuConversion factor we don't have
                if ((prev === 'mcg' && v === 'mg') || (prev === 'mg' && v === 'mcg')) {
                    try {
                        const converted = convertUnits({ value: raw, from: prev, to: v });
                        return {
                            ...f,
                            doseUnit: v,
                            desiredDose: converted.value.toString(),
                        };
                    } catch {
                        // Fall through — keep value as-is
                    }
                }
            }
            return { ...f, doseUnit: v };
        });
    }

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    const peptideName = params.peptideName;

    return (
        <ScreenWrapper withGradient>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTransparent: true,
                    headerTitle: peptideName ? `${peptideName} Calculator` : 'Reconstitution Calculator',
                    headerTitleStyle: {
                        color: colors.textPrimary,
                        fontSize: 17,
                        fontWeight: '600',
                    },
                    headerLeft: () => (
                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.back();
                            }}
                            style={({ pressed }) => [
                                styles.headerBackBtn,
                                pressed && styles.headerBackBtnPressed,
                            ]}
                            hitSlop={12}
                        >
                            <GlassView variant="light" style={styles.headerBackInner} borderRadius={borderRadius.full}>
                                <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                            </GlassView>
                        </Pressable>
                    ),
                    headerBackground: () => (
                        <LinearGradient
                            colors={['rgba(10,10,15,0.95)', 'rgba(10,10,15,0)']}
                            style={StyleSheet.absoluteFill}
                        />
                    ),
                }}
            />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            >
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Hero header */}
                    <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
                        <LinearGradient
                            colors={gradients.primary}
                            style={styles.heroIconGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons name="flask" size={28} color="#fff" />
                        </LinearGradient>
                        <View>
                            <Text style={styles.heroTitle}>
                                {peptideName ?? 'Peptide Calculator'}
                            </Text>
                            <Text style={styles.heroSubtitle}>
                                Precise reconstitution dosing
                            </Text>
                        </View>
                    </Animated.View>

                    {/* Input card */}
                    <Animated.View entering={FadeInDown.delay(80).springify()}>
                        <GlassView variant="medium" style={styles.card} borderRadius={borderRadius.xl}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="options-outline" size={16} color={colors.primary} />
                                <Text style={styles.cardTitle}>Reconstitution Inputs</Text>
                            </View>

                            <GlassField
                                label="Peptide Amount"
                                value={form.peptideMg}
                                onChange={update('peptideMg')}
                                placeholder="5"
                                unit="mg"
                                error={errors.peptideMg}
                                hint="Total peptide mass in the vial"
                            />

                            <GlassField
                                label="BAC Water Volume"
                                value={form.bacWaterMl}
                                onChange={update('bacWaterMl')}
                                placeholder="2"
                                unit="mL"
                                error={errors.bacWaterMl}
                                hint="Bacteriostatic water to add"
                            />

                            {/* Dose field with unit toggle */}
                            <View style={styles.fieldGroup}>
                                <View style={styles.doseLabelRow}>
                                    <Text style={styles.label}>Desired Dose</Text>
                                    <View style={styles.doseUnitToggle}>
                                        {DOSE_UNITS.map((u) => {
                                            const active = u === form.doseUnit;
                                            return (
                                                <Pressable
                                                    key={u}
                                                    style={({ pressed }) => [
                                                        styles.doseUnitChip,
                                                        active && styles.doseUnitChipActive,
                                                        pressed && styles.doseUnitChipPressed,
                                                    ]}
                                                    onPress={() => updateDoseUnit(u)}
                                                    hitSlop={4}
                                                >
                                                    {active && (
                                                        <LinearGradient
                                                            colors={gradients.primary}
                                                            style={StyleSheet.absoluteFill}
                                                            start={{ x: 0, y: 0 }}
                                                            end={{ x: 1, y: 0 }}
                                                        />
                                                    )}
                                                    <Text style={[
                                                        styles.doseUnitChipLabel,
                                                        active && styles.doseUnitChipLabelActive,
                                                    ]}>
                                                        {UNIT_LABELS[u]}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </View>

                                <Animated.View style={[styles.inputWrapper, {
                                    borderColor: errors.desiredDose ? colors.error : colors.glass.border,
                                    borderWidth: 1,
                                }]}>
                                    <TextInput
                                        style={styles.input}
                                        value={form.desiredDose}
                                        onChangeText={update('desiredDose')}
                                        placeholder={form.doseUnit === 'mcg' ? '250' : form.doseUnit === 'mg' ? '0.25' : '1'}
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="decimal-pad"
                                    />
                                </Animated.View>

                                {errors.desiredDose && (
                                    <Animated.View entering={FadeInDown.duration(200)} style={styles.errorRow}>
                                        <Ionicons name="alert-circle" size={13} color={colors.error} />
                                        <Text style={styles.errorText}>{errors.desiredDose}</Text>
                                    </Animated.View>
                                )}

                                {form.doseUnit === 'IU' && (
                                    <Animated.View entering={FadeInDown.duration(200)} style={styles.warningRow}>
                                        <Ionicons name="information-circle-outline" size={13} color={colors.warning} />
                                        <Text style={styles.warningText}>
                                            IU conversion uses 1:1 numeric pass-through. Verify your peptide's IU/mg factor independently.
                                        </Text>
                                    </Animated.View>
                                )}
                            </View>

                            <ToggleGroup
                                label="Syringe Type"
                                options={['U-100', 'U-40'] as SyringeType[]}
                                value={form.syringeType}
                                onChange={updateSyringe}
                                renderLabel={(v) => v === 'U-100' ? 'U-100 (100 IU/mL)' : 'U-40 (40 IU/mL)'}
                            />
                        </GlassView>
                    </Animated.View>

                    {/* Results card */}
                    {result && !calcError && (
                        <Animated.View
                            entering={FadeInDown.delay(60).springify()}
                            layout={LinearTransition}
                            style={resultStyle}
                        >
                            <GlassView variant="heavy" style={styles.resultsCard} borderRadius={borderRadius.xl}>
                                {/* Header row */}
                                <View style={styles.resultsHeader}>
                                    <LinearGradient
                                        colors={gradients.primary}
                                        style={styles.resultsHeaderBadge}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        <Ionicons name="checkmark-circle" size={14} color="#fff" />
                                        <Text style={styles.resultsHeaderBadgeText}>Live Results</Text>
                                    </LinearGradient>
                                </View>

                                {/* Divider */}
                                <View style={styles.divider} />

                                <ResultRow
                                    icon="beaker-outline"
                                    label="Concentration"
                                    value={formatConcentration(result.concentration)}
                                    delay={0}
                                />

                                <View style={styles.resultDivider} />

                                <ResultRow
                                    icon="eyedrop-outline"
                                    label="Volume to Draw"
                                    value={formatDrawVolume(result.drawVolumeMl)}
                                    delay={60}
                                />

                                <View style={styles.resultDivider} />

                                <ResultRow
                                    icon="arrow-up-circle-outline"
                                    label={`Syringe Units (${form.syringeType})`}
                                    value={formatSyringeUnits(result.syringeUnits)}
                                    accent
                                    delay={120}
                                />

                                {/* Callout */}
                                <Animated.View entering={FadeInDown.delay(180)} style={styles.callout}>
                                    <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                                    <Text style={styles.calloutText}>
                                        Draw {formatSyringeUnits(result.syringeUnits)} on a {form.syringeType} syringe for your{' '}
                                        {form.desiredDose} {form.doseUnit} dose.
                                    </Text>
                                </Animated.View>
                            </GlassView>
                        </Animated.View>
                    )}

                    {/* Calc error banner */}
                    {calcError && (
                        <Animated.View entering={FadeInDown.springify()} layout={LinearTransition}>
                            <GlassView variant="light" style={styles.errorCard} borderRadius={borderRadius.xl}>
                                <Ionicons name="warning-outline" size={20} color={colors.error} />
                                <Text style={styles.errorCardText}>{calcError}</Text>
                            </GlassView>
                        </Animated.View>
                    )}

                    {/* Empty state when nothing entered */}
                    {!result && !calcError && (
                        <Animated.View entering={FadeIn.delay(300)} layout={LinearTransition}>
                            <GlassView variant="light" style={styles.emptyCard} borderRadius={borderRadius.xl}>
                                <Ionicons name="flask-outline" size={32} color={colors.textMuted} />
                                <Text style={styles.emptyTitle}>Results appear here</Text>
                                <Text style={styles.emptySubtitle}>
                                    Fill in all fields above and results update live
                                </Text>
                            </GlassView>
                        </Animated.View>
                    )}

                    {/* CTA button */}
                    <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.ctaRow}>
                        <AnimatedButton
                            title="Confirm Calculation"
                            onPress={handleCalculate}
                            variant="primary"
                            style={styles.ctaButton}
                        />
                    </Animated.View>

                    {/* Reference card */}
                    <Animated.View entering={FadeInDown.delay(250).springify()}>
                        <GlassView variant="light" style={styles.referenceCard} borderRadius={borderRadius.xl}>
                            <Text style={styles.referenceTitle}>Quick Reference</Text>
                            <View style={styles.referenceRow}>
                                <Text style={styles.referenceLabel}>Formula:</Text>
                                <Text style={styles.referenceValue}>
                                    Concentration = (mg × 1000) / mL
                                </Text>
                            </View>
                            <View style={styles.referenceRow}>
                                <Text style={styles.referenceLabel}>Draw volume:</Text>
                                <Text style={styles.referenceValue}>
                                    Dose (mcg) / Concentration (mcg/mL)
                                </Text>
                            </View>
                            <View style={styles.referenceRow}>
                                <Text style={styles.referenceLabel}>U-100 units:</Text>
                                <Text style={styles.referenceValue}>
                                    Draw volume (mL) × 100
                                </Text>
                            </View>
                            <View style={[styles.referenceRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                                <Text style={styles.referenceLabel}>U-40 units:</Text>
                                <Text style={styles.referenceValue}>
                                    Draw volume (mL) × 40
                                </Text>
                            </View>
                        </GlassView>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenWrapper>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingTop: spacing.xxl + 48, // leave room for transparent header
        paddingBottom: 120,
        gap: spacing.md,
    },

    // Hero
    hero: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    heroIconGradient: {
        width: 52,
        height: 52,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.primaryGlow,
    },
    heroTitle: {
        ...typography.h3,
        color: colors.textPrimary,
        letterSpacing: -0.3,
    },
    heroSubtitle: {
        ...typography.bodySmall,
        color: colors.textMuted,
        marginTop: 2,
    },

    // Card
    card: {
        padding: spacing.lg,
        gap: spacing.xs,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    cardTitle: {
        ...typography.label,
        color: colors.textSecondary,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontSize: 11,
    },

    // Fields
    fieldGroup: {
        marginBottom: spacing.md,
    },
    label: {
        ...typography.label,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        marginLeft: 2,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.light,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
    },
    input: {
        flex: 1,
        padding: spacing.md,
        color: colors.textPrimary,
        ...typography.body,
        fontSize: 16,
    },
    inputWithUnit: {
        paddingRight: spacing.xs,
    },
    unitBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.glass.medium,
        borderLeftWidth: 1,
        borderLeftColor: colors.glass.border,
        minWidth: 52,
        alignItems: 'center',
    },
    unitBadgeText: {
        ...typography.label,
        color: colors.textSecondary,
        fontWeight: '600',
        fontSize: 12,
    },

    // Error / warning / hint
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: spacing.xs,
        marginLeft: 2,
    },
    errorText: {
        ...typography.caption,
        color: colors.error,
        flex: 1,
    },
    warningRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 5,
        marginTop: spacing.xs,
        marginLeft: 2,
        backgroundColor: colors.warningMuted,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
    },
    warningText: {
        ...typography.caption,
        color: colors.warning,
        flex: 1,
        lineHeight: 16,
    },
    hintText: {
        ...typography.caption,
        color: colors.textMuted,
        marginTop: 4,
        marginLeft: 2,
    },

    // Dose unit row
    doseLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    doseUnitToggle: {
        flexDirection: 'row',
        gap: 4,
    },
    doseUnitChip: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.light,
        borderWidth: 1,
        borderColor: colors.glass.border,
        overflow: 'hidden',
        minWidth: 38,
        alignItems: 'center',
    },
    doseUnitChipActive: {
        borderColor: 'transparent',
        ...shadows.primaryGlow,
    },
    doseUnitChipPressed: {
        opacity: 0.75,
    },
    doseUnitChipLabel: {
        ...typography.caption,
        color: colors.textMuted,
        fontWeight: '500',
        fontSize: 11,
    },
    doseUnitChipLabelActive: {
        color: '#fff',
        fontWeight: '700',
    },

    // Toggle group
    toggleRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    toggleOption: {
        flex: 1,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.glass.light,
        borderWidth: 1,
        borderColor: colors.glass.border,
        alignItems: 'center',
        overflow: 'hidden',
    },
    toggleOptionActive: {
        borderColor: 'transparent',
        ...shadows.primaryGlow,
    },
    toggleOptionPressed: {
        opacity: 0.8,
    },
    toggleLabel: {
        ...typography.label,
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: '500',
    },
    toggleLabelActive: {
        color: '#fff',
        fontWeight: '700',
    },

    // Results
    resultsCard: {
        padding: spacing.lg,
    },
    resultsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    resultsHeaderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: spacing.sm,
        paddingVertical: 5,
        borderRadius: borderRadius.full,
    },
    resultsHeaderBadgeText: {
        ...typography.caption,
        color: '#fff',
        fontWeight: '700',
        fontSize: 11,
    },
    divider: {
        height: 1,
        backgroundColor: colors.glass.border,
        marginBottom: spacing.md,
    },

    // Result rows
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
    },
    resultIconWrap: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.md,
        backgroundColor: colors.glassColored.primary,
        borderWidth: 1,
        borderColor: colors.glassColored.primaryBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    resultIconWrapAccent: {
        backgroundColor: colors.glassColored.accent,
        borderColor: colors.glassColored.accentBorder,
    },
    resultLabelCol: {
        flex: 1,
    },
    resultLabel: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    resultValue: {
        ...typography.body,
        color: colors.textPrimary,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    resultValueAccent: {
        color: colors.accent,
    },
    resultDivider: {
        height: 1,
        backgroundColor: colors.glass.border,
        marginHorizontal: spacing.xs,
    },

    // Callout
    callout: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.xs,
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    calloutText: {
        ...typography.caption,
        color: colors.textMuted,
        flex: 1,
        lineHeight: 18,
    },

    // Error card
    errorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.lg,
    },
    errorCardText: {
        ...typography.body,
        color: colors.error,
        flex: 1,
    },

    // Empty state
    emptyCard: {
        padding: spacing.xxl,
        alignItems: 'center',
        gap: spacing.sm,
    },
    emptyTitle: {
        ...typography.label,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    emptySubtitle: {
        ...typography.caption,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 18,
    },

    // CTA
    ctaRow: {
        marginTop: spacing.xs,
    },
    ctaButton: {
        // AnimatedButton handles its own gradient/shadow
    },

    // Reference card
    referenceCard: {
        padding: spacing.lg,
    },
    referenceTitle: {
        ...typography.label,
        color: colors.textSecondary,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontSize: 11,
        marginBottom: spacing.sm,
    },
    referenceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
        gap: spacing.sm,
    },
    referenceLabel: {
        ...typography.caption,
        color: colors.textMuted,
        fontWeight: '600',
        minWidth: 90,
    },
    referenceValue: {
        ...typography.caption,
        color: colors.textSecondary,
        flex: 1,
        textAlign: 'right',
        lineHeight: 16,
    },

    // Header
    headerBackBtn: {
        marginLeft: spacing.sm,
    },
    headerBackBtnPressed: {
        opacity: 0.7,
    },
    headerBackInner: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
