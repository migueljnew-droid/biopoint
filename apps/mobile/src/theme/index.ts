/**
 * BioPoint Institutional UI Theme v4.0.0
 *
 * A clinical-grade light theme designed for trust, authority, and readability.
 * Inspired by leading health institutions (Mayo Clinic, Cleveland Clinic, Epic).
 *
 * Features:
 * - Clean light surfaces with subtle elevation and borders
 * - Deep navy primary palette conveying institutional trust
 * - Clinical teal accents for health authority
 * - iOS-native spring animations with precise timing curves
 * - Apple Human Interface Guidelines compliant color system
 * - Biomarker-specific status colors and data visualization palette
 * - expo-blur and react-native-reanimated ready configurations
 *
 * @version 4.0.0
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
// COLORS - Institutional Clinical Light Palette
// =============================================================================

export const colors = {
    // -------------------------------------------------------------------------
    // Primary Brand Colors - Deep Navy (Institutional Trust)
    // -------------------------------------------------------------------------
    primary: '#1B4B7A',
    primaryLight: '#2D6BA4',
    primaryDark: '#0F2B46',
    primaryMuted: '#143D66',
    primaryDeep: '#0A1F3A',
    primarySubtle: 'rgba(27, 75, 122, 0.1)',

    // Full primary scale
    primaryScale: {
        50: '#F0F5FA',
        100: '#D9E6F2',
        200: '#B3CCE5',
        300: '#8DB3D9',
        400: '#5E8FBF',
        500: '#1B4B7A',
        600: '#163F67',
        700: '#113354',
        800: '#0C2741',
        900: '#071B2E',
        950: '#030F1A',
    },

    // -------------------------------------------------------------------------
    // Accent Colors - Clinical Teal (Health Authority)
    // -------------------------------------------------------------------------
    accent: '#0D9488',
    accentLight: '#2DD4BF',
    accentDark: '#0F766E',
    accentMuted: '#0D7A70',
    accentSubtle: 'rgba(13, 148, 136, 0.1)',

    // -------------------------------------------------------------------------
    // Extended Palette - Muted Institutional
    // -------------------------------------------------------------------------
    violet: '#7C3AED',
    violetLight: '#A78BFA',
    fuchsia: '#C026D3',
    rose: '#E11D48',
    orange: '#EA580C',
    amber: '#D97706',
    emerald: '#059669',
    teal: '#0D9488',
    sky: '#0284C7',
    indigo: '#1B4B7A',

    // -------------------------------------------------------------------------
    // Semantic Colors - Clinical Grade
    // -------------------------------------------------------------------------
    success: '#16A34A',
    successLight: '#22C55E',
    successDark: '#15803D',
    successMuted: 'rgba(22, 163, 74, 0.1)',
    successGlow: 'rgba(22, 163, 74, 0.2)',

    warning: '#D97706',
    warningLight: '#F59E0B',
    warningDark: '#B45309',
    warningMuted: 'rgba(217, 119, 6, 0.1)',
    warningGlow: 'rgba(217, 119, 6, 0.2)',

    error: '#DC2626',
    errorLight: '#EF4444',
    errorDark: '#B91C1C',
    errorMuted: 'rgba(220, 38, 38, 0.1)',
    errorGlow: 'rgba(220, 38, 38, 0.2)',

    info: '#0284C7',
    infoLight: '#0EA5E9',
    infoDark: '#0369A1',
    infoMuted: 'rgba(2, 132, 199, 0.1)',
    infoGlow: 'rgba(2, 132, 199, 0.2)',

    // -------------------------------------------------------------------------
    // Background Colors - True Dark Mode (OLED Optimized)
    // -------------------------------------------------------------------------
    background: '#0A0A0F',
    backgroundSecondary: '#111118',
    backgroundCard: '#16161E',
    backgroundElevated: '#1C1C26',
    backgroundHover: '#1E1E28',
    backgroundActive: '#252530',
    backgroundSubtle: '#131318',
    backgroundMuted: '#1A1A22',

    // Deep blacks
    backgroundVoid: '#000000',
    backgroundAbyss: '#050508',

    // -------------------------------------------------------------------------
    // Surface Colors (Dark Mode Glass)
    // -------------------------------------------------------------------------
    glass: {
        ultraLight: 'rgba(255, 255, 255, 0.04)',
        light: 'rgba(255, 255, 255, 0.06)',
        medium: 'rgba(255, 255, 255, 0.10)',
        heavy: 'rgba(255, 255, 255, 0.14)',
        solid: 'rgba(255, 255, 255, 0.18)',
        border: 'rgba(255, 255, 255, 0.08)',
        borderLight: 'rgba(255, 255, 255, 0.05)',
        borderStrong: 'rgba(255, 255, 255, 0.15)',
        highlight: 'rgba(255, 255, 255, 0.04)',
        innerGlow: 'rgba(255, 255, 255, 0.02)',
    },

    // Colored surface variants
    glassColored: {
        primary: 'rgba(27, 75, 122, 0.15)',
        primaryBorder: 'rgba(27, 75, 122, 0.25)',
        accent: 'rgba(13, 148, 136, 0.15)',
        accentBorder: 'rgba(13, 148, 136, 0.25)',
        success: 'rgba(22, 163, 74, 0.15)',
        successBorder: 'rgba(22, 163, 74, 0.25)',
        warning: 'rgba(217, 119, 6, 0.15)',
        warningBorder: 'rgba(217, 119, 6, 0.25)',
        error: 'rgba(220, 38, 38, 0.15)',
        errorBorder: 'rgba(220, 38, 38, 0.25)',
    },

    // -------------------------------------------------------------------------
    // Text Colors - WCAG 2.1 Compliant on Dark Backgrounds
    // -------------------------------------------------------------------------
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    textMuted: '#475569',
    textDisabled: '#334155',
    textInverse: '#0F172A',

    // -------------------------------------------------------------------------
    // Border Colors
    // -------------------------------------------------------------------------
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.05)',
    borderFocus: '#2D6BA4',
    borderSubtle: 'rgba(255, 255, 255, 0.03)',
    borderAccent: 'rgba(45, 107, 164, 0.3)',

    // -------------------------------------------------------------------------
    // Overlay Colors
    // -------------------------------------------------------------------------
    overlay: 'rgba(15, 23, 42, 0.6)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',
    overlayHeavy: 'rgba(0, 0, 0, 0.7)',
    scrim: 'rgba(15, 23, 42, 0.8)',

    // -------------------------------------------------------------------------
    // Biomarker Status Colors - Clinical Grade
    // -------------------------------------------------------------------------
    biomarker: {
        optimal: {
            primary: '#16A34A',
            secondary: '#22C55E',
            background: 'rgba(22, 163, 74, 0.08)',
            border: 'rgba(22, 163, 74, 0.2)',
            glow: 'rgba(22, 163, 74, 0.15)',
        },
        suboptimal: {
            primary: '#CA8A04',
            secondary: '#EAB308',
            background: 'rgba(202, 138, 4, 0.08)',
            border: 'rgba(202, 138, 4, 0.2)',
            glow: 'rgba(202, 138, 4, 0.15)',
        },
        warning: {
            primary: '#EA580C',
            secondary: '#F97316',
            background: 'rgba(234, 88, 12, 0.08)',
            border: 'rgba(234, 88, 12, 0.2)',
            glow: 'rgba(234, 88, 12, 0.15)',
        },
        critical: {
            primary: '#DC2626',
            secondary: '#EF4444',
            background: 'rgba(220, 38, 38, 0.08)',
            border: 'rgba(220, 38, 38, 0.2)',
            glow: 'rgba(220, 38, 38, 0.15)',
        },
        unknown: {
            primary: '#6B7280',
            secondary: '#9CA3AF',
            background: 'rgba(107, 114, 128, 0.08)',
            border: 'rgba(107, 114, 128, 0.2)',
            glow: 'rgba(107, 114, 128, 0.15)',
        },
    },

    // -------------------------------------------------------------------------
    // Chart & Data Visualization Palette
    // -------------------------------------------------------------------------
    chart: {
        series: [
            '#1B4B7A', // Navy - primary
            '#0D9488', // Teal - secondary
            '#7C3AED', // Violet
            '#059669', // Emerald
            '#D97706', // Amber
            '#DB2777', // Pink
            '#2D6BA4', // Blue
            '#E11D48', // Rose
        ],
        areaFills: [
            'rgba(27, 75, 122, 0.15)',
            'rgba(13, 148, 136, 0.15)',
            'rgba(124, 58, 237, 0.15)',
            'rgba(5, 150, 105, 0.15)',
        ],
        grid: {
            line: 'rgba(0, 0, 0, 0.06)',
            lineMajor: 'rgba(0, 0, 0, 0.12)',
            label: '#94A3B8',
            axis: 'rgba(0, 0, 0, 0.15)',
        },
        reference: {
            target: '#0D9488',
            threshold: '#D97706',
            average: '#7C3AED',
            baseline: 'rgba(0, 0, 0, 0.1)',
        },
    },

    // -------------------------------------------------------------------------
    // Biomarker Category Colors (Darkened for light backgrounds)
    // -------------------------------------------------------------------------
    biomarkerCategory: {
        cardiovascular: '#E11D48',
        metabolic: '#9333EA',
        hormonal: '#EA580C',
        immune: '#16A34A',
        cognitive: '#1B4B7A',
        energy: '#CA8A04',
        sleep: '#0284C7',
        recovery: '#059669',
    },

    // -------------------------------------------------------------------------
    // Interactive States
    // -------------------------------------------------------------------------
    interactive: {
        hover: {
            light: 'rgba(0, 0, 0, 0.04)',
            medium: 'rgba(0, 0, 0, 0.08)',
            colored: 'rgba(27, 75, 122, 0.08)',
        },
        pressed: {
            light: 'rgba(0, 0, 0, 0.08)',
            medium: 'rgba(0, 0, 0, 0.12)',
            colored: 'rgba(27, 75, 122, 0.15)',
        },
        focus: {
            ring: 'rgba(27, 75, 122, 0.3)',
            outline: '#1B4B7A',
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
    primary: ['#0D9488', '#1B4B7A'] as const, // The BioPoint Helix: Teal (Health) -> Navy (Trust)
    primaryExtended: ['#2DD4BF', '#0D9488', '#1B4B7A'] as const,
    primaryGlow: ['#0D9488', '#1B4B7A', '#0F2B46'] as const,
    accent: ['#0D9488', '#0F766E'] as const,
    brand: ['#0D9488', '#1B4B7A'] as const,

    // -------------------------------------------------------------------------
    // Subtle Gradients (Institutional)
    // -------------------------------------------------------------------------
    aurora: ['#1B4B7A', '#7C3AED', '#C026D3'] as const,
    cosmic: ['#0F2B46', '#6D28D9', '#A21CAF'] as const,
    neon: ['#0D9488', '#7C3AED', '#E11D48'] as const,
    sunset: ['#E11D48', '#EA580C', '#D97706'] as const,
    ocean: ['#0284C7', '#0D9488', '#0F766E'] as const,
    forest: ['#059669', '#0D9488', '#0284C7'] as const,
    fire: ['#DC2626', '#EA580C', '#D97706'] as const,

    // -------------------------------------------------------------------------
    // CTA Button Gradients
    // -------------------------------------------------------------------------
    cta: {
        primary: ['#1B4B7A', '#0F2B46'] as const,
        primaryGlow: ['#2D6BA4', '#1B4B7A', '#0F2B46'] as const,
        accent: ['#0D9488', '#0F766E'] as const,
        success: ['#16A34A', '#15803D'] as const,
        premium: ['#D97706', '#B45309', '#92400E'] as const,
        danger: ['#E11D48', '#BE123C'] as const,
    },

    // -------------------------------------------------------------------------
    // Surface Gradients (Light Mode)
    // -------------------------------------------------------------------------
    glass: ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)'] as const,
    glassReverse: ['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.08)'] as const,
    glassDark: ['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)'] as const,
    glassColored: ['rgba(27, 75, 122, 0.06)', 'rgba(13, 148, 136, 0.03)'] as const,

    // -------------------------------------------------------------------------
    // Background Gradients
    // -------------------------------------------------------------------------
    background: {
        primary: ['#0A0A0F', '#0E0E16', '#111118', '#0A0A0F'] as const,
        ambient: ['#0A0A0F', '#0E0E16', '#0A0A0F'] as const,
        radial: ['#16161E', '#0A0A0F'] as const,
        diagonal: ['#0E0E16', '#0A0A0F'] as const,
        cardSurface: ['#16161E', '#111118'] as const,
    },

    // -------------------------------------------------------------------------
    // Subtle Glow Gradients (Radial)
    // -------------------------------------------------------------------------
    glow: {
        primary: ['rgba(27, 75, 122, 0.15)', 'rgba(27, 75, 122, 0.05)', 'transparent'] as const,
        accent: ['rgba(13, 148, 136, 0.15)', 'rgba(13, 148, 136, 0.05)', 'transparent'] as const,
        success: ['rgba(22, 163, 74, 0.15)', 'rgba(22, 163, 74, 0.05)', 'transparent'] as const,
        warning: ['rgba(217, 119, 6, 0.15)', 'rgba(217, 119, 6, 0.05)', 'transparent'] as const,
        error: ['rgba(220, 38, 38, 0.15)', 'rgba(220, 38, 38, 0.05)', 'transparent'] as const,
    },

    // -------------------------------------------------------------------------
    // Data Visualization Gradients
    // -------------------------------------------------------------------------
    data: {
        healthScore: ['#DC2626', '#EA580C', '#CA8A04', '#16A34A'] as const,
        progress: ['#1B4B7A', '#0D9488', '#0284C7'] as const,
        heartRateZone: ['#1B4B7A', '#16A34A', '#CA8A04', '#EA580C', '#DC2626'] as const,
        sleepQuality: ['#0A1F3A', '#0F2B46', '#1B4B7A', '#2D6BA4'] as const,
        hydration: ['#D97706', '#0D9488', '#1B4B7A'] as const,
    },

    // -------------------------------------------------------------------------
    // Border Gradients
    // -------------------------------------------------------------------------
    border: {
        shimmer: ['transparent', 'rgba(0, 0, 0, 0.06)', 'transparent'] as const,
        premium: ['rgba(27, 75, 122, 0.2)', 'rgba(13, 148, 136, 0.15)', 'rgba(27, 75, 122, 0.2)'] as const,
        success: ['rgba(22, 163, 74, 0.2)', 'rgba(22, 163, 74, 0.08)', 'rgba(22, 163, 74, 0.2)'] as const,
    },

    // -------------------------------------------------------------------------
    // Mesh Gradient Points (for Skia/advanced effects)
    // -------------------------------------------------------------------------
    mesh: {
        hero: [
            { color: 'rgba(27, 75, 122, 0.08)', position: [0, 0] },
            { color: 'rgba(13, 148, 136, 0.05)', position: [1, 0] },
            { color: 'rgba(124, 58, 237, 0.04)', position: [0, 1] },
            { color: 'rgba(2, 132, 199, 0.03)', position: [1, 1] },
        ],
        celebration: [
            { color: 'rgba(22, 163, 74, 0.1)', position: [0.5, 0] },
            { color: 'rgba(27, 75, 122, 0.08)', position: [0, 0.5] },
            { color: 'rgba(13, 148, 136, 0.08)', position: [1, 0.5] },
            { color: 'rgba(124, 58, 237, 0.05)', position: [0.5, 1] },
        ],
    },
};

// =============================================================================
// GLASSMORPHISM - Ready-to-Spread Styles
// =============================================================================

export const glass = {
    // -------------------------------------------------------------------------
    // Base Surface Layers (Light Mode)
    // -------------------------------------------------------------------------
    ultraLight: {
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        borderWidth: 0,
        borderColor: 'transparent',
    } as ViewStyle,

    light: {
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        borderWidth: 0,
        borderColor: 'transparent',
    } as ViewStyle,

    medium: {
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        borderWidth: 0,
        borderColor: 'transparent',
    } as ViewStyle,

    heavy: {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderWidth: 0,
        borderColor: 'transparent',
    } as ViewStyle,

    solid: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderWidth: 0,
        borderColor: 'transparent',
    } as ViewStyle,

    // -------------------------------------------------------------------------
    // Frosted Surface (expo-blur ready)
    // -------------------------------------------------------------------------
    frosted: {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderWidth: 0,
        borderColor: 'transparent',
    } as ViewStyle,

    frostedDark: {
        backgroundColor: 'rgba(248, 250, 252, 0.95)',
        borderWidth: 0,
        borderColor: 'transparent',
    } as ViewStyle,

    // -------------------------------------------------------------------------
    // Colored Surface Tints
    // -------------------------------------------------------------------------
    primary: {
        backgroundColor: 'rgba(27, 75, 122, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(27, 75, 122, 0.15)',
    } as ViewStyle,

    accent: {
        backgroundColor: 'rgba(13, 148, 136, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(13, 148, 136, 0.15)',
    } as ViewStyle,

    success: {
        backgroundColor: 'rgba(22, 163, 74, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(22, 163, 74, 0.15)',
    } as ViewStyle,

    warning: {
        backgroundColor: 'rgba(217, 119, 6, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(217, 119, 6, 0.15)',
    } as ViewStyle,

    error: {
        backgroundColor: 'rgba(220, 38, 38, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(220, 38, 38, 0.15)',
    } as ViewStyle,

    // -------------------------------------------------------------------------
    // Interactive Surface States
    // -------------------------------------------------------------------------
    pressed: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    } as ViewStyle,

    selected: {
        backgroundColor: 'rgba(27, 75, 122, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(27, 75, 122, 0.2)',
    } as ViewStyle,
};

// =============================================================================
// BLUR EFFECTS - expo-blur Configurations
// =============================================================================

export const blurEffects = {
    // -------------------------------------------------------------------------
    // Surface Blur Intensities (Light Mode)
    // -------------------------------------------------------------------------
    surfaces: {
        ultraThin: { intensity: 25, tint: 'light' as const },
        thin: { intensity: 45, tint: 'light' as const },
        regular: { intensity: 65, tint: 'light' as const },
        thick: { intensity: 85, tint: 'light' as const },
        chrome: { intensity: 98, tint: 'light' as const },
    },

    // -------------------------------------------------------------------------
    // Component-Specific Blur
    // -------------------------------------------------------------------------
    components: {
        navigationBar: { intensity: 85, tint: 'light' as const },
        tabBar: { intensity: 90, tint: 'light' as const },
        modalBackdrop: { intensity: 30, tint: 'dark' as const },
        actionSheet: { intensity: 80, tint: 'light' as const },
        toast: { intensity: 70, tint: 'light' as const },
        floatingCard: { intensity: 60, tint: 'light' as const },
        searchBar: { intensity: 50, tint: 'light' as const },
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
    // Colored Glow Effects (Subtle for light mode)
    // -------------------------------------------------------------------------
    glow: {
        shadowColor: '#1B4B7A',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    } as ViewStyle,

    primaryGlow: {
        shadowColor: '#1B4B7A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    } as ViewStyle,

    primaryGlowIntense: {
        shadowColor: '#1B4B7A',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
        elevation: 12,
    } as ViewStyle,

    accentGlow: {
        shadowColor: '#0D9488',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    } as ViewStyle,

    successGlow: {
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    } as ViewStyle,

    warningGlow: {
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    } as ViewStyle,

    errorGlow: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    } as ViewStyle,

    // -------------------------------------------------------------------------
    // Component Shadows
    // -------------------------------------------------------------------------
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    } as ViewStyle,

    cardHover: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
    } as ViewStyle,

    button: {
        shadowColor: '#1B4B7A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 3,
    } as ViewStyle,

    buttonPressed: {
        shadowColor: '#1B4B7A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 1,
    } as ViewStyle,

    // -------------------------------------------------------------------------
    // Inner Effects
    // -------------------------------------------------------------------------
    innerGlow: {
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    } as ViewStyle,

    innerGlowPrimary: {
        borderWidth: 1,
        borderColor: 'rgba(27, 75, 122, 0.15)',
        backgroundColor: 'rgba(27, 75, 122, 0.04)',
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
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.06)',
            borderRadius: 20,
            padding: 20,
            overflow: 'hidden',
        },
        containerElevated: {
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.08)',
            borderRadius: 20,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 4,
            overflow: 'hidden',
        },
        containerSelected: {
            backgroundColor: 'rgba(27, 75, 122, 0.06)',
            borderWidth: 1,
            borderColor: 'rgba(27, 75, 122, 0.2)',
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
            color: '#0F172A',
            letterSpacing: 0,
        },
        subtitle: {
            fontSize: 14,
            color: '#64748B',
            marginTop: 4,
        },
        content: {
            flex: 1,
        },
        footer: {
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: 'rgba(0, 0, 0, 0.06)',
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
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.1)',
            borderRadius: 12,
            overflow: 'hidden',
        },
        inputWrapperFocused: {
            borderColor: '#1B4B7A',
            shadowColor: '#1B4B7A',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 3,
        },
        inputWrapperError: {
            borderColor: '#DC2626',
            shadowColor: '#DC2626',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 3,
        },
        input: {
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 17,
            color: '#0F172A',
        },
        label: {
            fontSize: 14,
            fontWeight: '500',
            color: '#64748B',
            marginBottom: 8,
        },
        labelFocused: {
            color: '#1B4B7A',
        },
        errorText: {
            fontSize: 12,
            color: '#DC2626',
            marginTop: 6,
        },
        helperText: {
            fontSize: 12,
            color: '#94A3B8',
            marginTop: 6,
        },
    }),

    // -------------------------------------------------------------------------
    // Biomarker Card
    // -------------------------------------------------------------------------
    biomarkerCard: StyleSheet.create({
        container: {
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.06)',
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
            color: '#0F172A',
        },
        unitLabel: {
            fontSize: 16,
            fontWeight: '500',
            color: 'rgba(15, 23, 42, 0.45)',
            marginLeft: 4,
        },
        rangeBar: {
            height: 6,
            borderRadius: 3,
            backgroundColor: 'rgba(0, 0, 0, 0.08)',
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
            backgroundColor: 'rgba(27, 75, 122, 0.1)',
        },
        primaryText: {
            color: '#1B4B7A',
        },
        success: {
            backgroundColor: 'rgba(22, 163, 74, 0.1)',
        },
        successText: {
            color: '#16A34A',
        },
        warning: {
            backgroundColor: 'rgba(217, 119, 6, 0.1)',
        },
        warningText: {
            color: '#D97706',
        },
        error: {
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
        },
        errorText: {
            color: '#DC2626',
        },
        glass: {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.08)',
        },
        glassText: {
            color: '#0F172A',
        },
    }),

    // -------------------------------------------------------------------------
    // Modal
    // -------------------------------------------------------------------------
    modal: StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        container: {
            width: '100%',
            maxWidth: 400,
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
        },
        header: {
            padding: 24,
            paddingBottom: 0,
        },
        title: {
            fontSize: 20,
            fontWeight: '600',
            color: '#0F172A',
            textAlign: 'center',
        },
        subtitle: {
            fontSize: 14,
            color: '#64748B',
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
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            justifyContent: 'flex-end',
        },
        container: {
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.08)',
            borderBottomWidth: 0,
            maxHeight: '90%',
        },
        handle: {
            width: 36,
            height: 4,
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
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
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
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
            backgroundColor: 'rgba(27, 75, 122, 0.1)',
        },
        tabText: {
            fontSize: 14,
            fontWeight: '500',
            color: '#94A3B8',
        },
        tabTextActive: {
            color: '#1B4B7A',
        },
    }),

    // -------------------------------------------------------------------------
    // Progress Bar
    // -------------------------------------------------------------------------
    progressBar: StyleSheet.create({
        container: {
            height: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.08)',
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
            color: '#64748B',
        },
        valueText: {
            fontSize: 14,
            fontWeight: '600',
            color: '#0F172A',
        },
    }),

    // -------------------------------------------------------------------------
    // Skeleton
    // -------------------------------------------------------------------------
    skeleton: StyleSheet.create({
        container: {
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
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
            shadowColor: '#1B4B7A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 6,
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
