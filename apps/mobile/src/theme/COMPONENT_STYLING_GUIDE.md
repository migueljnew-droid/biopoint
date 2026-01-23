# BioPoint Liquid UI Component Styling Guide

## Overview

This guide provides implementation recommendations for the upgraded BioPoint Liquid UI theme v3.0.0. It covers glassmorphism effects, fluid animations, blur configurations, and best practices for creating premium iOS-style components.

---

## Required Dependencies

Add these to your `package.json`:

```bash
npx expo install expo-blur expo-linear-gradient expo-haptics react-native-reanimated react-native-gesture-handler
```

```json
{
  "expo-blur": "~13.0.0",
  "expo-haptics": "~13.0.0",
  "expo-linear-gradient": "~13.0.0",
  "react-native-reanimated": "~3.10.0",
  "react-native-gesture-handler": "~2.16.0"
}
```

Update `babel.config.js`:
```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

---

## 1. Glass Card Implementation

### Basic Glass Card

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { glass, colors, borderRadius, spacing, blurEffects } from '../theme';

export function GlassCard({ children, elevated = false }) {
  return (
    <View style={[styles.container, elevated && styles.elevated]}>
      <BlurView
        intensity={blurEffects.surfaces.regular.intensity}
        tint={blurEffects.surfaces.regular.tint}
        style={StyleSheet.absoluteFill}
      />
      <View style={[
        styles.content,
        elevated ? glass.heavy : glass.medium
      ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.card,
    overflow: 'hidden',
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  content: {
    padding: spacing.cardPadding,
    borderRadius: borderRadius.card,
  },
});
```

### Multi-Layer Glass Card (Premium)

```tsx
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { glass, gradients, borderRadius, spacing } from '../theme';

export function PremiumGlassCard({ children }) {
  return (
    <View style={styles.container}>
      {/* Layer 1: Base blur */}
      <BlurView
        intensity={60}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />

      {/* Layer 2: Gradient overlay */}
      <LinearGradient
        colors={gradients.glass}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Layer 3: Inner highlight (top edge) */}
      <View style={styles.highlight} />

      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.35,
    shadowRadius: 25,
    elevation: 15,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 1,
  },
  content: {
    padding: spacing.cardPadding,
  },
});
```

---

## 2. Animated Button with Haptics

```tsx
import React, { useCallback } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { gradients, animations, typography, borderRadius, shadows } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GradientButton({ title, onPress, variant = 'primary' }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(
      animations.presets.buttonPress.scale,
      animations.springs.snappy
    );
    opacity.value = withTiming(
      animations.presets.buttonPress.opacity,
      { duration: animations.timings.buttonPress.duration }
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animations.springs.snappy);
    opacity.value = withTiming(1, {
      duration: animations.timings.buttonRelease.duration
    });
  }, []);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.container, shadows.button, animatedStyle]}
    >
      <LinearGradient
        colors={gradients.cta[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Text style={styles.text}>{title}</Text>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.button,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.button,
    color: '#ffffff',
  },
});
```

---

## 3. Biomarker Status Card

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  colors,
  typography,
  borderRadius,
  spacing,
  componentStyles,
  getBiomarkerStatus
} from '../theme';

interface BiomarkerCardProps {
  name: string;
  value: number;
  unit: string;
  optimalRange: { min: number; max: number };
  warningRange: { min: number; max: number };
  category: keyof typeof colors.biomarkerCategory;
}

export function BiomarkerCard({
  name,
  value,
  unit,
  optimalRange,
  warningRange,
  category,
}: BiomarkerCardProps) {
  const status = getBiomarkerStatus(value, optimalRange, warningRange);
  const statusColors = colors.biomarker[status];
  const categoryColor = colors.biomarkerCategory[category];

  // Calculate fill percentage
  const maxRange = Math.max(warningRange.max, optimalRange.max * 1.5);
  const fillPercent = Math.min((value / maxRange) * 100, 100);

  return (
    <View style={componentStyles.biomarkerCard.container}>
      {/* Header with category icon */}
      <View style={componentStyles.biomarkerCard.header}>
        <View style={[
          componentStyles.biomarkerCard.iconContainer,
          { backgroundColor: `${categoryColor}15` }
        ]}>
          {/* Icon here */}
        </View>
        <View style={{ marginLeft: spacing.sm, flex: 1 }}>
          <Text style={styles.name}>{name}</Text>
        </View>
        {/* Status badge */}
        <View style={[
          componentStyles.biomarkerCard.statusBadge,
          { backgroundColor: statusColors.background }
        ]}>
          <Text style={[
            componentStyles.biomarkerCard.statusText,
            { color: statusColors.primary }
          ]}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Text>
        </View>
      </View>

      {/* Value display */}
      <View style={componentStyles.biomarkerCard.valueContainer}>
        <Text style={[
          componentStyles.biomarkerCard.primaryValue,
          { color: statusColors.primary }
        ]}>
          {value}
        </Text>
        <Text style={componentStyles.biomarkerCard.unitLabel}>{unit}</Text>
      </View>

      {/* Range bar */}
      <View style={componentStyles.biomarkerCard.rangeBar}>
        <LinearGradient
          colors={[statusColors.primary, statusColors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            componentStyles.biomarkerCard.rangeFill,
            { width: `${fillPercent}%` }
          ]}
        />
      </View>

      {/* Optimal range indicator */}
      <Text style={styles.rangeText}>
        Optimal: {optimalRange.min} - {optimalRange.max} {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  name: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  rangeText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
});
```

---

## 4. Animated List Item Entrance

```tsx
import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { animations, glass, colors, typography, spacing, borderRadius } from '../theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  index: number;
  onPress?: () => void;
}

export function AnimatedListItem({ title, subtitle, index, onPress }: ListItemProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  // Staggered entrance animation
  useEffect(() => {
    const delay = Math.min(index * animations.stagger.normal, animations.stagger.maxDelay);

    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: animations.timings.fade.duration })
    );
    translateY.value = withDelay(
      delay,
      withSpring(0, animations.springs.listItem)
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.container,
          glass.light,
          pressed && glass.pressed,
        ]}
      >
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: 4,
  },
});
```

---

## 5. Bottom Sheet with Gesture

```tsx
import React, { useCallback } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { animations, blurEffects, componentStyles, colors } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function BottomSheet({ isOpen, onClose, children }: BottomSheetProps) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  // Present animation
  React.useEffect(() => {
    if (isOpen) {
      translateY.value = withSpring(0, animations.springs.bottomSheet);
      backdropOpacity.value = withTiming(1, animations.timings.fade);
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, animations.springs.sheetDismiss);
      backdropOpacity.value = withTiming(0, animations.timings.quickFade);
    }
  }, [isOpen]);

  // Gesture handler for drag-to-dismiss
  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 150 || event.velocityY > 500) {
        translateY.value = withSpring(SCREEN_HEIGHT, animations.springs.sheetDismiss);
        backdropOpacity.value = withTiming(0, animations.timings.quickFade);
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, animations.springs.bottomSheet);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!isOpen) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <BlurView
          intensity={blurEffects.components.modalBackdrop.intensity}
          tint={blurEffects.components.modalBackdrop.tint}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Sheet */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[componentStyles.bottomSheet.container, sheetStyle]}>
          <View style={componentStyles.bottomSheet.handle} />
          <View style={componentStyles.bottomSheet.content}>
            {children}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
});
```

---

## 6. Skeleton Loading with Shimmer

```tsx
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { animations, componentStyles, colors } from '../theme';

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
}

export function Skeleton({ width, height, borderRadius = 8 }: SkeletonProps) {
  const shimmerPosition = useSharedValue(-1);

  useEffect(() => {
    shimmerPosition.value = withRepeat(
      withTiming(2, {
        duration: animations.timings.shimmer.duration,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shimmerPosition.value,
          [-1, 2],
          [-200, 400]
        ),
      },
    ],
  }));

  return (
    <View style={[
      componentStyles.skeleton.container,
      { width, height, borderRadius }
    ]}>
      <Animated.View style={[styles.shimmer, shimmerStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255, 255, 255, 0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    width: 200,
  },
});
```

---

## 7. Tab Bar with Animated Indicator

```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { animations, componentStyles, colors, typography } from '../theme';

interface TabBarProps {
  tabs: string[];
  activeIndex: number;
  onTabPress: (index: number) => void;
}

export function AnimatedTabBar({ tabs, activeIndex, onTabPress }: TabBarProps) {
  const indicatorPosition = useSharedValue(0);
  const tabWidth = 100 / tabs.length;

  React.useEffect(() => {
    indicatorPosition.value = withSpring(
      activeIndex * tabWidth,
      animations.springs.tabSwitch
    );
  }, [activeIndex]);

  const indicatorStyle = useAnimatedStyle(() => ({
    left: `${indicatorPosition.value}%`,
    width: `${tabWidth}%`,
  }));

  return (
    <View style={componentStyles.tabBar.container}>
      {/* Animated indicator */}
      <Animated.View style={[styles.indicator, indicatorStyle]} />

      {/* Tabs */}
      {tabs.map((tab, index) => (
        <Pressable
          key={tab}
          onPress={() => onTabPress(index)}
          style={[
            componentStyles.tabBar.tab,
            index === activeIndex && componentStyles.tabBar.tabActive,
          ]}
        >
          <Text style={[
            componentStyles.tabBar.tabText,
            index === activeIndex && componentStyles.tabBar.tabTextActive,
          ]}>
            {tab}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 8,
  },
});
```

---

## 8. Progress Ring (Radial Progress)

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  withSpring,
} from 'react-native-reanimated';
import { colors, typography, animations } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  gradientColors?: string[];
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 12,
  gradientColors = [colors.primary, colors.accent],
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = withSpring(
      circumference - (progress / 100) * circumference,
      animations.springs.gentle
    );
    return { strokeDashoffset };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradientColors[0]} />
            <Stop offset="100%" stopColor={gradientColors[1]} />
          </LinearGradient>
        </Defs>

        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#gradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      {/* Center text */}
      <View style={styles.centerText}>
        <Text style={styles.value}>{Math.round(progress)}</Text>
        <Text style={styles.label}>%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...typography.displaySmall,
    color: colors.textPrimary,
  },
  label: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
```

---

## Design System Best Practices

### 1. Glassmorphism Rules

| Surface Type | Background | Blur | Border |
|--------------|-----------|------|--------|
| Ultra Light | rgba(255,255,255,0.02) | 25 | 0.04 |
| Light | rgba(255,255,255,0.04) | 45 | 0.06 |
| Medium | rgba(255,255,255,0.06) | 65 | 0.08 |
| Heavy | rgba(255,255,255,0.08) | 85 | 0.12 |

### 2. Animation Timing Guidelines

- **Micro-interactions**: 100-180ms (button press/release)
- **Standard transitions**: 250-350ms (fade, slide)
- **Modal presentations**: Use spring animations with `damping: 28, stiffness: 270`
- **List stagger**: 50ms base delay, cap at 400ms total

### 3. Haptic Feedback Mapping

| Action | Haptic Type |
|--------|-------------|
| Button tap | Light impact |
| Toggle switch | Selection |
| Card press | Light impact |
| Delete action | Heavy impact |
| Success | Notification success |
| Error | Notification error |

### 4. Color Accessibility

All text colors maintain WCAG 2.1 AA compliance:
- `textPrimary` (#ffffff): 21:1 contrast
- `textSecondary` (#e4e4ed): 15.4:1 contrast
- `textTertiary` (#a1a1b5): 7.2:1 contrast
- `textMuted` (#71718a): 4.8:1 contrast

---

## File Organization

```
src/
├── theme/
│   ├── index.ts              # Main theme exports
│   └── COMPONENT_STYLING_GUIDE.md
├── components/
│   ├── ui/
│   │   ├── GlassCard.tsx
│   │   ├── GradientButton.tsx
│   │   ├── AnimatedListItem.tsx
│   │   ├── BottomSheet.tsx
│   │   ├── Skeleton.tsx
│   │   ├── AnimatedTabBar.tsx
│   │   └── ProgressRing.tsx
│   └── biomarker/
│       └── BiomarkerCard.tsx
```

---

*Generated by The Council - FORMA, TECHNE, SOPHIA Agents*
*BioPoint Liquid UI v3.0.0*
