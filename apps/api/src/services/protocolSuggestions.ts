import { VertexAI } from '@google-cloud/vertexai';
import { assertNoPhi } from '../utils/deidentify.js';
import { featureFlags } from '../config/featureFlags.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LabMarkerInput {
    name: string;
    value: number | null;
    unit: string;
    refRangeLow: number | null;
    refRangeHigh: number | null;
}

export interface ProtocolSuggestion {
    compound: string;
    peptideDbId: string | null;
    reason: string;
    markers: string[];
    citations: { title: string; url: string }[];
    confidence: 'high' | 'moderate' | 'low';
}

export interface ProtocolSuggestionResult {
    disclaimer: string;
    suggestions: ProtocolSuggestion[];
    analyzedMarkers: number;
    flaggedMarkers: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DISCLAIMER =
    'This information is for educational purposes only and is not medical advice. ' +
    'Always consult a qualified healthcare provider before starting any supplement or peptide protocol.';

const MODEL_ID = 'gemini-2.0-flash';

// ─────────────────────────────────────────────────────────────────────────────
// Vertex AI client (lazy-initialized)
// ─────────────────────────────────────────────────────────────────────────────

let _vertexAI: VertexAI | null = null;

function getVertexAI(): VertexAI {
    if (_vertexAI) return _vertexAI;

    const project = process.env.VERTEX_AI_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.VERTEX_AI_LOCATION || 'us-central1';

    if (!project) {
        throw new Error(
            'Vertex AI project not configured. ' +
                'Set VERTEX_AI_PROJECT or GOOGLE_CLOUD_PROJECT environment variable.'
        );
    }

    _vertexAI = new VertexAI({ project, location });
    return _vertexAI;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(markers: LabMarkerInput[]): string {
    const markersJson = JSON.stringify(
        markers.map((m) => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            refRangeLow: m.refRangeLow,
            refRangeHigh: m.refRangeHigh,
        }))
    );

    return `You are a research-based health informatics assistant. This is NOT medical advice.

Given the following lab markers (as JSON), analyze each marker against its reference range. Identify markers that fall outside the optimal range (above refRangeHigh or below refRangeLow). For markers with a null value, skip them.

Suggest supplements and peptides that published research associates with the flagged markers. Use language like "research suggests" and "commonly used for" -- never "take this" or "you should". Include PubMed citation URLs where available.

Lab markers:
${markersJson}

Return ONLY a valid JSON object (no markdown, no code fences) matching this exact schema:

{
  "suggestions": [
    {
      "compound": "Name of supplement or peptide",
      "peptideDbId": null,
      "reason": "Explanation of why research associates this compound with the flagged marker(s)",
      "markers": ["Marker Name 1"],
      "citations": [
        { "title": "Study title or description", "url": "https://pubmed.ncbi.nlm.nih.gov/..." }
      ],
      "confidence": "high | moderate | low"
    }
  ],
  "flaggedMarkers": 0
}

Rules:
- Only include suggestions for markers that are outside their reference range
- Each suggestion must reference which marker(s) it addresses in the "markers" array
- confidence must be exactly one of: "high", "moderate", "low"
- peptideDbId should be null unless you can identify a specific database identifier
- If no markers are flagged, return an empty suggestions array and flaggedMarkers: 0
- Do NOT include any text outside the JSON object`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response parser
// ─────────────────────────────────────────────────────────────────────────────

function parseGeminiResponse(raw: string): { suggestions: ProtocolSuggestion[]; flaggedMarkers: number } {
    // Strip markdown code fences if present
    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        jsonStr = fenceMatch[1]!.trim();
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonStr);
    } catch {
        throw new Error(`Gemini returned malformed JSON. Raw response: ${raw.slice(0, 500)}`);
    }

    if (typeof parsed !== 'object' || parsed === null || !('suggestions' in parsed)) {
        throw new Error(
            'Gemini response missing required "suggestions" field. ' +
                `Received keys: ${Object.keys(parsed as Record<string, unknown>).join(', ')}`
        );
    }

    const body = parsed as { suggestions: unknown[]; flaggedMarkers?: number };

    // Validate and normalize each suggestion
    const suggestions: ProtocolSuggestion[] = (body.suggestions || []).map((s: unknown, i: number) => {
        const item = s as Record<string, unknown>;

        if (!item.compound || typeof item.compound !== 'string') {
            throw new Error(`Suggestion at index ${i} missing valid "compound" field`);
        }

        const validConfidence = ['high', 'moderate', 'low'];
        const confidence = validConfidence.includes(item.confidence as string)
            ? (item.confidence as 'high' | 'moderate' | 'low')
            : 'low';

        return {
            compound: item.compound,
            peptideDbId: typeof item.peptideDbId === 'string' ? item.peptideDbId : null,
            reason: typeof item.reason === 'string' ? item.reason : '',
            markers: Array.isArray(item.markers) ? item.markers.filter((m): m is string => typeof m === 'string') : [],
            citations: Array.isArray(item.citations)
                ? (item.citations as Record<string, unknown>[])
                      .filter((c) => typeof c.title === 'string' && typeof c.url === 'string')
                      .map((c) => ({ title: c.title as string, url: c.url as string }))
                : [],
            confidence,
        };
    });

    const flaggedMarkers = typeof body.flaggedMarkers === 'number' ? body.flaggedMarkers : 0;

    return { suggestions, flaggedMarkers };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PHI Risk Assessment (AI-PROTO-01):
 * - Sends: de-identified lab marker data (name, value, unit, reference ranges)
 * - Does NOT send: userId, patient name, DOB, provider info, or any direct identifiers
 * - Risk level: LOW - numeric lab values without patient context are not individually identifiable
 * - Requires: Vertex AI BAA before processing in production (gated by FEATURE_AI_SUGGESTIONS flag)
 * - Reviewed: 2026-03-13
 *
 * Reference: 45 CFR 164.514(b)(2)(i)
 */
export async function analyzeLabForSuggestions(
    markers: LabMarkerInput[]
): Promise<ProtocolSuggestionResult> {
    // ── Feature flag gate ────────────────────────────────────────────────
    if (!featureFlags.geminiProtocolSuggestions) {
        throw new Error(
            'AI protocol suggestions are disabled. ' +
                'Set FEATURE_AI_SUGGESTIONS=true to enable (requires Vertex AI BAA).'
        );
    }

    // ── Input validation ─────────────────────────────────────────────────
    if (!markers || markers.length === 0) {
        return {
            disclaimer: DISCLAIMER,
            suggestions: [],
            analyzedMarkers: 0,
            flaggedMarkers: 0,
        };
    }

    // ── Build prompt ─────────────────────────────────────────────────────
    const prompt = buildPrompt(markers);

    // ── HIPAA guard: assert prompt contains no PHI patterns (COMP-04) ────
    assertNoPhi(prompt, 'protocolSuggestions prompt');

    // ── Call Vertex AI Gemini ────────────────────────────────────────────
    try {
        const vertexAI = getVertexAI();
        const model = vertexAI.getGenerativeModel({
            model: MODEL_ID,
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 4096,
                responseMimeType: 'application/json',
            },
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        const response = result.response;

        if (!response.candidates || response.candidates.length === 0) {
            throw new Error('Gemini returned no candidates. The request may have been blocked by safety filters.');
        }

        const candidate = response.candidates[0]!;
        const text = candidate.content?.parts
            ?.map((p) => p.text || '')
            .join('')
            .trim();

        if (!text) {
            throw new Error('Gemini returned an empty response.');
        }

        // ── Parse and validate ───────────────────────────────────────────
        const { suggestions, flaggedMarkers } = parseGeminiResponse(text);

        return {
            disclaimer: DISCLAIMER,
            suggestions,
            analyzedMarkers: markers.filter((m) => m.value !== null).length,
            flaggedMarkers,
        };
    } catch (error) {
        // Re-throw feature flag and PHI errors as-is
        if (
            error instanceof Error &&
            (error.message.includes('HIPAA violation') ||
                error.message.includes('AI protocol suggestions are disabled') ||
                error.message.includes('Vertex AI project not configured'))
        ) {
            throw error;
        }

        // Wrap Gemini/network/parsing errors with context
        const message = error instanceof Error ? error.message : String(error);
        console.error('Protocol suggestions Gemini error:', message);
        throw new Error(`Failed to generate protocol suggestions: ${message}`);
    }
}
