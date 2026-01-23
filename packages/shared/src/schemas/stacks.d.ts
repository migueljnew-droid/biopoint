import { z } from 'zod';
export declare const CreateStackSchema: z.ZodObject<{
    name: z.ZodString;
    goal: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    goal?: string | undefined;
    startDate?: string | undefined;
}, {
    name: string;
    goal?: string | undefined;
    startDate?: string | undefined;
}>;
export declare const UpdateStackSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    goal: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    goal?: string | undefined;
    isActive?: boolean | undefined;
}, {
    name?: string | undefined;
    goal?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const CycleJsonSchema: z.ZodOptional<z.ZodObject<{
    daysOn: z.ZodNumber;
    daysOff: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    daysOn: number;
    daysOff: number;
}, {
    daysOn: number;
    daysOff: number;
}>>;
export declare const CreateStackItemSchema: z.ZodObject<{
    name: z.ZodString;
    dose: z.ZodNumber;
    unit: z.ZodString;
    route: z.ZodOptional<z.ZodEnum<["SubQ", "IM", "IV", "Oral", "Sublingual", "Transdermal", "Nasal", "Other"]>>;
    frequency: z.ZodString;
    timing: z.ZodOptional<z.ZodString>;
    cycleJson: z.ZodOptional<z.ZodObject<{
        daysOn: z.ZodNumber;
        daysOff: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        daysOn: number;
        daysOff: number;
    }, {
        daysOn: number;
        daysOff: number;
    }>>;
    notes: z.ZodOptional<z.ZodString>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isActive: boolean;
    dose: number;
    unit: string;
    frequency: string;
    notes?: string | undefined;
    route?: "SubQ" | "IM" | "IV" | "Oral" | "Sublingual" | "Transdermal" | "Nasal" | "Other" | undefined;
    timing?: string | undefined;
    cycleJson?: {
        daysOn: number;
        daysOff: number;
    } | undefined;
}, {
    name: string;
    dose: number;
    unit: string;
    frequency: string;
    notes?: string | undefined;
    isActive?: boolean | undefined;
    route?: "SubQ" | "IM" | "IV" | "Oral" | "Sublingual" | "Transdermal" | "Nasal" | "Other" | undefined;
    timing?: string | undefined;
    cycleJson?: {
        daysOn: number;
        daysOff: number;
    } | undefined;
}>;
export declare const UpdateStackItemSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    dose: z.ZodOptional<z.ZodNumber>;
    unit: z.ZodOptional<z.ZodString>;
    route: z.ZodOptional<z.ZodOptional<z.ZodEnum<["SubQ", "IM", "IV", "Oral", "Sublingual", "Transdermal", "Nasal", "Other"]>>>;
    frequency: z.ZodOptional<z.ZodString>;
    timing: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    cycleJson: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        daysOn: z.ZodNumber;
        daysOff: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        daysOn: number;
        daysOff: number;
    }, {
        daysOn: number;
        daysOff: number;
    }>>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
    name?: string | undefined;
    isActive?: boolean | undefined;
    dose?: number | undefined;
    unit?: string | undefined;
    route?: "SubQ" | "IM" | "IV" | "Oral" | "Sublingual" | "Transdermal" | "Nasal" | "Other" | undefined;
    frequency?: string | undefined;
    timing?: string | undefined;
    cycleJson?: {
        daysOn: number;
        daysOff: number;
    } | undefined;
}, {
    notes?: string | undefined;
    name?: string | undefined;
    isActive?: boolean | undefined;
    dose?: number | undefined;
    unit?: string | undefined;
    route?: "SubQ" | "IM" | "IV" | "Oral" | "Sublingual" | "Transdermal" | "Nasal" | "Other" | undefined;
    frequency?: string | undefined;
    timing?: string | undefined;
    cycleJson?: {
        daysOn: number;
        daysOff: number;
    } | undefined;
}>;
export declare const ComplianceEventSchema: z.ZodObject<{
    stackItemId: z.ZodString;
    takenAt: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    stackItemId: string;
    notes?: string | undefined;
    takenAt?: string | undefined;
}, {
    stackItemId: string;
    notes?: string | undefined;
    takenAt?: string | undefined;
}>;
export type CreateStackInput = z.infer<typeof CreateStackSchema>;
export type UpdateStackInput = z.infer<typeof UpdateStackSchema>;
export type CreateStackItemInput = z.infer<typeof CreateStackItemSchema>;
export type UpdateStackItemInput = z.infer<typeof UpdateStackItemSchema>;
export type ComplianceEventInput = z.infer<typeof ComplianceEventSchema>;
export interface StackItemResponse {
    id: string;
    stackId: string;
    name: string;
    dose: number;
    unit: string;
    route: string | null;
    frequency: string;
    timing: string | null;
    cycleJson: {
        daysOn: number;
        daysOff: number;
    } | null;
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
//# sourceMappingURL=stacks.d.ts.map