/**
 * markerMeta.ts
 *
 * Maps common blood work biomarkers to their directional interpretation so the
 * correlation engine can correctly label a change as "improved" or "worsened".
 *
 * Three possible directions:
 *   lower-is-better    — chronic inflammation, lipid risk, metabolic load, etc.
 *   higher-is-better   — protective markers, nutrients, organ-function reserves, etc.
 *   range-dependent    — both extremes are pathological; can only say "changed"
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarkerDirection =
    | 'lower-is-better'
    | 'higher-is-better'
    | 'range-dependent';

/**
 * Classification of a percent-change for a given marker.
 * 'changed' is returned for range-dependent markers where direction alone
 * cannot determine whether the shift is beneficial.
 */
export type ChangeClassification = 'improved' | 'worsened' | 'unchanged' | 'changed';

// ---------------------------------------------------------------------------
// Marker direction map
// Keys are lowercase normalized names. Multiple aliases map to the same
// direction so callers can pass raw lab names without pre-normalization.
// ---------------------------------------------------------------------------

export const MARKER_DIRECTIONS: Record<string, MarkerDirection> = {

    // -----------------------------------------------------------------------
    // LOWER IS BETTER
    // -----------------------------------------------------------------------

    // Inflammatory markers — elevated CRP signals systemic inflammation
    'crp': 'lower-is-better',
    'c-reactive protein': 'lower-is-better',
    'hs-crp': 'lower-is-better',           // high-sensitivity variant, same direction
    'high-sensitivity crp': 'lower-is-better',

    // Lipid risk markers — LDL & triglycerides drive atherosclerotic burden
    'ldl': 'lower-is-better',
    'ldl cholesterol': 'lower-is-better',
    'ldl-c': 'lower-is-better',
    'triglycerides': 'lower-is-better',
    'tg': 'lower-is-better',

    // Glycemic control — lower HbA1c / fasting glucose = less chronic hyperglycemia
    'hba1c': 'lower-is-better',
    'a1c': 'lower-is-better',
    'hemoglobin a1c': 'lower-is-better',
    'glucose fasting': 'lower-is-better',
    'fasting glucose': 'lower-is-better',
    'glucose': 'lower-is-better',

    // Insulin — chronically elevated fasting insulin is a marker of IR
    'insulin fasting': 'lower-is-better',
    'fasting insulin': 'lower-is-better',
    'insulin': 'lower-is-better',

    // Liver enzymes — elevation signals hepatocellular stress or damage
    'alt': 'lower-is-better',              // alanine aminotransferase
    'ast': 'lower-is-better',              // aspartate aminotransferase
    'ggt': 'lower-is-better',              // gamma-glutamyl transferase; also oxidative stress proxy

    // Cardiovascular risk factors
    'homocysteine': 'lower-is-better',     // elevated = vascular endothelial damage risk
    'lipoprotein(a)': 'lower-is-better',   // Lp(a) — genetically elevated = independent CVD risk
    'lp(a)': 'lower-is-better',
    'apob': 'lower-is-better',             // ApoB particle count is a better atherogenic predictor than LDL-C

    // Ferritin — high ferritin = iron overload / oxidative stress (not just deficiency)
    'ferritin (when high)': 'lower-is-better',
    'ferritin': 'lower-is-better',         // context-dependent but excess is the more common clinical concern

    // Stress / adrenal — chronically elevated cortisol = catabolism, immune suppression
    'cortisol': 'lower-is-better',

    // Hormonal (context-specific)
    'estradiol (in men)': 'lower-is-better',   // elevated estradiol in men → gynecomastia, low T symptoms
    'shbg (when high)': 'lower-is-better',     // very high SHBG binds free testosterone, reducing bioavailability

    // Uric acid — elevated = gout risk, also associated with metabolic syndrome
    'uric acid': 'lower-is-better',

    // -----------------------------------------------------------------------
    // HIGHER IS BETTER
    // -----------------------------------------------------------------------

    // Protective cholesterol — HDL removes cholesterol from arterial walls
    'hdl': 'higher-is-better',
    'hdl cholesterol': 'higher-is-better',
    'hdl-c': 'higher-is-better',

    // Androgens — low testosterone associated with metabolic, cognitive, mood deficits
    'testosterone total': 'higher-is-better',
    'testosterone free': 'higher-is-better',
    'testosterone': 'higher-is-better',
    'dhea-s': 'higher-is-better',              // adrenal androgen; declines with age, low = accelerated aging

    // Vitamin D — deficiency linked to immune dysfunction, bone loss, depression
    'vitamin d': 'higher-is-better',
    '25-oh vitamin d': 'higher-is-better',
    '25(oh)d': 'higher-is-better',
    'vitamin d3': 'higher-is-better',

    // B vitamins / folate — deficiency causes neurological damage, megaloblastic anemia
    'vitamin b12': 'higher-is-better',
    'b12': 'higher-is-better',
    'folate': 'higher-is-better',
    'folic acid': 'higher-is-better',

    // Iron panel — low iron = anemia, fatigue, impaired oxygen delivery
    'iron': 'higher-is-better',
    'tibc': 'higher-is-better',                // total iron-binding capacity; higher = more transport capacity

    // Minerals
    'magnesium': 'higher-is-better',           // deficiency = arrhythmia, muscle cramps, insulin resistance
    'zinc': 'higher-is-better',                // deficiency = immune dysfunction, poor wound healing

    // Growth / anabolic markers
    'igf-1': 'higher-is-better',               // insulin-like growth factor; declines with age, low = sarcopenia risk
    'growth hormone': 'higher-is-better',      // GH; low in adults → body comp deterioration

    // Thyroid hormones (active forms) — low fT3/fT4 = hypothyroid symptoms
    't3 free': 'higher-is-better',
    'free t3': 'higher-is-better',
    'ft3': 'higher-is-better',
    't4 free': 'higher-is-better',
    'free t4': 'higher-is-better',
    'ft4': 'higher-is-better',

    // Organ function / blood counts
    'albumin': 'higher-is-better',             // low albumin = malnutrition, liver failure, inflammation
    'hemoglobin': 'higher-is-better',
    'hgb': 'higher-is-better',
    'hematocrit': 'higher-is-better',
    'hct': 'higher-is-better',
    'rbc': 'higher-is-better',                 // red blood cell count
    'wbc': 'higher-is-better',                 // white blood cell count (in normal range context)
    'platelets': 'higher-is-better',
    'plt': 'higher-is-better',

    // Kidney filtration — lower eGFR = worse kidney function
    'egfr': 'higher-is-better',
    'estimated gfr': 'higher-is-better',

    // -----------------------------------------------------------------------
    // RANGE-DEPENDENT
    // Too low AND too high are both clinically problematic.
    // -----------------------------------------------------------------------

    // TSH — low = hyperthyroid, high = hypothyroid; optimal window is narrow
    'tsh': 'range-dependent',
    'thyroid stimulating hormone': 'range-dependent',

    // Cortisol AM — too low = adrenal insufficiency, too high = Cushing's / chronic stress
    'cortisol am': 'range-dependent',
    'morning cortisol': 'range-dependent',

    // Female sex hormones — depend heavily on cycle phase; both excess and deficiency are harmful
    'estradiol (in women)': 'range-dependent',
    'estradiol': 'range-dependent',
    'e2': 'range-dependent',
    'progesterone': 'range-dependent',

    // Prolactin — low is rare/benign but high causes infertility / hypogonadism
    'prolactin': 'range-dependent',

    // Electrolytes — tight homeostatic windows; deviations in either direction are dangerous
    'sodium': 'range-dependent',
    'na': 'range-dependent',
    'potassium': 'range-dependent',
    'k': 'range-dependent',
    'calcium': 'range-dependent',
    'ca': 'range-dependent',
    'phosphorus': 'range-dependent',
    'phosphate': 'range-dependent',

    // Kidney waste markers — too high = impaired clearance; mildly below normal is benign
    // but very low creatinine can indicate muscle wasting
    'creatinine': 'range-dependent',
    'bun': 'range-dependent',               // blood urea nitrogen
    'blood urea nitrogen': 'range-dependent',
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns the directional interpretation for a biomarker.
 * Performs a case-insensitive lookup after trimming whitespace.
 * Defaults to 'range-dependent' for unknown markers — the safest assumption
 * when we cannot assert that one direction is universally better.
 */
export function getMarkerDirection(markerName: string): MarkerDirection {
    const normalized = markerName.trim().toLowerCase();
    return MARKER_DIRECTIONS[normalized] ?? 'range-dependent';
}

/**
 * Classifies a percent change for a given biomarker as improved, worsened,
 * unchanged, or (for range-dependent markers) simply changed.
 *
 * @param markerName   - Raw or normalized marker name (case-insensitive)
 * @param percentChange - Signed percent change: positive = value went up, negative = went down
 */
export function classifyChange(
    markerName: string,
    percentChange: number,
): ChangeClassification {
    const UNCHANGED_THRESHOLD = 2; // percent

    if (Math.abs(percentChange) < UNCHANGED_THRESHOLD) {
        return 'unchanged';
    }

    const direction = getMarkerDirection(markerName);

    switch (direction) {
        case 'lower-is-better':
            return percentChange < 0 ? 'improved' : 'worsened';

        case 'higher-is-better':
            return percentChange > 0 ? 'improved' : 'worsened';

        case 'range-dependent':
            // Cannot determine good vs bad from direction alone — caller must
            // compare against the reference range to make that determination.
            return 'changed';
    }
}
