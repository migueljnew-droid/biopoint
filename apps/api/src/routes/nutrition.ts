import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { CreateMealEntrySchema, UpdateMealEntrySchema, AnalyzeFoodPhotoSchema } from '@biopoint/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/auditLog.js';
import { analyzeFoodPhoto } from '../services/foodAnalysis.js';

async function getOrCreateFoodLog(userId: string, dateStr: string) {
    const date = new Date(dateStr);
    let foodLog = await prisma.foodLog.findUnique({
        where: { userId_date: { userId, date } },
    });

    if (!foodLog) {
        foodLog = await prisma.foodLog.create({
            data: { userId, date },
        });
    }

    return foodLog;
}

async function recalculateFoodLogTotals(foodLogId: string) {
    const meals = await prisma.mealEntry.findMany({
        where: { foodLogId },
    });

    const totals = meals.reduce(
        (acc, m) => ({
            totalCalories: acc.totalCalories + m.calories,
            totalProteinG: acc.totalProteinG + m.proteinG,
            totalCarbsG: acc.totalCarbsG + m.carbsG,
            totalFatG: acc.totalFatG + m.fatG,
            totalFiberG: acc.totalFiberG + m.fiberG,
            mealCount: acc.mealCount + 1,
        }),
        { totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0, totalFiberG: 0, mealCount: 0 }
    );

    await prisma.foodLog.update({
        where: { id: foodLogId },
        data: totals,
    });
}

export async function nutritionRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    // GET /daily/:date - Daily nutrition summary
    app.get('/daily/:date', async (request) => {
        const userId = request.userId;
        const { date } = request.params as { date: string };

        const foodLog = await getOrCreateFoodLog(userId, date);

        const meals = await prisma.mealEntry.findMany({
            where: { foodLogId: foodLog.id },
            orderBy: { createdAt: 'asc' },
        });

        // Get user's calorie targets
        const profile = await prisma.profile.findUnique({
            where: { userId },
            select: { calorieTarget: true, proteinTargetG: true, carbsTargetG: true, fatTargetG: true },
        });

        return {
            date,
            totalCalories: foodLog.totalCalories,
            totalProteinG: foodLog.totalProteinG,
            totalCarbsG: foodLog.totalCarbsG,
            totalFatG: foodLog.totalFatG,
            totalFiberG: foodLog.totalFiberG,
            mealCount: foodLog.mealCount,
            meals: meals.map((m) => ({
                id: m.id,
                mealType: m.mealType,
                name: m.name,
                calories: m.calories,
                proteinG: m.proteinG,
                carbsG: m.carbsG,
                fatG: m.fatG,
                fiberG: m.fiberG,
                servingSize: m.servingSize,
                photoUrl: m.photoUrl,
                aiAnalyzed: m.aiAnalyzed,
                aiConfidence: m.aiConfidence,
                createdAt: m.createdAt.toISOString(),
            })),
            targets: {
                calories: profile?.calorieTarget ?? null,
                proteinG: profile?.proteinTargetG ?? null,
                carbsG: profile?.carbsTargetG ?? null,
                fatG: profile?.fatTargetG ?? null,
            },
        };
    });

    // POST /meals - Add meal entry (manual)
    app.post('/meals', async (request) => {
        const userId = request.userId;
        const body = CreateMealEntrySchema.parse(request.body);

        const foodLog = await getOrCreateFoodLog(userId, body.date);

        const meal = await prisma.mealEntry.create({
            data: {
                userId,
                foodLogId: foodLog.id,
                mealType: body.mealType,
                name: body.name,
                calories: body.calories,
                proteinG: body.proteinG ?? 0,
                carbsG: body.carbsG ?? 0,
                fatG: body.fatG ?? 0,
                fiberG: body.fiberG ?? 0,
                servingSize: body.servingSize,
            },
        });

        await recalculateFoodLogTotals(foodLog.id);

        await createAuditLog(request, {
            action: 'CREATE',
            entityType: 'MealEntry',
            entityId: meal.id,
            metadata: { name: meal.name, calories: meal.calories },
        });

        return {
            id: meal.id,
            mealType: meal.mealType,
            name: meal.name,
            calories: meal.calories,
            proteinG: meal.proteinG,
            carbsG: meal.carbsG,
            fatG: meal.fatG,
            fiberG: meal.fiberG,
            servingSize: meal.servingSize,
            photoUrl: meal.photoUrl,
            aiAnalyzed: meal.aiAnalyzed,
            aiConfidence: meal.aiConfidence,
            createdAt: meal.createdAt.toISOString(),
        };
    });

    // PUT /meals/:id - Update meal entry
    app.put('/meals/:id', async (request, reply) => {
        const userId = request.userId;
        const { id } = request.params as { id: string };
        const body = UpdateMealEntrySchema.parse(request.body);

        const existing = await prisma.mealEntry.findFirst({
            where: { id, userId },
        });

        if (!existing) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Meal entry not found.',
            });
        }

        const meal = await prisma.mealEntry.update({
            where: { id },
            data: {
                mealType: body.mealType ?? existing.mealType,
                name: body.name ?? existing.name,
                calories: body.calories ?? existing.calories,
                proteinG: body.proteinG ?? existing.proteinG,
                carbsG: body.carbsG ?? existing.carbsG,
                fatG: body.fatG ?? existing.fatG,
                fiberG: body.fiberG ?? existing.fiberG,
                servingSize: body.servingSize ?? existing.servingSize,
            },
        });

        await recalculateFoodLogTotals(existing.foodLogId);

        return {
            id: meal.id,
            mealType: meal.mealType,
            name: meal.name,
            calories: meal.calories,
            proteinG: meal.proteinG,
            carbsG: meal.carbsG,
            fatG: meal.fatG,
            fiberG: meal.fiberG,
            servingSize: meal.servingSize,
            photoUrl: meal.photoUrl,
            aiAnalyzed: meal.aiAnalyzed,
            aiConfidence: meal.aiConfidence,
            createdAt: meal.createdAt.toISOString(),
        };
    });

    // DELETE /meals/:id - Delete meal entry
    app.delete('/meals/:id', async (request, reply) => {
        const userId = request.userId;
        const { id } = request.params as { id: string };

        const existing = await prisma.mealEntry.findFirst({
            where: { id, userId },
        });

        if (!existing) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Meal entry not found.',
            });
        }

        await prisma.mealEntry.delete({ where: { id } });
        await recalculateFoodLogTotals(existing.foodLogId);

        await createAuditLog(request, {
            action: 'DELETE',
            entityType: 'MealEntry',
            entityId: id,
            metadata: { name: existing.name },
        });

        return { success: true };
    });

    // POST /analyze-photo - Analyze food photo with GPT-4o
    app.post('/analyze-photo', async (request, reply) => {
        const body = AnalyzeFoodPhotoSchema.parse(request.body);

        if (!process.env.OPENAI_API_KEY) {
            return reply.status(503).send({
                statusCode: 503,
                error: 'Service Unavailable',
                message: 'Food analysis service is not configured.',
            });
        }

        const result = await analyzeFoodPhoto(body.imageBase64, body.mimeType);
        return result;
    });

    // POST /meals/from-analysis - Save meal from confirmed AI analysis
    app.post('/meals/from-analysis', async (request) => {
        const userId = request.userId;
        const body = CreateMealEntrySchema.parse(request.body);

        const foodLog = await getOrCreateFoodLog(userId, body.date);

        const meal = await prisma.mealEntry.create({
            data: {
                userId,
                foodLogId: foodLog.id,
                mealType: body.mealType,
                name: body.name,
                calories: body.calories,
                proteinG: body.proteinG ?? 0,
                carbsG: body.carbsG ?? 0,
                fatG: body.fatG ?? 0,
                fiberG: body.fiberG ?? 0,
                servingSize: body.servingSize,
                aiAnalyzed: true,
                aiConfidence: 0.85,
            },
        });

        await recalculateFoodLogTotals(foodLog.id);

        await createAuditLog(request, {
            action: 'CREATE',
            entityType: 'MealEntry',
            entityId: meal.id,
            metadata: { name: meal.name, aiAnalyzed: true },
        });

        return {
            id: meal.id,
            mealType: meal.mealType,
            name: meal.name,
            calories: meal.calories,
            proteinG: meal.proteinG,
            carbsG: meal.carbsG,
            fatG: meal.fatG,
            fiberG: meal.fiberG,
            servingSize: meal.servingSize,
            photoUrl: meal.photoUrl,
            aiAnalyzed: meal.aiAnalyzed,
            aiConfidence: meal.aiConfidence,
            createdAt: meal.createdAt.toISOString(),
        };
    });

    // GET /history - Paginated daily nutrition summaries
    app.get('/history', async (request) => {
        const userId = request.userId;
        const query = request.query as { page?: string; limit?: string };
        const page = parseInt(query.page || '1');
        const limit = parseInt(query.limit || '14');
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            prisma.foodLog.findMany({
                where: { userId },
                orderBy: { date: 'desc' },
                skip,
                take: limit,
            }),
            prisma.foodLog.count({ where: { userId } }),
        ]);

        return {
            data: logs.map((l) => ({
                date: l.date.toISOString().split('T')[0],
                totalCalories: l.totalCalories,
                totalProteinG: l.totalProteinG,
                totalCarbsG: l.totalCarbsG,
                totalFatG: l.totalFatG,
                totalFiberG: l.totalFiberG,
                mealCount: l.mealCount,
            })),
            total,
            page,
            limit,
            hasMore: skip + logs.length < total,
        };
    });
}
