import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { colors, spacing, typography, borderRadius } from '../theme';
import { Ionicons } from '@expo/vector-icons';

interface BreathingGuideProps {
    onClose: () => void;
    visible: boolean;
}

export function BreathingGuide({ onClose, visible }: BreathingGuideProps) {
    const insets = useSafeAreaInsets();
    const [phase, setPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.8);

    useEffect(() => {
        if (visible) {
            startBreathingCycle();
        }
    }, [visible]);

    const startBreathingCycle = () => {
        // 4-7-8 Breathing Technique
        // Inhale (4s) -> Hold (7s) -> Exhale (8s)
        triggerHaptic('Heavy');
        setPhase('Inhale');
        scale.value = withTiming(1.5, { duration: 4000, easing: Easing.inOut(Easing.ease) });
        opacity.value = withTiming(1, { duration: 4000 });

        setTimeout(() => {
            triggerHaptic('Light');
            setPhase('Hold');
            scale.value = withTiming(1.55, { duration: 7000, easing: Easing.linear }); // Slight pulse

            setTimeout(() => {
                triggerHaptic('Medium');
                setPhase('Exhale');
                scale.value = withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) });
                opacity.value = withTiming(0.8, { duration: 8000 });

                setTimeout(() => {
                    // Loop if still visible (basic recursive call)
                    if (visible) startBreathingCycle();
                }, 8000);
            }, 7000);
        }, 4000);
    };

    const triggerHaptic = (type: 'Light' | 'Medium' | 'Heavy') => {
        if (type === 'Light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (type === 'Medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (type === 'Heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    };

    const animatedCircleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    if (!visible) return null;

    // ... existing code ...

    return (
        <View style={[styles.overlay, { paddingBottom: insets.bottom + 100 }]}>
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

            <Pressable style={[styles.closeButton, { top: insets.top + 20 }]} onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>

            <View style={styles.content}>
                <Text style={styles.title}>Neuro-Resonance</Text>
                <Text style={styles.subtitle}>Sync your breath. Feel the data.</Text>

                <View style={styles.circleContainer}>
                    <Animated.View style={[styles.breathingCircle, animatedCircleStyle]}>
                        <View style={styles.innerCircle} />
                    </Animated.View>
                    <Text style={styles.phaseText}>{phase}</Text>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Ionicons name="heart-outline" size={20} color={colors.accent} />
                        <Text style={styles.statValue}>-5 BPM</Text>
                        <Text style={styles.statLabel}>Est. Drop</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statItem}>
                        <Ionicons name="water-outline" size={20} color={colors.primary} />
                        <Text style={styles.statValue}>+12%</Text>
                        <Text style={styles.statLabel}>HRV Boost</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        // top handled dynamically
        right: 20,
        zIndex: 1001,
        padding: spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: borderRadius.full,
    },
    content: {
        alignItems: 'center',
        width: '100%',
    },
    title: {
        ...typography.h3,
        color: colors.textPrimary,
        marginBottom: spacing.xs,
        letterSpacing: 1,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        marginBottom: spacing.xxl * 2,
    },
    circleContainer: {
        width: 300,
        height: 300,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xxl * 2,
    },
    breathingCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderWidth: 1,
        borderColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
    },
    innerCircle: {
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(99, 102, 241, 0.3)',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 40,
    },
    phaseText: {
        ...typography.h2,
        color: '#fff',
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 4,
        zIndex: 10,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    statItem: {
        alignItems: 'center',
        gap: 4,
        minWidth: 80,
    },
    statValue: {
        ...typography.h4,
        color: colors.textPrimary,
    },
    statLabel: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    divider: {
        width: 1,
        height: 40,
        backgroundColor: colors.glass.border,
        marginHorizontal: spacing.xl,
    }
});
