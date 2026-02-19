/**
 * PHI De-identification Utility
 *
 * Implements HIPAA Safe Harbor de-identification per 45 CFR 164.514(b)(2)(i).
 * This utility removes or replaces the 18 Safe Harbor identifier categories
 * before any text or structured data is transmitted to a non-BAA third-party AI service.
 *
 * Safe Harbor requires removal of the following categories:
 *   A. Names
 *   B. Geographic data (ZIP codes, addresses smaller than state)
 *   C. Dates (other than year) for individuals 89 or younger
 *   D. Telephone numbers
 *   E. Fax numbers
 *   F. Email addresses
 *   G. Social Security numbers
 *   H. Medical record numbers
 *   I. Health plan beneficiary numbers
 *   J. Account numbers
 *   K. Certificate/license numbers
 *   L. Vehicle identifiers and serial numbers
 *   M. Device identifiers and serial numbers
 *   N. Web Universal Resource Locators (URLs)
 *   O. Internet Protocol (IP) addresses
 *   P. Biometric identifiers (fingerprints, voice prints)
 *   Q. Full-face photographs and comparable images
 *   R. Any other unique identifying number, characteristic, or code
 *
 * Reference: 45 CFR 164.514(b)(2)(i)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A user context object that has been de-identified per 45 CFR 164.514(b)(2)(i).
 * Contains ONLY Safe Harbor-safe fields — no direct or quasi-identifiers.
 */
export interface SafeUserContext {
    /** Year of birth only (not full DOB). Ages > 89 are bucketed per Safe Harbor. */
    birthYear: number | null;
    /** Decade bucket (e.g., "30s", "40s", "90+") to prevent age inference for elderly individuals. */
    ageRange: string | null;
    /** Biological sex (male/female/other) — Safe Harbor category A does not apply to sex. */
    biologicalSex: string | null;
}

/**
 * A de-identified context wrapper carrying only fields safe for transmission
 * to non-BAA AI services per 45 CFR 164.514(b)(2)(i).
 */
export interface DeidentifiedContext {
    /** Safe user context with all direct identifiers stripped. */
    user: SafeUserContext | null;
    /** ISO timestamp indicating when de-identification was applied. */
    deidentifiedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHI Pattern Definitions (45 CFR 164.514(b)(2)(i) Safe Harbor categories)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regex patterns covering the text-scrubable Safe Harbor identifier categories.
 * Categories handled by field-stripping (A, L, M, P, Q) are not represented here
 * because they cannot be reliably detected via regex on arbitrary text.
 *
 * Reference: 45 CFR 164.514(b)(2)(i)
 */
const PHI_PATTERNS: ReadonlyArray<{ category: string; pattern: RegExp }> = [
    // Category B — Geographic: ZIP codes (5-digit and ZIP+4)
    {
        category: 'B-ZIP',
        pattern: /\b\d{5}(?:-\d{4})?\b/g,
    },

    // Category C — Dates (month/day/year or day/month/year, except year alone)
    {
        category: 'C-DATE-NUMERIC',
        pattern: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
    },
    {
        category: 'C-DATE-MONTH-NAME',
        pattern:
            /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    },

    // Category D — Telephone numbers (US formats including international prefix)
    {
        category: 'D-PHONE',
        pattern: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    },

    // Category F — Email addresses
    {
        category: 'F-EMAIL',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    },

    // Category G — Social Security numbers (SSN)
    {
        category: 'G-SSN',
        pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    },

    // Category H — Medical record numbers (common alphanumeric formats)
    {
        category: 'H-MRN',
        pattern: /\b[A-Z]{2,3}-?\d{4,10}\b/g,
    },

    // Categories I-K — Beneficiary, account, and license numbers
    // These are caught by generic alphanumeric identifier patterns below.
    // Specific patterns added for common formats:
    {
        category: 'I-J-K-ACCOUNT',
        pattern: /\b(?:acct|account|mrn|dob|ssn|npi|ein|dea|ndc)\s*[:#]?\s*[\w\-]{4,20}\b/gi,
    },

    // Category N — URLs (http and https)
    {
        category: 'N-URL',
        pattern: /https?:\/\/[^\s]+/g,
    },

    // Category O — IP addresses (IPv4)
    {
        category: 'O-IP',
        pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Exported functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replaces all detectable PHI patterns in free-text with `[REDACTED]`.
 *
 * Covers Safe Harbor categories B, C, D, E (via D), F, G, H, I-K (partially),
 * N, and O. Categories A (names), L (vehicle IDs), M (device IDs), P (biometrics),
 * and Q (photos) cannot be reliably detected via regex and must be handled at the
 * field/data-model level — do not pass such data into this function.
 *
 * Reference: 45 CFR 164.514(b)(2)(i)
 *
 * @param text - Raw text that may contain PHI
 * @returns Text with PHI patterns replaced by `[REDACTED]`
 */
export function scrubPhiFromText(text: string): string {
    let result = text;
    for (const { pattern } of PHI_PATTERNS) {
        // Reset lastIndex for global regexes used in a loop
        pattern.lastIndex = 0;
        result = result.replace(pattern, '[REDACTED]');
    }
    return result;
}

/**
 * De-identifies a structured user object for safe transmission to non-BAA AI services.
 *
 * Strips all 18 Safe Harbor direct identifiers from the user object and returns
 * only the Safe Harbor-safe fields: birthYear (year only), ageRange (decade bucket),
 * and biologicalSex.
 *
 * EXPLICITLY OMITS (not Safe Harbor-safe):
 * - userId / database IDs (Category R)
 * - email (Category F)
 * - name / firstName / lastName (Category A)
 * - dateOfBirth full date (Category C)
 * - ZIP code / address (Category B)
 * - phone (Category D)
 * - Any other direct or quasi-identifier
 *
 * Ages > 89 are bucketed as "90+" per Safe Harbor requirement that ages
 * 90 and above must not be disclosed as specific values.
 *
 * Reference: 45 CFR 164.514(b)(2)(i)
 *
 * @param user - User object with potentially identifying fields
 * @returns SafeUserContext with only Safe Harbor-safe fields
 */
export function deidentifyUserForAI(user: {
    dateOfBirth?: Date | null;
    biologicalSex?: string | null;
}): SafeUserContext {
    let birthYear: number | null = null;
    let ageRange: string | null = null;

    if (user.dateOfBirth != null) {
        const dob = user.dateOfBirth instanceof Date ? user.dateOfBirth : new Date(user.dateOfBirth);
        birthYear = dob.getFullYear();

        const now = new Date();
        const ageYears =
            now.getFullYear() -
            birthYear -
            (now.getMonth() < dob.getMonth() ||
            (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
                ? 1
                : 0);

        // Safe Harbor: ages > 89 must be bucketed as "90+" to prevent re-identification
        if (ageYears > 89) {
            ageRange = '90+';
            // Also suppress birthYear for ages > 89 per Safe Harbor
            birthYear = null;
        } else {
            const decade = Math.floor(ageYears / 10) * 10;
            ageRange = `${decade}s`;
        }
    }

    return {
        birthYear,
        ageRange,
        biologicalSex: user.biologicalSex ?? null,
    };
}

/**
 * Throws an Error if any detectable PHI pattern is found in the given text.
 *
 * Use this as a runtime guard before transmitting text to a non-BAA AI service.
 * It is a defense-in-depth check — do not rely on it as the sole PHI prevention
 * mechanism (scrubPhiFromText or field-stripping should be applied first).
 *
 * Reference: 45 CFR 164.514(b)(2)(i) — Safe Harbor requires no PHI in transmitted data.
 *
 * @param text - Text to assert is PHI-free
 * @param context - Human-readable label for error messages (e.g., "foodAnalysis system prompt")
 * @throws Error if a PHI pattern is detected
 */
export function assertNoPhi(text: string, context: string): void {
    for (const { category, pattern } of PHI_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(text)) {
            throw new Error(
                `HIPAA violation prevented: PHI pattern detected in ${context}. ` +
                    `Category: ${category}. ` +
                    `De-identify the text using scrubPhiFromText() before sending to non-BAA services. ` +
                    `Reference: 45 CFR 164.514(b)(2)(i).`
            );
        }
    }
}
