import { z } from 'zod';

// ============ Lab Schemas ============

export const CreateLabReportSchema = z.object({
    filename: z.string().min(1).max(255),
    s3Key: z.string().min(1),
    reportDate: z.string().datetime().optional(),
    notes: z.string().max(2000).optional(),
});

export const CreateLabMarkerSchema = z.object({
    name: z.string().min(1).max(100),
    value: z.number(),
    unit: z.string().min(1).max(50),
    refRangeLow: z.number().optional(),
    refRangeHigh: z.number().optional(),
    recordedAt: z.string().datetime().optional(),
    notes: z.string().max(500).optional(),
});

export const PresignUploadSchema = z.object({
    filename: z.string().min(1).max(255),
    contentType: z.string().regex(/^(application\/pdf|image\/(jpeg|png|webp))$/),
});

export type CreateLabReportInput = z.infer<typeof CreateLabReportSchema>;
export type CreateLabMarkerInput = z.infer<typeof CreateLabMarkerSchema>;
export type PresignUploadInput = z.infer<typeof PresignUploadSchema>;

// ============ Lab Response Types ============

export interface LabMarkerResponse {
    id: string;
    labReportId: string | null;
    name: string;
    value: number;
    unit: string;
    refRangeLow: number | null;
    refRangeHigh: number | null;
    recordedAt: string;
    notes: string | null;
    isInRange: boolean | null;
}

export interface LabReportResponse {
    id: string;
    filename: string;
    s3Key: string;
    uploadedAt: string;
    reportDate: string | null;
    notes: string | null;
    markers: LabMarkerResponse[];
}

export interface PresignResponse {
    uploadUrl: string;
    s3Key: string;
    expiresIn: number;
}

export interface MarkerTrendPoint {
    date: string;
    value: number;
    refRangeLow: number | null;
    refRangeHigh: number | null;
}

export interface MarkerTrendResponse {
    markerName: string;
    unit: string;
    dataPoints: MarkerTrendPoint[];
}
