/**
 * Feature flags for BioPoint API
 *
 * Flags are driven by environment variables and default to OFF (safe).
 * This ensures features that require BAAs or external vendor agreements
 * are not accidentally enabled in production.
 */

export const featureFlags = {
  /**
   * Gemini lab analysis (SEC-01)
   * Disabled by default: sends PHI (lab images) to Google Gemini which lacks a BAA.
   * Re-enable via FEATURE_GEMINI_LAB_ANALYSIS=true once Vertex AI Healthcare API
   * is available with an executed BAA.
   */
  geminiLabAnalysis: process.env.FEATURE_GEMINI_LAB_ANALYSIS === 'true',
} as const;
