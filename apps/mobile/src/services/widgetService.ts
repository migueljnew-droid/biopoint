import { Platform } from 'react-native';
import SharedGroupPreferences from 'react-native-shared-group-preferences';

const APP_GROUP = 'group.com.biopoint.app';

/**
 * Pushes data to the iOS widget via shared App Group UserDefaults.
 * The WidgetKit extension reads these values every 30 minutes.
 * Called after every dashboard fetch and score recalculation.
 */
export async function updateWidgetData(data: {
    score?: number;
    trend?: string;
    stacksDone?: number;
    stacksTotal?: number;
    calories?: number;
    calorieTarget?: number;
}) {
    if (Platform.OS !== 'ios') return;

    try {
        const payload: Record<string, string> = {};
        if (data.score !== undefined) payload.biopoint_score = String(data.score);
        if (data.trend !== undefined) payload.biopoint_trend = data.trend;
        if (data.stacksDone !== undefined) payload.stacks_done = String(data.stacksDone);
        if (data.stacksTotal !== undefined) payload.stacks_total = String(data.stacksTotal);
        if (data.calories !== undefined) payload.calories_today = String(data.calories);
        if (data.calorieTarget !== undefined) payload.calorie_target = String(data.calorieTarget);

        await SharedGroupPreferences.setItem('widget_data', JSON.stringify(payload), APP_GROUP);
    } catch (error) {
        console.log('[Widget] Failed to update widget data:', error);
    }
}
