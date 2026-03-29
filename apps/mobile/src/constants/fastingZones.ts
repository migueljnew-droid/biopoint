export interface FastingZone {
    id: number;
    name: string;
    startHour: number;
    endHour: number;
    color: string;
    glowColor: string;
    icon: string;
    description: string;
}

export const FASTING_ZONES: FastingZone[] = [
    {
        id: 1,
        name: 'Anabolic',
        startHour: 0,
        endHour: 4,
        color: '#94a3b8',
        glowColor: '#e2e8f0',
        icon: 'nutrition-outline',
        description: 'Body digesting last meal. Insulin high, glucose as fuel.',
    },
    {
        id: 2,
        name: 'Catabolic',
        startHour: 4,
        endHour: 8,
        color: '#8b5cf6',
        glowColor: '#c4b5fd',
        icon: 'trending-down-outline',
        description: 'Blood sugar dropping. Insulin falling. Glycogen tapped.',
    },
    {
        id: 3,
        name: 'Fat Burning',
        startHour: 8,
        endHour: 12,
        color: '#f59e0b',
        glowColor: '#fde68a',
        icon: 'flame-outline',
        description: 'Glycogen depleting. Body switching to fat for fuel.',
    },
    {
        id: 4,
        name: 'Ketosis',
        startHour: 12,
        endHour: 18,
        color: '#3b82f6',
        glowColor: '#93c5fd',
        icon: 'flash-outline',
        description: 'Liver producing ketones. Brain using ketones. Mental clarity.',
    },
    {
        id: 5,
        name: 'Deep Ketosis',
        startHour: 18,
        endHour: 24,
        color: '#06b6d4',
        glowColor: '#67e8f9',
        icon: 'sparkles-outline',
        description: 'Strong ketone levels. Autophagy beginning. Cellular cleanup.',
    },
    {
        id: 6,
        name: 'Autophagy',
        startHour: 24,
        endHour: 48,
        color: '#4ade80',
        glowColor: '#bbf7d0',
        icon: 'leaf-outline',
        description: 'Peak cellular recycling. Old proteins broken down. HGH surge.',
    },
    {
        id: 7,
        name: 'Deep Autophagy',
        startHour: 48,
        endHour: 72,
        color: '#10b981',
        glowColor: '#6ee7b7',
        icon: 'shield-checkmark-outline',
        description: 'Stem cell activation. Immune system renewal beginning.',
    },
    {
        id: 8,
        name: 'Immune Reset',
        startHour: 72,
        endHour: Infinity,
        color: '#f472b6',
        glowColor: '#f9a8d4',
        icon: 'heart-outline',
        description: 'Full immune system regeneration. Stem cell-based renewal.',
    },
];

export function getZoneForHours(hours: number): FastingZone {
    for (let i = FASTING_ZONES.length - 1; i >= 0; i--) {
        if (hours >= FASTING_ZONES[i]!.startHour) {
            return FASTING_ZONES[i]!;
        }
    }
    return FASTING_ZONES[0]!;
}

export function getNextZone(hours: number): { zone: FastingZone; hoursUntil: number } | null {
    const currentZone = getZoneForHours(hours);
    const nextIndex = FASTING_ZONES.findIndex(z => z.id === currentZone.id) + 1;
    if (nextIndex >= FASTING_ZONES.length) return null;
    const nextZone = FASTING_ZONES[nextIndex]!;
    return {
        zone: nextZone,
        hoursUntil: Math.max(0, nextZone.startHour - hours),
    };
}
