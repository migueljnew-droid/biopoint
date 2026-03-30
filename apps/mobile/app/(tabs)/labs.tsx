import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../src/components';

// Labs is gated as Coming Soon for v1 launch
export default function LabsScreen() {
    return (
        <ScreenWrapper>
            <View style={comingSoonStyles.container}>
                <View style={comingSoonStyles.iconWrap}>
                    <Ionicons name="flask" size={64} color={colors.primary} />
                </View>
                <Text style={comingSoonStyles.title}>AI Blood Work Analysis</Text>
                <Text style={comingSoonStyles.subtitle}>Coming Soon</Text>
                <Text style={comingSoonStyles.description}>
                    Upload your lab results and get AI-powered insights, biomarker tracking, and personalized recommendations from your blood work.
                </Text>
                <View style={comingSoonStyles.features}>
                    {['AI Biomarker Analysis', 'Trend Tracking Over Time', 'Personalized Recommendations', 'Practitioner Reports'].map((f, i) => (
                        <View key={i} style={comingSoonStyles.featureRow}>
                            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                            <Text style={comingSoonStyles.featureText}>{f}</Text>
                        </View>
                    ))}
                </View>
                <View style={comingSoonStyles.badge}>
                    <Ionicons name="notifications-outline" size={16} color={colors.primary} />
                    <Text style={comingSoonStyles.badgeText}>We'll notify you when it's ready</Text>
                </View>
            </View>
        </ScreenWrapper>
    );
}

const comingSoonStyles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    iconWrap: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(79, 70, 229, 0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
    title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs, textAlign: 'center' },
    subtitle: { fontSize: 18, fontWeight: '600', color: colors.primary, marginBottom: spacing.lg, letterSpacing: 1 },
    description: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
    features: { gap: spacing.md, width: '100%', marginBottom: spacing.xl },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    featureText: { ...typography.body, color: colors.textPrimary },
    badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.full, backgroundColor: 'rgba(79, 70, 229, 0.08)' },
    badgeText: { ...typography.bodySmall, color: colors.primary, fontWeight: '500' },
});
