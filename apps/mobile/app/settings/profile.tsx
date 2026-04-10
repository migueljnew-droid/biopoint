import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert, Pressable, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { useProfileStore } from '../../src/store/profileStore';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper, GlassView, AnimatedButton, HeightPicker, WeightPicker, BadgeChip } from '../../src/components';
import { api } from '../../src/services/api';
import { BADGE_DEFINITIONS } from '@biopoint/shared';
import type { PublicProfileResponse } from '@biopoint/shared';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function EditProfileScreen() {
    const { profile: bioProfile, fetchProfile, updateProfile } = useProfileStore();

    // Biometrics
    const [formData, setFormData] = useState({
        sex: '', heightCm: '', baselineWeightKg: '',
        goals: [] as string[], dietStyle: '', currentInterventions: ''
    });

    // Community identity
    const [communityProfile, setCommunityProfile] = useState<PublicProfileResponse | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarS3Key, setAvatarS3Key] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProfile();
        api.get('/community/profile/me').then(res => {
            const p = res.data as PublicProfileResponse;
            setCommunityProfile(p);
            setDisplayName(p.displayName || '');
            setUsername(p.username || '');
            setBio(p.bio || '');
            setAvatarUrl(p.avatarUrl);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (bioProfile) {
            setFormData({
                sex: bioProfile.sex || '',
                heightCm: bioProfile.heightCm?.toString() || '',
                baselineWeightKg: bioProfile.baselineWeightKg?.toString() || '',
                goals: bioProfile.goals || [],
                dietStyle: bioProfile.dietStyle || '',
                currentInterventions: bioProfile.currentInterventions || ''
            });
        }
    }, [bioProfile]);

    const handlePickAvatar = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Photo library access is needed.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
        });
        if (result.canceled) return;

        setUploadingAvatar(true);
        try {
            const presign = await api.post('/community/avatar/presign', {
                filename: `avatar_${Date.now()}.jpg`, contentType: 'image/jpeg',
            });
            const { uploadUrl, s3Key } = presign.data;
            const blob = await (await fetch(result.assets[0].uri)).blob();
            await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
            setAvatarS3Key(s3Key);
            setAvatarUrl(result.assets[0].uri);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
            Alert.alert('Error', 'Failed to upload avatar');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSave = async () => {
        if (username && (username.length < 3 || !/^[a-z0-9_]+$/.test(username))) {
            Alert.alert('Invalid Username', 'Must be 3+ characters, lowercase letters, numbers, and underscores only.');
            return;
        }
        setSaving(true);
        try {
            // Save biometrics
            const bioBody: any = { goals: formData.goals };
            if (formData.sex) bioBody.sex = formData.sex;
            if (formData.heightCm) bioBody.heightCm = parseFloat(formData.heightCm);
            if (formData.baselineWeightKg) bioBody.baselineWeightKg = parseFloat(formData.baselineWeightKg);
            if (formData.dietStyle) bioBody.dietStyle = formData.dietStyle;
            if (formData.currentInterventions) bioBody.currentInterventions = formData.currentInterventions;
            await updateProfile(bioBody);

            // Save community identity
            const body: any = {};
            if (displayName) body.displayName = displayName;
            if (username) body.username = username;
            if (bio) body.bio = bio;
            if (avatarS3Key) body.avatarS3Key = avatarS3Key;
            if (Object.keys(body).length > 0) {
                await api.put('/community/profile', body);
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Saved', 'Profile updated.');
            router.back();
        } catch (e: any) {
            if (e.response?.status === 409) {
                Alert.alert('Username Taken', 'That username is already in use.');
            } else {
                Alert.alert('Error', 'Failed to save profile');
            }
        } finally {
            setSaving(false);
        }
    };

    const goalOptions = ['Optimize Health', 'Build Muscle', 'Lose Fat', 'Improve Sleep', 'Increase Energy', 'Enhance Focus', 'Longevity'];

    const toggleGoal = (goal: string) => {
        setFormData(prev => ({
            ...prev,
            goals: prev.goals.includes(goal) ? prev.goals.filter(g => g !== goal) : [...prev.goals, goal]
        }));
    };

    return (
        <ScreenWrapper withGradient={true}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <GlassView variant="light" borderRadius={borderRadius.full} style={styles.iconButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </GlassView>
                </Pressable>
                <Text style={styles.title}>Edit Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeInDown.delay(100).springify()}>

                    {/* Avatar + Identity */}
                    <Pressable onPress={handlePickAvatar} style={styles.avatarSection} disabled={uploadingAvatar}>
                        <View style={styles.avatarContainer}>
                            {avatarUrl ? (
                                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <Ionicons name="person" size={40} color={colors.textMuted} />
                                </View>
                            )}
                            <View style={styles.avatarEditBadge}>
                                {uploadingAvatar ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="camera" size={14} color="#fff" />
                                )}
                            </View>
                        </View>
                        <Text style={styles.avatarHint}>Tap to change photo</Text>
                    </Pressable>

                    <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.section}>
                        <Text style={styles.sectionTitle}>Identity</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Display Name</Text>
                            <TextInput
                                style={styles.input}
                                value={displayName}
                                onChangeText={setDisplayName}
                                placeholder="Your name"
                                placeholderTextColor={colors.textMuted}
                                maxLength={60}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Username</Text>
                            <View style={styles.usernameRow}>
                                <Text style={styles.atSign}>@</Text>
                                <TextInput
                                    style={[styles.input, { flex: 1 }]}
                                    value={username}
                                    onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                    placeholder="biohacker_42"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    maxLength={30}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <View style={styles.fieldHeaderRow}>
                                <Text style={styles.label}>Bio</Text>
                                <Text style={styles.charCount}>{bio.length}/300</Text>
                            </View>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={bio}
                                onChangeText={setBio}
                                placeholder="What are you optimizing for?"
                                placeholderTextColor={colors.textMuted}
                                multiline
                                maxLength={300}
                            />
                        </View>
                    </GlassView>

                    {/* Badges */}
                    {communityProfile && (communityProfile.badges ?? []).length > 0 && (
                        <View style={styles.badgesSection}>
                            <Text style={styles.sectionTitle}>Earned Badges</Text>
                            <View style={styles.badgesRow}>
                                {BADGE_DEFINITIONS.map(b => (
                                    <BadgeChip key={b.id} badgeId={b.id} earned={(communityProfile.badges ?? []).includes(b.id as any)} size="sm" />
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Basic Info */}
                    <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.section}>
                        <Text style={styles.sectionTitle}>Basic Info</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Biological Sex</Text>
                            <View style={styles.options}>
                                {(['male', 'female', 'other'] as const).map((s) => (
                                    <Pressable
                                        key={s}
                                        style={[styles.option, formData.sex === s && styles.optionActive]}
                                        onPress={() => setFormData({ ...formData, sex: s })}
                                    >
                                        <Text style={[styles.optionText, formData.sex === s && styles.optionTextActive]}>
                                            {s.charAt(0).toUpperCase() + s.slice(1)}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Height</Text>
                            <HeightPicker
                                value={formData.heightCm}
                                onChange={(v: string) => setFormData(prev => ({ ...prev, heightCm: v }))}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Baseline Weight</Text>
                            <WeightPicker
                                value={formData.baselineWeightKg}
                                onChange={(v: string) => setFormData(prev => ({ ...prev, baselineWeightKg: v }))}
                            />
                        </View>
                    </GlassView>

                    {/* Goals */}
                    <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.section}>
                        <Text style={styles.sectionTitle}>Goals</Text>
                        <View style={styles.goalsGrid}>
                            {goalOptions.map((goal) => (
                                <Pressable
                                    key={goal}
                                    style={[styles.goalChip, formData.goals.includes(goal) && styles.goalChipActive]}
                                    onPress={() => toggleGoal(goal)}
                                >
                                    <Text style={[styles.goalChipText, formData.goals.includes(goal) && styles.goalChipTextActive]}>
                                        {goal}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </GlassView>

                    {/* Additional Details */}
                    <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.section}>
                        <Text style={styles.sectionTitle}>Details</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Diet Style</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.dietStyle}
                                onChangeText={(v) => setFormData({ ...formData, dietStyle: v })}
                                placeholder="e.g. Keto, Paleo"
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Current Interventions</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={formData.currentInterventions}
                                onChangeText={(v) => setFormData({ ...formData, currentInterventions: v })}
                                placeholder="Supplements, protocols..."
                                placeholderTextColor={colors.textMuted}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />
                        </View>
                    </GlassView>

                    <AnimatedButton
                        title={saving ? 'Saving...' : 'Save Changes'}
                        onPress={handleSave}
                        disabled={saving}
                        variant="primary"
                        style={{ marginBottom: spacing.xxl }}
                    />
                </Animated.View>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    backButton: {},
    iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '600', color: colors.textPrimary },
    content: { flex: 1, padding: spacing.lg },
    avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
    avatarContainer: { position: 'relative' },
    avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.backgroundCard },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.glass.border, borderStyle: 'dashed' },
    avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    avatarHint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
    section: { padding: spacing.lg, marginBottom: spacing.lg },
    sectionTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },
    inputGroup: { marginBottom: spacing.md },
    label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
    fieldHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
    charCount: { ...typography.caption, color: colors.textMuted },
    input: { backgroundColor: colors.glass.light, borderWidth: 0, borderColor: 'transparent', borderRadius: borderRadius.md, padding: spacing.md, color: colors.textPrimary, ...typography.body },
    textArea: { minHeight: 80 },
    usernameRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glass.light, borderRadius: borderRadius.md, paddingHorizontal: spacing.md },
    atSign: { ...typography.body, color: colors.textMuted, marginRight: 4 },
    options: { flexDirection: 'row', gap: spacing.sm },
    option: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.glass.light, borderWidth: 0, borderColor: 'transparent', alignItems: 'center' },
    optionActive: { borderColor: colors.primary, borderWidth: 1, backgroundColor: 'rgba(99, 102, 241, 0.15)' },
    optionText: { ...typography.label, color: colors.textSecondary },
    optionTextActive: { color: colors.primary },
    goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    goalChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.glass.light, borderWidth: 0, borderColor: 'transparent' },
    goalChipActive: { borderColor: colors.primary, borderWidth: 1, backgroundColor: 'rgba(99, 102, 241, 0.15)' },
    goalChipText: { ...typography.bodySmall, color: colors.textSecondary },
    goalChipTextActive: { color: colors.primary },
    badgesSection: { marginBottom: spacing.lg },
    badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
