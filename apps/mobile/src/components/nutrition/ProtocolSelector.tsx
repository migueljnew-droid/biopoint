import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../theme';
import { GlassView } from '../ui';

interface Protocol {
    id: string;
    slug: string;
    name: string;
    fastingHours: number;
    eatingHours: number;
    description: string | null;
}

interface ProtocolSelectorProps {
    protocols: Protocol[];
    selectedSlug: string | null;
    onSelect: (slug: string) => void;
}

function getProtocolIcon(slug: string): string {
    if (slug.includes('water')) return 'water-outline';
    if (slug.includes('circadian')) return 'sunny-outline';
    if (slug.includes('warrior')) return 'shield-outline';
    if (['36h', '5-2', 'alternate-day', 'eat-stop-eat'].some(s => slug.includes(s))) return 'moon-outline';
    return 'time-outline';
}

export function ProtocolSelector({ protocols, selectedSlug, onSelect }: ProtocolSelectorProps) {
    return (
        <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={protocols}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
                const isSelected = item.slug === selectedSlug;
                return (
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onSelect(item.slug);
                        }}
                        accessibilityRole="button"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <GlassView
                            variant="light"
                            borderRadius={borderRadius.xxl}
                            style={[
                                styles.card,
                                isSelected && styles.cardSelected,
                            ]}
                        >
                            <Ionicons
                                name={getProtocolIcon(item.slug) as any}
                                size={24}
                                color={isSelected ? '#22D3EE' : colors.textPrimary}
                            />
                            <Text style={[styles.name, isSelected && styles.nameSelected]} numberOfLines={1}>
                                {item.name}
                            </Text>
                            <Text style={styles.schedule}>
                                {item.fastingHours}h fast / {item.eatingHours}h eat
                            </Text>
                        </GlassView>
                    </Pressable>
                );
            }}
        />
    );
}

const styles = StyleSheet.create({
    list: {
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
    },
    card: {
        width: 120,
        height: 160,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    cardSelected: {
        borderColor: colors.primary,
        borderWidth: 2,  // keep selected state visible
    },
    name: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    nameSelected: {
        color: '#22D3EE',
    },
    schedule: {
        fontSize: 11,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});
