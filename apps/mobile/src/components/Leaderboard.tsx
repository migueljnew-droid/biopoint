import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography, borderRadius } from '../theme';
import { GlassView } from './ui/GlassView';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { communityService, LeaderboardEntry } from '../services/community';

export function Leaderboard() {
    const [leaders, setLeaders] = React.useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        loadLeaderboard();
    }, []);

    const loadLeaderboard = async () => {
        try {
            const data = await communityService.getLeaderboard();
            setLeaders(data);
        } catch (error) {
            console.log('Failed to load leaderboard', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading && leaders.length === 0) {
        // Return null or skeleton in real app, keeping simple for now
        return null;
    }

    const userRank = leaders.findIndex(l => l.isUser) + 1;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Global Elite</Text>
                    <Text style={styles.subtitle}>Top 1% Bio-Optimizers</Text>
                </View>
                {userRank > 0 && (
                    <GlassView variant="heavy" borderRadius={borderRadius.full} style={styles.rankBadge}>
                        <Text style={styles.rankText}>#{userRank}</Text>
                    </GlassView>
                )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
                {leaders.map((user, index) => (
                    <Animated.View
                        key={user.id}
                        entering={FadeInDown.delay(index * 100)}
                    >
                        <GlassView
                            variant={user.elite ? 'heavy' : 'light'}
                            borderRadius={borderRadius.lg}
                            style={[styles.card, user.isUser && styles.userCard]}
                        >
                            {user.elite && (
                                <LinearGradient
                                    colors={['rgba(255, 215, 0, 0.2)', 'transparent']}
                                    style={StyleSheet.absoluteFill}
                                />
                            )}

                            <View style={[styles.avatar, user.elite && styles.goldAvatar]}>
                                <Text style={[styles.avatarText, user.elite && styles.goldText]}>
                                    {user.avatar}
                                </Text>
                                {user.elite && (
                                    <View style={styles.crown}>
                                        <Ionicons name="trophy" size={12} color="#FFD700" />
                                    </View>
                                )}
                            </View>

                            <Text style={styles.name}>{user.name}</Text>

                            <View style={styles.scoreRow}>
                                <Text style={styles.score}>{user.score}</Text>
                                <Text style={styles.label}>BIO</Text>
                            </View>

                            <View style={styles.trendBadge}>
                                <Ionicons name={user.trend.startsWith('-') ? "caret-down" : "caret-up"} size={10} color={user.trend.startsWith('-') ? colors.error : colors.success} />
                                <Text style={[styles.trendText, user.trend.startsWith('-') && { color: colors.error }]}>{user.trend}</Text>
                            </View>
                        </GlassView>
                    </Animated.View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    title: {
        ...typography.h4,
        color: colors.textPrimary,
    },
    subtitle: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    rankBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        backgroundColor: colors.primary,
    },
    rankText: {
        ...typography.h4,
        color: '#fff',
    },
    list: {
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
    },
    card: {
        width: 100,
        height: 140,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.sm,
        gap: spacing.xs,
    },
    userCard: {
        borderColor: 'transparent',
        borderWidth: 0,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    goldAvatar: {
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        borderWidth: 0,
        borderColor: 'transparent',
    },
    avatarText: {
        ...typography.h4,
        color: colors.textSecondary,
    },
    goldText: {
        color: '#FFD700',
    },
    crown: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: colors.background,
        borderRadius: 8,
        padding: 2,
    },
    name: {
        ...typography.bodySmall,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 2,
    },
    score: {
        ...typography.h3,
        color: colors.primary,
    },
    label: {
        fontSize: 8,
        color: colors.textMuted,
        fontWeight: '700',
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
    },
    trendText: {
        fontSize: 10,
        color: colors.success,
        fontWeight: '700',
    }
});
