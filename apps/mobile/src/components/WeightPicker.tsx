import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors, spacing, typography, borderRadius } from '../theme';

interface WeightPickerProps {
    value: string; // kg as string
    onChange: (kg: string) => void;
    placeholder?: string;
}

// Generate weight options from 80 to 400 lbs
const WEIGHT_OPTIONS = Array.from({ length: 321 }, (_, i) => i + 80);

function kgToLbs(kg: number): number {
    return Math.round(kg * 2.20462);
}

function lbsToKg(lbs: number): number {
    return Math.round((lbs / 2.20462) * 10) / 10;
}

export function WeightPicker({ value, onChange, placeholder = 'Select weight' }: WeightPickerProps) {
    const [showPicker, setShowPicker] = useState(false);
    const [lbs, setLbs] = useState(165);

    useEffect(() => {
        if (value) {
            const kg = parseFloat(value);
            if (!isNaN(kg)) {
                const convertedLbs = kgToLbs(kg);
                setLbs(Math.max(80, Math.min(400, convertedLbs)));
            }
        }
    }, []);

    const handleDone = () => {
        const kg = lbsToKg(lbs);
        onChange(kg.toString());
        setShowPicker(false);
    };

    const displayValue = value ? `${kgToLbs(parseFloat(value))} lbs` : placeholder;

    return (
        <>
            <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
                <Text style={[styles.inputText, !value && styles.placeholder]}>
                    {displayValue}
                </Text>
            </Pressable>

            <Modal visible={showPicker} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Pressable onPress={() => setShowPicker(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </Pressable>
                            <Text style={styles.modalTitle}>Weight</Text>
                            <Pressable onPress={handleDone}>
                                <Text style={styles.doneText}>Done</Text>
                            </Pressable>
                        </View>
                        <Picker
                            selectedValue={lbs}
                            onValueChange={setLbs}
                            style={styles.picker}
                            itemStyle={styles.pickerItem}
                        >
                            {WEIGHT_OPTIONS.map((w) => (
                                <Picker.Item key={w} label={`${w} lbs`} value={w} />
                            ))}
                        </Picker>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    input: {
        backgroundColor: colors.backgroundCard,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: spacing.md,
    },
    inputText: {
        ...typography.body,
        color: colors.textPrimary,
    },
    placeholder: {
        color: colors.textMuted,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.backgroundSecondary,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        paddingBottom: spacing.xxl,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        ...typography.h4,
        color: colors.textPrimary,
    },
    cancelText: {
        ...typography.body,
        color: colors.textSecondary,
    },
    doneText: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '600',
    },
    picker: {
        height: 200,
    },
    pickerItem: {
        color: colors.textPrimary,
    },
});
