import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors, spacing, typography, borderRadius } from '../theme';

interface HeightPickerProps {
    value: string; // cm as string
    onChange: (cm: string) => void;
}

const FEET_OPTIONS = [4, 5, 6, 7];
const INCHES_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function cmToFeetInches(cm: number): { feet: number; inches: number } {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { feet: Math.max(4, Math.min(7, feet)), inches: Math.min(11, inches) };
}

function feetInchesToCm(feet: number, inches: number): number {
    const totalInches = feet * 12 + inches;
    return Math.round(totalInches * 2.54);
}

export function HeightPicker({ value, onChange }: HeightPickerProps) {
    const [showPicker, setShowPicker] = useState(false);
    const [feet, setFeet] = useState(5);
    const [inches, setInches] = useState(9);

    useEffect(() => {
        if (value) {
            const cm = parseFloat(value);
            if (!isNaN(cm)) {
                const { feet: f, inches: i } = cmToFeetInches(cm);
                setFeet(f);
                setInches(i);
            }
        }
    }, []);

    const handleDone = () => {
        const cm = feetInchesToCm(feet, inches);
        onChange(cm.toString());
        setShowPicker(false);
    };

    const displayValue = value ? `${feet}'${inches}"` : 'Select height';

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
                            <Text style={styles.modalTitle}>Height</Text>
                            <Pressable onPress={handleDone}>
                                <Text style={styles.doneText}>Done</Text>
                            </Pressable>
                        </View>
                        <View style={styles.pickerRow}>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={feet}
                                    onValueChange={setFeet}
                                    style={styles.picker}
                                    itemStyle={styles.pickerItem}
                                >
                                    {FEET_OPTIONS.map((f) => (
                                        <Picker.Item key={f} label={`${f} ft`} value={f} />
                                    ))}
                                </Picker>
                            </View>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={inches}
                                    onValueChange={setInches}
                                    style={styles.picker}
                                    itemStyle={styles.pickerItem}
                                >
                                    {INCHES_OPTIONS.map((i) => (
                                        <Picker.Item key={i} label={`${i} in`} value={i} />
                                    ))}
                                </Picker>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    input: {
        backgroundColor: colors.backgroundCard,
        borderWidth: 0,
        borderColor: 'transparent',
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
        borderBottomWidth: 0,
        borderBottomColor: 'transparent',
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
    pickerRow: {
        flexDirection: 'row',
    },
    pickerContainer: {
        flex: 1,
    },
    picker: {
        height: 200,
    },
    pickerItem: {
        color: colors.textPrimary,
    },
});
