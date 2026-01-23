"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresignUploadSchema = exports.CreateLabMarkerSchema = exports.CreateLabReportSchema = void 0;
const zod_1 = require("zod");
// ============ Lab Schemas ============
exports.CreateLabReportSchema = zod_1.z.object({
    filename: zod_1.z.string().min(1).max(255),
    s3Key: zod_1.z.string().min(1),
    reportDate: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().max(2000).optional(),
});
exports.CreateLabMarkerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    value: zod_1.z.number(),
    unit: zod_1.z.string().min(1).max(50),
    refRangeLow: zod_1.z.number().optional(),
    refRangeHigh: zod_1.z.number().optional(),
    recordedAt: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().max(500).optional(),
});
exports.PresignUploadSchema = zod_1.z.object({
    filename: zod_1.z.string().min(1).max(255),
    contentType: zod_1.z.string().regex(/^(application\/pdf|image\/(jpeg|png|webp))$/),
});
//# sourceMappingURL=labs.js.map