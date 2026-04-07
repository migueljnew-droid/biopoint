import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, KeyboardAvoidingView, Platform, Pressable, Modal, ScrollView, Linking } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, borderRadius } from '../src/theme';
import { ScreenWrapper, GlassView } from '../src/components';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore, Message } from '../src/store/chatStore';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import Markdown from 'react-native-markdown-display';
import * as Haptics from 'expo-haptics';

export default function OracleScreen() {
    const { messages, isTyping, addMessage, generateResponse, clearHistory, aiConsentGiven, giveAiConsent } = useChatStore();
    const [inputValue, setInputValue] = useState('');
    const flatListRef = useRef<FlatList>(null);

    const handleConsent = () => {
        giveAiConsent();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const handleSend = () => {
        if (!inputValue.trim()) return;

        Haptics.selectionAsync();
        const text = inputValue.trim();
        setInputValue('');

        // Add user message
        addMessage('user', text);

        // Trigger AI
        generateResponse(text);
    };

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isUser = item.role === 'user';

        return (
            <Animated.View
                entering={FadeInUp.delay(index * 50)}
                style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.botBubble
                ]}
            >
                {!isUser && (
                    <View style={styles.botIcon}>
                        <Ionicons name="sparkles" size={14} color="#fff" />
                    </View>
                )}
                <View style={[styles.messageContent, isUser ? styles.userContent : styles.botContent]}>
                    {isUser ? (
                        <Text style={styles.userText}>{item.content}</Text>
                    ) : (
                        <Markdown style={markdownStyles}>
                            {item.content}
                        </Markdown>
                    )}
                </View>
            </Animated.View>
        );
    };

    return (
        <ScreenWrapper withGradient={true} edges={['top', 'left', 'right']}>
            {/* AI Data Consent Modal — shown before first use */}
            <Modal visible={!aiConsentGiven} animationType="fade" transparent>
                <View style={styles.consentOverlay}>
                    <Animated.View entering={FadeInDown.springify()} style={styles.consentContainer}>
                        <GlassView variant="heavy" borderRadius={20} style={styles.consentCard}>
                            <View style={styles.consentIconRow}>
                                <View style={styles.consentIconCircle}>
                                    <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
                                </View>
                            </View>
                            <Text style={styles.consentTitle}>AI Data Usage</Text>
                            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                                <Text style={styles.consentBody}>
                                    The Oracle uses AI to analyze your questions and provide wellness insights. Before using this feature, please understand how your data is handled:
                                </Text>
                                <Text style={styles.consentBullet}>
                                    {'\u2022'} <Text style={styles.consentBold}>What is sent:</Text> Your chat messages and relevant health context (biomarkers, supplement logs, fasting data) are sent to our secure backend for AI processing.
                                </Text>
                                <Text style={styles.consentBullet}>
                                    {'\u2022'} <Text style={styles.consentBold}>Who processes it:</Text> BioPoint's backend server processes your data using Google Gemini AI. No personal identifiers (name, email) are included in AI requests.
                                </Text>
                                <Text style={styles.consentBullet}>
                                    {'\u2022'} <Text style={styles.consentBold}>Data protection:</Text> All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Your data is never sold to third parties.
                                </Text>
                                <Text style={styles.consentBullet}>
                                    {'\u2022'} <Text style={styles.consentBold}>Not medical advice:</Text> AI responses are for general wellness information only and are not a substitute for professional medical advice.
                                </Text>
                                <Pressable onPress={() => router.push('/settings/privacy' as any)}>
                                    <Text style={styles.consentLink}>Read our full Privacy Policy</Text>
                                </Pressable>
                            </ScrollView>
                            <View style={styles.consentActions}>
                                <Pressable onPress={() => router.back()} style={styles.consentDecline}>
                                    <Text style={styles.consentDeclineText}>Decline</Text>
                                </Pressable>
                                <Pressable onPress={handleConsent} style={styles.consentAccept}>
                                    <Text style={styles.consentAcceptText}>I Understand & Agree</Text>
                                </Pressable>
                            </View>
                        </GlassView>
                    </Animated.View>
                </View>
            </Modal>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <GlassView variant="light" borderRadius={borderRadius.full} style={styles.iconButton}>
                            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                        </GlassView>
                    </Pressable>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.title}>The Oracle</Text>
                        <Text style={styles.subtitle}>Bio-Intelligence V1.0</Text>
                    </View>
                    <Pressable onPress={clearHistory} style={styles.clearButton}>
                        <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                    </Pressable>
                </View>

                {/* Chat Area */}
                <View style={{ flex: 1 }}>
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.chatContainer}
                        inverted={false}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    />
                </View>

                {/* Typing Indicator */}
                {isTyping && (
                    <View style={styles.typingContainer}>
                        <Text style={styles.typingText}>The Oracle is analyzing...</Text>
                    </View>
                )}

                {/* Input Area */}
                <View style={styles.inputContainer}>
                    <GlassView variant="heavy" borderRadius={24} style={styles.inputWrapper}>
                        <TextInput
                            style={styles.input}
                            value={inputValue}
                            onChangeText={setInputValue}
                            placeholder="Ask about your health..."
                            placeholderTextColor={colors.textMuted}
                            onSubmitEditing={handleSend}
                            returnKeyType="send"
                            multiline={false}
                        />
                        <Pressable
                            onPress={handleSend}
                            style={({ pressed }) => [
                                styles.sendButton,
                                !inputValue.trim() && styles.sendButtonDisabled,
                                pressed && { opacity: 0.8 }
                            ]}
                            disabled={!inputValue.trim()}
                        >
                            <Ionicons name="arrow-up" size={20} color="#fff" />
                        </Pressable>
                    </GlassView>
                </View>
            </KeyboardAvoidingView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    // AI Consent Modal
    consentOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    consentContainer: {
        justifyContent: 'center',
    },
    consentCard: {
        padding: spacing.xl,
    },
    consentIconRow: {
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    consentIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    consentTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    consentBody: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 21,
        marginBottom: spacing.md,
    },
    consentBullet: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 21,
        marginBottom: spacing.sm,
        paddingLeft: spacing.xs,
    },
    consentBold: {
        fontWeight: '700',
        color: colors.textPrimary,
    },
    consentLink: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
        marginTop: spacing.sm,
        marginBottom: spacing.md,
        textDecorationLine: 'underline',
    },
    consentActions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    consentDecline: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: borderRadius.lg,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
    },
    consentDeclineText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    consentAccept: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    consentAcceptText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 0,
        borderBottomColor: 'transparent',
    },
    backButton: {},
    iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitleContainer: { alignItems: 'center' },
    title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    subtitle: { fontSize: 10, color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
    clearButton: { padding: 8 },
    chatContainer: { padding: spacing.md, paddingBottom: 20 },

    messageBubble: {
        marginBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    userBubble: { justifyContent: 'flex-end' },
    botBubble: { justifyContent: 'flex-start' },

    botIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },

    messageContent: {
        maxWidth: '80%',
        padding: spacing.md,
        borderRadius: 20,
    },
    userContent: {
        backgroundColor: colors.primary,
        borderBottomRightRadius: 4,
    },
    botContent: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 0,
        borderColor: 'transparent',
        borderBottomLeftRadius: 4,
    },

    userText: { color: '#fff', fontSize: 16, lineHeight: 22 },

    typingContainer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
    typingText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },

    inputContainer: {
        padding: spacing.md,
        paddingBottom: Platform.OS === 'ios' ? 40 : spacing.md, // Manual bottom padding
        backgroundColor: colors.backgroundSecondary, // Solid background to ensure visibility
        borderTopWidth: 0,
        borderTopColor: 'transparent',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 4,
        paddingLeft: spacing.md,
        gap: spacing.md,
    },
    input: {
        flex: 1,
        height: 48,
        color: colors.textPrimary,
        fontSize: 16,
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: colors.textMuted,
        opacity: 0.5,
    },
});

const markdownStyles = StyleSheet.create({
    body: { color: colors.textPrimary, fontSize: 16, lineHeight: 24 },
    strong: { fontWeight: 'bold', color: colors.primary },
    bullet_list: { marginBottom: 8 },
    list_item: { marginBottom: 4 },
});
