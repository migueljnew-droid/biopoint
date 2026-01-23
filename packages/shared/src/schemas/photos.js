"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotoPresignSchema = exports.CreatePhotoSchema = void 0;
const zod_1 = require("zod");
// ============ Progress Photo Schemas ============
exports.CreatePhotoSchema = zod_1.z.object({
    originalS3Key: zod_1.z.string().min(1),
    category: zod_1.z.enum(['front', 'side', 'back']),
    capturedAt: zod_1.z.string().datetime().optional(),
    weightKg: zod_1.z.number().min(20).max(500).optional(),
    notes: zod_1.z.string().max(1000).optional(),
});
exports.PhotoPresignSchema = zod_1.z.object({
    filename: zod_1.z.string().min(1).max(255),
    contentType: zod_1.z.string().regex(/^image\/(jpeg|png|webp|heic)$/),
    category: zod_1.z.enum(['front', 'side', 'back']),
});
//# sourceMappingURL=photos.js.map