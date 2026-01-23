import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BlurView, BlurViewProps } from 'expo-blur';
import { glass, borderRadius } from '../../theme';

interface GlassViewProps {
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    intensity?: number;
    tint?: BlurViewProps['tint'];
    variant?: keyof typeof glass;
    borderRadius?: number;
}

export function GlassView({
    children,
    style,
    intensity = 50,
    tint = 'dark',
    variant = 'medium',
    borderRadius: radius = borderRadius.lg,
}: GlassViewProps) {
    const glassStyle = glass[variant] || glass.medium;

    return (
        <View
            style={[
                styles.container,
                {
                    borderRadius: radius,
                    backgroundColor: 'transparent',
                    borderColor: glassStyle.borderColor,
                    borderWidth: glassStyle.borderWidth,
                },
                style,
            ]}
        >
            <BlurView
                intensity={intensity}
                tint={tint}
                style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
            />
            {/* Background tint layer from theme if needed, but BlurView handles most. 
          The glass styles usually add a subtle rgba background. 
          We apply that on top or validly on the container.
      */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: glassStyle.backgroundColor, borderRadius: radius }]} />

            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    content: {
        // This view ensures z-index stacking is correct if needed
    },
});
