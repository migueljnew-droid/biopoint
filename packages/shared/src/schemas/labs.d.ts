import { z } from 'zod';
export declare const CreateLabReportSchema: z.ZodObject<{
    filename: z.ZodString;
    s3Key: z.ZodString;
    reportDate: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    filename: string;
    s3Key: string;
    notes?: string | undefined;
    reportDate?: string | undefined;
}, {
    filename: string;
    s3Key: string;
    notes?: string | undefined;
    reportDate?: string | undefined;
}>;
export declare const CreateLabMarkerSchema: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodNumber;
    unit: z.ZodString;
    refRangeLow: z.ZodOptional<z.ZodNumber>;
    refRangeHigh: z.ZodOptional<z.ZodNumber>;
    recordedAt: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value: number;
    name: string;
    unit: string;
    notes?: string | undefined;
    refRangeLow?: number | undefined;
    refRangeHigh?: number | undefined;
    recordedAt?: string | undefined;
}, {
    value: number;
    name: string;
    unit: string;
    notes?: string | undefined;
    refRangeLow?: number | undefined;
    refRangeHigh?: number | undefined;
    recordedAt?: string | undefined;
}>;
export declare const PresignUploadSchema: z.ZodObject<{
    filename: z.ZodString;
    contentType: z.ZodString;
}, "strip", z.ZodTypeAny, {
    filename: string;
    contentType: string;
}, {
    filename: string;
    contentType: string;
}>;
export type CreateLabReportInput = z.infer<typeof CreateLabReportSchema>;
export type CreateLabMarkerInput = z.infer<typeof CreateLabMarkerSchema>;
export type PresignUploadInput = z.infer<typeof PresignUploadSchema>;
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
//# sourceMappingURL=labs.d.ts.map