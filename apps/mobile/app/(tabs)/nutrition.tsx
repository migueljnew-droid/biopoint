import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, spacing, borderRadius } from '../../src/theme';
import { ScreenWrapper, GlassView } from '../../src/components';
import { FastingView } from '../../src/components/nutrition/FastingView';
import { FoodLogView } from '../../src/components/nutrition/FoodLogView';

type Tab = 'fasting' | 'food';

export default function NutritionScreen() {
    const [activeTab, setActiveTab] = useState<Tab>('fasting');

    const handleTabSwitch = (tab: Tab) => {
        if (tab === activeTab) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveTab(tab);
    };

    const indicatorStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: withTiming(activeTab === 'fasting' ? 0 : 1, { duration: 200 }) }],
    }));

    return (
        <ScreenWrapper withGradient>
            {/* Segmented Control */}
            <View style={styles.segmentContainer}>
                <GlassView variant="light" borderRadius={borderRadius.lg} style={styles.segmentControl}>
                    <Pressable
                        style={[styles.segmentTab, activeTab === 'fasting' && styles.segmentTabActive]}
                        onPress={() => handleTabSwitch('fasting')}
                        accessibilityRole="button"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name="timer-outline"
                            size={16}
                            color={activeTab === 'fasting' ? colors.primary : colors.textMuted}
                        />
                        <Text style={[styles.segmentText, activeTab === 'fasting' && styles.segmentTextActive]}>
                            Fasting
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.segmentTab, activeTab === 'food' && styles.segmentTabActive]}
                        onPress={() => handleTabSwitch('food')}
                        accessibilityRole="button"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name="restaurant-outline"
                            size={16}
                            color={activeTab === 'food' ? colors.primary : colors.textMuted}
                        />
                        <Text style={[styles.segmentText, activeTab === 'food' && styles.segmentTextActive]}>
                            Food Log
                        </Text>
                    </Pressable>
                </GlassView>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {activeTab === 'fasting' ? <FastingView /> : <FoodLogView />}
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    segmentContainer: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
    },
    segmentControl: {
        flexDirection: 'row',
        padding: 4,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    segmentTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: borderRadius.md,
        gap: 6,
    },
    segmentTabActive: {
        backgroundColor: 'rgba(27, 75, 122, 0.25)',
    },
    segmentText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    segmentTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    content: {
        flex: 1,
    },
});
