import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { api } from '../../src/services/api';
import { labsService, AnalysisResult } from '../../src/services/labs';
import { Ionicons } from '@expo/vector-icons';
import { Modal, ActivityIndicator, Dimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { LineChart } from 'react-native-chart-kit';
import { ScreenWrapper, GlassView } from '../../src/components';
import Animated, { LinearTransition, SlideInDown, SlideOutDown, FadeInDown } from 'react-native-reanimated';
import { useSubscriptionStore } from '../../src/store/subscriptionStore';
import { router } from 'expo-router';

interface LabReport { id: string; filename: string; uploadedAt: string; markers: { id: string; name: string; value: number; unit: string; refRangeLow: number | null; refRangeHigh: number | null; isInRange: boolean | null }[] }

export default function LabsScreen() {
    const { isPremium } = useSubscriptionStore();
    const [labs, setLabs] = useState<LabReport[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [trendsVisible, setTrendsVisible] = useState(false);
    const [trends, setTrends] = useState<any[]>([]);
    const [selectedTrend, setSelectedTrend] = useState<any>(null);

    const fetchLabs = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/labs');
            setLabs(response.data);
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to fetch labs');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchLabs(); }, []);

    const processUpload = async (uri: string, name: string, mimeType: string) => {
        setIsLoading(true);
        try {
            // 1. Get presigned URL
            const { uploadUrl, s3Key } = await labsService.getPresignedUrl(name, mimeType);

            // 2. Upload file to S3
            await labsService.uploadFile(uri, uploadUrl, mimeType);

            // 3. Create lab report record
            await labsService.createReport({
                filename: name,
                s3Key,
                notes: 'Uploaded from mobile app',
            });

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
        Alert.alert(
            'Upload Lab Report',
            'Select source',
            [
                {
                    text: 'Photo Library',
                    onPress: async () => {
                        const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            quality: 0.8,
                        });
                        if (!result.canceled && result.assets && result.assets.length > 0) {
                            const asset = result.assets[0];
                            if (asset) {
                                const name = asset.fileName || `photo_${Date.now()}.jpg`;
                                const type = asset.mimeType || 'image/jpeg';
                                if (asset.uri) processUpload(asset.uri, name, type);
                            }
                        }
                    },
                },
                {
                    text: 'Files (PDF/Doc)',
                    onPress: async () => {
                        const result = await DocumentPicker.getDocumentAsync({
                            type: ['image/*', 'application/pdf'],
                            copyToCacheDirectory: false,
                        });
                        if (!result.canceled && result.assets && result.assets.length > 0) {
                            const asset = result.assets[0];
                            if (asset) {
                                processUpload(asset.uri, asset.name, asset.mimeType || 'application/octet-stream');
                            }
                        }
                    },
                },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const handleViewTrends = async () => {
        if (!isPremium) {
            Alert.alert(
                'Premium Required',
                'Trend analysis is a BioPoint+ feature. Upgrade to view your biomarker history.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Upgrade', onPress: () => router.push('/premium') }
                ]
            );
            return;
        }

        setIsLoading(true);
        try {
            const data = await labsService.getTrends();
            setTrends(data);
            if (data.length > 0) setSelectedTrend(data[0]);
            setTrendsVisible(true);
        } catch (error) {
            Alert.alert('Error', 'Failed to load trends');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnalyze = async (id: string) => {
        if (!isPremium) {
            Alert.alert(
                'Premium Required',
                'AI Lab Analysis is a BioPoint+ feature. Instant interpretation requires an upgrade.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Upgrade', onPress: () => router.push('/premium') }
                ]
            );
            return;
        }

        setAnalyzingId(id);
        try {
            const result = await labsService.analyzeReport(id);
            setAnalysisResult(result);
            setModalVisible(true);
        } catch (e: any) {
            Alert.alert('Error', 'Failed to analyze report. Please try again.');
        } finally {
            setAnalyzingId(null);
        }
    };

    return (
        <ScreenWrapper withGradient={true}>
            <Animated.ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchLabs} tintColor={colors.primary} />}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Lab Reports</Text>
                    <Pressable style={styles.uploadButton} onPress={handleUpload}>
                        <Ionicons name="cloud-upload" size={20} color={colors.textPrimary} />
                        <Text style={styles.uploadText}>Upload</Text>
                    </Pressable>
                </View>

                {labs.length === 0 && !isLoading && (
                    <View style={styles.emptyState}>
                        <GlassView variant="light" style={styles.emptyIconContainer} borderRadius={borderRadius.xl}>
                            <Ionicons name="flask-outline" size={48} color={colors.textMuted} />
                        </GlassView>
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
                                    <Text style={styles.labFilename} numberOfLines={1} ellipsizeMode="middle">{lab.filename}</Text>
                                    <Text style={styles.labDate}>{new Date(lab.uploadedAt).toLocaleDateString()}</Text>
                                </View>
                                <View style={styles.markerCount}>
                                    <Text style={styles.markerCountText}>{lab.markers.length}</Text>
                                    <Text style={styles.markerCountLabel}>markers</Text>
                                </View>
                                <Pressable
                                    style={styles.analyzeButton}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleAnalyze(lab.id);
                                    }}
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
                                        const inRange = marker.isInRange;
                                        const statusColor = inRange === null ? colors.textMuted : inRange ? colors.success : colors.error;
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
                                                {inRange !== null && (
                                                    <Ionicons name={inRange ? 'checkmark-circle' : 'alert-circle'} size={20} color={statusColor} />
                                                )}
                                            </View>
                                        );
                                    })}
                                </Animated.View>
                            )}
                        </GlassView>
                    </Animated.View>
                ))}

                {/* Trends Placeholder */}
                <GlassView style={styles.trendsCard} variant="medium" borderRadius={borderRadius.lg}>
                    <Ionicons name="trending-up" size={24} color={colors.accent} />
                    <Text style={styles.trendsTitle}>Marker Trends</Text>
                    <Text style={styles.trendsSubtext}>View how your biomarkers change over time</Text>
                    <Pressable
                        style={({ pressed }) => [styles.trendsButton, { opacity: pressed ? 0.8 : 1, zIndex: 10 }]}
                        onPress={handleViewTrends}
                    >
                        <Text style={styles.trendsButtonText}>View Trends</Text>
                    </Pressable>
                </GlassView>
            </Animated.ScrollView>

            {/* Trends Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={trendsVisible}
                onRequestClose={() => setTrendsVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={{ flex: 1, justifyContent: 'flex-end' }}>
                        <GlassView variant="heavy" style={styles.modalContent} borderRadius={borderRadius.xl}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Biomarker Trends</Text>
                                <Pressable onPress={() => setTrendsVisible(false)}>
                                    <Ionicons name="close" size={24} color={colors.textMuted} />
                                </Pressable>
                            </View>

                            <ScrollView style={styles.modalBody}>
                                {trends.length > 0 ? (
                                    <>
                                        <View style={styles.pickerContainer}>
                                            <Text style={styles.label}>Select Biomarker:</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                                                {trends.map((t) => (
                                                    <Pressable
                                                        key={t.name}
                                                        style={[styles.chip, selectedTrend?.name === t.name && styles.activeChip]}
                                                        onPress={() => setSelectedTrend(t)}
                                                    >
                                                        <Text style={[styles.chipText, selectedTrend?.name === t.name && styles.activeChipText]}>{t.name}</Text>
                                                    </Pressable>
                                                ))}
                                            </ScrollView>
                                        </View>

                                        {selectedTrend && selectedTrend.history.length > 0 ? (
                                            <View style={styles.chartContainer}>
                                                <LineChart
                                                    data={{
                                                        labels: selectedTrend.history.map((h: any) => {
                                                            const date = new Date(h.date);
                                                            // Check if all points are on the same day
                                                            const allSameDay = selectedTrend.history.every((item: any) =>
                                                                new Date(item.date).toDateString() === new Date(selectedTrend.history[0].date).toDateString()
                                                            );

                                                            if (allSameDay) {
                                                                return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                                                            }
                                                            return `${date.getMonth() + 1}/${date.getDate()}`;
                                                        }),
                                                        datasets: [{ data: selectedTrend.history.map((h: any) => h.value) }]
                                                    }}
                                                    width={Dimensions.get('window').width - 48}
                                                    height={220}
                                                    yAxisSuffix={selectedTrend.unit ? ` ${selectedTrend.unit}` : ''}
                                                    fromZero
                                                    verticalLabelRotation={30}
                                                    chartConfig={{
                                                        backgroundColor: colors.backgroundCard,
                                                        backgroundGradientFrom: colors.backgroundCard,
                                                        backgroundGradientTo: colors.backgroundCard,
                                                        decimalPlaces: 1,
                                                        color: (opacity = 1) => `rgba(34, 211, 238, ${opacity})`,
                                                        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                                                        style: { borderRadius: 16 },
                                                        propsForDots: { r: "6", strokeWidth: "2", stroke: colors.accent }
                                                    }}
                                                    bezier
                                                    style={{ marginVertical: 8, borderRadius: 16 }}
                                                />
                                            </View>
                                        ) : (
                                            <View style={styles.noDataContainer}>
                                                <Text style={styles.noDataText}>Not enough data points for a chart yet.</Text>
                                            </View>
                                        )}

                                        {selectedTrend && (
                                            <View style={styles.historyList}>
                                                <Text style={styles.sectionTitle}>History</Text>
                                                {selectedTrend.history.map((h: any, i: number) => (
                                                    <View key={i} style={styles.historyRow}>
                                                        <Text style={styles.historyDate}>{new Date(h.date).toLocaleDateString()}</Text>
                                                        <Text style={styles.historyValue}>{h.value} {selectedTrend.unit}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </>
                                ) : (
                                    <Text style={styles.emptyText}>No trend data available yet.</Text>
                                )}
                            </ScrollView>
                        </GlassView>
                    </Animated.View>
                </View>
            </Modal>

            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={{ flex: 1, justifyContent: 'flex-end' }}>
                        <GlassView variant="heavy" style={styles.modalContent} borderRadius={borderRadius.lg}>
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
                                        {analysisResult.markers.map((marker, index) => (
                                            <View key={index} style={styles.analysisRow}>
                                                <View style={styles.analysisInfo}>
                                                    <Text style={styles.markerName}>{marker.name}</Text>
                                                    <Text style={styles.markerRange}>Range: {marker.range}</Text>
                                                    <Text style={styles.insightText}>{marker.insight}</Text>
                                                </View>
                                                <View style={styles.analysisValue}>
                                                    <Text style={[
                                                        styles.markerValueText,
                                                        { color: marker.flag === 'NORMAL' ? colors.success : colors.error }
                                                    ]}>
                                                        {marker.value} {marker.unit}
                                                    </Text>
                                                    <Text style={[
                                                        styles.flagText,
                                                        { color: marker.flag === 'NORMAL' ? colors.success : colors.error }
                                                    ]}>
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
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1, padding: spacing.lg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
    title: { ...typography.h2, color: colors.textPrimary },
    uploadButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
    uploadText: { ...typography.label, color: colors.textPrimary },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
    emptyIconContainer: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
    emptyText: { ...typography.h4, color: colors.textSecondary, marginTop: spacing.sm },
    emptySubtext: { ...typography.body, color: colors.textMuted },
    labCard: { padding: spacing.lg, marginBottom: spacing.md, overflow: 'hidden' },
    labHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
    labIcon: { width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center' },
    labInfo: { flex: 1 },
    labFilename: { ...typography.label, color: colors.textPrimary },
    labDate: { ...typography.caption, color: colors.textMuted },
    markerCount: { alignItems: 'center' },
    markerCountText: { ...typography.h4, color: colors.accent },
    markerCountLabel: { ...typography.caption, color: colors.textMuted },
    markersList: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md },
    markerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
    markerInfo: { flex: 1 },
    markerName: { ...typography.label, color: colors.textPrimary },
    markerRange: { ...typography.caption, color: colors.textMuted },
    markerValue: { alignItems: 'flex-end' },
    markerValueText: { ...typography.h4 },
    markerUnit: { ...typography.caption, color: colors.textMuted },
    trendsCard: { padding: spacing.lg, alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xxl },
    trendsTitle: { ...typography.h4, color: colors.textPrimary, marginTop: spacing.sm },
    trendsSubtext: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
    trendsButton: { backgroundColor: colors.accent, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
    trendsButtonText: { ...typography.label, color: colors.background },
    analyzeButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: 'rgba(34, 211, 238, 0.1)', borderRadius: borderRadius.sm, borderWidth: 1, borderColor: 'rgba(34, 211, 238, 0.3)' },
    analyzeButtonText: { ...typography.caption, color: colors.accent, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { height: '80%', padding: spacing.lg },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
    modalTitle: { ...typography.h2, color: colors.textPrimary },
    modalBody: { flex: 1 },
    summaryCard: { backgroundColor: colors.backgroundCard, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg },
    summaryTitle: { ...typography.h4, color: colors.accent, marginBottom: spacing.xs },
    summaryText: { ...typography.body, color: colors.textPrimary },
    sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
    analysisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    analysisInfo: { flex: 1, paddingRight: spacing.md },
    analysisValue: { alignItems: 'flex-end', minWidth: 80 },
    insightText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
    flagText: { ...typography.label, marginTop: spacing.xs },
    pickerContainer: { marginBottom: spacing.lg },
    label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
    chipContainer: { flexDirection: 'row', gap: spacing.sm },
    chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
    activeChip: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { ...typography.caption, color: colors.textSecondary },
    activeChipText: { color: colors.background, fontWeight: 'bold' },
    chartContainer: { alignItems: 'center', marginBottom: spacing.lg },
    noDataContainer: { padding: spacing.xl, alignItems: 'center' },
    noDataText: { ...typography.body, color: colors.textMuted, fontStyle: 'italic' },
    historyList: { marginTop: spacing.md },
    historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    historyDate: { ...typography.body, color: colors.textSecondary },
    historyValue: { ...typography.h4, color: colors.primary },
});
