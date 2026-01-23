import { z } from 'zod';
export declare const CreatePhotoSchema: z.ZodObject<{
    originalS3Key: z.ZodString;
    category: z.ZodEnum<["front", "side", "back"]>;
    capturedAt: z.ZodOptional<z.ZodString>;
    weightKg: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    originalS3Key: string;
    category: "front" | "side" | "back";
    weightKg?: number | undefined;
    notes?: string | undefined;
    capturedAt?: string | undefined;
}, {
    originalS3Key: string;
    category: "front" | "side" | "back";
    weightKg?: number | undefined;
    notes?: string | undefined;
    capturedAt?: string | undefined;
}>;
export declare const PhotoPresignSchema: z.ZodObject<{
    filename: z.ZodString;
    contentType: z.ZodString;
    category: z.ZodEnum<["front", "side", "back"]>;
}, "strip", z.ZodTypeAny, {
    filename: string;
    contentType: string;
    category: "front" | "side" | "back";
}, {
    filename: string;
    contentType: string;
    category: "front" | "side" | "back";
}>;
export type CreatePhotoInput = z.infer<typeof CreatePhotoSchema>;
export type PhotoPresignInput = z.infer<typeof PhotoPresignSchema>;
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
    stacks: {
        id: string;
        name: string;
        isActive: boolean;
    }[];
    labs: {
        id: string;
        filename: string;
    }[];
}
//# sourceMappingURL=photos.d.ts.map