import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { ScreenWrapper, GlassView } from '../../src/components';
import { Ionicons } from '@expo/vector-icons';

export default function HelpScreen() {
    return (
        <ScreenWrapper withGradient={true}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <GlassView variant="light" borderRadius={borderRadius.full} style={styles.iconButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </GlassView>
                </Pressable>
                <Text style={styles.title}>Help Center</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.card}>
                    <Text style={styles.heading}>Common Questions</Text>

                    <View style={styles.item}>
                        <Text style={styles.question}>How is my score calculated?</Text>
                        <Text style={styles.answer}>Biopoint aggregates your sleep, activity, and nutrition data to form a daily score out of 100.</Text>
                    </View>

                    <View style={styles.item}>
                        <Text style={styles.question}>How do I add a new Stack?</Text>
                        <Text style={styles.answer}>Go to the Stacks tab and press the (+) button in the top right.</Text>
                    </View>

                    <View style={styles.item}>
                        <Text style={styles.question}>Is my health data private?</Text>
                        <Text style={styles.answer}>Yes. All biometrics are encrypted and stored locally when possible. We never sell your data.</Text>
                    </View>
                </GlassView>

                <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.card}>
                    <Text style={styles.heading}>Contact Support</Text>
                    <Text style={styles.answer}>Need more help? Email us at support@biopoint.app</Text>
                </GlassView>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '600', color: colors.textPrimary },
    content: { padding: spacing.lg, gap: spacing.lg },
    card: { padding: spacing.lg },
    heading: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },
    item: { marginBottom: spacing.lg },
    question: { ...typography.body, fontWeight: '600', color: colors.accent, marginBottom: 4 },
    answer: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
    backButton: {},
});
