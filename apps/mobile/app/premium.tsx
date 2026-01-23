import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { colors, spacing, typography, borderRadius } from '../src/theme';
import { ScreenWrapper, GlassView, AnimatedButton } from '../src/components';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSubscriptionStore } from '../src/store/subscriptionStore';

// const { width } = Dimensions.get('window');

const FeatureRow = ({ icon, title, desc, delay }: any) => (
    <Animated.View entering={FadeInDown.delay(delay)} style={styles.featureRow}>
        <View style={styles.featureIcon}>
            <Ionicons name={icon} size={24} color={colors.warning} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>{title}</Text>
            <Text style={styles.featureDesc}>{desc}</Text>
        </View>
    </Animated.View>
);

export default function PremiumScreen() {
    const { purchase, restorePurchases, isLoading } = useSubscriptionStore();
    const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');

    const handlePurchase = async () => {
        try {
            await purchase(selectedPlan);
            Alert.alert('Welcome to BioPoint+', 'You are now a premium member!');
            router.back();
        } catch (e) {
            Alert.alert('Error', 'Purchase failed. Please try again.');
        }
    };

    const handleRestore = async () => {
        try {
            await restorePurchases();
            Alert.alert('Restored', 'Your purchases have been restored.');
        } catch (e) {
            Alert.alert('Error', 'Failed to restore purchases.');
        }
    };

    return (
        <ScreenWrapper withGradient={true}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={handleRestore}>
                    <Text style={styles.restoreText}>Restore</Text>
                </Pressable>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                style={{ flex: 1 }}
            >
                <Animated.View entering={FadeInDown.springify()} style={styles.heroSection}>
                    <LinearGradient
                        colors={['rgba(234, 179, 8, 0.2)', 'transparent']}
                        style={styles.glow}
                    />
                    <View style={styles.crownContainer}>
                        <Ionicons name="star" size={48} color={colors.warning} />
                    </View>
                    <Text style={styles.title}>BioPoint<Text style={{ color: colors.warning }}>+</Text></Text>
                    <Text style={styles.subtitle}>Maximal Optimization Protocol</Text>
                </Animated.View>

                <View style={styles.featuresList}>
                    <FeatureRow
                        icon="pulse"
                        title="Advanced Bio-Analytics"
                        desc="Deep trend analysis on all your biomarkers over time."
                        delay={100}
                    />
                    <FeatureRow
                        icon="infinite"
                        title="Unlimited Stacks"
                        desc="Create and track as many supplement protocols as you need."
                        delay={200}
                    />
                    <FeatureRow
                        icon="analytics"
                        title="AI Lab Analysis"
                        desc="Instant interpretation of your complex bloodwork results."
                        delay={300}
                    />
                    <FeatureRow
                        icon="cloud-upload"
                        title="Cloud Backup"
                        desc="Securely sync your data across all your devices."
                        delay={400}
                    />
                </View>

                <Animated.View entering={FadeInDown.delay(500)} style={styles.plansContainer}>
                    <Pressable onPress={() => setSelectedPlan('monthly')}>
                        <GlassView
                            variant={selectedPlan === 'monthly' ? 'medium' : 'light'}
                            style={[
                                styles.planCard,
                                selectedPlan === 'monthly' && styles.selectedPlan
                            ]}
                            borderRadius={borderRadius.lg}
                        >
                            <View style={styles.radioButton}>
                                {selectedPlan === 'monthly' && <View style={styles.radioInner} />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.planName}>Monthly</Text>
                                <Text style={styles.planPrice}>$9.99<Text style={styles.perText}>/mo</Text></Text>
                            </View>
                        </GlassView>
                    </Pressable>

                    <Pressable onPress={() => setSelectedPlan('yearly')}>
                        <GlassView
                            variant={selectedPlan === 'yearly' ? 'medium' : 'light'}
                            style={[
                                styles.planCard,
                                selectedPlan === 'yearly' && styles.selectedPlan
                            ]}
                            borderRadius={borderRadius.lg}
                        >
                            <View style={styles.radioButton}>
                                {selectedPlan === 'yearly' && <View style={styles.radioInner} />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={styles.bestValueRow}>
                                    <Text style={styles.planName}>Yearly</Text>
                                    <View style={styles.bestValueBadge}>
                                        <Text style={styles.bestValueText}>BEST VALUE</Text>
                                    </View>
                                </View>
                                <Text style={styles.planPrice}>$83.99<Text style={styles.perText}>/yr</Text></Text>
                                <Text style={styles.savings}>Save 30%</Text>
                            </View>
                        </GlassView>
                    </Pressable>
                </Animated.View>

                <View style={{ height: 100 }} />
            </ScrollView>

            <View style={styles.footer}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.footerContent}>
                    <Text style={styles.disclaimer}>
                        Recurring billing. Cancel anytime.
                    </Text>
                    <AnimatedButton
                        title={isLoading ? "Processing..." : `Start ${selectedPlan === 'yearly' ? '7-Day Free Trial' : 'Subscription'} `}
                        onPress={handlePurchase}
                        variant="accent" // Yellow/Gold typically
                        disabled={isLoading}
                        style={styles.subscribeButton}
                    />
                </View>
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
    },
    closeButton: {
        padding: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.light,
    },
    restoreText: {
        ...typography.label,
        color: colors.textSecondary,
    },
    content: {
        padding: spacing.lg,
    },
    heroSection: {
        alignItems: 'center',
        marginVertical: spacing.xl,
        position: 'relative',
    },
    glow: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        top: -100,
        opacity: 0.5,
    },
    crownContainer: {
        marginBottom: spacing.md,
        shadowColor: colors.warning,
        shadowOpacity: 0.5,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 0 },
    },
    title: {
        fontSize: 36,
        fontWeight: '800',
        color: colors.textPrimary,
        letterSpacing: -1,
        marginBottom: spacing.xs,
    },
    subtitle: {
        ...typography.h4,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    featuresList: {
        gap: spacing.lg,
        marginBottom: spacing.xl,
    },
    featureRow: {
        flexDirection: 'row',
        gap: spacing.md,
        alignItems: 'flex-start',
    },
    featureIcon: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.lg,
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    featureTitle: {
        ...typography.h4,
        color: colors.textPrimary,
        marginBottom: 2,
    },
    featureDesc: {
        ...typography.body,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    plansContainer: {
        gap: spacing.md,
    },
    planCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        gap: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    selectedPlan: {
        borderColor: colors.warning,
        backgroundColor: 'rgba(234, 179, 8, 0.05)',
    },
    radioButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.textSecondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.warning,
    },
    planName: {
        ...typography.h3,
        color: colors.textPrimary,
    },
    planPrice: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.textPrimary,
        marginTop: 4,
    },
    perText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '400',
    },
    bestValueRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    bestValueBadge: {
        backgroundColor: colors.warning,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    bestValueText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#000',
    },
    savings: {
        ...typography.caption,
        color: colors.warning,
        marginTop: 2,
        fontWeight: '600',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    footerContent: {
        padding: spacing.lg,
    },
    disclaimer: {
        ...typography.caption,
        color: colors.textMuted,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    subscribeButton: {
        // Override style if needed
        backgroundColor: colors.warning,
    },
});
