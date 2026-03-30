import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { api } from '../../src/services/api';
import { ScreenWrapper } from '../../src/components';

interface Post {
    id: string;
    authorHandle: string;
    content: string;
    createdAt: string;
}

interface GroupInfo {
    id: string;
    name: string;
    description: string | null;
    memberCount: number;
    isMember: boolean;
}

export default function GroupDetailScreen() {
    const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        fetchGroup();
        fetchPosts();
    }, []);

    const fetchGroup = async () => {
        try {
            const res = await api.get(`/community/groups/${id}`);
            setGroup(res.data);
        } catch (e: any) {
            console.log('Failed to fetch group:', e.message);
        }
    };

    const fetchPosts = async () => {
        try {
            const res = await api.get(`/community/groups/${id}/posts`);
            setPosts(res.data);
        } catch (e: any) {
            console.log('Failed to fetch posts:', e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoin = async () => {
        try {
            await api.post(`/community/groups/${id}/join`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchGroup();
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to join');
        }
    };

    const handleSend = async () => {
        if (!message.trim()) return;
        setIsSending(true);
        try {
            await api.post(`/community/groups/${id}/posts`, { content: message.trim() });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setMessage('');
            fetchPosts();
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to send');
        } finally {
            setIsSending(false);
        }
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHrs = Math.floor(diffMins / 60);
        if (diffHrs < 24) return `${diffHrs}h ago`;
        const diffDays = Math.floor(diffHrs / 24);
        return `${diffDays}d ago`;
    };

    const renderPost = ({ item }: { item: Post }) => (
        <View style={styles.postRow}>
            <View style={styles.postAvatar}>
                <Text style={styles.postAvatarText}>{item.authorHandle.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.postContent}>
                <View style={styles.postMeta}>
                    <Text style={styles.postAuthor}>{item.authorHandle}</Text>
                    <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
                </View>
                <Text style={styles.postText}>{item.content}</Text>
            </View>
        </View>
    );

    const isMember = group?.isMember ?? false;

    return (
        <ScreenWrapper>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                    </Pressable>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{name || group?.name || 'Group'}</Text>
                        <Text style={styles.headerSub}>{group?.memberCount ?? 0} members</Text>
                    </View>
                </View>

                {/* Posts */}
                <FlatList
                    ref={flatListRef}
                    data={posts}
                    renderItem={renderPost}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.postsList}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    ListEmptyComponent={
                        !isLoading ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
                                <Text style={styles.emptyText}>No messages yet</Text>
                                <Text style={styles.emptySubtext}>
                                    {isMember ? 'Be the first to post!' : 'Join this group to start chatting'}
                                </Text>
                            </View>
                        ) : null
                    }
                />

                {/* Input or Join */}
                {isMember ? (
                    <View style={styles.inputBar}>
                        <TextInput
                            style={styles.input}
                            value={message}
                            onChangeText={setMessage}
                            placeholder="Type a message..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            maxLength={500}
                        />
                        <Pressable
                            onPress={handleSend}
                            disabled={isSending || !message.trim()}
                            style={[styles.sendBtn, (!message.trim() || isSending) && { opacity: 0.4 }]}
                        >
                            <Ionicons name="send" size={20} color="#fff" />
                        </Pressable>
                    </View>
                ) : (
                    <View style={styles.joinBar}>
                        <Pressable style={styles.joinBtn} onPress={handleJoin}>
                            <Ionicons name="people" size={18} color="#fff" />
                            <Text style={styles.joinBtnText}>Join Group to Chat</Text>
                        </Pressable>
                    </View>
                )}
            </KeyboardAvoidingView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerInfo: { flex: 1 },
    headerTitle: { ...typography.h4, color: colors.textPrimary },
    headerSub: { ...typography.caption, color: colors.textMuted },
    postsList: {
        padding: spacing.md,
        paddingBottom: spacing.xl,
        flexGrow: 1,
    },
    postRow: {
        flexDirection: 'row',
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    postAvatar: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        alignItems: 'center', justifyContent: 'center',
    },
    postAvatarText: { fontSize: 14, fontWeight: '700', color: colors.primary },
    postContent: { flex: 1 },
    postMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
    postAuthor: { ...typography.label, color: colors.textPrimary, fontSize: 13 },
    postTime: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
    postText: { ...typography.body, color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyText: { ...typography.h4, color: colors.textSecondary, marginTop: spacing.md },
    emptySubtext: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: spacing.md,
        paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
        gap: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    input: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        color: colors.textPrimary,
        fontSize: 15,
        maxHeight: 100,
    },
    sendBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    joinBar: {
        padding: spacing.md,
        paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    },
    joinBtn: {
        flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
    },
    joinBtnText: { ...typography.label, color: '#fff', fontSize: 15 },
});
