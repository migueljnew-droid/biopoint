import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, RefreshControl, Alert, ActivityIndicator, ScrollView, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, SlideInDown, SlideOutDown, LinearTransition } from 'react-native-reanimated';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { ScreenWrapper, GlassView } from '../../src/components';
import { labsService, AnalysisResult } from '../../src/services/labs';
import { api } from '../../src/services/api';

interface LabReport {
    id: string;
    filename: string;
    uploadedAt: string;
    markers: Array<{
        id: string;
        name: string;
        value: number | null;
        unit: string;
        refRangeLow: number | null;
        refRangeHigh: number | null;
        isInRange: boolean | null;
        notes: string | null;
    }>;
}

export default function LabsScreen() {
    const [labs, setLabs] = useState<LabReport[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const fetchLabs = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/labs');
            setLabs(response.data);
        } catch (e: any) {
            // Empty state is fine for new users
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchLabs(); }, []);

    const processUpload = async (uri: string, name: string, mimeType: string) => {
        setIsLoading(true);
        try {
            const { uploadUrl, s3Key } = await labsService.getPresignedUrl(name, mimeType);
            await labsService.uploadFile(uri, uploadUrl, mimeType);
            await labsService.createReport({ filename: name, s3Key, notes: 'Uploaded from mobile app' });
            Alert.alert('Success', 'Lab report uploaded successfully');
            fetchLabs();
        } catch (error) {
            console.error('Upload failed:', error);
            Alert.alert('Error', 'Failed to upload lab report');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = () => {
        Alert.alert('Upload Lab Report', 'Select source', [
            {
                text: 'Photo Library',
                onPress: async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
                    if (!result.canceled && result.assets?.[0]) {
                        const asset = result.assets[0];
                        processUpload(asset.uri, asset.fileName || `lab_${Date.now()}.jpg`, asset.mimeType || 'image/jpeg');
                    }
                },
            },
            {
                text: 'Take Photo',
                onPress: async () => {
                    const perm = await ImagePicker.requestCameraPermissionsAsync();
                    if (!perm.granted) { Alert.alert('Permission needed', 'Camera access required'); return; }
                    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
                    if (!result.canceled && result.assets?.[0]) {
                        const asset = result.assets[0];
                        processUpload(asset.uri, asset.fileName || `lab_${Date.now()}.jpg`, asset.mimeType || 'image/jpeg');
                    }
                },
            },
            {
                text: 'Files (PDF)',
                onPress: async () => {
                    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
                    if (!result.canceled && result.assets?.[0]) {
                        const asset = result.assets[0];
                        processUpload(asset.uri, asset.name, asset.mimeType || 'application/octet-stream');
                    }
                },
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const handleAnalyze = async (id: string) => {
        setAnalyzingId(id);
        try {
            const result = await labsService.analyzeReport(id);
            setAnalysisResult(result);
            setModalVisible(true);
            fetchLabs(); // Refresh to get saved markers
        } catch (e: any) {
            Alert.alert('Analysis Failed', e.response?.data?.message || 'Could not analyze this report. Try again.');
        } finally {
            setAnalyzingId(null);
        }
    };

    return (
        <ScreenWrapper>
            <Animated.ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchLabs} tintColor={colors.primary} />}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Lab Reports</Text>
                    <Pressable style={styles.uploadButton} onPress={handleUpload}>
                        <Ionicons name="cloud-upload" size={20} color="#fff" />
                        <Text style={styles.uploadText}>Upload</Text>
                    </Pressable>
                </View>

                {labs.length === 0 && !isLoading && (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIcon}>
                            <Ionicons name="flask-outline" size={48} color={colors.textMuted} />
                        </View>
                        <Text style={styles.emptyText}>No lab reports yet</Text>
                        <Text style={styles.emptySubtext}>Upload your bloodwork to track biomarkers</Text>
                    </View>
                )}

                {labs.map((lab, index) => (
                    <Animated.View key={lab.id} entering={FadeInDown.delay(index * 100)} layout={LinearTransition}>
                        <GlassView style={styles.labCard} variant="medium" borderRadius={borderRadius.lg}>
                            <Pressable style={styles.labHeader} onPress={() => setExpandedId(expandedId === lab.id ? null : lab.id)}>
                                <View style={styles.labIcon}>
                                    <Ionicons name="document-text" size={24} color={colors.primary} />
                                </View>
                                <View style={styles.labInfo}>
                                    <Text style={styles.labFilename} numberOfLines={1}>{lab.filename}</Text>
                                    <Text style={styles.labDate}>{new Date(lab.uploadedAt).toLocaleDateString()}</Text>
                                </View>
                                <View style={styles.markerCount}>
                                    <Text style={styles.markerCountText}>{lab.markers.length}</Text>
                                    <Text style={styles.markerCountLabel}>markers</Text>
                                </View>
                                <Pressable
                                    style={styles.analyzeButton}
                                    onPress={(e) => { e.stopPropagation?.(); handleAnalyze(lab.id); }}
                                    disabled={analyzingId === lab.id}
                                >
                                    {analyzingId === lab.id ? (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    ) : (
                                        <>
                                            <Ionicons name="sparkles" size={16} color={colors.accent} />
                                            <Text style={styles.analyzeButtonText}>Analyze</Text>
                                        </>
                                    )}
                                </Pressable>
                                <Ionicons name={expandedId === lab.id ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
                            </Pressable>

                            {expandedId === lab.id && lab.markers.length > 0 && (
                                <Animated.View entering={FadeInDown} style={styles.markersList}>
                                    {lab.markers.map((marker) => {
                                        const statusColor = marker.isInRange === null ? colors.textMuted : marker.isInRange ? colors.success : colors.error;
                                        return (
                                            <View key={marker.id} style={styles.markerRow}>
                                                <View style={styles.markerInfo}>
                                                    <Text style={styles.markerName}>{marker.name}</Text>
                                                    {marker.refRangeLow !== null && marker.refRangeHigh !== null && (
                                                        <Text style={styles.markerRange}>Ref: {marker.refRangeLow} - {marker.refRangeHigh} {marker.unit}</Text>
                                                    )}
                                                </View>
                                                <View style={styles.markerValue}>
                                                    <Text style={[styles.markerValueText, { color: statusColor }]}>{marker.value}</Text>
                                                    <Text style={styles.markerUnit}>{marker.unit}</Text>
                                                </View>
                                                {marker.isInRange !== null && (
                                                    <Ionicons name={marker.isInRange ? 'checkmark-circle' : 'alert-circle'} size={20} color={statusColor} />
                                                )}
                                            </View>
                                        );
                                    })}
                                </Animated.View>
                            )}
                        </GlassView>
                    </Animated.View>
                ))}
            </Animated.ScrollView>

            {/* Analysis Result Modal */}
            <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={{ flex: 1, justifyContent: 'flex-end' }}>
                        <GlassView variant="heavy" style={styles.modalContent} borderRadius={borderRadius.xl}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>AI Analysis</Text>
                                <Pressable onPress={() => setModalVisible(false)}>
                                    <Ionicons name="close" size={24} color={colors.textMuted} />
                                </Pressable>
                            </View>
                            <ScrollView style={styles.modalBody}>
                                {analysisResult && (
                                    <>
                                        <View style={styles.summaryCard}>
                                            <Text style={styles.summaryTitle}>Summary</Text>
                                            <Text style={styles.summaryText}>{analysisResult.summary}</Text>
                                        </View>
                                        <Text style={styles.sectionTitle}>Detected Markers</Text>
                                        {analysisResult.markers.map((marker, i) => (
                                            <View key={i} style={styles.analysisRow}>
                                                <View style={styles.analysisInfo}>
                                                    <Text style={styles.markerName}>{marker.name}</Text>
                                                    <Text style={styles.markerRange}>Range: {marker.range}</Text>
                                                    <Text style={styles.insightText}>{marker.insight}</Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end', minWidth: 80 }}>
                                                    <Text style={[styles.markerValueText, { color: marker.flag === 'NORMAL' ? colors.success : colors.error }]}>
                                                        {marker.value} {marker.unit}
                                                    </Text>
                                                    <Text style={[styles.flagText, { color: marker.flag === 'NORMAL' ? colors.success : colors.error }]}>
                                                        {marker.flag}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </>
                                )}
                            </ScrollView>
                        </GlassView>
                    </Animated.View>
                </View>
            </Modal>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    scrollView: { flex: 1, padding: spacing.lg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
    title: { ...typography.h2, color: colors.textPrimary },
    uploadButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
    uploadText: { ...typography.label, color: '#fff' },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
    emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(99,102,241,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
    emptyText: { ...typography.h4, color: colors.textSecondary, marginTop: spacing.sm },
    emptySubtext: { ...typography.body, color: colors.textMuted },
    labCard: { padding: 0, marginBottom: spacing.md, overflow: 'hidden' },
    labHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
    labIcon: { width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center' },
    labInfo: { flex: 1 },
    labFilename: { ...typography.label, color: colors.textPrimary },
    labDate: { ...typography.caption, color: colors.textMuted },
    markerCount: { alignItems: 'center' },
    markerCountText: { ...typography.h4, color: colors.accent },
    markerCountLabel: { ...typography.caption, color: colors.textMuted },
    analyzeButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: 'rgba(34, 211, 238, 0.1)', borderRadius: borderRadius.sm },
    analyzeButtonText: { ...typography.caption, color: colors.accent, fontWeight: '600' },
    markersList: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', padding: spacing.md },
    markerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
    markerInfo: { flex: 1 },
    markerName: { ...typography.label, color: colors.textPrimary },
    markerRange: { ...typography.caption, color: colors.textMuted },
    markerValue: { alignItems: 'flex-end' },
    markerValueText: { ...typography.h4 },
    markerUnit: { ...typography.caption, color: colors.textMuted },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { height: '80%', padding: spacing.lg },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
    modalTitle: { ...typography.h2, color: colors.textPrimary },
    modalBody: { flex: 1 },
    summaryCard: { backgroundColor: 'rgba(99,102,241,0.08)', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg },
    summaryTitle: { ...typography.h4, color: colors.primary, marginBottom: spacing.xs },
    summaryText: { ...typography.body, color: colors.textPrimary },
    sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
    analysisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    analysisInfo: { flex: 1, paddingRight: spacing.md },
    insightText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
    flagText: { ...typography.label, marginTop: spacing.xs },
});
