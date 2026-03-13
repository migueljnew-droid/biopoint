/**
 * Peptide reconstitution calculator utilities.
 *
 * Pure functions — no imports, no side effects, no API calls.
 * All arithmetic uses SI-derived units internally:
 *   - mass  : milligrams (mg) and micrograms (mcg), where 1 mg = 1000 mcg
 *   - volume: millilitres (mL)
 *   - syringe: insulin units (IU), scaled by syringe type (U-100 = 100 IU/mL, U-40 = 40 IU/mL)
 */

// ---------------------------------------------------------------------------
// Syringe types
// ---------------------------------------------------------------------------

/** Insulin syringe calibration: U-100 has 100 units per mL, U-40 has 40 units per mL. */
export type SyringeType = 'U-100' | 'U-40';

/** Maps each syringe type to its units-per-mL scale factor. */
const SYRINGE_SCALE: Record<SyringeType, number> = {
  'U-100': 100,
  'U-40': 40,
} as const;

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

/** Parameters required to calculate a peptide reconstitution. */
export interface ReconstituteInput {
  /** Total peptide mass in the vial, in milligrams (mg). */
  peptideMg: number;
  /** Volume of bacteriostatic water added to the vial, in millilitres (mL). */
  bacWaterMl: number;
  /** The dose the user wishes to draw, in micrograms (mcg). */
  desiredDoseMcg: number;
  /** The insulin syringe being used for the draw. */
  syringeType: SyringeType;
}

/** Calculated reconstitution result. */
export interface ReconstituteResult {
  /** Resulting peptide concentration in mcg per mL. */
  concentration: number;
  /** Volume to draw from the vial in mL, rounded to 4 decimal places. */
  drawVolumeMl: number;
  /** Equivalent syringe graduation units to draw, rounded to 1 decimal place. */
  syringeUnits: number;
}

// ---------------------------------------------------------------------------
// Unit conversion types
// ---------------------------------------------------------------------------

/** Supported unit identifiers for the convertUnits helper. */
export type MassUnit = 'mcg' | 'mg' | 'IU';

/** Input descriptor for convertUnits. */
export interface ConvertUnitsInput {
  /** The numeric value to convert. */
  value: number;
  /** The unit the value is currently expressed in. */
  from: MassUnit;
  /** The unit to convert the value into. */
  to: MassUnit;
  /**
   * Conversion factor between mass and International Units.
   * Required when either `from` or `to` is 'IU'.
   * Expressed as IU per mg (e.g. for HGH: 3 IU/mg → iuConversion = 3).
   */
  iuConversion?: number;
}

/** Result of a unit conversion. */
export interface ConvertUnitsResult {
  /** The converted numeric value. */
  value: number;
  /** The unit of the converted value. */
  unit: MassUnit;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validates that a number is finite and strictly positive.
 * Throws a descriptive RangeError when the assertion fails.
 */
function assertPositiveFinite(value: number, label: string): void {
  if (Number.isNaN(value)) {
    throw new RangeError(`${label} must be a number, received NaN.`);
  }
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number, received ${value}.`);
  }
  if (value <= 0) {
    throw new RangeError(
      `${label} must be greater than zero, received ${value}.`,
    );
  }
}

/** Rounds a number to the specified number of decimal places. */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// Primary export: reconstitute
// ---------------------------------------------------------------------------

/**
 * Calculates the peptide concentration, draw volume, and syringe graduation
 * units for a given reconstitution scenario.
 *
 * @example
 * reconstitute(10, 2, 250, 'U-100')
 * // => { concentration: 5000, drawVolumeMl: 0.05, syringeUnits: 5.0 }
 *
 * @throws {RangeError} When any numeric input is zero, negative, or NaN.
 */
export function reconstitute(
  peptideMg: number,
  bacWaterMl: number,
  desiredDoseMcg: number,
  syringeType: SyringeType,
): ReconstituteResult {
  assertPositiveFinite(peptideMg, 'peptideMg');
  assertPositiveFinite(bacWaterMl, 'bacWaterMl');
  assertPositiveFinite(desiredDoseMcg, 'desiredDoseMcg');

  const concentration = (peptideMg * 1000) / bacWaterMl;
  const drawVolumeMl = round(desiredDoseMcg / concentration, 4);
  const syringeScale = SYRINGE_SCALE[syringeType];
  const syringeUnits = round(drawVolumeMl * syringeScale, 1);

  return { concentration, drawVolumeMl, syringeUnits };
}

// ---------------------------------------------------------------------------
// Secondary export: convertUnits
// ---------------------------------------------------------------------------

/**
 * Converts a mass value between mcg, mg, and IU.
 *
 * IU conversions require the `iuConversion` factor (IU per mg).
 * Passing a conversion factor when neither unit is IU is silently ignored.
 *
 * @example
 * convertUnits({ value: 5, from: 'mg', to: 'mcg' })
 * // => { value: 5000, unit: 'mcg' }
 *
 * convertUnits({ value: 1, from: 'mg', to: 'IU', iuConversion: 3 })
 * // => { value: 3, unit: 'IU' }
 *
 * @throws {RangeError} When value is zero, negative, or NaN.
 * @throws {TypeError}  When an IU conversion is requested but iuConversion is absent.
 */
export function convertUnits(input: ConvertUnitsInput): ConvertUnitsResult {
  const { value, from, to, iuConversion } = input;

  assertPositiveFinite(value, 'value');

  if (from === to) {
    return { value, unit: to };
  }

  // Normalise to mg first, then project to the target unit.
  let valueMg: number;

  switch (from) {
    case 'mcg':
      valueMg = value / 1000;
      break;
    case 'mg':
      valueMg = value;
      break;
    case 'IU': {
      if (iuConversion === undefined) {
        throw new TypeError(
          'iuConversion (IU per mg) is required when converting from IU.',
        );
      }
      assertPositiveFinite(iuConversion, 'iuConversion');
      valueMg = value / iuConversion;
      break;
    }
  }

  switch (to) {
    case 'mcg':
      return { value: valueMg * 1000, unit: 'mcg' };
    case 'mg':
      return { value: valueMg, unit: 'mg' };
    case 'IU': {
      if (iuConversion === undefined) {
        throw new TypeError(
          'iuConversion (IU per mg) is required when converting to IU.',
        );
      }
      assertPositiveFinite(iuConversion, 'iuConversion');
      return { value: valueMg * iuConversion, unit: 'IU' };
    }
  }
}
