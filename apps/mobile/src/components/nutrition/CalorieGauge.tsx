import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, spacing } from '../../theme';

const SIZE = 180;
const STROKE_WIDTH = 10;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface CalorieGaugeProps {
    consumed: number;
    target: number | null;
}

export function CalorieGauge({ consumed, target }: CalorieGaugeProps) {
    const effectiveTarget = target ?? 2000;
    const ratio = Math.min(1.2, consumed / effectiveTarget);
    const isOver = consumed > effectiveTarget;
    const strokeColor = isOver ? colors.error : '#a78bfa';
    const offset = CIRCUMFERENCE * (1 - Math.min(1, ratio));

    return (
        <View style={styles.container}>
            <Svg width={SIZE} height={SIZE}>
                <Circle
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                />
                <Circle
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    stroke={strokeColor}
                    strokeWidth={STROKE_WIDTH}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                />
            </Svg>
            <View style={styles.center}>
                <Text style={[styles.consumed, isOver && { color: colors.error }]}>
                    {consumed}
                </Text>
                <Text style={styles.unit}>cal</Text>
                {target && (
                    <Text style={styles.target}>/ {target}</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: SIZE,
        height: SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
    },
    center: {
        position: 'absolute',
        alignItems: 'center',
    },
    consumed: {
        fontSize: 36,
        fontWeight: '800',
        color: '#a78bfa',
        letterSpacing: -1,
    },
    unit: {
        fontSize: 14,
        color: colors.textMuted,
        marginTop: -2,
    },
    target: {
        fontSize: 13,
        color: colors.textMuted,
        marginTop: 2,
    },
});
