import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, borderRadius } from '../src/theme';
import { ScreenWrapper, GlassView } from '../src/components';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore, Message } from '../src/store/chatStore';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Markdown from 'react-native-markdown-display';
import * as Haptics from 'expo-haptics';

export default function OracleScreen() {
    const { messages, isTyping, addMessage, generateResponse, clearHistory } = useChatStore();
    const [inputValue, setInputValue] = useState('');
    const flatListRef = useRef<FlatList>(null);

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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
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
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderBottomLeftRadius: 4,
    },

    userText: { color: '#fff', fontSize: 16, lineHeight: 22 },

    typingContainer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
    typingText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },

    inputContainer: {
        padding: spacing.md,
        paddingBottom: Platform.OS === 'ios' ? 40 : spacing.md, // Manual bottom padding
        backgroundColor: colors.backgroundSecondary, // Solid background to ensure visibility
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
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
