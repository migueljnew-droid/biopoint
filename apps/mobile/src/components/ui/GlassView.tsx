import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { borderRadius as br } from '../../theme';

// Dark liquid glass variants — no BlurView (it creates gray surfaces on dark backgrounds)
const glassStyles: Record<string, { backgroundColor: string; borderColor: string; borderWidth: number }> = {
    ultraLight: { backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(255, 255, 255, 0.04)', borderWidth: 1 },
    light:      { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.06)', borderWidth: 1 },
    medium:     { backgroundColor: 'rgba(255, 255, 255, 0.07)', borderColor: 'rgba(255, 255, 255, 0.08)', borderWidth: 1 },
    heavy:      { backgroundColor: 'rgba(255, 255, 255, 0.10)', borderColor: 'rgba(255, 255, 255, 0.10)', borderWidth: 1 },
    solid:      { backgroundColor: 'rgba(255, 255, 255, 0.14)', borderColor: 'rgba(255, 255, 255, 0.12)', borderWidth: 1 },
    frosted:    { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.08)', borderWidth: 1 },
    frostedDark:{ backgroundColor: 'rgba(22, 22, 30, 0.95)',    borderColor: 'rgba(255, 255, 255, 0.06)', borderWidth: 1 },
    primary:    { backgroundColor: 'rgba(27, 75, 122, 0.15)',   borderColor: 'rgba(27, 75, 122, 0.25)',   borderWidth: 1 },
    accent:     { backgroundColor: 'rgba(13, 148, 136, 0.15)',  borderColor: 'rgba(13, 148, 136, 0.25)',  borderWidth: 1 },
    selected:   { backgroundColor: 'rgba(27, 75, 122, 0.12)',   borderColor: 'rgba(27, 75, 122, 0.30)',   borderWidth: 1 },
    error:      { backgroundColor: 'rgba(220, 38, 38, 0.10)',   borderColor: 'rgba(220, 38, 38, 0.20)',   borderWidth: 1 },
};

interface GlassViewProps {
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    intensity?: number;
    tint?: string;
    variant?: string;
    borderRadius?: number;
}

export function GlassView({
    children,
    style,
    variant = 'medium',
    borderRadius: radius = br.lg,
}: GlassViewProps) {
    const glass = glassStyles[variant] || glassStyles.medium;

    return (
        <View
            style={[
                styles.container,
                {
                    borderRadius: radius,
                    backgroundColor: glass.backgroundColor,
                    borderColor: glass.borderColor,
                    borderWidth: glass.borderWidth,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
});
