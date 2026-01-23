import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';

export const biometricService = {
    checkHardware: async () => {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware) {
            Alert.alert('Not Supported', 'This device does not support biometric authentication.');
            return false;
        }
        return true;
    },

    authenticate: async (reason: string = 'Confirm your identity') => {
        const hasHardware = await biometricService.checkHardware();
        if (!hasHardware) return false;

        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!isEnrolled) {
            Alert.alert('Not Configured', 'No biometrics are enrolled on this device.');
            return false;
        }

        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: reason,
            fallbackLabel: 'Enter Passcode'
        });

        if (result.success) {
            return true;
        } else {
            return false;
        }
    }
};
