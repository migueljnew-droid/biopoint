import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from './GlassView';

export interface PickerOption {
    label: string;
    value: string | number;
}

interface GlassPickerProps {
    label: string;
    value: string | number;
    options: PickerOption[];
    onChange: (value: any) => void;
    placeholder?: string;
}

export function GlassPicker({ label, value, options, onChange, placeholder = 'Select...' }: GlassPickerProps) {
    const [showPicker, setShowPicker] = useState(false);

    const selectedOption = options.find(opt => opt.value === value);
    const displayValue = selectedOption ? selectedOption.label : placeholder;

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>
            <Pressable onPress={() => setShowPicker(true)}>
                <GlassView variant="light" intensity={20} borderRadius={borderRadius.lg} style={styles.trigger}>
                    <Text style={[styles.valueText, !selectedOption && styles.placeholder]}>
                        {displayValue}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </GlassView>
            </Pressable>

            <Modal visible={showPicker} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Pressable onPress={() => setShowPicker(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </Pressable>
                            <Text style={styles.modalTitle}>{label}</Text>
                            <Pressable onPress={() => setShowPicker(false)}>
                                <Text style={styles.doneText}>Done</Text>
                            </Pressable>
                        </View>
                        <Picker
                            selectedValue={value}
                            onValueChange={(itemValue) => {
                                onChange(itemValue);
                            }}
                            style={styles.picker}
                            itemStyle={styles.pickerItem}
                        >
                            {options.map((opt) => (
                                <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                            ))}
                        </Picker>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.lg,
    },
    label: {
        ...typography.label,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        marginLeft: 4,
    },
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
    },
    valueText: {
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
    picker: {
        height: 200,
    },
    pickerItem: {
        color: colors.textPrimary,
    },
});
