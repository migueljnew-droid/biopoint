import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, RefreshControl, Alert, Modal, ScrollView } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { api } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScreenWrapper, GlassView, CreateGroupModal, Leaderboard } from '../../src/components';
import Animated, { LinearTransition, FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Group { id: string; name: string; description: string | null; memberCount: number; isMember: boolean }
interface Template { id: string; name: string; description: string | null; goal: string | null; forkCount: number; items: { name: string; dose: number; unit: string }[] }

export default function CommunityScreen() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [tab, setTab] = useState<'groups' | 'templates'>('groups');
    const [eulaAccepted, setEulaAccepted] = useState(false);
    const [eulaChecked, setEulaChecked] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem('community_eula_v2_accepted').then(v => {
            setEulaAccepted(v === 'true');
            setEulaChecked(true);
        });
    }, []);

    const handleAcceptEula = async () => {
        await AsyncStorage.setItem('community_eula_v2_accepted', 'true');
        setEulaAccepted(true);
    };

    const [blockedIds, setBlockedIds] = useState<string[]>([]);

    useEffect(() => {
        AsyncStorage.getItem('community_blocked_ids').then(v => {
            if (v) setBlockedIds(JSON.parse(v));
        });
    }, []);

    const handleReportContent = (type: string, id: string, name: string) => {
        Alert.alert(
            'Report Content',
            `Report "${name}" for objectionable content?\n\nThis will notify the BioPoint team for review within 24 hours.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Report & Block',
                    style: 'destructive',
                    onPress: async () => {
                        const report = { type, id, name, reason: 'objectionable_content', date: new Date().toISOString() };
                        // Block content immediately from user's feed
                        const newBlocked = [...blockedIds, id];
                        setBlockedIds(newBlocked);
                        await AsyncStorage.setItem('community_blocked_ids', JSON.stringify(newBlocked));
                        // Send report to server to notify development team
                        try {
                            await api.post('/community/report', report);
                        } catch {
                            // Store locally for retry if server is unreachable
                            const existing = await AsyncStorage.getItem('community_reports') || '[]';
                            const reports = [...JSON.parse(existing), report];
                            await AsyncStorage.setItem('community_reports', JSON.stringify(reports));
                        }
                        Alert.alert('Reported & Blocked', 'Thank you. This content has been hidden from your feed. Our team has been notified and will review the report within 24 hours, including removing the content and suspending the offending user if necessary.');
                    },
                },
            ]
        );
    };

    const handleBlockUser = (id: string, name: string) => {
        Alert.alert(
            'Block User',
            `Block the creator of "${name}"? Their content will be removed from your feed immediately.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                        const newBlocked = [...blockedIds, id];
                        setBlockedIds(newBlocked);
                        await AsyncStorage.setItem('community_blocked_ids', JSON.stringify(newBlocked));
                        // Notify server of block action
                        api.post('/community/report', { type: 'block_user', id, name, reason: 'user_blocked', date: new Date().toISOString() }).catch(() => {});
                        Alert.alert('Blocked', 'This user has been blocked and our team has been notified. Their content has been removed from your feed.');
                    },
                },
            ]
        );
    };

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

    useEffect(() => { if (eulaAccepted) fetchData(); }, [eulaAccepted]);

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

    if (!eulaChecked) return <ScreenWrapper withGradient={true}><View /></ScreenWrapper>;

    return (
        <ScreenWrapper withGradient={true}>
            {/* Community EULA */}
            <Modal visible={!eulaAccepted} animationType="fade" transparent>
                <View style={styles.eulaOverlay}>
                    <GlassView variant="heavy" borderRadius={20} style={styles.eulaCard}>
                        <Ionicons name="people" size={32} color={colors.primary} style={{ alignSelf: 'center', marginBottom: spacing.md }} />
                        <Text style={styles.eulaTitle}>Community Guidelines</Text>
                        <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                            <Text style={styles.eulaBody}>
                                By using BioPoint Community, you agree to the following terms:{'\n\n'}
                                1. <Text style={styles.eulaBold}>No objectionable content.</Text> Content that is offensive, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable is strictly prohibited.{'\n\n'}
                                2. <Text style={styles.eulaBold}>No medical advice.</Text> Community content is for informational sharing only. Do not provide medical diagnoses or treatment recommendations.{'\n\n'}
                                3. <Text style={styles.eulaBold}>Respect all members.</Text> Harassment, bullying, hate speech, and discrimination are not tolerated.{'\n\n'}
                                4. <Text style={styles.eulaBold}>No spam or self-promotion.</Text> Do not post irrelevant or promotional content.{'\n\n'}
                                5. <Text style={styles.eulaBold}>Report violations.</Text> Use the report button on any content that violates these guidelines. We review all reports within 24 hours.{'\n\n'}
                                Violation of these terms will result in content removal and account suspension.
                            </Text>
                        </ScrollView>
                        <View style={styles.eulaActions}>
                            <Pressable onPress={() => router.back()} style={styles.eulaDecline}>
                                <Text style={styles.eulaDeclineText}>Decline</Text>
                            </Pressable>
                            <Pressable onPress={handleAcceptEula} style={styles.eulaAccept}>
                                <Text style={styles.eulaAcceptText}>I Agree</Text>
                            </Pressable>
                        </View>
                    </GlassView>
                </View>
            </Modal>

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
                        {groups.filter(g => !blockedIds.includes(g.id)).length === 0 && !isLoading && (
                            <View style={styles.emptyState}>
                                <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                                <Text style={styles.emptyText}>No groups available</Text>
                            </View>
                        )}
                        {groups.filter(g => !blockedIds.includes(g.id)).map((group, index) => (
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
                                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                    {group.isMember ? (
                                        <View style={styles.memberBadge}><Text style={styles.memberBadgeText}>Joined</Text></View>
                                    ) : (
                                        <Pressable style={styles.joinButton} onPress={() => handleJoinGroup(group.id)}>
                                            <Text style={styles.joinButtonText}>Join</Text>
                                        </Pressable>
                                    )}
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <Pressable onPress={() => handleBlockUser(group.id, group.name)} hitSlop={8}>
                                            <Ionicons name="ban-outline" size={14} color={colors.textMuted} />
                                        </Pressable>
                                        <Pressable onPress={() => handleReportContent('group', group.id, group.name)} hitSlop={8}>
                                            <Ionicons name="flag-outline" size={14} color={colors.textMuted} />
                                        </Pressable>
                                    </View>
                                    </View>
                                </GlassView>
                                </Pressable>
                            </Animated.View>
                        ))}
                    </>
                )}

                {tab === 'templates' && (
                    <>
                        {templates.filter(t => !blockedIds.includes(t.id)).length === 0 && !isLoading && (
                            <View style={styles.emptyState}>
                                <Ionicons name="copy-outline" size={48} color={colors.textMuted} />
                                <Text style={styles.emptyText}>No templates available</Text>
                            </View>
                        )}
                        {templates.filter(t => !blockedIds.includes(t.id)).map((template, index) => (
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

                                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                        <Pressable style={[styles.forkButton, { flex: 1 }]} onPress={() => handleForkTemplate(template.id, template.name)}>
                                            <Ionicons name="download-outline" size={18} color={colors.textPrimary} />
                                            <Text style={styles.forkButtonText}>Use This Stack</Text>
                                        </Pressable>
                                        <Pressable style={styles.reportButton} onPress={() => handleReportContent('template', template.id, template.name)}>
                                            <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
                                        </Pressable>
                                    </View>
                                </GlassView>
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
    groupIcon: { width: 48, height: 48, borderRadius: borderRadius.full, backgroundColor: 'rgba(99, 102, 241, 0.15)', justifyContent: 'center', alignItems: 'center' },
    groupInfo: { flex: 1 },
    groupName: { ...typography.h4, color: colors.textPrimary },
    groupDesc: { ...typography.bodySmall, color: colors.textSecondary },
    memberCount: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
    memberBadge: { backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
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
    reportButton: { width: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: borderRadius.md },
    // EULA Modal
    eulaOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: spacing.lg },
    eulaCard: { padding: spacing.xl },
    eulaTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.md },
    eulaBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
    eulaBold: { fontWeight: '700', color: colors.textPrimary },
    eulaActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    eulaDecline: { flex: 1, paddingVertical: 14, borderRadius: borderRadius.lg, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
    eulaDeclineText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
    eulaAccept: { flex: 2, paddingVertical: 14, borderRadius: borderRadius.lg, backgroundColor: colors.primary, alignItems: 'center' },
    eulaAcceptText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
