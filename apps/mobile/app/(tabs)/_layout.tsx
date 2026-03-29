import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Platform } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming, useSharedValue, withSequence } from 'react-native-reanimated';
import { useEffect } from 'react';
import { colors, borderRadius } from '../../src/theme';

function AnimatedTabIcon({ name, color, focused }: { name: keyof typeof Ionicons.glyphMap; color: string; focused: boolean }) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.5);

    useEffect(() => {
        if (focused) {
            scale.value = withSequence(
                withSpring(1.2, { damping: 10, stiffness: 300 }),
                withSpring(1, { damping: 12, stiffness: 300 })
            );
            opacity.value = withTiming(1, { duration: 200 });
        } else {
            scale.value = withSpring(1, { damping: 20, stiffness: 200 });
            opacity.value = withTiming(0.6, { duration: 200 }); // Slightly simpler for unfocused
        }
    }, [focused]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={[styles.iconContainer, focused && styles.activeIconContainer, animatedStyle]}>
            <Ionicons name={name} size={24} color={color} />
        </Animated.View>
    );
}

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarStyle: {
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'rgba(17, 17, 24, 0.85)',
                    borderTopWidth: 1,
                    borderTopColor: colors.glass.border,
                    paddingTop: 8,
                    height: Platform.OS === 'ios' ? 88 : 70,
                    ...Platform.select({
                        ios: {
                            shadowColor: colors.primary,
                            shadowOffset: { width: 0, height: -4 },
                            shadowOpacity: 0.1,
                            shadowRadius: 12,
                        },
                        android: {
                            elevation: 8,
                        },
                    }),
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '500',
                    marginBottom: Platform.OS === 'ios' ? 0 : 8,
                },
                tabBarIconStyle: {
                    marginTop: 4,
                },
                headerStyle: {
                    backgroundColor: colors.background,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.glass.border,
                    ...Platform.select({
                        ios: {
                            shadowColor: 'transparent',
                        },
                    }),
                },
                headerTitleStyle: {
                    color: colors.textPrimary,
                    fontWeight: '600',
                    fontSize: 17,
                },
                headerTintColor: colors.textPrimary,
                headerShadowVisible: false,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color, focused }) => (
                        <AnimatedTabIcon name={focused ? 'analytics' : 'analytics-outline'} color={color} focused={focused} />
                    ),
                    headerTitle: 'BioPoint',
                }}
            />
            <Tabs.Screen
                name="stacks"
                options={{
                    title: 'Stacks',
                    tabBarIcon: ({ color, focused }) => (
                        <AnimatedTabIcon name={focused ? 'layers' : 'layers-outline'} color={color} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="nutrition"
                options={{
                    title: 'Nutrition',
                    tabBarIcon: ({ color, focused }) => (
                        <AnimatedTabIcon name={focused ? 'restaurant' : 'restaurant-outline'} color={color} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="progress"
                options={{
                    title: 'Progress',
                    tabBarIcon: ({ color, focused }) => (
                        <AnimatedTabIcon name={focused ? 'images' : 'images-outline'} color={color} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="labs"
                options={{
                    title: 'Labs',
                    tabBarIcon: ({ color, focused }) => (
                        <AnimatedTabIcon name={focused ? 'flask' : 'flask-outline'} color={color} focused={focused} />
                    ),
                }}
            />

            <Tabs.Screen
                name="community"
                options={{
                    title: 'Community',
                    tabBarIcon: ({ color, focused }) => (
                        <AnimatedTabIcon name={focused ? 'people' : 'people-outline'} color={color} focused={focused} />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    activeIconContainer: {
        backgroundColor: colors.glassColored.primary,
        borderRadius: borderRadius.md,
        padding: 6,
        // marginBottom removed to prevent layout jump, handled by padding/layout in container
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.md,
        padding: 6,
    }
});
