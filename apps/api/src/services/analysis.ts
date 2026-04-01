import { appLogger } from '../utils/appLogger.js';

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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set');
    }

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

    try {
        const b64 = fileBuffer.toString('base64');

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType, data: b64 } },
                        ],
                    }],
                }),
            }
        );

        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Gemini API ${res.status}: ${errBody.slice(0, 300)}`);
        }

        const data = await res.json() as any;
        const parts = data.candidates?.[0]?.content?.parts || [];

        // Gemini 2.5 Flash is a thinking model — parts[0] may be thinking text.
        // Find the LAST non-thinking part which contains the actual response.
        let text = '';
        for (const part of parts) {
            if (!part.thought && part.text) {
                text = part.text;
            }
        }
        if (!text) {
            // Fallback: just grab any text from any part
            text = parts.map((p: any) => p.text || '').join('');
        }

        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr) as AnalysisResult;
    } catch (error: any) {
        appLogger.error({ err: error, mimeType, bufferSize: fileBuffer.length }, 'Gemini Analysis Error');
        const detail = error?.message || String(error);
        throw new Error(`Failed to analyze (${mimeType}, ${Math.round(fileBuffer.length / 1024)}KB): ${detail}`);
    }
}
