import OpenAI from 'openai';
import type { FoodAnalysisResult } from '@biopoint/shared';
import { assertNoPhi } from '../utils/deidentify.js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * PHI Risk Assessment (SEC-08):
 * - Sends: food photo (base64 image) + generic nutrition analysis prompt
 * - Does NOT send: userId, userEmail, health conditions, names, DOB
 * - Risk level: LOW - food photos rarely contain PHI identifiers
 * - Recommendation: Obtain OpenAI BAA (email baa@openai.com) for zero-retention API
 * - Reviewed: 2026-02-19
 *
 * Note: Food photos are NOT PHI per HIPAA (they do not identify an individual in the
 * context of health care delivery). This assertNoPhi() guard applies to the text prompt
 * only — it prevents future regressions if someone inadvertently adds user context to
 * the system prompt. (COMP-04)
 */
export async function analyzeFoodPhoto(
    imageBase64: string,
    mimeType: string = 'image/jpeg'
): Promise<FoodAnalysisResult> {
    // HIPAA guard: ensure prompt text contains no PHI patterns (COMP-04)
    // Reference: 45 CFR 164.514(b)(2)(i) — Safe Harbor de-identification required for non-BAA services
    const systemPrompt = `You are a nutrition analysis expert. Analyze food photos and return JSON with nutritional estimates.
Always respond with ONLY valid JSON in this exact format:
{
  "name": "Brief description of the meal",
  "calories": 0,
  "proteinG": 0,
  "carbsG": 0,
  "fatG": 0,
  "fiberG": 0,
  "items": [
    {"name": "Item name", "calories": 0, "proteinG": 0, "carbsG": 0, "fatG": 0, "servingSize": "1 cup"}
  ],
  "confidence": 0.85
}
Confidence is 0-1 indicating how sure you are of the analysis.
Be accurate with standard portion sizes. Round to nearest integer for calories, one decimal for grams.`;

    assertNoPhi(systemPrompt, 'foodAnalysis system prompt');

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.3,
        max_tokens: 1000,
        messages: [
            {
                role: 'system',
                content: systemPrompt,
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:${mimeType};base64,${imageBase64}`,
                            detail: 'low',
                        },
                    },
                    {
                        type: 'text',
                        text: 'Analyze this food photo. Return nutritional breakdown as JSON.',
                    },
                ],
            },
        ],
    });

    const content = response.choices[0]?.message?.content || '';

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1]!.trim();
    }

    const parsed = JSON.parse(jsonStr) as FoodAnalysisResult;

    // Validate required fields
    return {
        name: parsed.name || 'Unknown Food',
        calories: Math.round(parsed.calories || 0),
        proteinG: Math.round((parsed.proteinG || 0) * 10) / 10,
        carbsG: Math.round((parsed.carbsG || 0) * 10) / 10,
        fatG: Math.round((parsed.fatG || 0) * 10) / 10,
        fiberG: Math.round((parsed.fiberG || 0) * 10) / 10,
        items: (parsed.items || []).map((item) => ({
            name: item.name || 'Unknown',
            calories: Math.round(item.calories || 0),
            proteinG: Math.round((item.proteinG || 0) * 10) / 10,
            carbsG: Math.round((item.carbsG || 0) * 10) / 10,
            fatG: Math.round((item.fatG || 0) * 10) / 10,
            servingSize: item.servingSize || '1 serving',
        })),
        confidence: Math.round((parsed.confidence || 0.5) * 100) / 100,
    };
}
