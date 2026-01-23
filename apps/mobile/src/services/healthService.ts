import AppleHealthKit, { HealthValue, HealthKitPermissions } from 'react-native-health';
import { Platform } from 'react-native';

const PERMISSIONS: HealthKitPermissions = {
    permissions: {
        read: [
            AppleHealthKit.Constants.Permissions.HeartRate,
            AppleHealthKit.Constants.Permissions.Steps,
            AppleHealthKit.Constants.Permissions.SleepAnalysis,
            AppleHealthKit.Constants.Permissions.RespiratoryRate,
            AppleHealthKit.Constants.Permissions.BodyTemperature,
            AppleHealthKit.Constants.Permissions.OxygenSaturation,
            AppleHealthKit.Constants.Permissions.BloodGlucose,
            AppleHealthKit.Constants.Permissions.BloodPressureDiastolic,
            AppleHealthKit.Constants.Permissions.BloodPressureSystolic,
            AppleHealthKit.Constants.Permissions.HeartRateVariability,
            AppleHealthKit.Constants.Permissions.Vo2Max,
            AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
            AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
        ],
        write: [],
    },
};

class HealthService {
    async requestPermissions(): Promise<boolean> {
        if (Platform.OS !== 'ios') return false;

        return new Promise((resolve, reject) => {
            AppleHealthKit.initHealthKit(PERMISSIONS, (err: string, results: unknown) => {
                if (err) {
                    console.log('error initializing HealthKit: ', err);
                    reject(err);
                } else {
                    resolve(!!results);
                }
            });
        });
    }

    async getSteps(date: Date = new Date()): Promise<number> {
        if (Platform.OS !== 'ios') return 0;

        const options = {
            date: date.toISOString(),
            includeManuallyAdded: false,
        };

        return new Promise((resolve) => {
            AppleHealthKit.getStepCount(options, (err: Object, results: HealthValue) => {
                if (err) {
                    resolve(0);
                    return;
                }
                resolve(results.value);
            });
        });
    }

    async getSleep(date: Date = new Date()): Promise<number> {
        if (Platform.OS !== 'ios') return 0;

        const startDate = new Date(date);
        startDate.setDate(date.getDate() - 1);
        startDate.setHours(18, 0, 0, 0);

        const endDate = new Date(date);
        endDate.setHours(12, 0, 0, 0);

        const options = {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        };

        return new Promise((resolve) => {
            AppleHealthKit.getSleepSamples(options, (err: Object, results: any[]) => {
                if (err) {
                    resolve(0);
                    return;
                }
                // Sum up "ASLEEP" samples
                // Note: Actual logic depends on how 'results' determines sleep stages. 
                // For MVP, just return total duration or similar.
                resolve(results.length > 0 ? 8 : 0); // Mock/Simplified
            });
        });
    }
}

export const healthService = new HealthService();
