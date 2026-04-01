import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { authMiddleware } from '../middleware/auth.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function oracleRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    app.post('/chat', async (request, reply) => {
        const userId = request.userId;
        const { message, history } = request.body as {
            message: string;
            history?: Array<{ role: string; content: string }>;
        };

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return reply.status(400).send({ error: 'Message is required' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return reply.status(503).send({ error: 'AI service not configured' });
        }

        try {
            // Gather user's health context
            const [recentLogs, labMarkers, stacks, fastingSessions] = await Promise.all([
                prisma.dailyLog.findMany({
                    where: { userId },
                    orderBy: { date: 'desc' },
                    take: 7,
                    select: { date: true, sleepQuality: true, energyLevel: true, moodLevel: true, focusLevel: true, weightKg: true },
                }),
                prisma.labMarker.findMany({
                    where: { userId },
                    orderBy: { recordedAt: 'desc' },
                    take: 30,
                    select: { name: true, value: true, unit: true, refRangeLow: true, refRangeHigh: true, recordedAt: true, notes: true },
                }),
                prisma.stack.findMany({
                    where: { userId },
                    include: { items: { select: { name: true, dose: true, unit: true, timing: true } } },
                    take: 5,
                }),
                prisma.fastingSession.findMany({
                    where: { userId },
                    orderBy: { startedAt: 'desc' },
                    take: 5,
                    select: { protocolId: true, startedAt: true, endedAt: true, durationMins: true },
                }),
            ]);

            // Build context string
            const contextParts: string[] = [];

            if (recentLogs.length > 0) {
                const logSummary = recentLogs.map(l => {
                    const parts = [`Date: ${l.date.toISOString().split('T')[0]}`];
                    if (l.sleepQuality !== null) parts.push(`Sleep: ${l.sleepQuality}/10`);
                    if (l.energyLevel !== null) parts.push(`Energy: ${l.energyLevel}/10`);
                    if (l.moodLevel !== null) parts.push(`Mood: ${l.moodLevel}/10`);
                    if (l.focusLevel !== null) parts.push(`Focus: ${l.focusLevel}/10`);
                    if (l.weightKg !== null) parts.push(`Weight: ${l.weightKg}kg`);
                    return parts.join(', ');
                }).join('\n');
                contextParts.push(`DAILY LOGS (Last 7 days):\n${logSummary}`);
            }

            if (labMarkers.length > 0) {
                const markerSummary = labMarkers.map(m => {
                    const inRange = m.refRangeLow !== null && m.refRangeHigh !== null && m.value !== null
                        ? (m.value >= m.refRangeLow && m.value <= m.refRangeHigh ? 'IN RANGE' : 'OUT OF RANGE')
                        : '';
                    return `${m.name}: ${m.value} ${m.unit} (Ref: ${m.refRangeLow ?? '?'}-${m.refRangeHigh ?? '?'}) ${inRange}`;
                }).join('\n');
                contextParts.push(`LAB BIOMARKERS (Most recent):\n${markerSummary}`);
            }

            if (stacks.length > 0) {
                const stackSummary = stacks.map(s =>
                    `Stack "${s.name}": ${s.items.map(c => `${c.name} ${c.dose}${c.unit} (${c.timing ?? 'anytime'})`).join(', ')}`
                ).join('\n');
                contextParts.push(`SUPPLEMENT STACKS:\n${stackSummary}`);
            }

            if (fastingSessions.length > 0) {
                const fastSummary = fastingSessions.map(f => {
                    const hours = f.durationMins ? Math.round(f.durationMins / 60 * 10) / 10 : '?';
                    return `Protocol ${f.protocolId}: ${hours}h (${f.startedAt.toISOString().split('T')[0]})`;
                }).join('\n');
                contextParts.push(`RECENT FASTING:\n${fastSummary}`);
            }

            const healthContext = contextParts.length > 0
                ? contextParts.join('\n\n')
                : 'No health data available yet. The user is new.';

            const systemPrompt = `You are The Oracle, the AI health intelligence engine inside BioPoint — a biohacking companion app. You analyze the user's biological data and provide actionable, evidence-based insights.

PERSONA: Clinical, precise, confident. You speak like a personal health advisor who has access to all the user's data. Use markdown formatting for emphasis. Be concise — mobile screen.

RULES:
- Always reference the user's ACTUAL data when answering (biomarkers, logs, stacks, fasting).
- If a biomarker is out of range, flag it clearly.
- Suggest specific, actionable protocols (supplements, timing, lifestyle changes).
- Never diagnose. Say "your data suggests" not "you have".
- Keep responses under 200 words unless the user asks for detail.
- Use bullet points and bold for key numbers.

USER'S HEALTH DATA:
${healthContext}`;

            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

            // Build conversation history for multi-turn
            const chatHistory = (history || []).map(h => ({
                role: h.role === 'user' ? 'user' as const : 'model' as const,
                parts: [{ text: h.content }],
            }));

            const chat = model.startChat({
                history: [
                    { role: 'user', parts: [{ text: 'Initialize. Here is my health context.' }] },
                    { role: 'model', parts: [{ text: systemPrompt }] },
                    ...chatHistory,
                ],
            });

            const result = await chat.sendMessage(message);
            const response = result.response.text();

            return { response };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to generate response' });
        }
    });
}
