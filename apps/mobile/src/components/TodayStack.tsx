import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius } from '../theme';
import { GlassView } from './ui';
import { useStacksStore } from '../store/stacksStore';

interface TodayItem {
    id: string;
    name: string;
    dose: number;
    unit: string;
    route: string | null;
    stackName: string;
    taken: boolean;
}

const getTodayKey = () => `taken_${new Date().toISOString().slice(0, 10)}`;

export function TodayStack() {
    const { stacks, logCompliance } = useStacksStore();
    const [takenIds, setTakenIds] = useState<Set<string>>(new Set());

    // Load today's checkoffs from storage
    useEffect(() => {
        AsyncStorage.getItem(getTodayKey()).then((val) => {
            if (val) setTakenIds(new Set(JSON.parse(val)));
        }).catch(() => {});
    }, []);

    const todayItems: TodayItem[] = [];
    const today = new Date().getDay();

    for (const stack of stacks) {
        if (!stack.isActive) continue;
        for (const item of stack.items) {
            if (!item.isActive) continue;

            let shouldShow = false;
            // today: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

            // If user picked specific days, use those
            if (item.scheduleDays && item.scheduleDays.length > 0) {
                shouldShow = item.scheduleDays.includes(today);
            } else {
                // Fall back to frequency-based defaults
                switch (item.frequency) {
                    case 'Daily': case 'Morning': case 'Evening':
                    case 'Twice Daily': case '3x Daily':
                        shouldShow = true;
                        break;
                    case 'Weekly':
                        shouldShow = today === 1;
                        break;
                    case 'Twice a week':
                        shouldShow = today === 2 || today === 5;
                        break;
                    case 'Three times a week':
                        shouldShow = today === 2 || today === 4 || today === 6;
                        break;
                    case 'As Needed':
                        shouldShow = false;
                        break;
                    default:
                        shouldShow = false;
                }
            }

            if (shouldShow) {
                todayItems.push({
                    id: item.id, name: item.name, dose: item.dose,
                    unit: item.unit, route: item.route,
                    stackName: stack.name, taken: takenIds.has(item.id),
                });
            }
        }
    }

    if (todayItems.length === 0) return null;

    const takenCount = todayItems.filter(i => i.taken).length;
    const totalCount = todayItems.length;
    const allDone = takenCount === totalCount;

    const handleTake = async (item: TodayItem) => {
        if (item.taken) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const newIds = new Set([...takenIds, item.id]);
        setTakenIds(newIds);
        AsyncStorage.setItem(getTodayKey(), JSON.stringify([...newIds])).catch(() => {});
        try { await logCompliance(item.id); } catch { /* logged visually */ }
    };

    return (
        <Animated.View entering={FadeInDown.delay(50).springify()} layout={LinearTransition}>
            <GlassView variant="medium" borderRadius={borderRadius.xl} style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Ionicons name="today" size={18} color={colors.primary} />
                        <Text style={styles.title}>Today's Stack</Text>
                    </View>
                    <View style={[styles.countBadge, allDone && styles.countBadgeDone]}>
                        <Text style={[styles.countText, allDone && styles.countTextDone]}>
                            {takenCount}/{totalCount}
                        </Text>
                    </View>
                </View>

                {todayItems.map((item, i) => (
                    <Pressable
                        key={item.id}
                        onPress={() => handleTake(item)}
                        style={({ pressed }) => [
                            styles.itemRow,
                            pressed && !item.taken && styles.itemPressed,
                            i === todayItems.length - 1 && styles.itemRowLast,
                        ]}
                    >
                        <View style={[styles.checkbox, item.taken && styles.checkboxDone]}>
                            {item.taken && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>
                        <View style={styles.itemInfo}>
                            <Text style={[styles.itemName, item.taken && styles.itemNameDone]}>{item.name}</Text>
                            <Text style={styles.itemMeta}>
                                {item.dose} {item.unit}{item.route ? ` • ${item.route}` : ''} — {item.stackName}
                            </Text>
                        </View>
                    </Pressable>
                ))}

                {allDone && (
                    <View style={styles.doneBar}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={styles.doneText}>All done for today</Text>
                    </View>
                )}
            </GlassView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: { padding: spacing.lg, marginBottom: spacing.md },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
    countBadge: { backgroundColor: 'rgba(27, 75, 122, 0.3)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
    countBadgeDone: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
    countText: { fontSize: 13, fontWeight: '600', color: colors.primary },
    countTextDone: { color: colors.success },
    itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', gap: 12 },
    itemRowLast: { borderBottomWidth: 0 },
    itemPressed: { opacity: 0.7 },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    checkboxDone: { backgroundColor: colors.success, borderColor: colors.success },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
    itemNameDone: { textDecorationLine: 'line-through', opacity: 0.5 },
    itemMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    doneBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.sm, paddingTop: spacing.sm },
    doneText: { fontSize: 13, fontWeight: '600', color: colors.success },
});
