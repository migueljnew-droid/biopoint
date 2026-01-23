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

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type ForkTemplateInput = z.infer<typeof ForkTemplateSchema>;

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
    authorEmail: string;
    content: string;
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
