import { z } from 'zod';

// ============ Progress Photo Schemas ============

export const CreatePhotoSchema = z.object({
    originalS3Key: z.string().min(1),
    category: z.enum(['front', 'side', 'back']),
    capturedAt: z.string().datetime().optional(),
    weightKg: z.number().min(20).max(500).optional(),
    notes: z.string().max(1000).optional(),
});

export const PhotoPresignSchema = z.object({
    filename: z.string().min(1).max(255),
    contentType: z.string().regex(/^image\/(jpeg|png|webp|heic)$/),
    category: z.enum(['front', 'side', 'back']),
});

export type CreatePhotoInput = z.infer<typeof CreatePhotoSchema>;
export type PhotoPresignInput = z.infer<typeof PhotoPresignSchema>;

// ============ Photo Response Types ============

export interface ProgressPhotoResponse {
    id: string;
    originalS3Key: string;
    originalUrl: string;
    alignedS3Key: string | null;
    alignedUrl: string | null;
    category: string;
    capturedAt: string;
    weightKg: number | null;
    notes: string | null;
    alignmentStatus: 'pending' | 'processing' | 'done' | 'failed';
}

export interface PhotoTimelineEntry {
    date: string;
    photos: ProgressPhotoResponse[];
    stacks: { id: string; name: string; isActive: boolean }[];
    labs: { id: string; filename: string }[];
}
