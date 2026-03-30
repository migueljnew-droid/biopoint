import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { ScreenWrapper, GlassView, Button } from '../../src/components';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../src/services/api';

interface ExportOption {
    id: string;
    name: string;
    description: string;
    available: boolean;
    recordCount: number;
}

interface ExportOptions {
    formats: string[];
    categories: ExportOption[];
    gdprNotice: string;
}

export default function DataExportScreen() {
    const [exportOptions, setExportOptions] = useState<ExportOptions | null>(null);
    const [selectedFormat, setSelectedFormat] = useState<'json' | 'csv' | 'xml' | 'pdf'>('json');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        loadExportOptions();
    }, []);

    const loadExportOptions = async () => {
        try {
            const options = await apiService.get<ExportOptions>('/user/export/options');
            setExportOptions(options);
            // Select all available categories by default
            const availableCategories = options.categories.filter(cat => cat.available).map(cat => cat.id);
            setSelectedCategories(availableCategories);
        } catch (error) {
            console.error('Failed to load export options:', error);
            Alert.alert('Error', 'Failed to load export options');
        } finally {
            setLoading(false);
        }
    };

    const toggleCategory = (categoryId: string) => {
        setSelectedCategories(prev => 
            prev.includes(categoryId) 
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    const handleExport = async () => {
        if (selectedCategories.length === 0) {
            Alert.alert('Error', 'Please select at least one data category to export');
            return;
        }

        setExporting(true);
        try {
            // Build export parameters
            const params = new URLSearchParams();
            params.append('format', selectedFormat);
            
            // Add category parameters
            exportOptions?.categories.forEach(category => {
                const isSelected = selectedCategories.includes(category.id);
                const paramName = `include${category.id.charAt(0).toUpperCase() + category.id.slice(1)}`;
                params.append(paramName, isSelected.toString());
            });

            // For PDF format, we need to handle the response differently
            if (selectedFormat === 'pdf') {
                const response = await apiService.getBlob(`/user/export?${params.toString()}`);
                
                // Create a download link for the PDF
                const blob = new Blob([response], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `biopoint-data-export-${new Date().toISOString().split('T')[0]}.pdf`;
                link.click();
                URL.revokeObjectURL(url);
            } else {
                const data = await apiService.get(`/user/export?${params.toString()}`);
                
                // Create download link for JSON/XML/CSV
                const contentType = {
                    json: 'application/json',
                    csv: 'text/csv',
                    xml: 'application/xml',
                }[selectedFormat];
                
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: contentType });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `biopoint-data-export-${new Date().toISOString().split('T')[0]}.${selectedFormat}`;
                link.click();
                URL.revokeObjectURL(url);
            }

            Alert.alert('Success', 'Your data has been exported successfully');
            
            // Navigate back to settings
            router.back();
        } catch (error) {
            console.error('Export failed:', error);
            Alert.alert('Export Failed', 'Failed to export your data. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <ScreenWrapper withGradient={true}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading export options...</Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper withGradient={true}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <GlassView variant="light" borderRadius={borderRadius.full} style={styles.iconButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </GlassView>
                </Pressable>
                <Text style={styles.title}>Data Export</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.card}>
                    <Text style={styles.sectionTitle}>Export Format</Text>
                    <View style={styles.formatContainer}>
                        {exportOptions?.formats.map(format => (
                            <Pressable
                                key={format}
                                style={[
                                    styles.formatButton,
                                    selectedFormat === format && styles.formatButtonSelected
                                ]}
                                onPress={() => setSelectedFormat(format as any)}
                            >
                                <Text style={[
                                    styles.formatButtonText,
                                    selectedFormat === format && styles.formatButtonTextSelected
                                ]}>
                                    {format.toUpperCase()}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </GlassView>

                <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.card}>
                    <Text style={styles.sectionTitle}>Data Categories</Text>
                    <Text style={styles.sectionSubtitle}>Select the types of data you want to export</Text>
                    
                    {exportOptions?.categories.map(category => (
                        <View key={category.id} style={styles.categoryItem}>
                            <View style={styles.categoryInfo}>
                                <Text style={styles.categoryName}>{category.name}</Text>
                                <Text style={styles.categoryDescription}>{category.description}</Text>
                                <Text style={styles.categoryCount}>
                                    {category.recordCount} {category.recordCount === 1 ? 'record' : 'records'}
                                </Text>
                            </View>
                            <Switch
                                value={selectedCategories.includes(category.id)}
                                onValueChange={() => toggleCategory(category.id)}
                                disabled={!category.available}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor={selectedCategories.includes(category.id) ? colors.primary : colors.surface}
                            />
                        </View>
                    ))}
                </GlassView>

                <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.noticeCard}>
                    <Ionicons name="information-circle" size={24} color={colors.primary} style={styles.noticeIcon} />
                    <Text style={styles.noticeText}>
                        {exportOptions?.gdprNotice}
                    </Text>
                </GlassView>

                <Button
                    title={exporting ? "Exporting..." : "Export My Data"}
                    onPress={handleExport}
                    disabled={exporting || selectedCategories.length === 0}
                    variant="primary"
                    size="large"
                    icon={exporting ? undefined : "download"}
                />
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    iconButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    content: {
        padding: spacing.lg,
    },
    card: {
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    noticeCard: {
        padding: spacing.lg,
        marginBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: spacing.sm,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    formatContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    formatButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 0,
        borderColor: 'transparent',
        backgroundColor: colors.surface,
    },
    formatButtonSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + '20',
    },
    formatButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    formatButtonTextSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
    categoryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderBottomWidth: 0,
        borderBottomColor: 'transparent',
    },
    categoryInfo: {
        flex: 1,
        marginRight: spacing.md,
    },
    categoryName: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    categoryDescription: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    categoryCount: {
        fontSize: 12,
        color: colors.textTertiary,
    },
    noticeIcon: {
        marginRight: spacing.sm,
    },
    noticeText: {
        flex: 1,
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: 16,
        color: colors.textSecondary,
    },
});