import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing } from '../../theme';
import { type FastingZone, getZoneForHours } from '../../constants/fastingZones';

interface FastingZoneBannerProps {
    elapsedHours: number;
}

export function FastingZoneBanner({ elapsedHours }: FastingZoneBannerProps) {
    const [showBanner, setShowBanner] = useState(false);
    const [lastZoneId, setLastZoneId] = useState<number | null>(null);
    const [currentZone, setCurrentZone] = useState<FastingZone | null>(null);
    const iconScale = useSharedValue(1);

    useEffect(() => {
        const zone = getZoneForHours(elapsedHours);

        if (lastZoneId !== null && zone.id !== lastZoneId) {
            setCurrentZone(zone);
            setShowBanner(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            iconScale.value = withRepeat(
                withSequence(
                    withTiming(1.2, { duration: 300 }),
                    withTiming(1, { duration: 300 }),
                ),
                3,
                false,
            );

            const timer = setTimeout(() => setShowBanner(false), 4000);
            return () => clearTimeout(timer);
        }

        setLastZoneId(zone.id);
    }, [elapsedHours]);

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: iconScale.value }],
    }));

    if (!showBanner || !currentZone) return null;

    return (
        <Animated.View
            entering={FadeInDown.duration(300).springify()}
            exiting={FadeOutUp.duration(250)}
            style={[styles.banner, { borderColor: currentZone.color }]}
        >
            <Animated.View style={animatedIconStyle}>
                <Ionicons name={currentZone.icon as any} size={22} color={currentZone.color} />
            </Animated.View>
            <Text style={styles.text}>
                You've entered <Text style={[styles.zoneName, { color: currentZone.color }]}>{currentZone.name}</Text>
            </Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: 12,
        borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    text: {
        fontSize: 15,
        color: colors.textPrimary,
        fontWeight: '500',
    },
    zoneName: {
        fontWeight: '800',
    },
});
