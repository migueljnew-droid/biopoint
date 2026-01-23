"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateReminderSchema = exports.CreateReminderSchema = void 0;
const zod_1 = require("zod");
// ============ Reminder Schemas ============
exports.CreateReminderSchema = zod_1.z.object({
    stackItemId: zod_1.z.string().min(1),
    time: zod_1.z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:MM format'),
    daysOfWeek: zod_1.z.array(zod_1.z.number().int().min(0).max(6)).min(1),
    isActive: zod_1.z.boolean().default(true),
});
exports.UpdateReminderSchema = zod_1.z.object({
    time: zod_1.z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:MM format').optional(),
    daysOfWeek: zod_1.z.array(zod_1.z.number().int().min(0).max(6)).min(1).optional(),
    isActive: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=reminders.js.map