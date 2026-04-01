import { GoogleGenerativeAI, GoogleAIFileManager } from '@google/generative-ai/server';
import { GoogleGenerativeAI as GoogleGenAIClient } from '@google/generative-ai';
import { appLogger } from '../utils/appLogger.js';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenAIClient(apiKey);

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

    // Write buffer to temp file for Gemini File API upload
    const ext = mimeType.split('/')[1] || 'jpg';
    const tmpPath = join(tmpdir(), `lab-${Date.now()}.${ext}`);

    try {
        writeFileSync(tmpPath, fileBuffer);

        // Upload via Gemini File API (more reliable than inline base64)
        const fileManager = new GoogleAIFileManager(apiKey);
        const uploadResult = await fileManager.uploadFile(tmpPath, {
            mimeType,
            displayName: `lab-report-${Date.now()}`,
        });

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
                fileData: {
                    fileUri: uploadResult.file.uri,
                    mimeType: uploadResult.file.mimeType,
                },
            },
        ]);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(jsonStr) as AnalysisResult;
    } catch (error: any) {
        appLogger.error({ err: error, mimeType, bufferSize: fileBuffer.length }, 'Gemini Analysis Error');
        const detail = error?.message || String(error);
        throw new Error(`Failed to analyze (${mimeType}, ${Math.round(fileBuffer.length / 1024)}KB): ${detail}`);
    } finally {
        try { unlinkSync(tmpPath); } catch { /* ignore cleanup errors */ }
    }
}
