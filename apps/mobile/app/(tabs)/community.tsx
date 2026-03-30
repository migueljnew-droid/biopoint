import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, RefreshControl, Alert } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { api } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScreenWrapper, GlassView, CreateGroupModal, Leaderboard } from '../../src/components';
import Animated, { LinearTransition, FadeInDown } from 'react-native-reanimated';

interface Group { id: string; name: string; description: string | null; memberCount: number; isMember: boolean }
interface Template { id: string; name: string; description: string | null; goal: string | null; forkCount: number; items: { name: string; dose: number; unit: string }[] }

export default function CommunityScreen() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [tab, setTab] = useState<'groups' | 'templates'>('groups');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [groupsRes, templatesRes] = await Promise.all([api.get('/community/groups'), api.get('/community/templates')]);
            setGroups(groupsRes.data);
            setTemplates(templatesRes.data);
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to fetch data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleJoinGroup = async (groupId: string) => {
        try {
            await api.post(`/community/groups/${groupId}/join`);
            fetchData();
            Alert.alert('Joined', 'You have joined the group');
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to join group');
        }
    };

    const handleForkTemplate = async (templateId: string, name: string) => {
        try {
            await api.post(`/community/templates/${templateId}/fork`);
            Alert.alert('Forked', `${name} has been added to your stacks`);
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to fork template');
        }
    };

    const [createModalVisible, setCreateModalVisible] = useState(false);

    const handleCreateGroup = async (name: string, description: string) => {
        try {
            await api.post('/community/groups', { name, description });
            Alert.alert('Success', 'Group created successfully');
            fetchData();
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to create group');
        }
    };

    return (
        <ScreenWrapper withGradient={true}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Community</Text>
                {tab === 'groups' && (
                    <Pressable style={styles.createButton} onPress={() => setCreateModalVisible(true)}>
                        <Ionicons name="add" size={20} color={colors.textPrimary} />
                        <Text style={styles.createButtonText}>Create</Text>
                    </Pressable>
                )}
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <Pressable onPress={() => setTab('groups')} style={{ flex: 1 }}>
                    <GlassView style={styles.tab} variant={tab === 'groups' ? 'selected' : 'light'} intensity={20} borderRadius={borderRadius.md}>
                        <Text style={[styles.tabText, tab === 'groups' && styles.tabTextActive]}>Groups</Text>
                    </GlassView>
                </Pressable>
                <Pressable onPress={() => setTab('templates')} style={{ flex: 1 }}>
                    <GlassView style={styles.tab} variant={tab === 'templates' ? 'selected' : 'light'} intensity={20} borderRadius={borderRadius.md}>
                        <Text style={[styles.tabText, tab === 'templates' && styles.tabTextActive]}>Templates</Text>
                    </GlassView>
                </Pressable>
            </View>

            <Animated.ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchData} tintColor={colors.primary} />}
                showsVerticalScrollIndicator={false}
                layout={LinearTransition}
            >
                {/* Global Leaderboard - Only on Groups tab for now */}
                {tab === 'groups' && (
                    <Animated.View entering={FadeInDown.duration(600)}>
                        <Leaderboard />
                    </Animated.View>
                )}

                {tab === 'groups' && (
                    <>
                        {groups.length === 0 && !isLoading && (
                            <View style={styles.emptyState}>
                                <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                                <Text style={styles.emptyText}>No groups available</Text>
                            </View>
                        )}
                        {groups.map((group, index) => (
                            <Animated.View key={group.id} entering={FadeInDown.delay(index * 100)} layout={LinearTransition}>
                                <Pressable onPress={() => router.push({ pathname: '/community/group', params: { id: group.id, name: group.name } })}>
                                <GlassView style={styles.groupCard} variant="medium" borderRadius={borderRadius.lg}>
                                    <View style={styles.groupIcon}>
                                        <Ionicons name="people" size={24} color={colors.primary} />
                                    </View>
                                    <View style={styles.groupInfo}>
                                        <Text style={styles.groupName}>{group.name}</Text>
                                        {group.description && <Text style={styles.groupDesc}>{group.description}</Text>}
                                        <Text style={styles.memberCount}>{group.memberCount} members</Text>
                                    </View>
                                    {group.isMember ? (
                                        <View style={styles.memberBadge}><Text style={styles.memberBadgeText}>Joined</Text></View>
                                    ) : (
                                        <Pressable style={styles.joinButton} onPress={() => handleJoinGroup(group.id)}>
                                            <Text style={styles.joinButtonText}>Join</Text>
                                        </Pressable>
                                    )}
                                </GlassView>
                                </Pressable>
                            </Animated.View>
                        ))}
                    </>
                )}

                {tab === 'templates' && (
                    <>
                        {templates.length === 0 && !isLoading && (
                            <View style={styles.emptyState}>
                                <Ionicons name="copy-outline" size={48} color={colors.textMuted} />
                                <Text style={styles.emptyText}>No templates available</Text>
                            </View>
                        )}
                        {templates.map((template, index) => (
                            <Animated.View key={template.id} entering={FadeInDown.delay(index * 100).springify()} layout={LinearTransition}>
                                <GlassView style={styles.templateCard} variant="medium" borderRadius={borderRadius.lg}>
                                    <View style={styles.templateHeader}>
                                        <Text style={styles.templateName}>{template.name}</Text>
                                        <View style={styles.forkBadge}>
                                            <Ionicons name="git-branch" size={14} color={colors.accent} />
                                            <Text style={styles.forkCount}>{template.forkCount}</Text>
                                        </View>
                                    </View>
                                    {template.goal && <Text style={styles.templateGoal}>{template.goal}</Text>}
                                    {template.description && <Text style={styles.templateDesc}>{template.description}</Text>}

                                    <View style={styles.itemsPreview}>
                                        {template.items.slice(0, 3).map((item, i) => (
                                            <Text key={i} style={styles.itemPreview}>• {item.name} {item.dose}{item.unit}</Text>
                                        ))}
                                        {template.items.length > 3 && <Text style={styles.moreItems}>+{template.items.length - 3} more</Text>}
                                    </View>

                                    <Pressable style={styles.forkButton} onPress={() => handleForkTemplate(template.id, template.name)}>
                                        <Ionicons name="download-outline" size={18} color={colors.textPrimary} />
                                        <Text style={styles.forkButtonText}>Use This Stack</Text>
                                    </Pressable>
                                </GlassView>
                                </Pressable>
                            </Animated.View>
                        ))}
                    </>
                )}
            </Animated.ScrollView>

            <CreateGroupModal
                visible={createModalVisible}
                onClose={() => setCreateModalVisible(false)}
                onSubmit={handleCreateGroup}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    title: { ...typography.h2, color: colors.textPrimary },
    createButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, gap: 4 },
    createButtonText: { ...typography.button, color: colors.textPrimary, fontSize: 12 },
    tabs: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
    tab: { paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.md },
    tabActive: {},
    tabText: { ...typography.label, color: colors.textSecondary },
    tabTextActive: { color: colors.textPrimary },
    scrollView: { flex: 1, padding: spacing.lg, paddingTop: 0 },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
    emptyText: { ...typography.h4, color: colors.textSecondary, marginTop: spacing.md },
    groupCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.md, gap: spacing.md },
    groupIcon: { width: 48, height: 48, borderRadius: borderRadius.full, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center' },
    groupInfo: { flex: 1 },
    groupName: { ...typography.h4, color: colors.textPrimary },
    groupDesc: { ...typography.bodySmall, color: colors.textSecondary },
    memberCount: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
    memberBadge: { backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
    memberBadgeText: { ...typography.caption, color: colors.success },
    joinButton: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
    joinButtonText: { ...typography.label, color: colors.textPrimary },
    templateCard: { padding: spacing.md, marginBottom: spacing.md },
    templateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
    templateName: { ...typography.h4, color: colors.textPrimary },
    forkBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    forkCount: { ...typography.caption, color: colors.accent },
    templateGoal: { ...typography.bodySmall, color: colors.primary, marginBottom: spacing.xs },
    templateDesc: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },
    itemsPreview: { backgroundColor: colors.backgroundElevated, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.md },
    itemPreview: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
    moreItems: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
    forkButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.accent, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
    forkButtonText: { ...typography.label, color: colors.background },
});
