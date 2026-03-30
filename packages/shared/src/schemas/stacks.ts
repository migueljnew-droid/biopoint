import { z } from 'zod';

// ============ Stack Schemas ============

export const CreateStackSchema = z.object({
    name: z.string().min(1).max(100),
    goal: z.string().max(500).optional(),
    startDate: z.string().datetime().optional(),
});

export const UpdateStackSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    goal: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
});

export const CycleJsonSchema = z.object({
    daysOn: z.number().int().min(1).max(365),
    daysOff: z.number().int().min(0).max(365),
}).optional();

export const CreateStackItemSchema = z.object({
    name: z.string().min(1).max(100),
    dose: z.number().positive(),
    unit: z.string().min(1).max(20),
    route: z.enum(['SubQ', 'IM', 'IV', 'Oral', 'Sublingual', 'Transdermal', 'Nasal', 'Other']).optional(),
    frequency: z.string().min(1).max(50),
    scheduleDays: z.array(z.number().min(0).max(6)).optional(),
    timing: z.string().max(100).optional(),
    cycleJson: CycleJsonSchema,
    notes: z.string().max(1000).optional(),
    isActive: z.boolean().default(true),
});

export const UpdateStackItemSchema = CreateStackItemSchema.partial();

export const ComplianceEventSchema = z.object({
    stackItemId: z.string().min(1),
    takenAt: z.string().datetime().optional(),
    notes: z.string().max(500).optional(),
});

export type CreateStackInput = z.infer<typeof CreateStackSchema>;
export type UpdateStackInput = z.infer<typeof UpdateStackSchema>;
export type CreateStackItemInput = z.infer<typeof CreateStackItemSchema>;
export type UpdateStackItemInput = z.infer<typeof UpdateStackItemSchema>;
export type ComplianceEventInput = z.infer<typeof ComplianceEventSchema>;

// ============ Stack Response Types ============

export interface StackItemResponse {
    id: string;
    stackId: string;
    name: string;
    dose: number;
    unit: string;
    route: string | null;
    frequency: string;
    scheduleDays: number[];
    timing: string | null;
    cycleJson: { daysOn: number; daysOff: number } | null;
    notes: string | null;
    isActive: boolean;
}

export interface StackResponse {
    id: string;
    userId: string;
    name: string;
    goal: string | null;
    startDate: string;
    isActive: boolean;
    items: StackItemResponse[];
}

export interface ComplianceEventResponse {
    id: string;
    stackItemId: string;
    stackItemName: string;
    takenAt: string;
    notes: string | null;
}
