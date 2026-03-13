import { colors } from '../theme';

export const CATEGORY_COLORS: Record<string, string> = {
    recovery: '#34D399',
    'fat-loss': '#f97316',
    'anti-aging': '#8b5cf6',
    cognitive: '#5E5CE6',
    hormonal: '#FF9F0A',
    'gut-health': '#22d3ee',
    'muscle-growth': '#f43f5e',
    sleep: '#64D2FF',
    immune: '#30D158',
};

export function getCategoryColor(category: string): string {
    return CATEGORY_COLORS[category.toLowerCase()] ?? colors.primary;
}

export function formatCategoryLabel(slug: string): string {
    return slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}
