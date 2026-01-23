import { z } from 'zod';
export declare const CreateGroupSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    isPublic: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isPublic: boolean;
    description?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
    isPublic?: boolean | undefined;
}>;
export declare const CreatePostSchema: z.ZodObject<{
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
}, {
    content: string;
}>;
export declare const ForkTemplateSchema: z.ZodObject<{
    stackName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    stackName?: string | undefined;
}, {
    stackName?: string | undefined;
}>;
export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type ForkTemplateInput = z.infer<typeof ForkTemplateSchema>;
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
//# sourceMappingURL=community.d.ts.map