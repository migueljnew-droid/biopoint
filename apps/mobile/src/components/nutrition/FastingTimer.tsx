import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { colors, spacing, typography, withAlpha } from '../../theme';
import { getZoneForHours, getNextZone } from '../../constants/fastingZones';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 240;
const STROKE_WIDTH = 12;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface FastingTimerProps {
    startedAt: string;
    targetEndAt: string;
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

function formatElapsed(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const s = Math.floor(((hours - h) * 60 - m) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function FastingTimer({ startedAt, targetEndAt, status }: FastingTimerProps) {
    const [elapsed, setElapsed] = useState(0);
    const progress = useSharedValue(0);

    const start = new Date(startedAt).getTime();
    const target = new Date(targetEndAt).getTime();
    const totalMs = target - start;

    useEffect(() => {
        if (status !== 'ACTIVE') return;

        const tick = () => {
            const now = Date.now();
            const elapsedMs = now - start;
            const elapsedHours = elapsedMs / (1000 * 60 * 60);
            setElapsed(elapsedHours);
            const pct = Math.min(1, elapsedMs / totalMs);
            progress.value = withTiming(pct, { duration: 900, easing: Easing.linear });
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [startedAt, targetEndAt, status]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
    }));

    const zone = getZoneForHours(elapsed);
    const next = getNextZone(elapsed);
    const totalTargetHours = totalMs / (1000 * 60 * 60);

    return (
        <View style={styles.container}>
            <View style={[styles.ringContainer, { shadowColor: zone.glowColor, shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } }]}>
                <Svg width={SIZE} height={SIZE}>
                    <Defs>
                        <RadialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                            <Stop offset="0%" stopColor={zone.glowColor} stopOpacity={0.18} />
                            <Stop offset="50%" stopColor={zone.color} stopOpacity={0.08} />
                            <Stop offset="100%" stopColor={zone.color} stopOpacity={0} />
                        </RadialGradient>
                        <LinearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0%" stopColor={zone.glowColor} stopOpacity={1} />
                            <Stop offset="50%" stopColor={zone.color} stopOpacity={1} />
                            <Stop offset="100%" stopColor={zone.color} stopOpacity={0.7} />
                        </LinearGradient>
                    </Defs>
                    {/* Center glow */}
                    <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS - 10} fill="url(#centerGlow)" />
                    {/* Background ring */}
                    <Circle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        stroke={withAlpha(zone.color, 0.2)}
                        strokeWidth={STROKE_WIDTH}
                        fill="none"
                    />
                    {/* Progress ring with gradient */}
                    <AnimatedCircle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        stroke="url(#ringGradient)"
                        strokeWidth={STROKE_WIDTH}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={CIRCUMFERENCE}
                        animatedProps={animatedProps}
                        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                    />
                </Svg>
                <View style={styles.centerContent}>
                    <Text style={styles.elapsed}>{formatElapsed(elapsed)}</Text>
                    <Text style={[styles.zoneName, { color: zone.glowColor }]}>{zone.name}</Text>
                    <Text style={styles.target}>of {totalTargetHours}h</Text>
                </View>
            </View>
            <Text style={styles.zoneDescription}>{zone.description}</Text>
            {next && (
                <Text style={styles.nextZone}>
                    <Text style={{ color: colors.textSecondary }}>Next: </Text>
                    <Text style={{ color: next.zone.glowColor, fontWeight: '700' }}>{next.zone.name}</Text>
                    <Text style={{ color: colors.textSecondary }}> in {next.hoursUntil.toFixed(1)}h</Text>
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    ringContainer: {
        width: SIZE,
        height: SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerContent: {
        position: 'absolute',
        alignItems: 'center',
    },
    elapsed: {
        fontSize: 40,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: -1,
        fontVariant: ['tabular-nums'],
    },
    zoneName: {
        fontSize: 17,
        fontWeight: '800',
        marginTop: 4,
        letterSpacing: 0.5,
    },
    target: {
        fontSize: 13,
        color: colors.textTertiary,
        marginTop: 2,
    },
    zoneDescription: {
        ...typography.caption,
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.md,
        paddingHorizontal: spacing.lg,
        lineHeight: 18,
    },
    nextZone: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: spacing.sm,
    },
});
