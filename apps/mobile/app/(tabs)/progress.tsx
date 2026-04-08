import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, RefreshControl, Image, Dimensions, Alert, ActivityIndicator, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { api } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper, GlassView } from '../../src/components';
import Animated, { LinearTransition, FadeInDown } from 'react-native-reanimated';

interface Photo {
    id: string;
    originalUrl: string;
    alignedUrl: string | null;
    category: string;
    capturedAt: string;
    weightKg: number | null;
    alignmentStatus: string;
}

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - spacing.lg * 2 - spacing.sm * 2) / 3;

export default function ProgressScreen() {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
    const [showAligned, setShowAligned] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [pendingImage, setPendingImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

    const fetchPhotos = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/photos');
            setPhotos(response.data);
        } catch {
            // Silently fail on fetch — empty state handles it
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchPhotos(); }, []);

    const pickImage = async (source: 'camera' | 'library') => {
        const options: ImagePicker.ImagePickerOptions = {
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.8,
        };

        let result: ImagePicker.ImagePickerResult;

        if (source === 'camera') {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Camera access is needed to take progress photos.');
                return;
            }
            result = await ImagePicker.launchCameraAsync(options);
        } else {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Photo library access is needed to select progress photos.');
                return;
            }
            result = await ImagePicker.launchImageLibraryAsync(options);
        }

        if (!result.canceled && result.assets[0]) {
            setPendingImage(result.assets[0]);
            setShowCategoryPicker(true);
        }
    };

    const uploadPhoto = async (category: string) => {
        if (!pendingImage) return;
        setShowCategoryPicker(false);
        setUploading(true);

        try {
            const filename = `progress_${Date.now()}.jpg`;

            // 1. Get presigned upload URL
            const presignRes = await api.post('/photos/presign', {
                filename,
                contentType: 'image/jpeg',
            });
            const { uploadUrl, s3Key } = presignRes.data;

            // 2. Upload image to S3
            const imageResponse = await fetch(pendingImage.uri);
            const blob = await imageResponse.blob();
            await fetch(uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'image/jpeg' },
            });

            // 3. Create photo record
            const photoRes = await api.post('/photos', {
                originalS3Key: s3Key,
                category,
            });

            setPhotos((prev) => [photoRes.data, ...prev]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e: any) {
            Alert.alert('Upload Failed', e.response?.data?.message || 'Could not upload photo. Please try again.');
        } finally {
            setUploading(false);
            setPendingImage(null);
        }
    };

    const deletePhoto = async (photoId: string) => {
        try {
            await api.delete(`/photos/${photoId}`);
            setPhotos((prev) => prev.filter((p) => p.id !== photoId));
            setSelectedPhoto(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
            Alert.alert('Error', 'Failed to delete photo.');
        }
    };

    const handleUpload = () => {
        Alert.alert('Add Progress Photo', 'Choose a source', [
            { text: 'Camera', onPress: () => pickImage('camera') },
            { text: 'Photo Library', onPress: () => pickImage('library') },
            { text: 'Cancel', style: 'cancel' },
        ]);
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
                    <Pressable style={styles.uploadButton} onPress={handleUpload} disabled={uploading}>
                        {uploading ? (
                            <ActivityIndicator size="small" color={colors.textPrimary} />
                        ) : (
                            <>
                                <Ionicons name="camera" size={20} color={colors.textPrimary} />
                                <Text style={styles.uploadText}>Capture</Text>
                            </>
                        )}
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
                    <Animated.View key={date} entering={FadeInDown} style={styles.dateGroup}>
                        <Text style={styles.dateLabel}>{date}</Text>
                        <View style={styles.photoGrid}>
                            {datePhotos.map((photo) => (
                                <Pressable key={photo.id} style={styles.photoThumbnail} onPress={() => setSelectedPhoto(photo)}>
                                    <Image source={{ uri: photo.originalUrl }} style={styles.thumbnailImage} />
                                    <View style={styles.categoryBadge}>
                                        <Text style={styles.categoryText}>{categoryLabels[photo.category] || photo.category}</Text>
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                    </Animated.View>
                ))}

                <View style={{ height: spacing.xxl }} />
            </Animated.ScrollView>

            {/* Category Picker Modal */}
            <Modal visible={showCategoryPicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <GlassView variant="medium" style={styles.categoryModal} borderRadius={borderRadius.xl}>
                        <Text style={styles.categoryModalTitle}>Photo Category</Text>
                        <Text style={styles.categoryModalSubtext}>What angle is this photo?</Text>
                        {(['front', 'side', 'back'] as const).map((cat) => (
                            <Pressable
                                key={cat}
                                style={styles.categoryOption}
                                onPress={() => uploadPhoto(cat)}
                            >
                                <Ionicons
                                    name={cat === 'front' ? 'person' : cat === 'side' ? 'person-outline' : 'arrow-back-circle'}
                                    size={24}
                                    color={colors.primary}
                                />
                                <Text style={styles.categoryOptionText}>{categoryLabels[cat]}</Text>
                            </Pressable>
                        ))}
                        <Pressable style={styles.cancelButton} onPress={() => { setShowCategoryPicker(false); setPendingImage(null); }}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                    </GlassView>
                </View>
            </Modal>

            {/* Photo Detail Modal */}
            {selectedPhoto && (
                <View style={styles.detailOverlay}>
                    <Pressable style={styles.closeButton} onPress={() => { setSelectedPhoto(null); setShowAligned(false); }}>
                        <Ionicons name="close" size={28} color={colors.textPrimary} />
                    </Pressable>

                    <Image
                        source={{ uri: showAligned && selectedPhoto.alignedUrl ? selectedPhoto.alignedUrl : selectedPhoto.originalUrl }}
                        style={styles.fullImage}
                        resizeMode="contain"
                    />

                    <View style={styles.photoDetails}>
                        <Text style={styles.photoDate}>{new Date(selectedPhoto.capturedAt).toLocaleDateString()}</Text>
                        <Text style={styles.photoCat}>{categoryLabels[selectedPhoto.category] || selectedPhoto.category}</Text>
                        {selectedPhoto.weightKg && <Text style={styles.photoWeight}>{selectedPhoto.weightKg} kg</Text>}
                    </View>

                    <Pressable
                        style={styles.deletePhotoButton}
                        onPress={() => {
                            Alert.alert('Delete Photo', 'Are you sure?', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => deletePhoto(selectedPhoto.id) },
                            ]);
                        }}
                    >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                        <Text style={{ ...typography.label, color: colors.error }}>Delete</Text>
                    </Pressable>
                </View>
            )}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
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
    categoryBadge: { position: 'absolute', bottom: spacing.xs, left: spacing.xs, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
    categoryText: { ...typography.caption, color: '#fff' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    categoryModal: { width: '100%', padding: spacing.xl, gap: spacing.md },
    categoryModalTitle: { ...typography.h3, color: colors.textPrimary, textAlign: 'center' },
    categoryModalSubtext: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
    categoryOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: 'rgba(255,255,255,0.06)' },
    categoryOptionText: { ...typography.h4, color: colors.textPrimary },
    cancelButton: { alignItems: 'center', padding: spacing.md },
    cancelText: { ...typography.body, color: colors.textMuted },
    detailOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
    closeButton: { position: 'absolute', top: 60, right: spacing.lg, zIndex: 10 },
    fullImage: { width: '100%', height: '70%' },
    photoDetails: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    photoDate: { ...typography.label, color: colors.textPrimary },
    photoCat: { ...typography.label, color: colors.accent },
    photoWeight: { ...typography.label, color: colors.accent },
    deletePhotoButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, padding: spacing.md },
});
