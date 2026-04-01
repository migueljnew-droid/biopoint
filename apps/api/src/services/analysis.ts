import { GoogleGenerativeAI } from '@google/generative-ai';
import { appLogger } from '../utils/appLogger.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface AnalysisResult {
    summary: string;
    markers: Array<{
        name: string;
        value: number;
        unit: string;
        range: string;
        flag: 'HIGH' | 'LOW' | 'NORMAL';
        insight: string;
    }>;
}

export async function analyzeLabReport(
    fileBuffer: Buffer,
    mimeType: string
): Promise<AnalysisResult> {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set');
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `You are an expert medical data analyst. Analyze this blood work / lab report image.
Extract the following information in strict JSON format:
1. A brief "summary" of the overall health status based on the results.
2. A list of "markers" found in the report. For each marker, include:
   - "name": The name of the biomarker (e.g., Hemoglobin, LDL Cholesterol).
   - "value": The numeric value (use 0 if not numeric or not found).
   - "unit": The unit of measurement (e.g., g/dL, mg/dL).
   - "range": The reference range provided in the image (as a string).
   - "flag": "HIGH", "LOW", or "NORMAL" based on the range.
   - "insight": A one-sentence explanation of what this result means.

Return ONLY the raw JSON object, no markdown formatting.`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: fileBuffer.toString('base64'),
                    mimeType,
                },
            },
        ]);
        const response = await result.response;
        const text = response.text();

        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr) as AnalysisResult;
    } catch (error: any) {
        appLogger.error({ err: error, mimeType, bufferSize: fileBuffer.length }, 'Gemini Analysis Error');
        const detail = error?.message || String(error);
        throw new Error(`Failed to analyze (${mimeType}, ${Math.round(fileBuffer.length / 1024)}KB): ${detail}`);
    }
}
