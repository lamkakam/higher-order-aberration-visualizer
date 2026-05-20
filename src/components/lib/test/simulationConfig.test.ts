import { describe, expect, it } from 'vitest';
import {
  approximateStrehlRatio,
  computeRmsWavefrontError,
  createDefaultZernikeCoefficients,
  formatApproximateStrehlRatio
} from '../simulationConfig';

describe('Strehl ratio helpers', () => {
  it('formats all-zero coefficients as 100.0%', () => {
    expect(formatApproximateStrehlRatio(createDefaultZernikeCoefficients())).toBe(
      'Approx. Strehl Ratio: 100.0%'
    );
  });

  it('uses the Marechal approximation for one coefficient', () => {
    const coefficients = createDefaultZernikeCoefficients();
    coefficients['4,0'] = 0.1;

    expect(approximateStrehlRatio(coefficients)).toBeCloseTo(
      Math.exp(-((2 * Math.PI * 0.1) ** 2))
    );
    expect(formatApproximateStrehlRatio(coefficients)).toBe('Approx. Strehl Ratio: 67.4%');
  });

  it('computes RMS wavefront error as root-sum-square', () => {
    const coefficients = createDefaultZernikeCoefficients();
    coefficients['3,-1'] = 0.1;
    coefficients['4,0'] = 0.2;

    expect(computeRmsWavefrontError(coefficients)).toBeCloseTo(Math.sqrt(0.1 ** 2 + 0.2 ** 2));
    expect(formatApproximateStrehlRatio(coefficients)).toBe('Approx. Strehl Ratio: 13.9%');
  });
});
