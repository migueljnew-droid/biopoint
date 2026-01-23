"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForkTemplateSchema = exports.CreatePostSchema = exports.CreateGroupSchema = void 0;
const zod_1 = require("zod");
// ============ Community Schemas ============
exports.CreateGroupSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(1000).optional(),
    isPublic: zod_1.z.boolean().default(true),
});
exports.CreatePostSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(5000),
});
exports.ForkTemplateSchema = zod_1.z.object({
    stackName: zod_1.z.string().min(1).max(100).optional(),
});
//# sourceMappingURL=community.js.map