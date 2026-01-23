/**
 * BioPoint Liquid UI Theme v3.0.0
 *
 * A premium iOS-inspired dark theme with advanced glassmorphism, fluid animations,
 * Apple-style blur effects, and clinical-grade biomarker visualization.
 *
 * Features:
 * - Multi-layer glassmorphism with varying opacity and blur intensities
 * - iOS-native spring animations with precise timing curves
 * - Apple Human Interface Guidelines compliant color system
 * - Biomarker-specific status colors and data visualization palette
 * - expo-blur and react-native-reanimated ready configurations
 *
 * @version 3.0.0
 * @author The Council - FORMA, TECHNE, SOPHIA Agents
 */

import { StyleSheet, ViewStyle } from 'react-native';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Adds alpha transparency to a hex color
 */
export const withAlpha = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Creates a shadow style with custom color (iOS-optimized)
 */
export const createGlow = (
    color: string,
    radius: number,
    opacity: number,
    offset: { width: number; height: number } = { width: 0, height: 0 }
): ViewStyle => ({
    shadowColor: color,
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation: Math.round(radius / 2),
});

/**
 * Get biomarker status color based on value and thresholds
 */
export const getBiomarkerStatus = (
    value: number,
    optimal: { min: number; max: number },
    warning: { min: number; max: number }
): 'optimal' | 'suboptimal' | 'warning' | 'critical' => {
    if (value >= optimal.min && value <= optimal.max) return 'optimal';
    if (value >= warning.min && value <= warning.max) {
        return value < optimal.min ? 'suboptimal' : 'warning';
    }
    return 'critical';
};

// =============================================================================
// COLORS - Premium Dark Liquid UI Palette
// =============================================================================

export const colors = {
    // -------------------------------------------------------------------------
    // Primary Brand Colors - BioPoint Blue (Trust & Science)
    // -------------------------------------------------------------------------
    primary: '#3b82f6',
    primaryLight: '#60a5fa',
    primaryDark: '#2563eb',
    primaryMuted: '#1d4ed8',
    primaryDeep: '#1e3a8a',
    primarySubtle: 'rgba(59, 130, 246, 0.15)',

    // Full primary scale
    primaryScale: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
        950: '#172554',
    },

    // -------------------------------------------------------------------------
    // Accent Colors - BioPoint Green (Growth & Life)
    // -------------------------------------------------------------------------
    accent: '#4ade80',
    accentLight: '#86efac',
    accentDark: '#22c55e',
    accentMuted: '#16a34a',
    accentSubtle: 'rgba(74, 222, 128, 0.15)',

    // -------------------------------------------------------------------------
    // Vibrant Palette - Extended Colors
    // -------------------------------------------------------------------------
    violet: '#8b5cf6',
    violetLight: '#a78bfa',
    fuchsia: '#d946ef',
    rose: '#f43f5e',
    orange: '#f97316',
    amber: '#fbbf24',
    emerald: '#10b981',
    teal: '#14b8a6',
    sky: '#0ea5e9',
    indigo: '#5e5ce6',

    // -------------------------------------------------------------------------
    // Semantic Colors - Clinical Grade
    // -------------------------------------------------------------------------
    success: '#22c55e',
    successLight: '#4ade80',
    successDark: '#16a34a',
    successMuted: 'rgba(34, 197, 94, 0.15)',
    successGlow: 'rgba(34, 197, 94, 0.4)',

    warning: '#f59e0b',
    warningLight: '#fbbf24',
    warningDark: '#d97706',
    warningMuted: 'rgba(245, 158, 11, 0.15)',
    warningGlow: 'rgba(245, 158, 11, 0.4)',

    error: '#ef4444',
    errorLight: '#f87171',
    errorDark: '#dc2626',
    errorMuted: 'rgba(239, 68, 68, 0.15)',
    errorGlow: 'rgba(239, 68, 68, 0.4)',

    info: '#0ea5e9',
    infoLight: '#38bdf8',
    infoDark: '#0284c7',
    infoMuted: 'rgba(14, 165, 233, 0.15)',
    infoGlow: 'rgba(14, 165, 233, 0.4)',

    // -------------------------------------------------------------------------
    // Background Colors - Rich Blacks with Blue/Purple Undertones
    // -------------------------------------------------------------------------
    background: '#0a0a0f',
    backgroundSecondary: '#111118',
    backgroundCard: '#16161f',
    backgroundElevated: '#1c1c28',
    backgroundHover: '#22222f',
    backgroundActive: '#28283a',
    backgroundSubtle: '#252536',
    backgroundMuted: '#2a2a3d',

    // OLED-safe pure blacks
    backgroundVoid: '#050507',
    backgroundAbyss: '#08080c',

    // -------------------------------------------------------------------------
    // Glassmorphism Surface Colors
    // -------------------------------------------------------------------------
    glass: {
        ultraLight: 'rgba(255, 255, 255, 0.02)',
        light: 'rgba(255, 255, 255, 0.04)',
        medium: 'rgba(255, 255, 255, 0.06)',
        heavy: 'rgba(255, 255, 255, 0.08)',
        solid: 'rgba(255, 255, 255, 0.12)',
        border: 'rgba(255, 255, 255, 0.08)',
        borderLight: 'rgba(255, 255, 255, 0.12)',
        borderStrong: 'rgba(255, 255, 255, 0.15)',
        highlight: 'rgba(255, 255, 255, 0.05)',
        innerGlow: 'rgba(255, 255, 255, 0.03)',
    },

    // Colored glass variants
    glassColored: {
        primary: 'rgba(59, 130, 246, 0.08)',
        primaryBorder: 'rgba(59, 130, 246, 0.2)',
        accent: 'rgba(74, 222, 128, 0.08)',
        accentBorder: 'rgba(74, 222, 128, 0.2)',
        success: 'rgba(34, 197, 94, 0.08)',
        successBorder: 'rgba(34, 197, 94, 0.2)',
        warning: 'rgba(245, 158, 11, 0.08)',
        warningBorder: 'rgba(245, 158, 11, 0.2)',
        error: 'rgba(239, 68, 68, 0.08)',
        errorBorder: 'rgba(239, 68, 68, 0.2)',
    },

    // -------------------------------------------------------------------------
    // Text Colors - WCAG 2.1 Compliant
    // -------------------------------------------------------------------------
    textPrimary: '#ffffff',
    textSecondary: '#e4e4ed',
    textTertiary: '#a1a1b5',
    textMuted: '#71718a',
    textDisabled: '#4a4a5e',
    textInverse: '#0a0a0f',

    // -------------------------------------------------------------------------
    // Border Colors
    // -------------------------------------------------------------------------
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.12)',
    borderFocus: '#6366f1',
    borderSubtle: 'rgba(255, 255, 255, 0.04)',
    borderAccent: 'rgba(99, 102, 241, 0.3)',

    // -------------------------------------------------------------------------
    // Overlay Colors
    // -------------------------------------------------------------------------
    overlay: 'rgba(5, 5, 7, 0.8)',
    overlayLight: 'rgba(0, 0, 0, 0.5)',
    overlayHeavy: 'rgba(0, 0, 0, 0.85)',
    scrim: 'rgba(10, 10, 15, 0.9)',

    // -------------------------------------------------------------------------
    // Biomarker Status Colors - Clinical Grade
    // -------------------------------------------------------------------------
    biomarker: {
        optimal: {
            primary: '#22c55e',
            secondary: '#4ade80',
            background: 'rgba(34, 197, 94, 0.12)',
            border: 'rgba(34, 197, 94, 0.3)',
            glow: 'rgba(34, 197, 94, 0.5)',
        },
        suboptimal: {
            primary: '#eab308',
            secondary: '#facc15',
            background: 'rgba(234, 179, 8, 0.12)',
            border: 'rgba(234, 179, 8, 0.3)',
            glow: 'rgba(234, 179, 8, 0.5)',
        },
        warning: {
            primary: '#f97316',
            secondary: '#fb923c',
            background: 'rgba(249, 115, 22, 0.12)',
            border: 'rgba(249, 115, 22, 0.3)',
            glow: 'rgba(249, 115, 22, 0.5)',
        },
        critical: {
            primary: '#ef4444',
            secondary: '#f87171',
            background: 'rgba(239, 68, 68, 0.12)',
            border: 'rgba(239, 68, 68, 0.3)',
            glow: 'rgba(239, 68, 68, 0.5)',
        },
        unknown: {
            primary: '#6b7280',
            secondary: '#9ca3af',
            background: 'rgba(107, 114, 128, 0.12)',
            border: 'rgba(107, 114, 128, 0.3)',
            glow: 'rgba(107, 114, 128, 0.3)',
        },
    },

    // -------------------------------------------------------------------------
    // Chart & Data Visualization Palette
    // -------------------------------------------------------------------------
    chart: {
        series: [
            '#6366f1', // Indigo - primary
            '#22d3ee', // Cyan - secondary
            '#a78bfa', // Violet
            '#34d399', // Emerald
            '#fbbf24', // Amber
            '#f472b6', // Pink
            '#60a5fa', // Blue
            '#fb7185', // Rose
        ],
        areaFills: [
            'rgba(99, 102, 241, 0.3)',
            'rgba(34, 211, 238, 0.3)',
            'rgba(167, 139, 250, 0.3)',
            'rgba(52, 211, 153, 0.3)',
        ],
        grid: {
            line: 'rgba(255, 255, 255, 0.06)',
            lineMajor: 'rgba(255, 255, 255, 0.12)',
            label: '#71718a',
            axis: 'rgba(255, 255, 255, 0.15)',
        },
        reference: {
            target: '#22d3ee',
            threshold: '#f59e0b',
            average: '#a78bfa',
            baseline: 'rgba(255, 255, 255, 0.2)',
        },
    },

    // -------------------------------------------------------------------------
    // Biomarker Category Colors
    // -------------------------------------------------------------------------
    biomarkerCategory: {
        cardiovascular: '#FF6482',
        metabolic: '#BF5AF2',
        hormonal: '#FF9F0A',
        immune: '#30D158',
        cognitive: '#5E5CE6',
        energy: '#FFD60A',
        sleep: '#64D2FF',
        recovery: '#34D399',
    },

    // -------------------------------------------------------------------------
    // Interactive States
    // -------------------------------------------------------------------------
    interactive: {
        hover: {
            light: 'rgba(255, 255, 255, 0.08)',
            medium: 'rgba(255, 255, 255, 0.12)',
            colored: 'rgba(99, 102, 241, 0.15)',
        },
        pressed: {
            light: 'rgba(255, 255, 255, 0.04)',
            medium: 'rgba(255, 255, 255, 0.08)',
            colored: 'rgba(99, 102, 241, 0.25)',
        },
        focus: {
            ring: 'rgba(99, 102, 241, 0.5)',
            outline: '#6366f1',
        },
    },
};

// =============================================================================
// GRADIENTS - LinearGradient-ready Arrays
// =============================================================================

export const gradients = {
    // -------------------------------------------------------------------------
    // Brand Gradients
    // -------------------------------------------------------------------------
    primary: ['#4ade80', '#3b82f6'] as const, // The BioPoint Helix: Green (Life) -> Blue (Tech)
    primaryExtended: ['#86efac', '#4ade80', '#3b82f6'] as const,
    primaryGlow: ['#4ade80', '#3b82f6', '#1d4ed8'] as const,
    accent: ['#4ade80', '#22c55e'] as const,
    brand: ['#4ade80', '#3b82f6'] as const,

    // -------------------------------------------------------------------------
    // Vibrant Gradients
    // -------------------------------------------------------------------------
    aurora: ['#6366f1', '#8b5cf6', '#d946ef'] as const,
    cosmic: ['#4f46e5', '#7c3aed', '#c026d3'] as const,
    neon: ['#22d3ee', '#a855f7', '#f43f5e'] as const,
    sunset: ['#f43f5e', '#f97316', '#fbbf24'] as const,
    ocean: ['#0ea5e9', '#22d3ee', '#14b8a6'] as const,
    forest: ['#10b981', '#14b8a6', '#22d3ee'] as const,
    fire: ['#ef4444', '#f97316', '#fbbf24'] as const,

    // -------------------------------------------------------------------------
    // CTA Button Gradients
    // -------------------------------------------------------------------------
    cta: {
        primary: ['#6366f1', '#4f46e5'] as const,
        primaryGlow: ['#818cf8', '#6366f1', '#4f46e5'] as const,
        accent: ['#22d3ee', '#06b6d4'] as const,
        success: ['#22c55e', '#16a34a'] as const,
        premium: ['#fbbf24', '#f59e0b', '#d97706'] as const,
        danger: ['#f43f5e', '#e11d48'] as const,
    },

    // -------------------------------------------------------------------------
    // Glassmorphism Gradients
    // -------------------------------------------------------------------------
    glass: ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)'] as const,
    glassReverse: ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.08)'] as const,
    glassDark: ['rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 0.1)'] as const,
    glassColored: ['rgba(99, 102, 241, 0.12)', 'rgba(139, 92, 246, 0.04)'] as const,

    // -------------------------------------------------------------------------
    // Background Gradients
    // -------------------------------------------------------------------------
    background: {
        primary: ['#0a0a0f', '#0d0b14', '#0f0a12', '#0a0a0f'] as const,
        ambient: ['#0a0a0f', '#0f0d18', '#0a0a0f'] as const,
        radial: ['#16161f', '#0a0a0f'] as const,
        diagonal: ['#111118', '#0a0a0f'] as const,
        cardSurface: ['#1c1c28', '#16161f'] as const,
    },

    // -------------------------------------------------------------------------
    // Glow Gradients (Radial)
    // -------------------------------------------------------------------------
    glow: {
        primary: ['rgba(99, 102, 241, 0.4)', 'rgba(99, 102, 241, 0.1)', 'transparent'] as const,
        accent: ['rgba(34, 211, 238, 0.4)', 'rgba(34, 211, 238, 0.1)', 'transparent'] as const,
        success: ['rgba(34, 197, 94, 0.4)', 'rgba(34, 197, 94, 0.1)', 'transparent'] as const,
        warning: ['rgba(245, 158, 11, 0.4)', 'rgba(245, 158, 11, 0.1)', 'transparent'] as const,
        error: ['rgba(244, 63, 94, 0.4)', 'rgba(244, 63, 94, 0.1)', 'transparent'] as const,
    },

    // -------------------------------------------------------------------------
    // Data Visualization Gradients
    // -------------------------------------------------------------------------
    data: {
        healthScore: ['#ef4444', '#f97316', '#eab308', '#4ade80'] as const,
        progress: ['#3b82f6', '#4ade80', '#22d3ee'] as const,
        heartRateZone: ['#3b82f6', '#4ade80', '#eab308', '#f97316', '#ef4444'] as const,
        sleepQuality: ['#1e3a8a', '#1e40af', '#3b82f6', '#60a5fa'] as const,
        hydration: ['#fbbf24', '#22d3ee', '#3b82f6'] as const,
    },

    // -------------------------------------------------------------------------
    // Border Gradients (for premium effects)
    // -------------------------------------------------------------------------
    border: {
        shimmer: ['transparent', 'rgba(255, 255, 255, 0.1)', 'transparent'] as const,
        premium: ['rgba(99, 102, 241, 0.3)', 'rgba(139, 92, 246, 0.2)', 'rgba(34, 211, 238, 0.3)'] as const,
        success: ['rgba(34, 197, 94, 0.4)', 'rgba(34, 197, 94, 0.1)', 'rgba(34, 197, 94, 0.4)'] as const,
    },

    // -------------------------------------------------------------------------
    // Mesh Gradient Points (for Skia/advanced effects)
    // -------------------------------------------------------------------------
    mesh: {
        hero: [
            { color: 'rgba(99, 102, 241, 0.15)', position: [0, 0] },
            { color: 'rgba(34, 211, 238, 0.08)', position: [1, 0] },
            { color: 'rgba(139, 92, 246, 0.1)', position: [0, 1] },
            { color: 'rgba(6, 182, 212, 0.05)', position: [1, 1] },
        ],
        celebration: [
            { color: 'rgba(34, 197, 94, 0.2)', position: [0.5, 0] },
            { color: 'rgba(99, 102, 241, 0.15)', position: [0, 0.5] },
            { color: 'rgba(34, 211, 238, 0.15)', position: [1, 0.5] },
            { color: 'rgba(139, 92, 246, 0.1)', position: [0.5, 1] },
        ],
    },
};

// =============================================================================
// GLASSMORPHISM - Ready-to-Spread Styles
// =============================================================================

export const glass = {
    // -------------------------------------------------------------------------
    // Base Glass Layers
    // -------------------------------------------------------------------------
    ultraLight: {
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.04)',
    } as ViewStyle,

    light: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    } as ViewStyle,

    medium: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    } as ViewStyle,

    heavy: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    } as ViewStyle,

    solid: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    } as ViewStyle,

    // -------------------------------------------------------------------------
    // Frosted Glass (expo-blur ready)
    // -------------------------------------------------------------------------
    frosted: {
        backgroundColor: 'rgba(22, 22, 31, 0.7)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    } as ViewStyle,

    frostedDark: {
        backgroundColor: 'rgba(10, 10, 15, 0.85)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    } as ViewStyle,

    // -------------------------------------------------------------------------
    // Colored Glass Tints
    // -------------------------------------------------------------------------
    primary: {
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.2)',
    } as ViewStyle,

    accent: {
        backgroundColor: 'rgba(34, 211, 238, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(34, 211, 238, 0.2)',
    } as ViewStyle,

    success: {
        backgroundColor: 'rgba(34, 197, 94, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.2)',
    } as ViewStyle,

    warning: {
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.2)',
    } as ViewStyle,

    error: {
        backgroundColor: 'rgba(244, 63, 94, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(244, 63, 94, 0.2)',
    } as ViewStyle,

    // -------------------------------------------------------------------------
    // Interactive Glass States
    // -------------------------------------------------------------------------
    pressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    } as ViewStyle,

    selected: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
    } as ViewStyle,
};

// =============================================================================
// BLUR EFFECTS - expo-blur Configurations
// =============================================================================

export const blurEffects = {
    // -------------------------------------------------------------------------
    // Surface Blur Intensities (Dark Mode)
    // -------------------------------------------------------------------------
    surfaces: {
        ultraThin: { intensity: 25, tint: 'dark' as const },
        thin: { intensity: 45, tint: 'dark' as const },
        regular: { intensity: 65, tint: 'dark' as const },
        thick: { intensity: 85, tint: 'dark' as const },
        chrome: { intensity: 98, tint: 'dark' as const },
    },

    // -------------------------------------------------------------------------
    // Component-Specific Blur
    // -------------------------------------------------------------------------
    components: {
        navigationBar: { intensity: 85, tint: 'dark' as const },
        tabBar: { intensity: 90, tint: 'dark' as const },
        modalBackdrop: { intensity: 30, tint: 'dark' as const },
        actionSheet: { intensity: 80, tint: 'dark' as const },
        toast: { intensity: 70, tint: 'dark' as const },
        floatingCard: { intensity: 60, tint: 'dark' as const },
        searchBar: { intensity: 50, tint: 'dark' as const },
    },

    // -------------------------------------------------------------------------
    // Vibrancy Configurations
    // -------------------------------------------------------------------------
    vibrancy: {
        label: { intensity: 50, tint: 'default' as const },
        secondaryLabel: { intensity: 40, tint: 'default' as const },
        prominent: { intensity: 70, tint: 'prominent' as const },
        fill: { intensity: 30, tint: 'default' as const },
    },
};

// =============================================================================
// ANIMATIONS - iOS-Native Spring Configurations
// =============================================================================

export const animations = {
    // -------------------------------------------------------------------------
    // Spring Configurations (react-native-reanimated)
    // -------------------------------------------------------------------------
    springs: {
        /** Standard iOS interactive spring */
        interactive: {
            damping: 20,
            stiffness: 300,
            mass: 1,
        },

        /** Quick response for buttons */
        snappy: {
            damping: 22,
            stiffness: 400,
            mass: 0.8,
        },

        /** Playful bounce */
        bouncy: {
            damping: 12,
            stiffness: 200,
            mass: 0.9,
        },

        /** Soft ambient animations */
        gentle: {
            damping: 25,
            stiffness: 120,
            mass: 1.2,
        },

        /** iOS modal presentation */
        modalPresent: {
            damping: 28,
            stiffness: 270,
            mass: 0.95,
        },

        /** Bottom sheet presentation */
        bottomSheet: {
            damping: 24,
            stiffness: 350,
            mass: 0.9,
        },

        /** Quick dismissal */
        sheetDismiss: {
            damping: 30,
            stiffness: 400,
            mass: 0.85,
            overshootClamping: true,
        },

        /** Card lift on press */
        cardLift: {
            damping: 18,
            stiffness: 280,
            mass: 0.85,
        },

        /** Card return to rest */
        cardSettle: {
            damping: 22,
            stiffness: 240,
            mass: 1,
        },

        /** List item entrance */
        listItem: {
            damping: 20,
            stiffness: 320,
            mass: 0.8,
        },

        /** Tab switch animation */
        tabSwitch: {
            damping: 26,
            stiffness: 260,
            mass: 0.9,
        },
    },

    // -------------------------------------------------------------------------
    // Timing Durations (milliseconds)
    // -------------------------------------------------------------------------
    durations: {
        instant: 50,
        fast: 150,
        normal: 250,
        slow: 400,
        slower: 600,
        slowest: 1000,
    },

    // -------------------------------------------------------------------------
    // Timing Configurations
    // -------------------------------------------------------------------------
    timings: {
        /** iOS default system curve (350ms) */
        systemDefault: { duration: 350 },

        /** Ease out for entering elements */
        easeOut: { duration: 300 },

        /** Ease in for leaving elements */
        easeIn: { duration: 250 },

        /** Button press feedback */
        buttonPress: { duration: 100 },

        /** Button release */
        buttonRelease: { duration: 180 },

        /** Toggle switch */
        toggle: { duration: 200 },

        /** Fade transition */
        fade: { duration: 200 },

        /** Quick fade for overlays */
        quickFade: { duration: 150 },

        /** Shimmer cycle */
        shimmer: { duration: 1500 },

        /** Pulse cycle */
        pulse: { duration: 2000 },
    },

    // -------------------------------------------------------------------------
    // Easing Curves (Cubic Bezier)
    // -------------------------------------------------------------------------
    easing: {
        smooth: [0.4, 0, 0.2, 1] as const,
        decelerate: [0, 0, 0.2, 1] as const,
        accelerate: [0.4, 0, 1, 1] as const,
        sharp: [0.4, 0, 0.6, 1] as const,
        elastic: [0.68, -0.55, 0.27, 1.55] as const,
        appleEase: [0.25, 0.1, 0.25, 1] as const,
    },

    // -------------------------------------------------------------------------
    // Animation Presets
    // -------------------------------------------------------------------------
    presets: {
        buttonPress: {
            scale: 0.97,
            opacity: 0.8,
        },
        cardLift: {
            scale: 1.02,
            translateY: -8,
        },
        modalEnter: {
            from: { opacity: 0, scale: 0.95, translateY: 20 },
            to: { opacity: 1, scale: 1, translateY: 0 },
        },
        fadeIn: {
            from: { opacity: 0 },
            to: { opacity: 1 },
        },
        slideUp: {
            from: { translateY: 50, opacity: 0 },
            to: { translateY: 0, opacity: 1 },
        },
        pulse: {
            scale: [1, 1.05, 1],
            opacity: [1, 0.8, 1],
        },
    },

    // -------------------------------------------------------------------------
    // Stagger Delays (for list animations)
    // -------------------------------------------------------------------------
    stagger: {
        fast: 30,
        normal: 50,
        slow: 80,
        maxDelay: 400,
    },

    // -------------------------------------------------------------------------
    // Gesture Configurations
    // -------------------------------------------------------------------------
    gestures: {
        drag: {
            activeOffsetX: [-10, 10],
            activeOffsetY: [-10, 10],
        },
        swipe: {
            velocityThreshold: 500,
            directionalOffsetThreshold: 80,
        },
        longPress: {
            minDurationMs: 500,
            maxDist: 10,
        },
        pullToRefresh: {
            triggerThreshold: 80,
            maxPullDistance: 120,
        },
    },
};

// =============================================================================
// SPACING - 8-Point Grid System
// =============================================================================

export const spacing = {
    none: 0,
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,

    // Semantic spacing
    gutter: 20,
    cardPadding: 20,
    sectionGap: 32,
    listItemGap: 12,
    inputPadding: 16,
    buttonPadding: 16,

    // Safe area
    safeAreaTop: 59,
    safeAreaBottom: 34,
};

// =============================================================================
// BORDER RADIUS - Consistent Corner Radii
// =============================================================================

export const borderRadius = {
    none: 0,
    xs: 4,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    full: 9999,

    // Semantic radii
    card: 20,
    button: 12,
    input: 12,
    badge: 8,
    avatar: 9999,
    modal: 24,
    bottomSheet: 24,
};

// =============================================================================
// TYPOGRAPHY - Apple HIG Compliant
// =============================================================================

export const typography = {
    // -------------------------------------------------------------------------
    // Display - Hero Numbers
    // -------------------------------------------------------------------------
    displayLarge: {
        fontSize: 57,
        fontWeight: '700' as const,
        lineHeight: 64,
        letterSpacing: -0.25,
    },
    displayMedium: {
        fontSize: 45,
        fontWeight: '700' as const,
        lineHeight: 52,
        letterSpacing: 0,
    },
    displaySmall: {
        fontSize: 36,
        fontWeight: '600' as const,
        lineHeight: 44,
        letterSpacing: 0,
    },

    // -------------------------------------------------------------------------
    // Headlines - Section Headers
    // -------------------------------------------------------------------------
    h1: {
        fontSize: 32,
        fontWeight: '700' as const,
        lineHeight: 40,
        letterSpacing: -0.5,
    },
    h2: {
        fontSize: 28,
        fontWeight: '600' as const,
        lineHeight: 36,
        letterSpacing: -0.3,
    },
    h3: {
        fontSize: 24,
        fontWeight: '600' as const,
        lineHeight: 32,
        letterSpacing: -0.2,
    },
    h4: {
        fontSize: 22,
        fontWeight: '600' as const,
        lineHeight: 28,
        letterSpacing: 0,
    },

    // -------------------------------------------------------------------------
    // Title - Card Headers
    // -------------------------------------------------------------------------
    titleLarge: {
        fontSize: 22,
        fontWeight: '600' as const,
        lineHeight: 28,
        letterSpacing: 0,
    },
    titleMedium: {
        fontSize: 17,
        fontWeight: '600' as const,
        lineHeight: 24,
        letterSpacing: 0.15,
    },
    titleSmall: {
        fontSize: 14,
        fontWeight: '600' as const,
        lineHeight: 20,
        letterSpacing: 0.1,
    },

    // -------------------------------------------------------------------------
    // Body - Primary Content
    // -------------------------------------------------------------------------
    body: {
        fontSize: 17,
        fontWeight: '400' as const,
        lineHeight: 24,
        letterSpacing: 0,
    },
    bodyMedium: {
        fontSize: 15,
        fontWeight: '500' as const,
        lineHeight: 22,
        letterSpacing: 0.25,
    },
    bodySmall: {
        fontSize: 13,
        fontWeight: '400' as const,
        lineHeight: 18,
        letterSpacing: 0.4,
    },

    // -------------------------------------------------------------------------
    // Labels - Buttons, Tags
    // -------------------------------------------------------------------------
    label: {
        fontSize: 15,
        fontWeight: '600' as const,
        lineHeight: 20,
        letterSpacing: 0.1,
    },
    labelMedium: {
        fontSize: 13,
        fontWeight: '600' as const,
        lineHeight: 18,
        letterSpacing: 0.5,
    },
    labelSmall: {
        fontSize: 11,
        fontWeight: '600' as const,
        lineHeight: 16,
        letterSpacing: 0.5,
        textTransform: 'uppercase' as const,
    },

    // -------------------------------------------------------------------------
    // Utility
    // -------------------------------------------------------------------------
    caption: {
        fontSize: 12,
        fontWeight: '400' as const,
        lineHeight: 16,
        letterSpacing: 0.4,
    },
    button: {
        fontSize: 17,
        fontWeight: '600' as const,
        lineHeight: 22,
        letterSpacing: 0,
    },
    buttonSmall: {
        fontSize: 15,
        fontWeight: '600' as const,
        lineHeight: 20,
        letterSpacing: 0,
    },
    overline: {
        fontSize: 11,
        fontWeight: '600' as const,
        lineHeight: 16,
        letterSpacing: 1,
        textTransform: 'uppercase' as const,
    },
};

// =============================================================================
// SHADOWS - iOS-Optimized with Colored Glows
// =============================================================================

export const shadows = {
    // -------------------------------------------------------------------------
    // Elevation Shadows
    // -------------------------------------------------------------------------
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    } as ViewStyle,

    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    } as ViewStyle,

    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    } as ViewStyle,

    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    } as ViewStyle,

    xl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.35,
        shadowRadius: 25,
        elevation: 15,
    } as ViewStyle,

    xxl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.4,
        shadowRadius: 35,
        elevation: 20,
    } as ViewStyle,

    // -------------------------------------------------------------------------
    // Colored Glow Effects
    // -------------------------------------------------------------------------
    glow: {
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    } as ViewStyle,

    primaryGlow: {
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    } as ViewStyle,

    primaryGlowIntense: {
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 24,
        elevation: 12,
    } as ViewStyle,

    accentGlow: {
        shadowColor: '#22d3ee',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    } as ViewStyle,

    successGlow: {
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    } as ViewStyle,

    warningGlow: {
        shadowColor: '#f59e0b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    } as ViewStyle,

    errorGlow: {
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    } as ViewStyle,

    // -------------------------------------------------------------------------
    // Component Shadows
    // -------------------------------------------------------------------------
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    } as ViewStyle,

    cardHover: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    } as ViewStyle,

    button: {
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    } as ViewStyle,

    buttonPressed: {
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    } as ViewStyle,

    // -------------------------------------------------------------------------
    // Inner Effects
    // -------------------------------------------------------------------------
    innerGlow: {
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    } as ViewStyle,

    innerGlowPrimary: {
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
    } as ViewStyle,
};

// =============================================================================
// COMPONENT STYLES - Pre-built Liquid UI Components
// =============================================================================

export const componentStyles = {
    // -------------------------------------------------------------------------
    // Glass Card
    // -------------------------------------------------------------------------
    glassCard: StyleSheet.create({
        container: {
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 20,
            padding: 20,
            overflow: 'hidden',
        },
        containerElevated: {
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 20,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 10,
            overflow: 'hidden',
        },
        containerSelected: {
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            borderWidth: 1,
            borderColor: 'rgba(99, 102, 241, 0.3)',
            borderRadius: 20,
            padding: 20,
            overflow: 'hidden',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
        },
        title: {
            fontSize: 17,
            fontWeight: '600',
            color: '#ffffff',
            letterSpacing: 0,
        },
        subtitle: {
            fontSize: 14,
            color: '#a1a1b5',
            marginTop: 4,
        },
        content: {
            flex: 1,
        },
        footer: {
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.06)',
        },
    }),

    // -------------------------------------------------------------------------
    // Gradient Button
    // -------------------------------------------------------------------------
    gradientButton: StyleSheet.create({
        container: {
            borderRadius: 12,
            overflow: 'hidden',
        },
        gradient: {
            paddingVertical: 16,
            paddingHorizontal: 24,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
        },
        text: {
            fontSize: 17,
            fontWeight: '600',
            color: '#ffffff',
            letterSpacing: 0,
        },
        icon: {
            marginRight: 8,
        },
        disabled: {
            opacity: 0.5,
        },
        small: {
            paddingVertical: 12,
            paddingHorizontal: 16,
        },
        smallText: {
            fontSize: 15,
        },
        large: {
            paddingVertical: 18,
            paddingHorizontal: 32,
        },
        largeText: {
            fontSize: 17,
        },
    }),

    // -------------------------------------------------------------------------
    // Glowing Input
    // -------------------------------------------------------------------------
    glowingInput: StyleSheet.create({
        container: {
            position: 'relative',
        },
        inputWrapper: {
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 12,
            overflow: 'hidden',
        },
        inputWrapperFocused: {
            borderColor: '#6366f1',
            shadowColor: '#6366f1',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 4,
        },
        inputWrapperError: {
            borderColor: '#ef4444',
            shadowColor: '#ef4444',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 4,
        },
        input: {
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 17,
            color: '#ffffff',
        },
        label: {
            fontSize: 14,
            fontWeight: '500',
            color: '#a1a1b5',
            marginBottom: 8,
        },
        labelFocused: {
            color: '#6366f1',
        },
        errorText: {
            fontSize: 12,
            color: '#ef4444',
            marginTop: 6,
        },
        helperText: {
            fontSize: 12,
            color: '#71718a',
            marginTop: 6,
        },
    }),

    // -------------------------------------------------------------------------
    // Biomarker Card
    // -------------------------------------------------------------------------
    biomarkerCard: StyleSheet.create({
        container: {
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 20,
            padding: 20,
            minHeight: 140,
        },
        iconContainer: {
            width: 44,
            height: 44,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
        },
        valueContainer: {
            flexDirection: 'row',
            alignItems: 'baseline',
        },
        primaryValue: {
            fontSize: 34,
            fontWeight: '700',
            letterSpacing: -0.5,
            color: '#ffffff',
        },
        unitLabel: {
            fontSize: 16,
            fontWeight: '500',
            color: 'rgba(255, 255, 255, 0.5)',
            marginLeft: 4,
        },
        rangeBar: {
            height: 6,
            borderRadius: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            marginTop: 16,
            overflow: 'hidden',
        },
        rangeFill: {
            height: '100%',
            borderRadius: 3,
        },
        statusBadge: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
            alignSelf: 'flex-start',
        },
        statusText: {
            fontSize: 12,
            fontWeight: '600',
            letterSpacing: 0.3,
        },
    }),

    // -------------------------------------------------------------------------
    // Badge
    // -------------------------------------------------------------------------
    badge: StyleSheet.create({
        container: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
            alignSelf: 'flex-start',
        },
        text: {
            fontSize: 12,
            fontWeight: '600',
            letterSpacing: 0.3,
        },
        primary: {
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
        },
        primaryText: {
            color: '#818cf8',
        },
        success: {
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
        },
        successText: {
            color: '#4ade80',
        },
        warning: {
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
        },
        warningText: {
            color: '#fbbf24',
        },
        error: {
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
        },
        errorText: {
            color: '#f87171',
        },
        glass: {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
        },
        glassText: {
            color: '#ffffff',
        },
    }),

    // -------------------------------------------------------------------------
    // Modal
    // -------------------------------------------------------------------------
    modal: StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(5, 5, 7, 0.8)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        container: {
            width: '100%',
            maxWidth: 400,
            backgroundColor: '#16161f',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
        },
        header: {
            padding: 24,
            paddingBottom: 0,
        },
        title: {
            fontSize: 20,
            fontWeight: '600',
            color: '#ffffff',
            textAlign: 'center',
        },
        subtitle: {
            fontSize: 14,
            color: '#a1a1b5',
            textAlign: 'center',
            marginTop: 8,
        },
        body: {
            padding: 24,
        },
        footer: {
            padding: 24,
            paddingTop: 0,
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 12,
        },
    }),

    // -------------------------------------------------------------------------
    // Bottom Sheet
    // -------------------------------------------------------------------------
    bottomSheet: StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(5, 5, 7, 0.8)',
            justifyContent: 'flex-end',
        },
        container: {
            backgroundColor: 'rgba(22, 22, 31, 0.98)',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderBottomWidth: 0,
            maxHeight: '90%',
        },
        handle: {
            width: 36,
            height: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 2,
            alignSelf: 'center',
            marginTop: 12,
            marginBottom: 8,
        },
        content: {
            padding: 20,
        },
    }),

    // -------------------------------------------------------------------------
    // Tab Bar
    // -------------------------------------------------------------------------
    tabBar: StyleSheet.create({
        container: {
            flexDirection: 'row',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 12,
            padding: 4,
        },
        tab: {
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
        },
        tabActive: {
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
        },
        tabText: {
            fontSize: 14,
            fontWeight: '500',
            color: '#71718a',
        },
        tabTextActive: {
            color: '#818cf8',
        },
    }),

    // -------------------------------------------------------------------------
    // Progress Bar
    // -------------------------------------------------------------------------
    progressBar: StyleSheet.create({
        container: {
            height: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 4,
            overflow: 'hidden',
        },
        fill: {
            height: '100%',
            borderRadius: 4,
        },
        containerSmall: {
            height: 4,
        },
        containerLarge: {
            height: 12,
        },
        label: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 8,
        },
        labelText: {
            fontSize: 14,
            color: '#a1a1b5',
        },
        valueText: {
            fontSize: 14,
            fontWeight: '600',
            color: '#ffffff',
        },
    }),

    // -------------------------------------------------------------------------
    // Skeleton
    // -------------------------------------------------------------------------
    skeleton: StyleSheet.create({
        container: {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 8,
            overflow: 'hidden',
        },
        shimmer: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
        },
        text: {
            height: 16,
            borderRadius: 4,
        },
        title: {
            height: 24,
            borderRadius: 6,
        },
        avatar: {
            borderRadius: 9999,
        },
        card: {
            borderRadius: 20,
        },
    }),

    // -------------------------------------------------------------------------
    // Floating Action Button
    // -------------------------------------------------------------------------
    fab: StyleSheet.create({
        container: {
            position: 'absolute',
            bottom: 24,
            right: 24,
        },
        button: {
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#6366f1',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8,
        },
        buttonSmall: {
            width: 44,
            height: 44,
            borderRadius: 22,
        },
        buttonLarge: {
            width: 72,
            height: 72,
            borderRadius: 36,
        },
    }),
};

// =============================================================================
// LAYOUT HELPERS
// =============================================================================

export const layout = {
    screen: {
        flex: 1,
        backgroundColor: colors.background,
    } as ViewStyle,

    center: {
        alignItems: 'center',
        justifyContent: 'center',
    } as ViewStyle,

    row: {
        flexDirection: 'row',
        alignItems: 'center',
    } as ViewStyle,

    rowBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    } as ViewStyle,

    column: {
        flexDirection: 'column',
    } as ViewStyle,

    absoluteFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    } as ViewStyle,
};

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
export type Typography = typeof typography;
export type Shadows = typeof shadows;
export type Glass = typeof glass;
export type Gradients = typeof gradients;
export type Animations = typeof animations;
export type BlurEffects = typeof blurEffects;
export type ComponentStyles = typeof componentStyles;
export type Layout = typeof layout;

// =============================================================================
// THEME OBJECT (for ThemeProvider usage)
// =============================================================================

export const theme = {
    colors,
    spacing,
    borderRadius,
    typography,
    shadows,
    glass,
    gradients,
    animations,
    blurEffects,
    componentStyles,
    layout,
    helpers: {
        withAlpha,
        createGlow,
        getBiomarkerStatus,
    },
} as const;

export type Theme = typeof theme;

export default theme;
