import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../../src/theme';
import { ScreenWrapper, GlassView, BadgeChip } from '../../../src/components/ui';
import { api } from '../../../src/services/api';
import { BADGE_DEFINITIONS } from '@biopoint/shared';
import type { PublicProfileResponse } from '@biopoint/shared';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function PublicProfileScreen() {
    const { userId } = useLocalSearchParams<{ userId: string }>();
    const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        api.get(`/community/profile/${userId}`).then(res => {
            setProfile(res.data);
        }).catch(() => {}).finally(() => setLoading(false));
    }, [userId]);

    if (loading) {
        return (
            <ScreenWrapper withGradient>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    if (!profile) {
        return (
            <ScreenWrapper withGradient>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                    </Pressable>
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ ...typography.body, color: colors.textMuted }}>Profile not found</Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper withGradient>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.headerTitle}>
                    {profile.username ? `@${profile.username}` : 'Profile'}
                </Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Avatar + Name */}
                <Animated.View entering={FadeInDown.duration(400)} style={styles.profileTop}>
                    {profile.avatarUrl ? (
                        <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarInitial}>
                                {(profile.displayName || profile.username || '?').charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <Text style={styles.displayName}>{profile.displayName || profile.username || 'Biohacker'}</Text>
                    {profile.username && <Text style={styles.username}>@{profile.username}</Text>}
                    {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

                    {/* Streak */}
                    {profile.currentStreak > 0 && (
                        <View style={styles.streakBadge}>
                            <Ionicons name="flame" size={16} color={colors.warning} />
                            <Text style={styles.streakText}>{profile.currentStreak} day streak</Text>
                        </View>
                    )}
                </Animated.View>

                {/* Stats */}
                <Animated.View entering={FadeInDown.delay(100)} style={styles.statsRow}>
                    <GlassView variant="light" borderRadius={borderRadius.lg} style={styles.statCard}>
                        <Text style={styles.statValue}>{profile.stats.daysLogged}</Text>
                        <Text style={styles.statLabel}>Days Logged</Text>
                    </GlassView>
                    <GlassView variant="light" borderRadius={borderRadius.lg} style={styles.statCard}>
                        <Text style={styles.statValue}>{profile.stats.stacksActive}</Text>
                        <Text style={styles.statLabel}>Active Stacks</Text>
                    </GlassView>
                    <GlassView variant="light" borderRadius={borderRadius.lg} style={styles.statCard}>
                        <Text style={styles.statValue}>{profile.stats.labsUploaded}</Text>
                        <Text style={styles.statLabel}>Labs</Text>
                    </GlassView>
                </Animated.View>

                {/* Badges */}
                <Animated.View entering={FadeInDown.delay(200)} style={styles.badgesSection}>
                    <Text style={styles.sectionTitle}>Badges</Text>
                    <View style={styles.badgesGrid}>
                        {BADGE_DEFINITIONS.map(b => (
                            <BadgeChip key={b.id} badgeId={b.id} earned={profile.badges.includes(b.id as any)} />
                        ))}
                    </View>
                </Animated.View>

                <View style={{ height: 60 }} />
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, marginBottom: spacing.md },
    backButton: { width: 44, height: 44, borderRadius: borderRadius.full, backgroundColor: colors.glass.light, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...typography.h3, color: colors.textPrimary },
    content: { flex: 1, paddingHorizontal: spacing.lg },
    profileTop: { alignItems: 'center', marginBottom: spacing.xl },
    avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: spacing.md },
    avatarPlaceholder: { backgroundColor: 'rgba(99, 102, 241, 0.2)', alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { fontSize: 36, fontWeight: '700', color: colors.primary },
    displayName: { ...typography.h2, color: colors.textPrimary },
    username: { ...typography.body, color: colors.textMuted, marginTop: 2 },
    bio: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, maxWidth: 280 },
    streakBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, backgroundColor: 'rgba(234, 179, 8, 0.1)', borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.2)' },
    streakText: { ...typography.label, color: colors.warning, fontSize: 13 },
    statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
    statCard: { flex: 1, padding: spacing.md, alignItems: 'center' },
    statValue: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
    statLabel: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
    badgesSection: { marginBottom: spacing.xl },
    sectionTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },
    badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
