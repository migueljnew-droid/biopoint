import AppleHealthKit, {
    HealthValue,
    HealthKitPermissions,
} from 'react-native-health';
import { Platform } from 'react-native';

// PULSE PROTOCOL: HEALTHKIT BRIDGE

const PERMISSIONS: HealthKitPermissions = {
    permissions: {
        read: [
            AppleHealthKit.Constants.Permissions.HeartRate,
            AppleHealthKit.Constants.Permissions.StepCount,
            AppleHealthKit.Constants.Permissions.SleepAnalysis,
            AppleHealthKit.Constants.Permissions.HeartRateVariability,
            AppleHealthKit.Constants.Permissions.Weight,
        ],
        write: [], // We only read for now
    },
};

export const healthKitService = {
    init: async (): Promise<boolean> => {
        if (Platform.OS !== 'ios') return false;

        return new Promise((resolve) => {
            AppleHealthKit.initHealthKit(PERMISSIONS, (err: string) => {
                if (err) {
                    console.log('[HealthKit] Error initializing:', err);
                    resolve(false);
                    return;
                }
                resolve(true);
            });
        });
    },

    getSleep: async (): Promise<number> => {
        if (Platform.OS !== 'ios') return 0;

        let options = {
            startDate: new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString(),
        };

        return new Promise((resolve) => {
            AppleHealthKit.getSleepSamples(options, (err: Object, results: Array<any>) => {
                if (err) {
                    resolve(0);
                    return;
                }
                // Simplified calculation: Sum 'ASLEEP' periods
                // In prod, this needs robust parsing of 'INBED' vs 'ASLEEP'
                const totalMinutes = results.reduce((acc, sample) => {
                    const start = new Date(sample.startDate).getTime();
                    const end = new Date(sample.endDate).getTime();
                    return acc + (end - start) / 1000 / 60;
                }, 0);

                resolve(totalMinutes / 60); // Return hours
            });
        });
    },

    getSteps: async (): Promise<number> => {
        if (Platform.OS !== 'ios') return 0;

        return new Promise((resolve) => {
            AppleHealthKit.getStepCount({}, (err: Object, results: HealthValue) => {
                if (err) {
                    resolve(0);
                    return;
                }
                resolve(results.value);
            });
        });
    },

    // Future: HRV, Weight hooks...
};
