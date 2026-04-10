import { z } from 'zod';

// ============ Community Schemas ============

export const CreateGroupSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000).optional(),
    isPublic: z.boolean().default(true),
});

export const CreatePostSchema = z.object({
    content: z.string().min(1).max(5000),
});

export const ForkTemplateSchema = z.object({
    stackName: z.string().min(1).max(100).optional(),
});

export const UpdatePublicProfileSchema = z.object({
    displayName: z.string().min(1).max(60).optional(),
    username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, underscores only').optional(),
    bio: z.string().max(300).optional(),
    avatarS3Key: z.string().optional(),
});

export const CreateRichPostSchema = z.object({
    content: z.string().min(1).max(5000),
    category: z.enum(['general', 'peptide_protocols', 'supplement_stacks', 'lab_results', 'fasting', 'progress_photos', 'qa']).default('general'),
    mediaJson: z.array(z.object({ s3Key: z.string(), type: z.enum(['photo']) })).max(4).optional(),
    linkUrl: z.string().url().optional(),
    stackTemplateId: z.string().optional(),
});

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type ForkTemplateInput = z.infer<typeof ForkTemplateSchema>;
export type UpdatePublicProfileInput = z.infer<typeof UpdatePublicProfileSchema>;
export type CreateRichPostInput = z.infer<typeof CreateRichPostSchema>;

// ============ Community Response Types ============

export interface GroupResponse {
    id: string;
    name: string;
    description: string | null;
    createdById: string;
    isPublic: boolean;
    memberCount: number;
    isMember: boolean;
}

export interface GroupMemberResponse {
    id: string;
    userId: string;
    role: string;
    joinedAt: string;
}

export interface PostResponse {
    id: string;
    groupId: string;
    userId: string;
    authorHandle: string;
    authorAvatar: string | null;
    content: string;
    category: string;
    mediaUrls: string[];
    linkUrl: string | null;
    stackTemplateId: string | null;
    createdAt: string;
}

export interface StackTemplateItemResponse {
    name: string;
    dose: number;
    unit: string;
    route: string | null;
    frequency: string;
    timing: string | null;
}

export interface StackTemplateResponse {
    id: string;
    groupId: string | null;
    name: string;
    description: string | null;
    goal: string | null;
    items: StackTemplateItemResponse[];
    forkCount: number;
}

// ============ Community Profile & Badges ============

export const POST_CATEGORIES = [
    { key: 'general', label: 'All', icon: 'apps-outline' },
    { key: 'peptide_protocols', label: 'Peptides', icon: 'flask-outline' },
    { key: 'supplement_stacks', label: 'Stacks', icon: 'layers-outline' },
    { key: 'lab_results', label: 'Labs', icon: 'bar-chart-outline' },
    { key: 'fasting', label: 'Fasting', icon: 'time-outline' },
    { key: 'progress_photos', label: 'Progress', icon: 'camera-outline' },
    { key: 'qa', label: 'Q&A', icon: 'help-circle-outline' },
] as const;

export const BADGE_DEFINITIONS = [
    { id: 'lab_verified', label: 'Lab Verified', icon: 'shield-checkmark', description: '3+ lab reports uploaded' },
    { id: 'thirty_day_stack', label: '30-Day Stack', icon: 'layers', description: '30 days of stack compliance' },
    { id: 'data_driven', label: 'Data Driven', icon: 'analytics', description: '30 consecutive daily logs' },
    { id: 'protocol_publisher', label: 'Protocol Publisher', icon: 'share-social', description: 'Shared a stack to community' },
    { id: 'bio_optimized', label: 'Bio Optimized', icon: 'star', description: 'BioPoint score of 80+' },
] as const;

export type BadgeId = typeof BADGE_DEFINITIONS[number]['id'];

export interface PublicProfileResponse {
    userId: string;
    displayName: string | null;
    username: string | null;
    avatarUrl: string | null;
    bio: string | null;
    badges: BadgeId[];
    stats: { daysLogged: number; stacksActive: number; labsUploaded: number };
    currentStreak: number;
}
