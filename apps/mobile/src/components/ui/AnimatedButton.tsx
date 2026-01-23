import React, { useCallback } from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { gradients, animations, typography, borderRadius, shadows } from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedButtonProps {
    title: string;
    onPress: () => void;
    variant?: keyof typeof gradients.cta;
    style?: ViewStyle;
    textStyle?: TextStyle;
    icon?: React.ReactNode;
    disabled?: boolean;
}

export const AnimatedButton = React.forwardRef<View, AnimatedButtonProps>(({
    title,
    onPress,
    variant = 'primary',
    style,
    textStyle,
    icon,
    disabled = false,
}, ref) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const handlePressIn = useCallback(() => {
        if (disabled) return;
        scale.value = withSpring(
            animations.presets.buttonPress.scale,
            animations.springs.snappy
        );
        opacity.value = withTiming(
            animations.presets.buttonPress.opacity,
            { duration: animations.timings.buttonPress.duration }
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [disabled]);

    const handlePressOut = useCallback(() => {
        if (disabled) return;
        scale.value = withSpring(1, animations.springs.snappy);
        opacity.value = withTiming(1, {
            duration: animations.timings.buttonRelease.duration
        });
    }, [disabled]);

    return (
        <AnimatedPressable
            ref={ref}
            onPress={disabled ? undefined : onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[
                styles.container,
                !disabled && shadows.button,
                style,
                animatedStyle,
                disabled && styles.disabledContainer
            ]}
        >
            <LinearGradient
                colors={disabled ? ['#2a2a3d', '#2a2a3d'] : gradients.cta[variant]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                {icon}
                <Text style={[styles.text, textStyle, disabled && styles.disabledText]}>
                    {title}
                </Text>
            </LinearGradient>
        </AnimatedPressable>
    );
});

AnimatedButton.displayName = 'AnimatedButton';

const styles = StyleSheet.create({
    container: {
        borderRadius: borderRadius.button,
        overflow: 'hidden',
    },
    gradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    text: {
        ...typography.button,
        color: '#ffffff',
        fontWeight: '600',
    },
    disabledContainer: {
        shadowOpacity: 0,
        elevation: 0,
    },
    disabledText: {
        color: 'rgba(255, 255, 255, 0.4)',
    },
});
