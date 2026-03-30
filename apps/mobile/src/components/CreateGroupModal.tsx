import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../theme';
import { GlassView } from './ui/GlassView';
import { AnimatedButton } from './ui/AnimatedButton';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

interface CreateGroupModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (name: string, description: string) => Promise<void>;
}

export const CreateGroupModal = ({ visible, onClose, onSubmit }: CreateGroupModalProps) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim()) return;
        setIsLoading(true);
        try {
            await onSubmit(name, description);
            setName('');
            setDescription('');
            onClose();
        } catch (error) {
            // Error handling should be done in parent or here
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <Animated.View
                    entering={SlideInDown}
                    exiting={SlideOutDown}
                    style={styles.container}
                >
                    <GlassView variant="heavy" style={styles.content} borderRadius={borderRadius.xl}>
                        <View style={styles.handle} />

                        <View style={styles.header}>
                            <Text style={styles.title}>Create New Group</Text>
                            <Pressable onPress={onClose} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </Pressable>
                        </View>

                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Group Name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="e.g. BioHackers Elite"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Description</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    value={description}
                                    onChangeText={setDescription}
                                    placeholder="What's this community about?"
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />
                            </View>
                        </View>

                        <View style={styles.footer}>
                            <AnimatedButton
                                title="Create Group"
                                onPress={handleSubmit}
                                variant="primary"
                                disabled={!name.trim()}
                            />
                        </View>
                    </GlassView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    container: {
        width: '100%',
    },
    content: {
        padding: spacing.lg,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        minHeight: 400,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    title: {
        ...typography.h3,
        color: colors.textPrimary,
    },
    closeButton: {
        padding: 4,
    },
    form: {
        marginBottom: spacing.xl,
    },
    inputGroup: {
        marginBottom: spacing.lg,
    },
    label: {
        ...typography.label,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        marginLeft: 4,
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
    footer: {
        paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    },
});
