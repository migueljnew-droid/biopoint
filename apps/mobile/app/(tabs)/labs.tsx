import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, RefreshControl, Alert, ActivityIndicator, ScrollView, Modal, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, SlideInDown, SlideOutDown, LinearTransition } from 'react-native-reanimated';
import { LineChart } from 'react-native-chart-kit';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { ScreenWrapper, GlassView } from '../../src/components';
import { labsService, AnalysisResult } from '../../src/services/labs';
import { api } from '../../src/services/api';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface LabMarker {
    id: string;
    name: string;
    value: number | null;
    unit: string;
    refRangeLow: number | null;
    refRangeHigh: number | null;
    isInRange: boolean | null;
    notes: string | null;
}

interface LabReport {
    id: string;
    filename: string;
    uploadedAt: string;
    markers: LabMarker[];
}

interface TrendHistory {
    id: string;
    value: number | null;
    date: string;
    refLow: number | null;
    refHigh: number | null;
}

interface BiomarkerTrend {
    name: string;
    unit: string;
    history: TrendHistory[];
}

type TabMode = 'reports' | 'trends';

export default function LabsScreen() {
    const [labs, setLabs] = useState<LabReport[]>([]);
    const [trends, setTrends] = useState<BiomarkerTrend[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<TabMode>('reports');
    const [expandedTrend, setExpandedTrend] = useState<string | null>(null);
    const [lastUpload, setLastUpload] = useState<{ reportId: string; uri: string; mimeType: string } | null>(null);

    const fetchLabs = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/labs');
            setLabs(response.data);
        } catch (e: any) {
            // Empty state is fine for new users
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchTrends = useCallback(async () => {
        try {
            const data = await labsService.getTrends();
            setTrends(data);
        } catch (e: any) {
            // Trends may be empty
        }
    }, []);

    useEffect(() => {
        fetchLabs();
        fetchTrends();
    }, []);

    const handleRefresh = () => {
        fetchLabs();
        fetchTrends();
    };

    const processUpload = async (uri: string, name: string, mimeType: string) => {
        setIsLoading(true);
        try {
            const { uploadUrl, s3Key } = await labsService.getPresignedUrl(name, mimeType);
            await labsService.uploadFile(uri, uploadUrl, mimeType);
            const report = await labsService.createReport({ filename: name, s3Key, notes: 'Uploaded from mobile app' });
            setLastUpload({ reportId: report.id, uri, mimeType });
            Alert.alert('Success', 'Lab report uploaded! Tap Analyze to extract biomarkers.');
            fetchLabs();
            fetchTrends();
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

    const handleDelete = (id: string) => {
        Alert.alert('Delete Report', 'Are you sure you want to delete this lab report?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await api.delete(`/labs/${id}`);
                        fetchLabs();
                        fetchTrends();
                    } catch {
                        Alert.alert('Error', 'Failed to delete report');
                    }
                }
            },
        ]);
    };

    const handleAnalyze = async (id: string) => {
        setAnalyzingId(id);
        try {
            // Send image directly from device if we have it (bypasses R2 download)
            const upload = lastUpload?.reportId === id ? lastUpload : null;
            const result = await labsService.analyzeReport(id, upload?.uri, upload?.mimeType);
            setAnalysisResult(result);
            setModalVisible(true);
            fetchLabs();
            fetchTrends();
        } catch (e: any) {
            Alert.alert('Analysis Failed', e.response?.data?.message || 'Could not analyze this report. Try again.');
        } finally {
            setAnalyzingId(null);
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    const formatFullDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getLatestValue = (trend: BiomarkerTrend) => {
        const valid = trend.history.filter(h => h.value !== null);
        return valid.length > 0 ? valid[valid.length - 1] : null;
    };

    const getTrendDirection = (trend: BiomarkerTrend): 'up' | 'down' | 'stable' => {
        const valid = trend.history.filter(h => h.value !== null);
        if (valid.length < 2) return 'stable';
        const last = valid[valid.length - 1]!.value!;
        const prev = valid[valid.length - 2]!.value!;
        const change = ((last - prev) / prev) * 100;
        if (Math.abs(change) < 2) return 'stable';
        return change > 0 ? 'up' : 'down';
    };

    const isInRange = (value: number | null, refLow: number | null, refHigh: number | null): boolean | null => {
        if (value === null || refLow === null || refHigh === null) return null;
        return value >= refLow && value <= refHigh;
    };

    const renderTrendChart = (trend: BiomarkerTrend) => {
        const validHistory = trend.history.filter(h => h.value !== null);
        if (validHistory.length < 2) return null;

        const labels = validHistory.map(h => formatDate(h.date));
        const data = validHistory.map(h => h.value!);
        const chartWidth = Math.max(SCREEN_WIDTH - 64, validHistory.length * 60);

        // Reference range band
        const hasRefRange = validHistory[0]?.refLow !== null && validHistory[0]?.refHigh !== null;

        return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
                <LineChart
                    data={{
                        labels,
                        datasets: [
                            { data, color: () => colors.accent, strokeWidth: 2 },
                            ...(hasRefRange ? [
                                { data: validHistory.map(h => h.refHigh!), color: () => 'rgba(22, 163, 74, 0.3)', strokeWidth: 1, withDots: false },
                                { data: validHistory.map(h => h.refLow!), color: () => 'rgba(22, 163, 74, 0.3)', strokeWidth: 1, withDots: false },
                            ] as any : []),
                        ],
                    }}
                    width={chartWidth}
                    height={180}
                    chartConfig={{
                        backgroundColor: 'transparent',
                        backgroundGradientFrom: colors.backgroundCard,
                        backgroundGradientTo: colors.backgroundCard,
                        decimalPlaces: 1,
                        color: (opacity = 1) => `rgba(13, 148, 136, ${opacity})`,
                        labelColor: () => colors.textMuted,
                        propsForDots: {
                            r: '4',
                            strokeWidth: '2',
                            stroke: colors.accent,
                            fill: colors.backgroundCard,
                        },
                        propsForBackgroundLines: {
                            strokeDasharray: '4,8',
                            stroke: 'rgba(255,255,255,0.05)',
                        },
                        style: { borderRadius: 12 },
                    }}
                    bezier
                    style={{ borderRadius: 12, marginVertical: 4 }}
                    withInnerLines={true}
                    withOuterLines={false}
                    fromZero={false}
                />
            </ScrollView>
        );
    };

    const renderTrendsTab = () => {
        if (trends.length === 0) {
            return (
                <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                        <Ionicons name="trending-up-outline" size={48} color={colors.textMuted} />
                    </View>
                    <Text style={styles.emptyText}>No biomarker history yet</Text>
                    <Text style={styles.emptySubtext}>Upload and analyze lab reports to see trends over time</Text>
                </View>
            );
        }

        return (
            <View style={styles.trendsContainer}>
                {/* Summary Cards */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRow}>
                    <GlassView variant="medium" borderRadius={borderRadius.md} style={styles.summaryCard}>
                        <Ionicons name="flask" size={20} color={colors.accent} />
                        <Text style={styles.summaryValue}>{trends.length}</Text>
                        <Text style={styles.summaryLabel}>Biomarkers</Text>
                    </GlassView>
                    <GlassView variant="medium" borderRadius={borderRadius.md} style={styles.summaryCard}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        <Text style={styles.summaryValue}>
                            {trends.filter(t => {
                                const latest = getLatestValue(t);
                                return latest && isInRange(latest.value, latest.refLow, latest.refHigh) === true;
                            }).length}
                        </Text>
                        <Text style={styles.summaryLabel}>In Range</Text>
                    </GlassView>
                    <GlassView variant="medium" borderRadius={borderRadius.md} style={styles.summaryCard}>
                        <Ionicons name="alert-circle" size={20} color={colors.error} />
                        <Text style={styles.summaryValue}>
                            {trends.filter(t => {
                                const latest = getLatestValue(t);
                                return latest && isInRange(latest.value, latest.refLow, latest.refHigh) === false;
                            }).length}
                        </Text>
                        <Text style={styles.summaryLabel}>Out of Range</Text>
                    </GlassView>
                    <GlassView variant="medium" borderRadius={borderRadius.md} style={styles.summaryCard}>
                        <Ionicons name="document-text" size={20} color={colors.primary} />
                        <Text style={styles.summaryValue}>{labs.length}</Text>
                        <Text style={styles.summaryLabel}>Reports</Text>
                    </GlassView>
                </ScrollView>

                {/* Biomarker Trend Cards */}
                {trends.map((trend, index) => {
                    const latest = getLatestValue(trend);
                    const direction = getTrendDirection(trend);
                    const inRangeStatus = latest ? isInRange(latest.value, latest.refLow, latest.refHigh) : null;
                    const statusColor = inRangeStatus === null ? colors.textMuted : inRangeStatus ? colors.success : colors.error;
                    const isExpanded = expandedTrend === trend.name;
                    const validCount = trend.history.filter(h => h.value !== null).length;

                    return (
                        <Animated.View key={trend.name} entering={FadeInDown.delay(index * 60)}>
                            <Pressable onPress={() => setExpandedTrend(isExpanded ? null : trend.name)}>
                                <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.trendCard}>
                                    {/* Header row */}
                                    <View style={styles.trendHeader}>
                                        <View style={[styles.trendIndicator, { backgroundColor: statusColor }]} />
                                        <View style={styles.trendInfo}>
                                            <Text style={styles.trendName}>{trend.name}</Text>
                                            {latest && latest.refLow !== null && latest.refHigh !== null && (
                                                <Text style={styles.trendRange}>
                                                    Ref: {latest.refLow} - {latest.refHigh} {trend.unit}
                                                </Text>
                                            )}
                                        </View>

                                        {/* Current value */}
                                        <View style={styles.trendValueCol}>
                                            <View style={styles.trendValueRow}>
                                                <Text style={[styles.trendValue, { color: statusColor }]}>
                                                    {latest?.value ?? '—'}
                                                </Text>
                                                <Text style={styles.trendUnit}>{trend.unit}</Text>
                                            </View>
                                            <View style={styles.trendDirectionRow}>
                                                <Ionicons
                                                    name={direction === 'up' ? 'caret-up' : direction === 'down' ? 'caret-down' : 'remove'}
                                                    size={12}
                                                    color={direction === 'stable' ? colors.textMuted : direction === 'up' ? colors.accent : colors.error}
                                                />
                                                <Text style={styles.trendCount}>{validCount} readings</Text>
                                            </View>
                                        </View>

                                        <Ionicons
                                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                            size={18}
                                            color={colors.textMuted}
                                        />
                                    </View>

                                    {/* Expanded chart */}
                                    {isExpanded && (
                                        <Animated.View entering={FadeInDown.duration(200)}>
                                            {renderTrendChart(trend)}

                                            {/* History table */}
                                            <View style={styles.historyTable}>
                                                <View style={styles.historyHeader}>
                                                    <Text style={[styles.historyHeaderText, { flex: 1 }]}>Date</Text>
                                                    <Text style={[styles.historyHeaderText, { width: 80, textAlign: 'right' }]}>Value</Text>
                                                    <Text style={[styles.historyHeaderText, { width: 60, textAlign: 'center' }]}>Status</Text>
                                                </View>
                                                {[...trend.history].reverse().filter(h => h.value !== null).map((h, i) => {
                                                    const rowInRange = isInRange(h.value, h.refLow, h.refHigh);
                                                    const rowColor = rowInRange === null ? colors.textMuted : rowInRange ? colors.success : colors.error;
                                                    return (
                                                        <View key={h.id || i} style={styles.historyRow}>
                                                            <Text style={[styles.historyDate, { flex: 1 }]}>{formatFullDate(h.date)}</Text>
                                                            <Text style={[styles.historyValue, { width: 80, textAlign: 'right', color: rowColor }]}>
                                                                {h.value} {trend.unit}
                                                            </Text>
                                                            <View style={{ width: 60, alignItems: 'center' }}>
                                                                {rowInRange !== null && (
                                                                    <Ionicons
                                                                        name={rowInRange ? 'checkmark-circle' : 'alert-circle'}
                                                                        size={16}
                                                                        color={rowColor}
                                                                    />
                                                                )}
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </Animated.View>
                                    )}
                                </GlassView>
                            </Pressable>
                        </Animated.View>
                    );
                })}
            </View>
        );
    };

    return (
        <ScreenWrapper>
            <Animated.ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={colors.primary} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Lab Reports</Text>
                    <Pressable style={styles.uploadButton} onPress={handleUpload}>
                        <Ionicons name="cloud-upload" size={20} color="#fff" />
                        <Text style={styles.uploadText}>Upload</Text>
                    </Pressable>
                </View>

                {/* Tab Switcher */}
                <View style={styles.tabRow}>
                    <Pressable
                        style={[styles.tab, activeTab === 'reports' && styles.tabActive]}
                        onPress={() => setActiveTab('reports')}
                    >
                        <Ionicons name="document-text-outline" size={16} color={activeTab === 'reports' ? colors.accent : colors.textMuted} />
                        <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>Reports</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.tab, activeTab === 'trends' && styles.tabActive]}
                        onPress={() => setActiveTab('trends')}
                    >
                        <Ionicons name="trending-up-outline" size={16} color={activeTab === 'trends' ? colors.accent : colors.textMuted} />
                        <Text style={[styles.tabText, activeTab === 'trends' && styles.tabTextActive]}>Trends</Text>
                        {trends.length > 0 && (
                            <View style={styles.tabBadge}>
                                <Text style={styles.tabBadgeText}>{trends.length}</Text>
                            </View>
                        )}
                    </Pressable>
                </View>

                {/* Reports Tab */}
                {activeTab === 'reports' && (
                    <>
                        {labs.length === 0 && !isLoading && (
                            <View style={styles.emptyState}>
                                <View style={styles.emptyIcon}>
                                    <Ionicons name="flask-outline" size={48} color={colors.textMuted} />
                                </View>
                                <Text style={styles.emptyText}>No lab reports yet</Text>
                                <Text style={styles.emptySubtext}>Upload your bloodwork to track biomarkers over time</Text>
                                <Pressable style={styles.emptyUploadButton} onPress={handleUpload}>
                                    <Ionicons name="add-circle" size={20} color="#fff" />
                                    <Text style={styles.emptyUploadText}>Upload Your First Report</Text>
                                </Pressable>
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

                                    {expandedId === lab.id && (
                                        <Animated.View entering={FadeInDown} style={styles.markersList}>
                                            {lab.markers.length > 0 ? lab.markers.map((marker) => {
                                                const statusColor = marker.isInRange === null ? colors.textMuted : marker.isInRange ? colors.success : colors.error;
                                                const statusLabel = marker.isInRange === null ? '' : marker.isInRange ? 'IN RANGE' : 'OUT OF RANGE';
                                                return (
                                                    <View key={marker.id} style={{ paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <Text style={styles.markerName} numberOfLines={1}>{marker.name}</Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                                                <Text style={{ fontSize: 18, fontWeight: '700', color: statusColor }}>
                                                                    {marker.value ?? '—'}
                                                                </Text>
                                                                <Text style={{ fontSize: 12, color: colors.textMuted }}>{marker.unit}</Text>
                                                            </View>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                                                            {marker.refRangeLow !== null && marker.refRangeHigh !== null ? (
                                                                <Text style={{ ...typography.caption, color: colors.textMuted }}>
                                                                    Ref: {marker.refRangeLow} - {marker.refRangeHigh} {marker.unit}
                                                                </Text>
                                                            ) : <View />}
                                                            {statusLabel ? (
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                    <Ionicons name={marker.isInRange ? 'checkmark-circle' : 'alert-circle'} size={14} color={statusColor} />
                                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
                                                                </View>
                                                            ) : null}
                                                        </View>
                                                    </View>
                                                );
                                            }) : (
                                                <Text style={{ color: colors.textMuted, ...typography.caption, textAlign: 'center', paddingVertical: spacing.sm }}>No markers yet — tap Analyze to extract biomarkers</Text>
                                            )}
                                            <Pressable
                                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm, marginTop: spacing.xs }}
                                                onPress={() => handleDelete(lab.id)}
                                            >
                                                <Ionicons name="trash-outline" size={16} color={colors.error} />
                                                <Text style={{ color: colors.error, ...typography.caption, fontWeight: '600' }}>Delete Report</Text>
                                            </Pressable>
                                        </Animated.View>
                                    )}
                                </GlassView>
                            </Animated.View>
                        ))}
                    </>
                )}

                {/* Trends Tab */}
                {activeTab === 'trends' && renderTrendsTab()}

                {/* Bottom spacer for tab bar */}
                <View style={{ height: 100 }} />
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
                                        <View style={styles.summaryCardModal}>
                                            <Text style={styles.summaryTitleModal}>Summary</Text>
                                            <Text style={styles.summaryTextModal}>{analysisResult.summary}</Text>
                                        </View>
                                        <Text style={styles.sectionTitle}>Detected Markers</Text>
                                        {analysisResult.markers.map((marker, i) => {
                                            const flagColor = marker.flag === 'NORMAL' ? colors.success : marker.flag === 'HIGH' ? colors.error : '#F59E0B';
                                            return (
                                                <View key={i} style={styles.analysisRow}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Text style={styles.markerName} numberOfLines={1}>{marker.name}</Text>
                                                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                                            <Text style={{ fontSize: 18, fontWeight: '700', color: flagColor }}>{marker.value}</Text>
                                                            <Text style={{ fontSize: 12, color: colors.textMuted }}>{marker.unit}</Text>
                                                            <View style={{ backgroundColor: flagColor + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4 }}>
                                                                <Text style={{ fontSize: 10, fontWeight: '700', color: flagColor }}>{marker.flag}</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                    <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 2 }}>Ref: {marker.range}</Text>
                                                    <Text style={styles.insightText}>{marker.insight}</Text>
                                                </View>
                                            );
                                        })}
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
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    title: { ...typography.h2, color: colors.textPrimary },
    uploadButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
    uploadText: { ...typography.label, color: '#fff' },

    // Tab switcher
    tabRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: borderRadius.md,
        padding: 3,
        marginBottom: spacing.lg,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: borderRadius.sm,
    },
    tabActive: {
        backgroundColor: 'rgba(13, 148, 136, 0.15)',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textMuted,
    },
    tabTextActive: {
        color: colors.accent,
    },
    tabBadge: {
        backgroundColor: colors.accent,
        borderRadius: 8,
        paddingHorizontal: 5,
        paddingVertical: 1,
        minWidth: 18,
        alignItems: 'center',
    },
    tabBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },

    // Empty state
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
    emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(99,102,241,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
    emptyText: { ...typography.h4, color: colors.textSecondary, marginTop: spacing.sm },
    emptySubtext: { ...typography.body, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.xl },
    emptyUploadButton: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12,
        borderRadius: borderRadius.md, marginTop: spacing.lg,
    },
    emptyUploadText: { color: '#fff', fontWeight: '600', fontSize: 14 },

    // Lab report cards
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

    // Trends tab
    trendsContainer: { gap: spacing.md },
    summaryRow: { gap: spacing.sm, paddingBottom: spacing.sm },
    summaryCard: {
        width: 90, height: 90,
        alignItems: 'center', justifyContent: 'center',
        gap: 4, padding: spacing.sm,
    },
    summaryValue: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
    summaryLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },

    // Trend cards
    trendCard: { padding: spacing.md },
    trendHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    trendIndicator: { width: 4, height: 32, borderRadius: 2 },
    trendInfo: { flex: 1 },
    trendName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    trendRange: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    trendValueCol: { alignItems: 'flex-end', marginRight: 4 },
    trendValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    trendValue: { fontSize: 20, fontWeight: '800' },
    trendUnit: { fontSize: 11, color: colors.textMuted },
    trendDirectionRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    trendCount: { fontSize: 10, color: colors.textMuted },

    // Chart
    chartScroll: { marginTop: spacing.md },

    // History table
    historyTable: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: spacing.sm },
    historyHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    historyHeaderText: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
    historyDate: { fontSize: 13, color: colors.textSecondary },
    historyValue: { fontSize: 13, fontWeight: '600' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { height: '80%', padding: spacing.lg },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
    modalTitle: { ...typography.h2, color: colors.textPrimary },
    modalBody: { flex: 1 },
    summaryCardModal: { backgroundColor: 'rgba(99,102,241,0.08)', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg },
    summaryTitleModal: { ...typography.h4, color: colors.primary, marginBottom: spacing.xs },
    summaryTextModal: { ...typography.body, color: colors.textPrimary },
    sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
    analysisRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    analysisInfo: { flex: 1, paddingRight: spacing.md },
    insightText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
    flagText: { ...typography.label, marginTop: spacing.xs },
});
