import { z } from 'zod';

// ============ Reminder Schemas ============

export const CreateReminderSchema = z.object({
    stackItemId: z.string().min(1),
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:MM format'),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    isActive: z.boolean().default(true),
});

export const UpdateReminderSchema = z.object({
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:MM format').optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).optional(),
    isActive: z.boolean().optional(),
});

export type CreateReminderInput = z.infer<typeof CreateReminderSchema>;
export type UpdateReminderInput = z.infer<typeof UpdateReminderSchema>;

// ============ Reminder Response Types ============

export interface ReminderResponse {
    id: string;
    stackItemId: string;
    stackItemName: string;
    time: string;
    daysOfWeek: number[];
    isActive: boolean;
}
