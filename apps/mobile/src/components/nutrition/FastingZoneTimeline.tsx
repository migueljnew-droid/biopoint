import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, spacing, withAlpha } from '../../theme';
import { FASTING_ZONES, getZoneForHours } from '../../constants/fastingZones';

interface FastingZoneTimelineProps {
    elapsedHours: number;
    targetHours: number;
}

export function FastingZoneTimeline({ elapsedHours, targetHours }: FastingZoneTimelineProps) {
    const currentZone = getZoneForHours(elapsedHours);
    const relevantZones = FASTING_ZONES.filter(z => z.startHour < targetHours + 12);

    return (
        <View style={styles.container}>
            {relevantZones.map((zone, index) => {
                const isPast = elapsedHours >= zone.endHour;
                const isCurrent = zone.id === currentZone.id;
                const isReached = isPast || isCurrent;
                const isFuture = elapsedHours < zone.startHour;

                const zoneProgress = isCurrent
                    ? Math.min(1, (elapsedHours - zone.startHour) / (zone.endHour - zone.startHour))
                    : isPast ? 1 : 0;

                return (
                    <Animated.View
                        key={zone.id}
                        entering={isReached ? FadeIn.delay(index * 60) : undefined}
                        style={[
                            styles.zoneRow,
                            isReached && {
                                backgroundColor: withAlpha(zone.color, 0.1),
                                borderRadius: 12,
                                marginHorizontal: -4,
                                paddingHorizontal: 4,
                            },
                        ]}
                    >
                        {/* Connector line */}
                        {index < relevantZones.length - 1 && (
                            <View style={[
                                styles.connector,
                                {
                                    backgroundColor: isPast
                                        ? withAlpha(zone.glowColor, 0.5)
                                        : isCurrent
                                            ? withAlpha(zone.color, 0.3)
                                            : 'rgba(255,255,255,0.06)',
                                },
                            ]} />
                        )}

                        {/* Icon */}
                        <View style={[
                            styles.iconCircle,
                            isFuture && {
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                borderColor: 'rgba(255,255,255,0.1)',
                            },
                            isPast && {
                                backgroundColor: withAlpha(zone.color, 0.25),
                                borderColor: zone.glowColor,
                                shadowColor: zone.glowColor,
                                shadowOpacity: 0.6,
                                shadowRadius: 10,
                                shadowOffset: { width: 0, height: 0 },
                            },
                            isCurrent && {
                                backgroundColor: withAlpha(zone.color, 0.3),
                                borderColor: zone.glowColor,
                                borderWidth: 2,
                                shadowColor: zone.glowColor,
                                shadowOpacity: 0.7,
                                shadowRadius: 14,
                                shadowOffset: { width: 0, height: 0 },
                            },
                        ]}>
                            {isPast ? (
                                <Ionicons name="checkmark" size={14} color={zone.glowColor} />
                            ) : (
                                <Ionicons
                                    name={zone.icon as any}
                                    size={14}
                                    color={isCurrent ? zone.glowColor : colors.textDisabled}
                                />
                            )}
                        </View>

                        {/* Text */}
                        <View style={styles.zoneInfo}>
                            <View style={styles.zoneHeader}>
                                <Text style={[
                                    styles.zoneName,
                                    isPast && { color: zone.glowColor, fontWeight: '700' },
                                    isCurrent && { color: zone.glowColor, fontWeight: '800' },
                                    isFuture && { color: colors.textDisabled },
                                ]}>
                                    {zone.name}
                                </Text>
                                <Text style={[
                                    styles.zoneHour,
                                    isPast && { color: zone.glowColor, fontWeight: '600' },
                                    isCurrent && { color: zone.glowColor, fontWeight: '700' },
                                ]}>
                                    {zone.startHour}h
                                </Text>
                            </View>
                            <Text style={[
                                styles.zoneDesc,
                                isPast && { color: withAlpha(zone.glowColor, 0.6) },
                                isCurrent && { color: colors.textSecondary },
                                isFuture && { color: colors.textDisabled },
                            ]}>
                                {zone.description}
                            </Text>

                            {isCurrent && (
                                <View style={styles.progressContainer}>
                                    <View style={styles.progressTrack}>
                                        <View style={[
                                            styles.progressFill,
                                            {
                                                width: `${zoneProgress * 100}%`,
                                                backgroundColor: zone.glowColor,
                                                shadowColor: zone.glowColor,
                                                shadowOpacity: 0.8,
                                                shadowRadius: 6,
                                                shadowOffset: { width: 0, height: 0 },
                                            },
                                        ]} />
                                    </View>
                                    <Text style={[styles.progressText, { color: zone.glowColor }]}>
                                        {Math.round(zoneProgress * 100)}%
                                    </Text>
                                </View>
                            )}
                        </View>
                    </Animated.View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: spacing.sm,
        gap: 2,
    },
    zoneRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: spacing.sm,
        paddingLeft: spacing.xs,
    },
    connector: {
        position: 'absolute',
        left: spacing.xs + 13,
        top: 36,
        width: 2,
        height: 36,
        borderRadius: 1,
    },
    iconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    zoneInfo: {
        flex: 1,
    },
    zoneHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    zoneName: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    zoneHour: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.textMuted,
    },
    zoneDesc: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
        lineHeight: 16,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    progressTrack: {
        flex: 1,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    progressText: {
        fontSize: 11,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
});
