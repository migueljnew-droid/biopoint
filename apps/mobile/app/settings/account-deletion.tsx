import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, TextInput } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { ScreenWrapper, GlassView, AnimatedButton } from '../../src/components';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../src/services/api';

interface DeletionStatus {
    hasPendingDeletion: boolean;
    status: string | null;
    requestedAt: string | null;
    scheduledFor: string | null;
    reason: string | null;
    completedAt: string | null;
}

interface DataRetentionPolicy {
    policy: {
        inactiveAccountDeletion: string;
        medicalRecordRetention: string;
        marketingDataRetention: string;
        analyticsDataRetention: string;
        logDataRetention: string;
        backupDataRetention: string;
    };
    userData: {
        accountCreated: string;
        lastUpdated: string;
        scheduledDeletionDate: string;
        yearsUntilDeletion: number;
    };
}

export default function AccountDeletionScreen() {
    const [deletionStatus, setDeletionStatus] = useState<DeletionStatus | null>(null);
    const [retentionPolicy, setRetentionPolicy] = useState<DataRetentionPolicy | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [email, setEmail] = useState('');
    const [reason, setReason] = useState('');
    const [immediateEffect, setImmediateEffect] = useState(false);
    const [understandConsequences, setUnderstandConsequences] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [status, policy] = await Promise.all([
                apiService.get<DeletionStatus>('/user/delete-account/status').catch(() => ({
                    hasPendingDeletion: false, status: null, requestedAt: null,
                    scheduledFor: null, reason: null, completedAt: null,
                })),
                apiService.get<DataRetentionPolicy>('/user/data-retention-policy').catch(() => null),
            ]);
            setDeletionStatus(status);
            if (policy) setRetentionPolicy(policy);
        } catch (error) {
            console.log('Failed to load deletion data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        if (!understandConsequences) {
            Alert.alert('Error', 'Please confirm that you understand the consequences of account deletion');
            return;
        }

        // Show confirmation dialog
        Alert.alert(
            'Confirm Account Deletion',
            immediateEffect 
                ? 'This will immediately disable your account and schedule complete deletion in 30 days. You will not be able to log in during this period. Are you absolutely sure?'
                : 'This will schedule your account for deletion in 30 days. You can cancel this request until then. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Delete Account', 
                    style: 'destructive',
                    onPress: proceedWithDeletion
                }
            ]
        );
    };

    const proceedWithDeletion = async () => {
        setDeleting(true);
        try {
            const response = await apiService.post<{ message: string }>('/user/delete-account', {
                confirmationEmail: email.trim(),
                reason: reason.trim() || undefined,
                immediateEffect,
            });

            Alert.alert(
                'Account Deletion Requested',
                response.message || 'Your account deletion has been scheduled.',
                [
                    { 
                        text: 'OK', 
                        onPress: () => {
                            if (immediateEffect) {
                                // User will be logged out, navigate to login
                                router.replace('/login');
                            } else {
                                // Reload data to show updated status
                                loadData();
                            }
                        }
                    }
                ]
            );
        } catch (error: any) {
            console.error('Account deletion failed:', error);
            Alert.alert(
                'Deletion Failed', 
                error.response?.data?.message || 'Failed to request account deletion. Please try again.'
            );
        } finally {
            setDeleting(false);
        }
    };

    const handleCancelDeletion = async () => {
        if (!deletionStatus?.hasPendingDeletion || !deletionStatus?.status) {
            return;
        }

        Alert.alert(
            'Cancel Account Deletion',
            'Are you sure you want to cancel your account deletion request?',
            [
                { text: 'No', style: 'cancel' },
                { 
                    text: 'Yes, Cancel', 
                    style: 'default',
                    onPress: async () => {
                        try {
                            await apiService.delete(`/user/delete-account/${deletionStatus.status}`);
                            Alert.alert('Success', 'Account deletion request cancelled successfully');
                            loadData();
                        } catch (error) {
                            console.error('Failed to cancel deletion:', error);
                            Alert.alert('Error', 'Failed to cancel deletion request');
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <ScreenWrapper withGradient={true}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading account information...</Text>
                </View>
            </ScreenWrapper>
        );
    }

    if (deletionStatus?.hasPendingDeletion) {
        return (
            <ScreenWrapper withGradient={true}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <GlassView variant="light" borderRadius={borderRadius.full} style={styles.iconButton}>
                            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                        </GlassView>
                    </Pressable>
                    <Text style={styles.title}>Account Deletion</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <GlassView variant="warning" borderRadius={borderRadius.lg} style={styles.warningCard}>
                        <Ionicons name="warning" size={24} color={colors.warning} style={styles.warningIcon} />
                        <View style={styles.warningContent}>
                            <Text style={styles.warningTitle}>Account Deletion Pending</Text>
                            <Text style={styles.warningText}>
                                Your account is scheduled for deletion on {new Date(deletionStatus.scheduledFor!).toLocaleDateString()}
                            </Text>
                        </View>
                    </GlassView>

                    <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.card}>
                        <Text style={styles.sectionTitle}>Deletion Details</Text>
                        
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Requested:</Text>
                            <Text style={styles.detailValue}>
                                {new Date(deletionStatus.requestedAt!).toLocaleDateString()}
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Scheduled Deletion:</Text>
                            <Text style={styles.detailValue}>
                                {new Date(deletionStatus.scheduledFor!).toLocaleDateString()}
                            </Text>
                        </View>

                        {deletionStatus.reason && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Reason:</Text>
                                <Text style={styles.detailValue}>{deletionStatus.reason}</Text>
                            </View>
                        )}
                    </GlassView>

                    <View style={styles.buttonContainer}>
                        <AnimatedButton
                            title="Cancel Deletion Request"
                            onPress={handleCancelDeletion}
                            variant="primary"
                        />

                        <AnimatedButton
                            title="Back to Settings"
                            onPress={() => router.back()}
                            variant="primary"
                        />
                    </View>
                </ScrollView>
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
                <Text style={styles.title}>Delete Account</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <GlassView variant="error" borderRadius={borderRadius.lg} style={styles.warningCard}>
                    <Ionicons name="alert-circle" size={24} color={colors.error} style={styles.warningIcon} />
                    <View style={styles.warningContent}>
                        <Text style={styles.warningTitle}>Irreversible Action</Text>
                        <Text style={styles.warningText}>
                            This action cannot be undone. All your data will be permanently deleted after 30 days.
                        </Text>
                    </View>
                </GlassView>

                <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.card}>
                    <Text style={styles.sectionTitle}>What Will Be Deleted</Text>
                    
                    <View style={styles.dataList}>
                        <Text style={styles.dataItem}>• Profile information and settings</Text>
                        <Text style={styles.dataItem}>• Lab reports and biomarker data</Text>
                        <Text style={styles.dataItem}>• Progress photos</Text>
                        <Text style={styles.dataItem}>• Daily logs and tracking data</Text>
                        <Text style={styles.dataItem}>• Supplement and peptide stacks</Text>
                        <Text style={styles.dataItem}>• Community posts and interactions</Text>
                    </View>
                </GlassView>

                <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.card}>
                    <Text style={styles.sectionTitle}>Data Retention Policy</Text>
                    
                    <View style={styles.policyItem}>
                        <Text style={styles.policyLabel}>Account Deletion:</Text>
                        <Text style={styles.policyValue}>30-day grace period</Text>
                    </View>
                    
                    <View style={styles.policyItem}>
                        <Text style={styles.policyLabel}>Medical Records:</Text>
                        <Text style={styles.policyValue}>7 years (legal requirement)</Text>
                    </View>
                    
                    <View style={styles.policyItem}>
                        <Text style={styles.policyLabel}>Inactive Accounts:</Text>
                        <Text style={styles.policyValue}>Auto-delete after 7 years</Text>
                    </View>
                    
                    <View style={styles.policyItem}>
                        <Text style={styles.policyLabel}>Your Account:</Text>
                        <Text style={styles.policyValue}>
                            {retentionPolicy?.userData.yearsUntilDeletion} years until auto-deletion
                        </Text>
                    </View>
                </GlassView>

                <GlassView variant="medium" borderRadius={borderRadius.lg} style={styles.card}>
                    <Text style={styles.sectionTitle}>Confirmation Required</Text>
                    
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Email Address *</Text>
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Enter your email address"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Reason (Optional)</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={reason}
                            onChangeText={setReason}
                            placeholder="Tell us why you're leaving (optional)"
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    <View style={styles.checkboxContainer}>
                        <Pressable
                            style={[styles.checkbox, understandConsequences && styles.checkboxChecked]}
                            onPress={() => setUnderstandConsequences(!understandConsequences)}
                        >
                            {understandConsequences && (
                                <Ionicons name="checkmark" size={16} color={'#fff'} />
                            )}
                        </Pressable>
                        <Text style={styles.checkboxLabel}>
                            I understand that this action is permanent and cannot be undone
                        </Text>
                    </View>

                    <View style={styles.checkboxContainer}>
                        <Pressable
                            style={[styles.checkbox, immediateEffect && styles.checkboxChecked]}
                            onPress={() => setImmediateEffect(!immediateEffect)}
                        >
                            {immediateEffect && (
                                <Ionicons name="checkmark" size={16} color={'#fff'} />
                            )}
                        </Pressable>
                        <Text style={styles.checkboxLabel}>
                            Disable my account immediately (I won't be able to log in until deletion)
                        </Text>
                    </View>
                </GlassView>

                <AnimatedButton
                    title={deleting ? "Processing..." : "Delete My Account"}
                    onPress={handleDeleteAccount}
                    disabled={deleting || !understandConsequences || !email.trim()}
                    variant="primary"
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
    warningCard: {
        padding: spacing.lg,
        marginBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    warningContent: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    warningTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.error,
        marginBottom: 4,
    },
    warningText: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    warningIcon: {
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: spacing.md,
    },
    dataList: {
        marginBottom: spacing.sm,
    },
    dataItem: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        lineHeight: 20,
    },
    policyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    policyLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        flex: 1,
    },
    policyValue: {
        fontSize: 14,
        color: colors.textPrimary,
        fontWeight: '500',
        flex: 1,
        textAlign: 'right',
    },
    inputContainer: {
        marginBottom: spacing.md,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    input: {
        borderWidth: 0,
        borderColor: 'transparent',
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        fontSize: 16,
        color: colors.textPrimary,
        backgroundColor: '#fff',
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.sm,
        marginRight: spacing.sm,
        marginTop: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    checkboxLabel: {
        flex: 1,
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    buttonContainer: {
        gap: spacing.md,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    detailLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    detailValue: {
        fontSize: 14,
        color: colors.textPrimary,
        fontWeight: '500',
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