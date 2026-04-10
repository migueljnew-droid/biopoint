import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { ScreenWrapper, GlassView, AnimatedButton, BadgeChip } from '../../src/components/ui';
import { api } from '../../src/services/api';
import { BADGE_DEFINITIONS } from '@biopoint/shared';
import type { PublicProfileResponse } from '@biopoint/shared';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function CommunityIdentityScreen() {
    const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarS3Key, setAvatarS3Key] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    useEffect(() => {
        api.get('/community/profile/me').then(res => {
            const p = res.data as PublicProfileResponse;
            setProfile(p);
            setDisplayName(p.displayName || '');
            setUsername(p.username || '');
            setBio(p.bio || '');
            setAvatarUrl(p.avatarUrl);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const handlePickAvatar = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Photo library access is needed.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });
        if (result.canceled) return;

        setUploadingAvatar(true);
        try {
            const presign = await api.post('/community/avatar/presign', {
                filename: `avatar_${Date.now()}.jpg`,
                contentType: 'image/jpeg',
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
            const body: any = {};
            if (displayName) body.displayName = displayName;
            if (username) body.username = username;
            if (bio) body.bio = bio;
            if (avatarS3Key) body.avatarS3Key = avatarS3Key;

            const res = await api.put('/community/profile', body);
            setProfile(prev => prev ? { ...prev, ...res.data } : prev);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Saved', 'Your community profile has been updated.');
        } catch (e: any) {
            if (e.response?.status === 409) {
                Alert.alert('Username Taken', 'That username is already in use. Try another.');
            } else {
                Alert.alert('Error', e.response?.data?.message || 'Failed to save profile');
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <ScreenWrapper withGradient>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={colors.primary} />
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
                <Text style={styles.title}>Community Identity</Text>
                <View style={{ width: 44 }} />
            </View>

            <Animated.ScrollView entering={FadeInDown} style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Avatar */}
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
                    <Text style={styles.avatarHint}>Tap to change</Text>
                </Pressable>

                {/* Display Name */}
                <GlassView variant="light" borderRadius={borderRadius.lg} style={styles.fieldCard}>
                    <Text style={styles.fieldLabel}>Display Name</Text>
                    <TextInput
                        style={styles.input}
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder="Your name"
                        placeholderTextColor={colors.textMuted}
                        maxLength={60}
                    />
                </GlassView>

                {/* Username */}
                <GlassView variant="light" borderRadius={borderRadius.lg} style={styles.fieldCard}>
                    <Text style={styles.fieldLabel}>Username</Text>
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
                </GlassView>

                {/* Bio */}
                <GlassView variant="light" borderRadius={borderRadius.lg} style={styles.fieldCard}>
                    <View style={styles.fieldHeaderRow}>
                        <Text style={styles.fieldLabel}>Bio</Text>
                        <Text style={styles.charCount}>{bio.length}/300</Text>
                    </View>
                    <TextInput
                        style={[styles.input, styles.bioInput]}
                        value={bio}
                        onChangeText={setBio}
                        placeholder="What are you optimizing for?"
                        placeholderTextColor={colors.textMuted}
                        multiline
                        maxLength={300}
                    />
                </GlassView>

                {/* Badges */}
                {profile && profile.badges.length > 0 && (
                    <View style={styles.badgesSection}>
                        <Text style={styles.sectionTitle}>Earned Badges</Text>
                        <View style={styles.badgesRow}>
                            {BADGE_DEFINITIONS.map(b => (
                                <BadgeChip key={b.id} badgeId={b.id} earned={profile.badges.includes(b.id as any)} size="sm" />
                            ))}
                        </View>
                    </View>
                )}

                {/* Stats */}
                {profile && (
                    <View style={styles.statsRow}>
                        <GlassView variant="light" borderRadius={borderRadius.lg} style={styles.statCard}>
                            <Text style={styles.statValue}>{profile.currentStreak}</Text>
                            <Text style={styles.statLabel}>Day Streak</Text>
                        </GlassView>
                        <GlassView variant="light" borderRadius={borderRadius.lg} style={styles.statCard}>
                            <Text style={styles.statValue}>{profile.stats.daysLogged}</Text>
                            <Text style={styles.statLabel}>Days Logged</Text>
                        </GlassView>
                        <GlassView variant="light" borderRadius={borderRadius.lg} style={styles.statCard}>
                            <Text style={styles.statValue}>{profile.stats.labsUploaded}</Text>
                            <Text style={styles.statLabel}>Labs</Text>
                        </GlassView>
                    </View>
                )}

                <AnimatedButton
                    title={saving ? 'Saving...' : 'Save Profile'}
                    onPress={handleSave}
                    disabled={saving}
                    variant="primary"
                />

                <View style={{ height: 60 }} />
            </Animated.ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, marginBottom: spacing.md },
    backButton: { width: 44, height: 44, borderRadius: borderRadius.full, backgroundColor: colors.glass.light, alignItems: 'center', justifyContent: 'center' },
    title: { ...typography.h3, color: colors.textPrimary },
    content: { flex: 1, paddingHorizontal: spacing.lg },
    avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
    avatarContainer: { position: 'relative' },
    avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.backgroundCard },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.glass.border, borderStyle: 'dashed' },
    avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    avatarHint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
    fieldCard: { padding: spacing.md, marginBottom: spacing.md },
    fieldLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
    fieldHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
    charCount: { ...typography.caption, color: colors.textMuted },
    input: { ...typography.body, color: colors.textPrimary, paddingVertical: spacing.xs },
    bioInput: { minHeight: 80, textAlignVertical: 'top' },
    usernameRow: { flexDirection: 'row', alignItems: 'center' },
    atSign: { ...typography.body, color: colors.textMuted, marginRight: 4 },
    badgesSection: { marginBottom: spacing.lg },
    sectionTitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
    badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
    statCard: { flex: 1, padding: spacing.md, alignItems: 'center' },
    statValue: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
    statLabel: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
});
