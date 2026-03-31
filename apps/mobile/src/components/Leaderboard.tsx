import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

    if (isLoading && leaders.length === 0) return null;
    if (leaders.length === 0) return null;

    const userRank = leaders.findIndex(l => l.isUser) + 1;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Leaderboard</Text>
                    <Text style={styles.subtitle}>Top Bio-Optimizers</Text>
                </View>
                {userRank > 0 && (
                    <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>#{userRank}</Text>
                    </View>
                )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
                {leaders.map((user, index) => (
                    <Animated.View key={user.id} entering={FadeInDown.delay(index * 80)}>
                        <GlassView
                            variant={user.isUser ? 'primary' : 'light'}
                            borderRadius={borderRadius.xl}
                            style={styles.card}
                        >
                            {/* Rank number */}
                            <Text style={styles.rankNumber}>#{index + 1}</Text>

                            {/* Avatar */}
                            <View style={[styles.avatar, user.isUser && styles.userAvatar]}>
                                <Text style={[styles.avatarText, user.isUser && styles.userAvatarText]}>
                                    {user.isUser ? 'YOU' : user.avatar}
                                </Text>
                            </View>

                            {/* Name */}
                            <Text style={[styles.name, user.isUser && styles.userName]} numberOfLines={1}>
                                {user.isUser ? 'You' : user.name}
                            </Text>

                            {/* Score */}
                            <Text style={[styles.score, user.isUser && styles.userScore]}>{user.score}</Text>

                            {/* Trend */}
                            <View style={styles.trendBadge}>
                                <Ionicons
                                    name={user.trend.startsWith('-') ? "caret-down" : "caret-up"}
                                    size={10}
                                    color={user.trend.startsWith('-') ? colors.error : '#22D3EE'}
                                />
                                <Text style={[styles.trendText, user.trend.startsWith('-') && { color: colors.error }]}>
                                    {user.trend}
                                </Text>
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
        marginBottom: spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    subtitle: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    rankBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        backgroundColor: 'rgba(13, 148, 136, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(13, 148, 136, 0.3)',
    },
    rankText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#22D3EE',
    },
    list: {
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
    },
    card: {
        width: 110,
        height: 150,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.sm,
        gap: 4,
    },
    rankNumber: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.textSecondary,
        position: 'absolute',
        top: 8,
        left: 10,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    userAvatar: {
        backgroundColor: 'rgba(13, 148, 136, 0.25)',
        borderWidth: 1,
        borderColor: 'rgba(34, 211, 238, 0.4)',
    },
    avatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    userAvatarText: {
        fontSize: 10,
        color: '#22D3EE',
    },
    name: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        textAlign: 'center',
        maxWidth: 90,
    },
    userName: {
        color: '#FFFFFF',
    },
    score: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.primary,
    },
    userScore: {
        color: '#22D3EE',
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: 'rgba(34, 211, 238, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    trendText: {
        fontSize: 10,
        color: '#22D3EE',
        fontWeight: '700',
    },
});
