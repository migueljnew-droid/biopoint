import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, RefreshControl, Image, Dimensions, Alert } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { api } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper, GlassView } from '../../src/components';
import Animated, { LinearTransition } from 'react-native-reanimated';

interface Photo { id: string; originalUrl: string; alignedUrl: string | null; category: string; capturedAt: string; weightKg: number | null; alignmentStatus: string }

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - spacing.lg * 2 - spacing.sm * 2) / 3;

export default function ProgressScreen() {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
    const [showAligned, setShowAligned] = useState(false);

    const fetchPhotos = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/photos');
            setPhotos(response.data);
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to fetch photos');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchPhotos(); }, []);

    const handleUpload = () => {
        Alert.alert('Upload Progress Photo', 'This would open the camera or photo library to capture a progress photo.', [{ text: 'OK' }]);
    };

    const categoryLabels: Record<string, string> = { front: 'Front', side: 'Side', back: 'Back' };
    const groupedPhotos = photos.reduce((acc, photo) => {
        const date = new Date(photo.capturedAt).toLocaleDateString();
        if (!acc[date]) acc[date] = [];
        acc[date].push(photo);
        return acc;
    }, {} as Record<string, Photo[]>);

    return (
        <ScreenWrapper withGradient={true}>
            <Animated.ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchPhotos} tintColor={colors.primary} />}
                showsVerticalScrollIndicator={false}
                layout={LinearTransition}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Progress Photos</Text>
                    <Pressable style={styles.uploadButton} onPress={handleUpload}>
                        <Ionicons name="camera" size={20} color={colors.textPrimary} />
                        <Text style={styles.uploadText}>Capture</Text>
                    </Pressable>
                </View>

                {photos.length === 0 && !isLoading && (
                    <View style={styles.emptyState}>
                        <GlassView variant="light" style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }} borderRadius={borderRadius.xl}>
                            <Ionicons name="images-outline" size={48} color={colors.textMuted} />
                        </GlassView>
                        <Text style={styles.emptyText}>No progress photos yet</Text>
                        <Text style={styles.emptySubtext}>Capture before/after photos to track your transformation</Text>
                    </View>
                )}

                {Object.entries(groupedPhotos).map(([date, datePhotos]) => (
                    <View key={date} style={styles.dateGroup}>
                        <Text style={styles.dateLabel}>{date}</Text>
                        <View style={styles.photoGrid}>
                            {datePhotos.map((photo) => (
                                <Pressable key={photo.id} style={styles.photoThumbnail} onPress={() => setSelectedPhoto(photo)}>
                                    <Image source={{ uri: photo.originalUrl }} style={styles.thumbnailImage} />
                                    <View style={styles.categoryBadge}>
                                        <Text style={styles.categoryText}>{categoryLabels[photo.category] || photo.category}</Text>
                                    </View>
                                    {photo.alignmentStatus === 'done' && (
                                        <View style={styles.alignedBadge}>
                                            <Ionicons name="resize" size={12} color={colors.success} />
                                        </View>
                                    )}
                                </Pressable>
                            ))}
                        </View>
                    </View>
                ))}

                {/* Compare Section */}
                <GlassView style={styles.compareCard} variant="medium" borderRadius={borderRadius.lg}>
                    <Ionicons name="git-compare" size={24} color={colors.accent} />
                    <Text style={styles.compareTitle}>Before/After Compare</Text>
                    <Text style={styles.compareSubtext}>Swipe to compare your progress photos side by side</Text>
                    <Pressable style={styles.compareButton}>
                        <Text style={styles.compareButtonText}>Compare Photos</Text>
                    </Pressable>
                </GlassView>
            </Animated.ScrollView>

            {/* Photo Detail Modal */}
            {selectedPhoto && (
                <View style={styles.modalOverlay}>
                    <Pressable style={styles.closeButton} onPress={() => { setSelectedPhoto(null); setShowAligned(false); }}>
                        <Ionicons name="close" size={28} color={colors.textPrimary} />
                    </Pressable>

                    <Image source={{ uri: showAligned && selectedPhoto.alignedUrl ? selectedPhoto.alignedUrl : selectedPhoto.originalUrl }} style={styles.fullImage} resizeMode="contain" />

                    <View style={styles.photoDetails}>
                        <Text style={styles.photoDate}>{new Date(selectedPhoto.capturedAt).toLocaleDateString()}</Text>
                        {selectedPhoto.weightKg && <Text style={styles.photoWeight}>{selectedPhoto.weightKg} kg</Text>}
                    </View>

                    {selectedPhoto.alignedUrl && (
                        <View style={styles.toggleContainer}>
                            <Pressable style={[styles.toggleButton, !showAligned && styles.toggleActive]} onPress={() => setShowAligned(false)}>
                                <Text style={[styles.toggleText, !showAligned && styles.toggleTextActive]}>Original</Text>
                            </Pressable>
                            <Pressable style={[styles.toggleButton, showAligned && styles.toggleActive]} onPress={() => setShowAligned(true)}>
                                <Text style={[styles.toggleText, showAligned && styles.toggleTextActive]}>Aligned</Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            )}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1, padding: spacing.lg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
    title: { ...typography.h2, color: colors.textPrimary },
    uploadButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
    uploadText: { ...typography.label, color: colors.textPrimary },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
    emptyText: { ...typography.h4, color: colors.textSecondary, marginTop: spacing.md },
    emptySubtext: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
    dateGroup: { marginBottom: spacing.lg },
    dateLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    photoThumbnail: { width: PHOTO_SIZE, height: PHOTO_SIZE * 1.3, borderRadius: borderRadius.md, overflow: 'hidden', backgroundColor: colors.backgroundCard },
    thumbnailImage: { width: '100%', height: '100%' },
    categoryBadge: { position: 'absolute', bottom: spacing.xs, left: spacing.xs, backgroundColor: colors.overlay, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
    categoryText: { ...typography.caption, color: colors.textPrimary },
    alignedBadge: { position: 'absolute', top: spacing.xs, right: spacing.xs, backgroundColor: colors.backgroundCard, padding: 4, borderRadius: borderRadius.sm },
    compareCard: { padding: spacing.lg, alignItems: 'center', marginBottom: spacing.xxl },
    compareTitle: { ...typography.h4, color: colors.textPrimary, marginTop: spacing.sm },
    compareSubtext: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
    compareButton: { backgroundColor: colors.accent, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
    compareButtonText: { ...typography.label, color: colors.background },
    modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
    closeButton: { position: 'absolute', top: 60, right: spacing.lg, zIndex: 10 },
    fullImage: { width: '100%', height: '70%' },
    photoDetails: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    photoDate: { ...typography.label, color: colors.textPrimary },
    photoWeight: { ...typography.label, color: colors.accent },
    toggleContainer: { flexDirection: 'row', backgroundColor: colors.backgroundCard, borderRadius: borderRadius.full, padding: 4, marginTop: spacing.md },
    toggleButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full },
    toggleActive: { backgroundColor: colors.primary },
    toggleText: { ...typography.label, color: colors.textSecondary },
    toggleTextActive: { color: colors.textPrimary },
});
