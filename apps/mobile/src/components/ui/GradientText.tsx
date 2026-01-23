import React from 'react';
import { Text, TextProps } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../../theme';

interface GradientTextProps extends TextProps {
    colors?: readonly string[] | string[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
}

export function GradientText({
    colors: gradientColors = gradients.primaryExtended,
    start = { x: 0, y: 0 },
    end = { x: 1, y: 0 },
    style,
    children,
    ...props
}: GradientTextProps) {
    return (
        <MaskedView
            maskElement={
                <Text style={[style, { backgroundColor: 'transparent' }]} {...props}>
                    {children}
                </Text>
            }
        >
            <LinearGradient
                colors={gradientColors as any}
                start={start}
                end={end}
            >
                <Text style={[style, { opacity: 0 }]} {...props}>
                    {children}
                </Text>
            </LinearGradient>
        </MaskedView>
    );
}
