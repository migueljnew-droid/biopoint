import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { ScreenWrapper, GlassView } from '../../src/components';
import { Ionicons } from '@expo/vector-icons';

// ─────────────────────────────────────────────────────────────────────────────
// Helper components for formatted policy text
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
    return <Text style={styles.sectionHeader}>{children}</Text>;
}

function BulletItem({ label, children }: { label?: string; children: React.ReactNode }) {
    return (
        <Text style={styles.bulletItem}>
            {'• '}
            {label ? (
                <>
                    <Text style={styles.bold}>{label}</Text>
                    {children}
                </>
            ) : (
                children
            )}
        </Text>
    );
}

function BodyText({ children }: { children: React.ReactNode }) {
    return <Text style={styles.bodyText}>{children}</Text>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

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

                    {/* Title */}
                    <Text style={styles.policyTitle}>HIPAA Notice of Privacy Practices</Text>
                    <Text style={styles.effectiveDate}>Effective Date: February 19, 2026</Text>

                    {/* Notice callout */}
                    <View style={styles.noticeBox}>
                        <BodyText>
                            THIS NOTICE DESCRIBES HOW MEDICAL INFORMATION ABOUT YOU MAY BE USED AND DISCLOSED AND HOW YOU CAN GET ACCESS TO THIS INFORMATION. PLEASE REVIEW IT CAREFULLY.
                        </BodyText>
                    </View>

                    {/* Section 1 */}
                    <SectionHeader>1. Our Duty to Safeguard Your Protected Health Information (PHI)</SectionHeader>
                    <BodyText>
                        We are required by the Health Insurance Portability and Accountability Act (HIPAA) to maintain the privacy of your PHI and provide you with this notice of our legal duties and privacy practices.
                    </BodyText>

                    {/* Section 2 */}
                    <SectionHeader>2. How We Use Your Data</SectionHeader>
                    <BulletItem label="Treatment: ">
                        We do not provide medical treatment but may share data with your healthcare providers at your explicit request.
                    </BulletItem>
                    <BulletItem label="AI-Assisted Features: ">
                        When we use AI-assisted features (such as food photo analysis), we send only the minimum data needed and never include your personal identifiers.
                    </BulletItem>
                    <BulletItem label="Security: ">
                        Your data is encrypted at rest using AES-256-GCM standards and in transit via TLS 1.3.
                    </BulletItem>

                    {/* Section 3 */}
                    <SectionHeader>3. AI-Powered Features & Data Sharing</SectionHeader>
                    <BodyText>
                        BioPoint uses AI to power The Oracle (chat-based health insights) and Lab Analysis features. Here is exactly how your data is handled:
                    </BodyText>
                    <BulletItem label="The Oracle: ">
                        When you send a message to The Oracle, your chat message and relevant health context (biomarker values, supplement logs, fasting data) are sent to BioPoint's backend server. Our backend processes your request using Google Gemini AI. No personal identifiers (name, email, account ID) are included in AI requests.
                    </BulletItem>
                    <BulletItem label="Lab Analysis: ">
                        When you upload lab results, the document image is processed by our backend using AI to extract biomarker values. The original image is stored securely; only extracted data values are retained.
                    </BulletItem>
                    <BulletItem label="Food Photo Analysis: ">
                        Food images are sent to a third-party AI service solely to estimate nutritional content. No personal information or health data is included with the image.
                    </BulletItem>
                    <BulletItem label="Consent: ">
                        You are asked to review and consent to AI data processing before first using The Oracle. You may decline and still use all other features of BioPoint.
                    </BulletItem>

                    {/* Section 4 */}
                    <SectionHeader>4. Third-Party Service Providers (Business Associates)</SectionHeader>
                    <BodyText>
                        We share your health data only with vendors who have signed Business Associate Agreements (BAAs) as required by HIPAA. These vendors provide database hosting, file storage, and API infrastructure. Any vendor that does not have a BAA in place receives only de-identified data that cannot reasonably be used to identify you.
                    </BodyText>

                    {/* Section 5 */}
                    <SectionHeader>5. Your Rights</SectionHeader>
                    <BulletItem label="Access: ">
                        You have the right to inspect and copy your health records. Use the data export feature in your account settings.
                    </BulletItem>
                    <BulletItem label="Deletion: ">
                        You may request permanent deletion of your account and all associated health data from the account deletion option in settings.
                    </BulletItem>
                    <BulletItem label="Accounting: ">
                        You have the right to request an audit log of disclosures of your PHI.
                    </BulletItem>
                    <BulletItem label="Restriction: ">
                        You may request restrictions on certain uses of your PHI, though we are not always required to agree.
                    </BulletItem>
                    <BulletItem label="Amendment: ">
                        You may request correction of inaccurate health information in your records.
                    </BulletItem>

                    {/* Section 6 */}
                    <SectionHeader>6. Data Breach Notification</SectionHeader>
                    <BodyText>
                        In the unlikely event of a breach affecting your unsecured PHI, we are required by law (45 CFR 164.404) to notify you within 60 days of discovery.
                    </BodyText>

                    {/* Section 7 */}
                    <SectionHeader>7. Contact</SectionHeader>
                    <BodyText>
                        Questions about this notice or your privacy rights:{'\n'}
                        <Text style={styles.contactEmail}>privacy@biopoint.app</Text>
                    </BodyText>

                </GlassView>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '600', color: colors.textPrimary },
    content: { padding: spacing.lg },
    card: { padding: spacing.lg },
    backButton: {},

    policyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    effectiveDate: {
        ...typography.caption,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    noticeBox: {
        borderLeftWidth: 3,
        borderLeftColor: colors.textSecondary,
        paddingLeft: spacing.sm,
        marginBottom: spacing.md,
    },
    sectionHeader: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.textPrimary,
        marginTop: spacing.md,
        marginBottom: spacing.xs,
    },
    bodyText: {
        ...typography.body,
        color: colors.textSecondary,
        lineHeight: 22,
        marginBottom: spacing.xs,
    },
    bulletItem: {
        ...typography.body,
        color: colors.textSecondary,
        lineHeight: 22,
        marginBottom: spacing.xs,
        paddingLeft: spacing.xs,
    },
    bold: {
        fontWeight: '700',
        color: colors.textPrimary,
    },
    contactEmail: {
        color: colors.textPrimary,
        fontWeight: '600',
    },
});
