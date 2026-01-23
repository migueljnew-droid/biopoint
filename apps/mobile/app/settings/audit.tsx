import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { ScreenWrapper, GlassView } from '../../src/components';
import { Ionicons } from '@expo/vector-icons';
import { useAuditStore, AuditEvent } from '../../src/services/auditService';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function AuditLogScreen() {
    const { logs } = useAuditStore();

    const formatDate = (ts: number) => {
        return new Date(ts).toLocaleString();
    };

    return (
        <ScreenWrapper withGradient={true}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <GlassView variant="light" borderRadius={borderRadius.full} style={styles.iconButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </GlassView>
                </Pressable>
                <Text style={styles.title}>Access Logs</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.subtitle}>HIPAA Compliance Audit Trail 45 CFR § 164.312(b)</Text>

                {logs.length === 0 ? (
                    <Text style={styles.emptyText}>No events recorded.</Text>
                ) : (
                    logs.map((log: AuditEvent, index: number) => (
                        <Animated.View key={log.id} entering={FadeInDown.delay(index * 20)}>
                            <GlassView variant="light" borderRadius={borderRadius.md} style={styles.logItem}>
                                <View style={styles.logHeader}>
                                    <Text style={styles.action}>{log.action}</Text>
                                    <View style={[styles.badge, { backgroundColor: log.status === 'SUCCESS' ? colors.success : colors.error }]}>
                                        <Text style={styles.status}>{log.status}</Text>
                                    </View>
                                </View>
                                <Text style={styles.timestamp}>{formatDate(log.timestamp)}</Text>
                                {log.metadata && <Text style={styles.metadata}>{log.metadata}</Text>}
                            </GlassView>
                        </Animated.View>
                    ))
                )}
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '600', color: colors.textPrimary },
    content: { padding: spacing.lg },
    subtitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center', opacity: 0.7 },
    emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
    logItem: { padding: spacing.md, marginBottom: spacing.sm },
    logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    action: { ...typography.bodySmall, fontWeight: '700', color: colors.textPrimary },
    timestamp: { ...typography.label, color: colors.textMuted },
    metadata: { ...typography.label, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    status: { fontSize: 10, fontWeight: '700', color: '#fff' },
    backButton: {},
});
