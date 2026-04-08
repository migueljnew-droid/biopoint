import { Platform } from 'react-native';

// Lazy-load react-native-health to prevent crash if native module isn't ready
// (RN 0.76+ bridgeless architecture loads NativeModules lazily)
function getHealthKit() {
    return require('react-native-health').default || require('react-native-health');
}

function getPermissions() {
    const AppleHealthKit = getHealthKit();
    return {
        permissions: {
            read: [
                AppleHealthKit.Constants.Permissions.HeartRate,
                AppleHealthKit.Constants.Permissions.StepCount,
                AppleHealthKit.Constants.Permissions.SleepAnalysis,
                AppleHealthKit.Constants.Permissions.HeartRateVariability,
                AppleHealthKit.Constants.Permissions.Weight,
            ],
            write: [],
        },
    };
}

export const healthKitService = {
    init: async (): Promise<boolean> => {
        if (Platform.OS !== 'ios') return false;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log('[HealthKit] Init timed out after 10s');
                resolve(false);
            }, 10000);

            try {
                const AppleHealthKit = getHealthKit();
                AppleHealthKit.initHealthKit(getPermissions(), (err: string) => {
                    clearTimeout(timeout);
                    if (err) {
                        console.log('[HealthKit] Error initializing:', err);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                });
            } catch (e) {
                clearTimeout(timeout);
                console.log('[HealthKit] Failed to load native module:', e);
                resolve(false);
            }
        });
    },

    getSleep: async (): Promise<number> => {
        if (Platform.OS !== 'ios') return 0;

        const options = {
            startDate: new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString(),
        };

        return new Promise((resolve) => {
            try {
                const AppleHealthKit = getHealthKit();
                AppleHealthKit.getSleepSamples(options, (err: Object, results: Array<any>) => {
                    if (err) { resolve(0); return; }
                    const totalMinutes = results.reduce((acc: number, sample: any) => {
                        const start = new Date(sample.startDate).getTime();
                        const end = new Date(sample.endDate).getTime();
                        return acc + (end - start) / 1000 / 60;
                    }, 0);
                    resolve(totalMinutes / 60);
                });
            } catch {
                resolve(0);
            }
        });
    },

    getSteps: async (): Promise<number> => {
        if (Platform.OS !== 'ios') return 0;

        return new Promise((resolve) => {
            try {
                const AppleHealthKit = getHealthKit();
                AppleHealthKit.getStepCount({}, (err: Object, results: any) => {
                    if (err) { resolve(0); return; }
                    resolve(results.value);
                });
            } catch {
                resolve(0);
            }
        });
    },
};
