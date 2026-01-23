import { z } from 'zod';
export declare const CreateReminderSchema: z.ZodObject<{
    stackItemId: z.ZodString;
    time: z.ZodString;
    daysOfWeek: z.ZodArray<z.ZodNumber, "many">;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive: boolean;
    stackItemId: string;
    time: string;
    daysOfWeek: number[];
}, {
    stackItemId: string;
    time: string;
    daysOfWeek: number[];
    isActive?: boolean | undefined;
}>;
export declare const UpdateReminderSchema: z.ZodObject<{
    time: z.ZodOptional<z.ZodString>;
    daysOfWeek: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive?: boolean | undefined;
    time?: string | undefined;
    daysOfWeek?: number[] | undefined;
}, {
    isActive?: boolean | undefined;
    time?: string | undefined;
    daysOfWeek?: number[] | undefined;
}>;
export type CreateReminderInput = z.infer<typeof CreateReminderSchema>;
export type UpdateReminderInput = z.infer<typeof UpdateReminderSchema>;
export interface ReminderResponse {
    id: string;
    stackItemId: string;
    stackItemName: string;
    time: string;
    daysOfWeek: number[];
    isActive: boolean;
}
//# sourceMappingURL=reminders.d.ts.map