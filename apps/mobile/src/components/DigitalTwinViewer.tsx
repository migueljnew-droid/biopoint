import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing, withSequence } from 'react-native-reanimated';
import { colors, spacing, typography, borderRadius } from '../theme';
import { GlassView } from './ui/GlassView';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, G, Defs, RadialGradient, Stop } from 'react-native-svg';

// const { width } = Dimensions.get('window');

// A simulated 3D body wireframe using SVG
const BodyWireframe = ({ color }: { color: string }) => {
    return (
        <Svg height="300" width="200" viewBox="0 0 200 300">
            <Defs>
                <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0%" stopColor={color} stopOpacity="0.6" />
                    <Stop offset="100%" stopColor={color} stopOpacity="0" />
                </RadialGradient>
            </Defs>

            {/* Outline of a human body - simplified */}
            <G stroke={color} strokeWidth="2" fill="none" opacity="0.8">
                {/* Head */}
                <Circle cx="100" cy="40" r="25" />
                {/* Torso */}
                <Path d="M100 65 L100 160" />
                <Path d="M70 80 Q100 160 130 80" />
                {/* Shoulders */}
                <Path d="M60 80 L140 80" />
                {/* Arms */}
                <Path d="M60 80 L40 180" />
                <Path d="M140 80 L160 180" />
                {/* Legs */}
                <Path d="M100 160 L80 280" />
                <Path d="M100 160 L120 280" />
            </G>

            {/* Glowing nodes at key areas */}
            <Circle cx="100" cy="40" r="5" fill={color} opacity="0.8" />
            <Circle cx="100" cy="70" r="4" fill={color} />
            <Circle cx="90" cy="100" r="3" fill={color} />
            <Circle cx="110" cy="130" r="3" fill={color} />

            {/* Holographic scanner effect line */}
            {/* Animated outside via reanimated style on a View overlaid */}
        </Svg>
    );
};

export const DigitalTwinViewer = () => {
    const scanY = useSharedValue(0);
    const rotation = useSharedValue(0);

    useEffect(() => {
        scanY.value = withRepeat(withTiming(300, { duration: 3000, easing: Easing.linear }), -1, true);
        rotation.value = withRepeat(
            withSequence(
                withTiming(15, { duration: 2000 }),
                withTiming(-15, { duration: 2000 })
            ),
            -1,
            true
        );
    }, []);

    const scannerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: scanY.value }]
    }));

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Ionicons name="cube-outline" size={20} color={colors.accent} />
                <Text style={styles.headerText}>DIGITAL TWIN // V.1.0</Text>
            </View>

            <View style={styles.viewer}>
                <View style={styles.gridBackground}>
                    {/* Retro Grid lines */}
                    {Array.from({ length: 10 }).map((_, i) => (
                        <View key={i} style={[styles.gridLine, { top: i * 30 }]} />
                    ))}
                    {Array.from({ length: 8 }).map((_, i) => (
                        <View key={i} style={[styles.gridLineV, { left: i * 40 }]} />
                    ))}
                </View>

                <Animated.View style={[styles.bodyContainer]}>
                    <BodyWireframe color={colors.accent} />
                </Animated.View>

                {/* Scanner */}
                <Animated.View style={[styles.scanner, scannerStyle]} />

                {/* Stats overlays */}
                <GlassView variant="light" style={[styles.statNode, { top: 30, right: 20 }]} borderRadius={borderRadius.sm}>
                    <Text style={styles.statLabel}>BRAIN</Text>
                    <Text style={styles.statValue}>OPTIMAL</Text>
                </GlassView>

                <GlassView variant="light" style={[styles.statNode, { top: 100, left: 20 }]} borderRadius={borderRadius.sm}>
                    <Text style={styles.statLabel}>HRV</Text>
                    <Text style={styles.statValue}>42ms</Text>
                </GlassView>
            </View>

            <View style={styles.footer}>
                <Text style={styles.statusText}>SYSTEM STATUS: GREEN</Text>
                <Text style={styles.syncText}>LAST SYNC: JUST NOW</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        padding: spacing.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.md,
    },
    headerText: {
        ...typography.caption,
        color: colors.accent,
        letterSpacing: 2,
        fontWeight: '700',
    },
    viewer: {
        width: '100%',
        height: 350,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    gridBackground: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.1,
    },
    gridLine: {
        position: 'absolute',
        width: '100%',
        height: 1,
        backgroundColor: colors.accent,
    },
    gridLineV: {
        position: 'absolute',
        height: '100%',
        width: 1,
        backgroundColor: colors.accent,
    },
    bodyContainer: {
        opacity: 0.9,
    },
    scanner: {
        position: 'absolute',
        width: '100%',
        height: 2,
        backgroundColor: colors.success,
        shadowColor: colors.success,
        shadowOpacity: 1,
        shadowRadius: 10,
        top: 0,
    },
    statNode: {
        position: 'absolute',
        padding: 4,
        paddingHorizontal: 8,
        borderLeftWidth: 2,
        borderLeftColor: colors.accent,
    },
    statLabel: {
        fontSize: 10,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    statValue: {
        fontSize: 12,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: spacing.sm,
    },
    statusText: {
        fontSize: 10,
        color: colors.success,
        fontFamily: 'Courier',
    },
    syncText: {
        fontSize: 10,
        color: colors.textMuted,
        fontFamily: 'Courier',
    },
});
