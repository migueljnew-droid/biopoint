// HealthKit integration removed for v1.0 — will be re-added in v1.1 with proper Expo config plugin
class HealthService {
    async requestPermissions(): Promise<boolean> { return false; }
    async getSteps(): Promise<number> { return 0; }
    async getSleep(): Promise<number> { return 0; }
}
export const healthService = new HealthService();
