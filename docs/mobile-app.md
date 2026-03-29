# BioPoint Mobile App Documentation

## Overview

The BioPoint mobile app is built with Expo React Native and TypeScript, providing a cross-platform solution for iOS and Android with a single codebase.

## Architecture

### Technology Stack
- **Framework**: Expo SDK 54+ with React Native 0.81+
- **Language**: TypeScript with strict mode
- **Navigation**: Expo Router v6 with file-based routing
- **State Management**: Zustand for global state
- **API Client**: Axios with custom interceptors
- **UI Components**: Custom component library with NativeWind
- **Animations**: React Native Reanimated v4
- **Gestures**: React Native Gesture Handler
- **Storage**: Expo Secure Store for sensitive data
- **Authentication**: JWT with biometric support

### Project Structure
```
apps/mobile/
├── app/                    # Expo Router file-based routing
│   ├── (auth)/            # Authentication screens
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── onboarding.tsx
│   ├── (tabs)/            # Main app tabs
│   │   ├── dashboard.tsx
│   │   ├── stacks.tsx
│   │   ├── labs.tsx
│   │   ├── photos.tsx
│   │   └── profile.tsx
│   └── _layout.tsx        # Root layout with providers
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── ui/           # Base UI components
│   │   ├── forms/        # Form components
│   │   └── charts/       # Data visualization
│   ├── services/         # API and external services
│   │   ├── api.ts        # Main API client
│   │   ├── auth.ts       # Authentication service
│   │   ├── biometric.ts  # Biometric authentication
│   │   └── health.ts     # HealthKit integration
│   ├── store/            # Zustand stores
│   │   ├── authStore.ts
│   │   ├── dashboardStore.ts
│   │   └── stacksStore.ts
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   └── theme/            # Design system
├── assets/               # Images, fonts, icons
└── config/               # App configuration
```

### Navigation Architecture

The app uses Expo Router with a hierarchical navigation structure:

```
Root Layout
├── Auth Group (unauthenticated)
│   ├── Login Screen
│   ├── Register Screen
│   └── Onboarding Flow
└── Main App Group (authenticated)
    ├── Tab Layout
    │   ├── Dashboard Tab
    │   ├── Stacks Tab
    │   ├── Labs Tab
    │   ├── Photos Tab
    │   └── Profile Tab
    └── Modal Screens
        ├── Stack Detail
        ├── Lab Detail
        └── Photo Gallery
```

## Build and Deployment

### Development Environment Setup

1. **Prerequisites**
   ```bash
   # Install Node.js 18+ and npm
   node --version  # Should be 18+
   
   # Install Expo CLI globally
   npm install -g @expo/cli
   
   # Install EAS CLI for builds
   npm install -g eas-cli
   ```

2. **Local Development**
   ```bash
   # Install dependencies
   cd apps/mobile
   npm install
   
   # Start development server
   npm start
   
   # Run on specific platforms
   npm run ios      # iOS simulator
   npm run android  # Android emulator
   npm run web      # Web browser
   ```

### Environment Configuration

Create environment files:

```bash
# apps/mobile/.env.local
EXPO_PUBLIC_API_URL=https://api.biopoint.com
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn
EXPO_PUBLIC_AMPLITUDE_KEY=your-amplitude-key
```

**Important**: Use `EXPO_PUBLIC_` prefix for variables accessible in the app.

### Building for Production

#### iOS Build
```bash
# Configure iOS credentials
eas credentials

# Build for iOS
eas build --platform ios

# Build options
eas build --platform ios --profile production
```

#### Android Build
```bash
# Configure Android keystore
eas credentials

# Build for Android
eas build --platform android

# Build options
eas build --platform android --profile production
```

#### Build Profiles
Configure different build profiles in `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.biopoint.com"
      }
    }
  }
}
```

## Store Submission Process

### App Store (iOS)

#### Prerequisites
- Apple Developer Account ($99/year)
- App Store Connect account
- Valid provisioning profile

#### Submission Steps

1. **Prepare App Metadata**
   ```bash
   # Update app.json
   {
     "expo": {
       "name": "BioPoint",
       "slug": "biopoint",
       "version": "1.0.0",
       "ios": {
         "bundleIdentifier": "com.biopoint.app",
         "buildNumber": "1.0.0"
       }
     }
   }
   ```

2. **Build and Submit**
   ```bash
   # Build for App Store
   eas build --platform ios --profile production
   
   # Submit to App Store
   eas submit --platform ios
   
   # Or use Transporter app to upload .ipa manually
   ```

3. **App Store Connect Configuration**
   - Create new app in App Store Connect
   - Fill in app information (name, description, keywords)
   - Upload screenshots (iPhone 6.7", 6.5", 5.5")
   - Set pricing and availability
   - Configure app privacy settings
   - Submit for review

#### Required App Store Information
- **App Name**: BioPoint
- **Primary Category**: Health & Fitness
- **Secondary Category**: Medical
- **Age Rating**: 12+ (infrequent medical information)
- **Copyright**: © 2024 BioPoint Inc.
- **Support URL**: https://support.biopoint.com
- **Marketing URL**: https://biopoint.com

### Google Play Store (Android)

#### Prerequisites
- Google Play Developer Account ($25 one-time)
- Valid keystore for app signing

#### Submission Steps

1. **Prepare App Metadata**
   ```bash
   # Update app.json
   {
     "expo": {
       "android": {
         "package": "com.biopoint.app",
         "versionCode": 1,
         "permissions": [
           "CAMERA",
           "READ_EXTERNAL_STORAGE",
           "WRITE_EXTERNAL_STORAGE"
         ]
       }
     }
   }
   ```

2. **Build and Submit**
   ```bash
   # Build for Play Store
   eas build --platform android --profile production
   
   # Submit to Play Store
   eas submit --platform android
   ```

3. **Play Console Configuration**
   - Create new app in Google Play Console
   - Set up app signing (Google Play App Signing)
   - Fill in store listing information
   - Upload screenshots (phone, 7" tablet, 10" tablet)
   - Configure content rating questionnaire
   - Set pricing and distribution
   - Create release and submit

#### Required Play Store Information
- **App Name**: BioPoint
- **Short Description**: Track biomarkers, supplements, and health progress
- **Full Description**: Comprehensive health tracking app for monitoring biomarkers, supplement protocols, lab results, and progress photos.
- **Category**: Health & Fitness
- **Content Rating**: Everyone 10+
- **Contact Email**: support@biopoint.com
- **Privacy Policy**: https://biopoint.com/privacy

## Configuration Management

### Environment-Specific Configuration

```typescript
// src/config/environment.ts
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV;
  
  switch (env) {
    case 'development':
      return {
        apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
        enableLogging: true,
        enableAnalytics: false,
      };
    case 'staging':
      return {
        apiUrl: 'https://staging-api.biopoint.com',
        enableLogging: true,
        enableAnalytics: true,
      };
    case 'production':
      return {
        apiUrl: 'https://api.biopoint.com',
        enableLogging: false,
        enableAnalytics: true,
      };
    default:
      return {
        apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
        enableLogging: true,
        enableAnalytics: false,
      };
  }
};
```

### Feature Flags

```typescript
// src/config/features.ts
export const FEATURES = {
  BIOMETRIC_AUTH: true,
  HEALTH_KIT_INTEGRATION: true,
  COMMUNITY_FEATURES: false, // Coming soon
  PREMIUM_FEATURES: true,
  ANALYTICS: __DEV__ ? false : true,
};
```

### API Configuration

```typescript
// src/services/api.ts
const apiClient = axios.create({
  baseURL: getEnvironmentConfig().apiUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth
apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await refreshTokens();
      return apiClient.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

## Security Implementation

### Biometric Authentication

```typescript
// src/services/biometricService.ts
import * as LocalAuthentication from 'expo-local-authentication';

export const authenticateWithBiometrics = async (): Promise<boolean> => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  
  if (!hasHardware || !isEnrolled) {
    return false;
  }
  
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access BioPoint',
    fallbackLabel: 'Use passcode',
  });
  
  return result.success;
};
```

### Secure Storage

```typescript
// src/store/secureStorage.ts
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'biopoint_access_token';
const REFRESH_TOKEN_KEY = 'biopoint_refresh_token';

export const storeTokens = async (accessToken: string, refreshToken: string) => {
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
};

export const getAccessToken = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(TOKEN_KEY);
};
```

### Certificate Pinning

```typescript
// Network security configuration
const networkSecurityConfig = {
  domainConfig: [
    {
      domain: 'api.biopoint.com',
      pinSet: [
        {
          digest: 'SHA-256',
          digestValue: 'base64EncodedPin',
        },
      ],
    },
  ],
};
```

## Performance Optimization

### Code Splitting

```typescript
// Lazy load heavy components
const LabReportsScreen = lazy(() => import('./screens/LabReportsScreen'));
const ProgressPhotosScreen = lazy(() => import('./screens/ProgressPhotosScreen'));
```

### Image Optimization

```typescript
// Use optimized image components
import { Image } from 'expo-image';

const OptimizedImage = ({ source, style }) => (
  <Image
    source={source}
    style={style}
    contentFit="cover"
    transition={200}
    cachePolicy="memory-disk"
  />
);
```

### Bundle Size Optimization

```json
// metro.config.js
module.exports = {
  transformer: {
    minifierConfig: {
      mangle: {
        keep_fnames: true,
      },
      output: {
        ascii_only: true,
        quote_keys: true,
        wrap_iife: true,
      },
      sourceMap: {
        includeSources: false,
      },
      toplevel: false,
      warnings: false,
    },
  },
};
```

## Testing Strategy

### Unit Tests
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

### Integration Tests
```bash
npm run test:integration  # Integration tests
```

### Security Tests
```bash
npm run test:security     # Security-specific tests
```

### E2E Testing with Detox
```bash
# Build for testing
detox build --configuration ios.sim.debug

# Run E2E tests
detox test --configuration ios.sim.debug
```

## Monitoring and Analytics

### Crash Reporting
```typescript
// Sentry integration
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.1,
});
```

### Analytics
```typescript
// Amplitude integration
import { Amplitude } from '@amplitude/analytics-react-native';

Amplitude.init(process.env.EXPO_PUBLIC_AMPLITUDE_KEY);

// Track user events
Amplitude.track('Stack Created', {
  stackName: 'Morning Energy',
  itemCount: 3,
});
```

### Performance Monitoring
```typescript
// React Native Performance
import { PerformanceProfiler } from '@react-native-performance/react-native';

const App = () => (
  <PerformanceProfiler
    onReportPrepared={(report) => {
      // Send to monitoring service
      analytics.track('Performance Report', report);
    }}
  >
    {/* App content */}
  </PerformanceProfiler>
);
```

## HealthKit Integration (iOS)

### Setup
```typescript
import AppleHealthKit from 'react-native-health';

const permissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Weight,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
    ],
    write: [
      AppleHealthKit.Constants.Permissions.Weight,
    ],
  },
};

AppleHealthKit.initHealthKit(permissions, (error) => {
  if (error) {
    console.log('HealthKit initialization error:', error);
  }
});
```

### Reading Data
```typescript
const readWeightData = () => {
  const options = {
    unit: 'kilogram',
    startDate: new Date(2024, 0, 1).toISOString(),
    endDate: new Date().toISOString(),
  };
  
  AppleHealthKit.getWeightSamples(options, (error, results) => {
    if (error) {
      console.log('Error reading weight:', error);
      return;
    }
    // Process weight data
    syncWeightData(results);
  });
};
```

## Troubleshooting

### Common Build Issues

1. **iOS Build Fails with Certificate Issues**
   ```bash
   # Reset certificates
   eas credentials --platform ios
   
   # Clear derived data
   rm -rf ~/Library/Developer/Xcode/DerivedData
   ```

2. **Android Build Fails with Memory Issues**
   ```bash
   # Increase Gradle heap size
   export GRADLE_OPTS="-Xmx4g -XX:MaxPermSize=512m"
   ```

3. **Metro Bundler Issues**
   ```bash
   # Clear Metro cache
   npx expo start --clear
   
   # Reset cache completely
   rm -rf node_modules/.cache
   ```

### Performance Issues

1. **Slow App Startup**
   - Use Hermes JavaScript engine
   - Enable ProGuard/R8 for Android
   - Optimize bundle size

2. **Memory Leaks**
   - Properly clean up subscriptions
   - Use React.memo for expensive components
   - Monitor memory usage in development

3. **Slow Navigation**
   - Use lazy loading for screens
   - Optimize heavy computations
   - Implement proper caching

## Security Checklist

- [ ] Enable certificate pinning
- [ ] Use biometric authentication
- [ ] Implement secure storage for tokens
- [ ] Enable app transport security (iOS)
- [ ] Configure network security config (Android)
- [ ] Obfuscate code in production builds
- [ ] Implement jailbreak/root detection
- [ ] Use encrypted communication (HTTPS/TLS)
- [ ] Validate all user inputs
- [ ] Implement proper session management

## Deployment Checklist

- [ ] Update app version in app.json
- [ ] Configure production API endpoints
- [ ] Test on physical devices
- [ ] Run full test suite
- [ ] Perform security testing
- [ ] Optimize bundle size
- [ ] Configure analytics and crash reporting
- [ ] Prepare app store metadata
- [ ] Create app preview videos
- [ ] Submit for review
- [ ] Monitor crash reports post-launch