import { describe, it, expect } from 'vitest';
import { reconstitute, convertUnits } from '../reconstitute';

// ---------------------------------------------------------------------------
// reconstitute()
// ---------------------------------------------------------------------------

describe('reconstitute()', () => {
  // --- Happy-path calculations ---

  it('basic case: 10mg / 2mL / 250mcg / U-100 → concentration 5000, drawVolumeMl 0.05, syringeUnits 5', () => {
    const result = reconstitute(10, 2, 250, 'U-100');
    expect(result.concentration).toBe(5000);
    expect(result.drawVolumeMl).toBe(0.05);
    expect(result.syringeUnits).toBe(5);
  });

  it('U-40 syringe: same inputs as basic case → syringeUnits scaled to U-40 (2)', () => {
    const result = reconstitute(10, 2, 250, 'U-40');
    expect(result.concentration).toBe(5000);
    expect(result.drawVolumeMl).toBe(0.05);
    expect(result.syringeUnits).toBe(2);
  });

  it('small dose: 50mcg from 5mg vial with 1mL BAC water', () => {
    // concentration = (5 * 1000) / 1 = 5000 mcg/mL
    // drawVolumeMl  = 50 / 5000 = 0.01 mL
    // syringeUnits  = 0.01 * 100 = 1.0
    const result = reconstitute(5, 1, 50, 'U-100');
    expect(result.concentration).toBe(5000);
    expect(result.drawVolumeMl).toBe(0.01);
    expect(result.syringeUnits).toBe(1);
  });

  it('large dose: 1000mcg from 10mg vial with 2mL BAC water', () => {
    // concentration = (10 * 1000) / 2 = 5000 mcg/mL
    // drawVolumeMl  = 1000 / 5000 = 0.2 mL
    // syringeUnits  = 0.2 * 100 = 20.0
    const result = reconstitute(10, 2, 1000, 'U-100');
    expect(result.concentration).toBe(5000);
    expect(result.drawVolumeMl).toBe(0.2);
    expect(result.syringeUnits).toBe(20);
  });

  it('very small BAC water (0.5mL): produces higher concentration and smaller draw volume', () => {
    // concentration = (5 * 1000) / 0.5 = 10000 mcg/mL
    // drawVolumeMl  = 250 / 10000 = 0.025 mL
    // syringeUnits  = 0.025 * 100 = 2.5
    const result = reconstitute(5, 0.5, 250, 'U-100');
    expect(result.concentration).toBe(10000);
    expect(result.drawVolumeMl).toBe(0.025);
    expect(result.syringeUnits).toBe(2.5);
  });

  it('large BAC water (10mL): produces lower concentration and larger draw volume', () => {
    // concentration = (5 * 1000) / 10 = 500 mcg/mL
    // drawVolumeMl  = 250 / 500 = 0.5 mL
    // syringeUnits  = 0.5 * 100 = 50.0
    const result = reconstitute(5, 10, 250, 'U-100');
    expect(result.concentration).toBe(500);
    expect(result.drawVolumeMl).toBe(0.5);
    expect(result.syringeUnits).toBe(50);
  });

  // --- Edge: zero inputs ---

  it('peptideMg = 0 → throws RangeError', () => {
    expect(() => reconstitute(0, 2, 250, 'U-100')).toThrow(RangeError);
  });

  it('bacWaterMl = 0 → throws RangeError', () => {
    expect(() => reconstitute(10, 0, 250, 'U-100')).toThrow(RangeError);
  });

  it('desiredDoseMcg = 0 → throws RangeError', () => {
    expect(() => reconstitute(10, 2, 0, 'U-100')).toThrow(RangeError);
  });

  // --- Edge: negative inputs ---

  it('negative peptideMg → throws RangeError', () => {
    expect(() => reconstitute(-5, 2, 250, 'U-100')).toThrow(RangeError);
  });

  it('negative bacWaterMl → throws RangeError', () => {
    expect(() => reconstitute(10, -2, 250, 'U-100')).toThrow(RangeError);
  });

  it('negative desiredDoseMcg → throws RangeError', () => {
    expect(() => reconstitute(10, 2, -250, 'U-100')).toThrow(RangeError);
  });

  // --- Edge: NaN ---

  it('NaN peptideMg → throws RangeError', () => {
    expect(() => reconstitute(NaN, 2, 250, 'U-100')).toThrow(RangeError);
  });

  it('NaN bacWaterMl → throws RangeError', () => {
    expect(() => reconstitute(10, NaN, 250, 'U-100')).toThrow(RangeError);
  });

  it('NaN desiredDoseMcg → throws RangeError', () => {
    expect(() => reconstitute(10, 2, NaN, 'U-100')).toThrow(RangeError);
  });

  // --- Edge: Infinity ---

  it('Infinity peptideMg → throws RangeError', () => {
    expect(() => reconstitute(Infinity, 2, 250, 'U-100')).toThrow(RangeError);
  });

  it('Infinity bacWaterMl → throws RangeError', () => {
    expect(() => reconstitute(10, Infinity, 250, 'U-100')).toThrow(RangeError);
  });

  it('Infinity desiredDoseMcg → throws RangeError', () => {
    expect(() => reconstitute(10, 2, Infinity, 'U-100')).toThrow(RangeError);
  });

  // --- Rounding ---

  it('drawVolumeMl is rounded to 4 decimal places', () => {
    // concentration = (3 * 1000) / 7 ≈ 428.5714... mcg/mL
    // drawVolumeMl  = 100 / 428.5714... ≈ 0.23333... → rounds to 0.2333
    const result = reconstitute(3, 7, 100, 'U-100');
    const decimals = result.drawVolumeMl.toString().split('.')[1] ?? '';
    expect(decimals.length).toBeLessThanOrEqual(4);
    expect(result.drawVolumeMl).toBe(parseFloat(result.drawVolumeMl.toFixed(4)));
  });

  it('syringeUnits is rounded to 1 decimal place', () => {
    // concentration = (3 * 1000) / 7 ≈ 428.5714... mcg/mL
    // drawVolumeMl  ≈ 0.2333 mL
    // syringeUnits  = 0.2333 * 100 = 23.33... → rounds to 23.3
    const result = reconstitute(3, 7, 100, 'U-100');
    const decimals = result.syringeUnits.toString().split('.')[1] ?? '';
    expect(decimals.length).toBeLessThanOrEqual(1);
    expect(result.syringeUnits).toBe(parseFloat(result.syringeUnits.toFixed(1)));
  });
});

// ---------------------------------------------------------------------------
// convertUnits()
// ---------------------------------------------------------------------------

describe('convertUnits()', () => {
  // --- Standard conversions ---

  it('mcg to mg: 1000mcg → 1mg', () => {
    const result = convertUnits({ value: 1000, from: 'mcg', to: 'mg' });
    expect(result.value).toBe(1);
    expect(result.unit).toBe('mg');
  });

  it('mg to mcg: 1mg → 1000mcg', () => {
    const result = convertUnits({ value: 1, from: 'mg', to: 'mcg' });
    expect(result.value).toBe(1000);
    expect(result.unit).toBe('mcg');
  });

  it('mg to IU with iuConversion=3000: 1mg → 3000 IU', () => {
    const result = convertUnits({ value: 1, from: 'mg', to: 'IU', iuConversion: 3000 });
    expect(result.value).toBe(3000);
    expect(result.unit).toBe('IU');
  });

  it('IU to mcg with iuConversion=3000: 3000 IU → 1000mcg', () => {
    // 3000 IU / 3000 (IU/mg) = 1mg = 1000mcg
    const result = convertUnits({ value: 3000, from: 'IU', to: 'mcg', iuConversion: 3000 });
    expect(result.value).toBe(1000);
    expect(result.unit).toBe('mcg');
  });

  // --- Identity (same unit) ---

  it('identity conversion: 500mcg to mcg → 500', () => {
    const result = convertUnits({ value: 500, from: 'mcg', to: 'mcg' });
    expect(result.value).toBe(500);
    expect(result.unit).toBe('mcg');
  });

  // --- Error: IU without iuConversion ---

  it('mg to IU without iuConversion → throws TypeError', () => {
    expect(() =>
      convertUnits({ value: 1, from: 'mg', to: 'IU' }),
    ).toThrow(TypeError);
  });

  it('IU to mg without iuConversion → throws TypeError', () => {
    expect(() =>
      convertUnits({ value: 3000, from: 'IU', to: 'mg' }),
    ).toThrow(TypeError);
  });

  // --- Error: zero value ---

  it('zero value → throws RangeError', () => {
    expect(() =>
      convertUnits({ value: 0, from: 'mcg', to: 'mg' }),
    ).toThrow(RangeError);
  });

  // --- Error: negative value ---

  it('negative value → throws RangeError', () => {
    expect(() =>
      convertUnits({ value: -100, from: 'mcg', to: 'mg' }),
    ).toThrow(RangeError);
  });
});
