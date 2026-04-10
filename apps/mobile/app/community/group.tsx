import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, Alert, Image, ScrollView, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { api } from '../../src/services/api';
import { ScreenWrapper, GlassView } from '../../src/components';
import { POST_CATEGORIES } from '@biopoint/shared';

interface Post {
    id: string;
    userId: string;
    authorHandle: string;
    authorAvatar: string | null;
    content: string;
    category: string;
    mediaUrls: string[];
    linkUrl: string | null;
    stackTemplateId: string | null;
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
    const [activeCategory, setActiveCategory] = useState('general');
    const [attachedPhotos, setAttachedPhotos] = useState<{ uri: string; s3Key: string }[]>([]);
    const [attachedLink, setAttachedLink] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [postCategory, setPostCategory] = useState('general');
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        fetchGroup();
    }, []);

    useEffect(() => {
        fetchPosts();
    }, [activeCategory]);

    const fetchGroup = async () => {
        try {
            const res = await api.get(`/community/groups/${id}`);
            setGroup(res.data);
        } catch { }
    };

    const fetchPosts = async () => {
        setIsLoading(true);
        try {
            const url = activeCategory === 'general'
                ? `/community/groups/${id}/posts`
                : `/community/groups/${id}/posts?category=${activeCategory}`;
            const res = await api.get(url);
            setPosts(res.data);
        } catch { } finally {
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

    const handleAttachPhoto = async () => {
        if (attachedPhotos.length >= 4) {
            Alert.alert('Limit', 'Maximum 4 photos per post');
            return;
        }
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
        });
        if (result.canceled) return;

        try {
            const presign = await api.post('/community/avatar/presign', {
                filename: `post_${Date.now()}.jpg`,
                contentType: 'image/jpeg',
            });
            const { uploadUrl, s3Key } = presign.data;
            const response = await fetch(result.assets[0].uri);
            const blob = await response.blob();
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(blob.size) },
            });
            if (!uploadRes.ok) {
                const errText = await uploadRes.text().catch(() => '');
                throw new Error(`S3 upload failed: ${uploadRes.status} ${errText.slice(0, 100)}`);
            }
            setAttachedPhotos(prev => [...prev, { uri: result.assets[0].uri, s3Key }]);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e: any) {
            Alert.alert('Upload Error', e.message || 'Failed to upload photo');
        }
    };

    const handleAttach = () => {
        Alert.alert('Attach', 'What would you like to add?', [
            { text: 'Photo', onPress: handleAttachPhoto },
            { text: 'Link', onPress: () => setShowLinkInput(true) },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const handleSend = async () => {
        if (!message.trim() && attachedPhotos.length === 0) return;
        setIsSending(true);
        try {
            const body: any = {
                content: message.trim() || '(photo)',
                category: postCategory,
            };
            if (attachedPhotos.length > 0) {
                body.mediaJson = attachedPhotos.map(p => ({ s3Key: p.s3Key, type: 'photo' }));
            }
            if (attachedLink) {
                body.linkUrl = attachedLink;
            }
            await api.post(`/community/groups/${id}/posts`, body);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setMessage('');
            setAttachedPhotos([]);
            setAttachedLink('');
            setShowLinkInput(false);
            setPostCategory('general');
            fetchPosts();
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to send');
        } finally {
            setIsSending(false);
        }
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const diffMs = Date.now() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHrs = Math.floor(diffMins / 60);
        if (diffHrs < 24) return `${diffHrs}h ago`;
        return `${Math.floor(diffHrs / 24)}d ago`;
    };

    const renderPost = ({ item }: { item: Post }) => (
        <View style={styles.postRow}>
            <Pressable onPress={() => router.push({ pathname: '/community/profile/[userId]' as any, params: { userId: item.userId } })}>
                <View style={styles.postAvatar}>
                    <Text style={styles.postAvatarText}>{(item.authorHandle ?? '?').charAt(0).toUpperCase()}</Text>
                </View>
            </Pressable>
            <View style={styles.postContent}>
                <View style={styles.postMeta}>
                    <Pressable onPress={() => router.push({ pathname: '/community/profile/[userId]' as any, params: { userId: item.userId } })}>
                        <Text style={styles.postAuthor}>{item.authorHandle}</Text>
                    </Pressable>
                    <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
                    {item.category !== 'general' && (
                        <View style={styles.categoryTag}>
                            <Text style={styles.categoryTagText}>
                                {POST_CATEGORIES.find(c => c.key === item.category)?.label || item.category}
                            </Text>
                        </View>
                    )}
                </View>
                <Text style={styles.postText}>{item.content}</Text>

                {/* Media photos */}
                {(item.mediaUrls ?? []).length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRow}>
                        {item.mediaUrls.map((url, i) => (
                            <Image key={i} source={{ uri: url }} style={styles.mediaImage} />
                        ))}
                    </ScrollView>
                )}

                {/* Link preview */}
                {item.linkUrl && (
                    <Pressable onPress={() => Linking.openURL(item.linkUrl!)} style={styles.linkCard}>
                        <Ionicons name="link" size={14} color={colors.accent} />
                        <Text style={styles.linkText} numberOfLines={1}>{item.linkUrl}</Text>
                    </Pressable>
                )}
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

                {/* Category Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBar} contentContainerStyle={styles.categoryBarContent}>
                    {POST_CATEGORIES.map((cat) => (
                        <Pressable
                            key={cat.key}
                            onPress={() => setActiveCategory(cat.key)}
                            style={[styles.categoryChip, activeCategory === cat.key && styles.categoryChipActive]}
                        >
                            <Ionicons name={cat.icon as any} size={14} color={activeCategory === cat.key ? colors.textPrimary : colors.textMuted} />
                            <Text style={[styles.categoryChipText, activeCategory === cat.key && styles.categoryChipTextActive]}>
                                {cat.label}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {/* Posts */}
                <FlatList
                    ref={flatListRef}
                    data={posts}
                    renderItem={renderPost}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.postsList}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        !isLoading ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
                                <Text style={styles.emptyText}>No posts yet</Text>
                                <Text style={styles.emptySubtext}>
                                    {isMember ? 'Be the first to share!' : 'Join this group to start posting'}
                                </Text>
                            </View>
                        ) : null
                    }
                />

                {/* Input or Join */}
                {isMember ? (
                    <View style={styles.inputArea}>
                        {/* Attached photos preview */}
                        {attachedPhotos.length > 0 && (
                            <ScrollView horizontal style={styles.attachPreview}>
                                {attachedPhotos.map((p, i) => (
                                    <View key={i} style={styles.attachThumb}>
                                        <Image source={{ uri: p.uri }} style={styles.attachImage} />
                                        <Pressable style={styles.attachRemove} onPress={() => setAttachedPhotos(prev => prev.filter((_, j) => j !== i))}>
                                            <Ionicons name="close-circle" size={18} color={colors.error} />
                                        </Pressable>
                                    </View>
                                ))}
                            </ScrollView>
                        )}

                        {/* Link input */}
                        {showLinkInput && (
                            <View style={styles.linkInputRow}>
                                <Ionicons name="link" size={16} color={colors.accent} />
                                <TextInput
                                    style={styles.linkInput}
                                    value={attachedLink}
                                    onChangeText={setAttachedLink}
                                    placeholder="https://..."
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="none"
                                    keyboardType="url"
                                />
                                <Pressable onPress={() => { setShowLinkInput(false); setAttachedLink(''); }}>
                                    <Ionicons name="close" size={18} color={colors.textMuted} />
                                </Pressable>
                            </View>
                        )}

                        {/* Category selector for post */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.postCategoryRow}>
                            {POST_CATEGORIES.filter(c => c.key !== 'general').map((cat) => (
                                <Pressable
                                    key={cat.key}
                                    onPress={() => setPostCategory(postCategory === cat.key ? 'general' : cat.key)}
                                    style={[styles.postCategoryChip, postCategory === cat.key && styles.postCategoryChipActive]}
                                >
                                    <Text style={[styles.postCategoryText, postCategory === cat.key && styles.postCategoryTextActive]}>
                                        {cat.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        <View style={styles.inputBar}>
                            <Pressable onPress={handleAttach} style={styles.attachBtn}>
                                <Ionicons name="add-circle-outline" size={24} color={colors.accent} />
                            </Pressable>
                            <TextInput
                                style={styles.input}
                                value={message}
                                onChangeText={setMessage}
                                placeholder="Share your protocol, labs, or ask a question..."
                                placeholderTextColor={colors.textMuted}
                                multiline
                                maxLength={5000}
                            />
                            <Pressable
                                onPress={handleSend}
                                disabled={isSending || (!message.trim() && attachedPhotos.length === 0)}
                                style={[styles.sendBtn, (!message.trim() && attachedPhotos.length === 0 || isSending) && { opacity: 0.4 }]}
                            >
                                <Ionicons name="send" size={20} color="#fff" />
                            </Pressable>
                        </View>
                    </View>
                ) : (
                    <View style={styles.joinBar}>
                        <Pressable style={styles.joinBtn} onPress={handleJoin}>
                            <Ionicons name="people" size={18} color="#fff" />
                            <Text style={styles.joinBtnText}>Join Group to Post</Text>
                        </Pressable>
                    </View>
                )}
            </KeyboardAvoidingView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
    headerInfo: { flex: 1 },
    headerTitle: { ...typography.h4, color: colors.textPrimary },
    headerSub: { ...typography.caption, color: colors.textMuted },
    categoryBar: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
    categoryBarContent: { paddingHorizontal: spacing.md, gap: spacing.xs, alignItems: 'center' },
    categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: 'rgba(255,255,255,0.04)' },
    categoryChipActive: { backgroundColor: colors.primary },
    categoryChipText: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
    categoryChipTextActive: { color: colors.textPrimary },
    postsList: { padding: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
    postRow: { flexDirection: 'row', marginBottom: spacing.lg, gap: spacing.sm },
    postAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(99, 102, 241, 0.15)', alignItems: 'center', justifyContent: 'center' },
    postAvatarText: { fontSize: 14, fontWeight: '700', color: colors.primary },
    postContent: { flex: 1 },
    postMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2, flexWrap: 'wrap' },
    postAuthor: { ...typography.label, color: colors.textPrimary, fontSize: 13 },
    postTime: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
    postText: { ...typography.body, color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    categoryTag: { backgroundColor: 'rgba(13, 148, 136, 0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    categoryTagText: { fontSize: 9, fontWeight: '600', color: colors.accent },
    mediaRow: { marginTop: spacing.sm },
    mediaImage: { width: 180, height: 220, borderRadius: borderRadius.md, marginRight: spacing.sm, backgroundColor: colors.backgroundCard },
    linkCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, padding: spacing.sm, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: borderRadius.md },
    linkText: { ...typography.caption, color: colors.accent, flex: 1 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyText: { ...typography.h4, color: colors.textSecondary, marginTop: spacing.md },
    emptySubtext: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
    inputArea: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
    attachPreview: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    attachThumb: { position: 'relative', marginRight: spacing.sm },
    attachImage: { width: 60, height: 60, borderRadius: borderRadius.sm },
    attachRemove: { position: 'absolute', top: -6, right: -6 },
    linkInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    linkInput: { flex: 1, color: colors.textPrimary, fontSize: 13, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
    postCategoryRow: { maxHeight: 32, paddingHorizontal: spacing.md, paddingTop: spacing.xs },
    postCategoryChip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full, backgroundColor: 'rgba(255,255,255,0.04)', marginRight: 6 },
    postCategoryChipActive: { backgroundColor: 'rgba(13, 148, 136, 0.2)' },
    postCategoryText: { fontSize: 10, color: colors.textMuted },
    postCategoryTextActive: { color: colors.accent, fontWeight: '600' },
    inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.md, paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md, gap: spacing.sm },
    attachBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.textPrimary, fontSize: 15, maxHeight: 100 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    joinBar: { padding: spacing.md, paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md },
    joinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.lg },
    joinBtnText: { ...typography.label, color: '#fff', fontSize: 15 },
});
