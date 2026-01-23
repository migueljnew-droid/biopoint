import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { ScreenWrapper, GlassView } from '../../src/components';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyScreen() {
    return (
        <ScreenWrapper withGradient={true}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <GlassView variant="light" borderRadius={borderRadius.full} style={styles.iconButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </GlassView>
                </Pressable>
                <Text style={styles.title}>Privacy Policy</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.card}>
                    <Text style={styles.text}>
                        **HIPAA Notice of Privacy Practices**{'\n\n'}
                        effective Date: Jan 1, 2026{'\n\n'}
                        **THIS NOTICE DESCRIBES HOW MEDICAL INFORMATION ABOUT YOU MAY BE USED AND DISCLOSED AND HOW YOU CAN GET ACCESS TO THIS INFORMATION. PLEASE REVIEW IT CAREFULLY.**{'\n\n'}
                        1. **Our Duty to Safeguard Your Protected Health Information (PHI)**{'\n'}
                        We are required by the Health Insurance Portability and Accountability Act (HIPAA) to maintain the privacy of your PHI and provide you with this notice of our legal duties.{'\n\n'}
                        2. **How We Use Your Data**{'\n'}
                        - **Treatment**: We do not provide medical treatment but may share data with your providers at your explicit request.{'\n'}
                        - **Operations**: We use de-identified data for algorithmic improvement (BioPoint Score).{'\n'}
                        - **Security**: Your data is encrypted at rest using AES-256 standards and in transit via TLS 1.3.{'\n\n'}
                        3. **Your Rights**{'\n'}
                        - **Access**: You have the right to inspect and copy your medical records (export feature).{'\n'}
                        - **Accounting**: You have the right to request an audit log of disclosures.{'\n'}
                        - **Restriction**: You may request restrictions on certain uses of your PHI.{'\n\n'}
                        4. **Data Breach Notification**{'\n'}
                        In the unlikely event of a breach, we are required by law to notify you within 60 days.{'\n\n'}
                        **Contact Officer**: privacy@biopoint.app
                    </Text>
                </GlassView>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '600', color: colors.textPrimary },
    content: { padding: spacing.lg },
    card: { padding: spacing.lg },
    text: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
    backButton: {},
});
