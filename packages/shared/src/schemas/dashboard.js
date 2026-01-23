"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyLogSchema = void 0;
const zod_1 = require("zod");
// ============ Daily Log Schemas ============
exports.DailyLogSchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
    weightKg: zod_1.z.number().min(20).max(500).optional(),
    sleepHours: zod_1.z.number().min(0).max(24).optional(),
    sleepQuality: zod_1.z.number().int().min(1).max(10).optional(),
    energyLevel: zod_1.z.number().int().min(1).max(10).optional(),
    focusLevel: zod_1.z.number().int().min(1).max(10).optional(),
    moodLevel: zod_1.z.number().int().min(1).max(10).optional(),
    notes: zod_1.z.string().max(2000).optional(),
});
//# sourceMappingURL=dashboard.js.map