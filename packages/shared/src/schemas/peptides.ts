import { z } from 'zod';

// ============ Peptide Schemas ============

export const PeptideCategorySchema = z.enum([
    'recovery',
    'fat-loss',
    'anti-aging',
    'cognitive',
    'hormonal',
    'gut-health',
    'muscle-growth',
    'sleep',
    'immune',
]);

export const PeptideCitationSchema = z.object({
    title: z.string().min(1),
    url: z.string().url(),
    year: z.number().int().min(1900).max(2100),
});

export const PeptideTypicalDoseSchema = z.object({
    min: z.number().positive(),
    max: z.number().positive(),
    unit: z.string().min(1).max(20),
});

export const PeptideCompoundSchema = z.object({
    id: z.string().cuid(),
    name: z.string().min(1).max(100),
    aliases: z.array(z.string()),
    category: PeptideCategorySchema,
    goals: z.array(z.string()),
    typicalDose: PeptideTypicalDoseSchema,
    halfLife: z.string().min(1).max(100),
    route: z.enum(['SubQ', 'IM', 'IV', 'Oral', 'Nasal', 'Topical', 'Sublingual', 'Other']),
    frequency: z.string().min(1).max(100),
    cycleProtocol: z.string().min(1).max(500),
    stackingNotes: z.string().max(2000),
    citations: z.array(PeptideCitationSchema),
    iuConversion: z.number().positive().nullable(),
    description: z.string().min(1).max(1000),
});

export const PeptideSearchSchema = z.object({
    query: z.string().max(200).optional(),
    category: PeptideCategorySchema.optional(),
    goal: z.string().max(100).optional(),
    route: z.enum(['SubQ', 'IM', 'IV', 'Oral', 'Nasal', 'Topical', 'Sublingual', 'Other']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PeptideDatabaseSchema = z.array(PeptideCompoundSchema);

export type PeptideCategory = z.infer<typeof PeptideCategorySchema>;
export type PeptideCitation = z.infer<typeof PeptideCitationSchema>;
export type PeptideTypicalDose = z.infer<typeof PeptideTypicalDoseSchema>;
export type PeptideCompound = z.infer<typeof PeptideCompoundSchema>;
export type PeptideSearchInput = z.infer<typeof PeptideSearchSchema>;
export type PeptideDatabase = z.infer<typeof PeptideDatabaseSchema>;

// ============ Peptide Response Types ============

export interface PeptideCompoundResponse {
    id: string;
    name: string;
    aliases: string[];
    category: PeptideCategory;
    goals: string[];
    typicalDose: {
        min: number;
        max: number;
        unit: string;
    };
    halfLife: string;
    route: string;
    frequency: string;
    cycleProtocol: string;
    stackingNotes: string;
    citations: Array<{
        title: string;
        url: string;
        year: number;
    }>;
    iuConversion: number | null;
    description: string;
}

export interface PeptideSearchResponse {
    data: PeptideCompoundResponse[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}
