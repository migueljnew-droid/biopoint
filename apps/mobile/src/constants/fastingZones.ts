export interface FastingZone {
    id: number;
    name: string;
    startHour: number;
    endHour: number;
    color: string;
    glowColor: string;
    icon: string;
    description: string;
    citation: string;
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
        description: 'Body digesting last meal. Insulin elevated, glucose as primary fuel.',
        citation: 'Cahill GF Jr. Fuel metabolism in starvation. Annu Rev Nutr. 2006;26:1-22. (PubMed: 16848698)',
    },
    {
        id: 2,
        name: 'Catabolic',
        startHour: 4,
        endHour: 8,
        color: '#8b5cf6',
        glowColor: '#c4b5fd',
        icon: 'trending-down-outline',
        description: 'Blood sugar declining. Insulin falling. Glycogen stores being used.',
        citation: 'Anton SD, et al. Flipping the Metabolic Switch. Obesity (Silver Spring). 2018;26(2):254-268. (PubMed: 29086496)',
    },
    {
        id: 3,
        name: 'Fat Burning',
        startHour: 8,
        endHour: 12,
        color: '#f59e0b',
        glowColor: '#fde68a',
        icon: 'flame-outline',
        description: 'Glycogen depleting. Body transitioning to fat oxidation for fuel.',
        citation: 'de Cabo R, Mattson MP. Effects of Intermittent Fasting on Health, Aging, and Disease. N Engl J Med. 2019;381(26):2541-2551. (PubMed: 31881139)',
    },
    {
        id: 4,
        name: 'Ketosis',
        startHour: 12,
        endHour: 18,
        color: '#3b82f6',
        glowColor: '#93c5fd',
        icon: 'flash-outline',
        description: 'Liver producing ketone bodies. Brain may begin utilizing ketones.',
        citation: 'Mattson MP, et al. Intermittent metabolic switching, neuroplasticity and brain health. Nat Rev Neurosci. 2018;19(2):63-80. (PubMed: 29321682)',
    },
    {
        id: 5,
        name: 'Deep Ketosis',
        startHour: 18,
        endHour: 24,
        color: '#06b6d4',
        glowColor: '#67e8f9',
        icon: 'sparkles-outline',
        description: 'Elevated ketone levels. Autophagy processes may begin.',
        citation: 'Bagherniya M, et al. The effect of fasting or calorie restriction on autophagy induction. Ageing Res Rev. 2018;47:183-197. (PubMed: 30172870)',
    },
    {
        id: 6,
        name: 'Autophagy',
        startHour: 24,
        endHour: 48,
        color: '#4ade80',
        glowColor: '#bbf7d0',
        icon: 'leaf-outline',
        description: 'Cellular recycling processes may increase. Growth hormone levels may rise.',
        citation: 'Alirezaei M, et al. Short-term fasting induces profound neuronal autophagy. Autophagy. 2010;6(6):702-710. (PubMed: 20534972)',
    },
    {
        id: 7,
        name: 'Deep Autophagy',
        startHour: 48,
        endHour: 72,
        color: '#10b981',
        glowColor: '#6ee7b7',
        icon: 'shield-checkmark-outline',
        description: 'Extended fasting may promote stem cell-based regeneration processes.',
        citation: 'Cheng CW, et al. Prolonged Fasting Reduces IGF-1/PKA to Promote Hematopoietic-Stem-Cell-Based Regeneration. Cell Stem Cell. 2014;14(6):810-823. (PubMed: 24905167)',
    },
    {
        id: 8,
        name: 'Immune Reset',
        startHour: 72,
        endHour: Infinity,
        color: '#f472b6',
        glowColor: '#f9a8d4',
        icon: 'heart-outline',
        description: 'Extended fasting may support immune system renewal processes.',
        citation: 'Cheng CW, et al. Prolonged Fasting Reduces IGF-1/PKA to Promote Hematopoietic-Stem-Cell-Based Regeneration. Cell Stem Cell. 2014;14(6):810-823. (PubMed: 24905167)',
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
