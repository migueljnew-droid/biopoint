"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceEventSchema = exports.UpdateStackItemSchema = exports.CreateStackItemSchema = exports.CycleJsonSchema = exports.UpdateStackSchema = exports.CreateStackSchema = void 0;
const zod_1 = require("zod");
// ============ Stack Schemas ============
exports.CreateStackSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    goal: zod_1.z.string().max(500).optional(),
    startDate: zod_1.z.string().datetime().optional(),
});
exports.UpdateStackSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    goal: zod_1.z.string().max(500).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.CycleJsonSchema = zod_1.z.object({
    daysOn: zod_1.z.number().int().min(1).max(365),
    daysOff: zod_1.z.number().int().min(0).max(365),
}).optional();
exports.CreateStackItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    dose: zod_1.z.number().positive(),
    unit: zod_1.z.string().min(1).max(20),
    route: zod_1.z.enum(['SubQ', 'IM', 'IV', 'Oral', 'Sublingual', 'Transdermal', 'Nasal', 'Other']).optional(),
    frequency: zod_1.z.string().min(1).max(50),
    scheduleDays: zod_1.z.array(zod_1.z.number().min(0).max(6)).optional(),
    timing: zod_1.z.string().max(100).optional(),
    cycleJson: exports.CycleJsonSchema,
    notes: zod_1.z.string().max(1000).optional(),
    isActive: zod_1.z.boolean().default(true),
});
exports.UpdateStackItemSchema = exports.CreateStackItemSchema.partial();
exports.ComplianceEventSchema = zod_1.z.object({
    stackItemId: zod_1.z.string().min(1),
    takenAt: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().max(500).optional(),
});
//# sourceMappingURL=stacks.js.map