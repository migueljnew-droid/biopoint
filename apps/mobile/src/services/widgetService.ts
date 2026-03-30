import { Platform, NativeModules } from 'react-native';

const APP_GROUP = 'group.com.biopoint.app';

/**
 * Updates widget data via shared UserDefaults (App Group).
 * Uses expo-secure-store's underlying SharedDefaults on iOS.
 * Widget reads this data to display BioPoint score, stacks, and nutrition.
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
        // Use react-native-shared-group-preferences or direct NativeModules
        // For now, we use expo modules' SharedPreferences if available
        const SharedGroupPreferences = NativeModules.SharedGroupPreferences;
        if (!SharedGroupPreferences) {
            console.log('[Widget] SharedGroupPreferences not available');
            return;
        }

        if (data.score !== undefined) {
            await SharedGroupPreferences.setItem('biopoint_score', String(data.score), APP_GROUP);
        }
        if (data.trend !== undefined) {
            await SharedGroupPreferences.setItem('biopoint_trend', data.trend, APP_GROUP);
        }
        if (data.stacksDone !== undefined) {
            await SharedGroupPreferences.setItem('stacks_done', String(data.stacksDone), APP_GROUP);
        }
        if (data.stacksTotal !== undefined) {
            await SharedGroupPreferences.setItem('stacks_total', String(data.stacksTotal), APP_GROUP);
        }
        if (data.calories !== undefined) {
            await SharedGroupPreferences.setItem('calories_today', String(data.calories), APP_GROUP);
        }
        if (data.calorieTarget !== undefined) {
            await SharedGroupPreferences.setItem('calorie_target', String(data.calorieTarget), APP_GROUP);
        }
    } catch (error) {
        console.log('[Widget] Failed to update widget data:', error);
    }
}
