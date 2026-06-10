import { describe, expect, it } from 'vitest';
import {
  approximateStrehlRatio,
  applyFwhmSeeingToZernikePayload,
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

describe('FWHM seeing payload helper', () => {
  it('returns cloned coefficient maps without mutating user coefficients when seeing is zero', () => {
    const coefficients = createDefaultZernikeCoefficients();
    coefficients['4,0'] = 0.2;
    const payload = [[550, coefficients]] as const;

    const mixedPayload = applyFwhmSeeingToZernikePayload({
      apertureDiameterMm: 6,
      fwhmSeeingArcsec: 0,
      zernikeCoefficientsByWavelength: payload
    });

    expect(mixedPayload).toEqual(payload);
    expect(mixedPayload).not.toBe(payload);
    expect(mixedPayload[0][1]).not.toBe(coefficients);
  });

  it('adds tilt terms for nonzero seeing while keeping user state separate', () => {
    const coefficients = createDefaultZernikeCoefficients();

    const mixedPayload = applyFwhmSeeingToZernikePayload({
      apertureDiameterMm: 6,
      fwhmSeeingArcsec: 1,
      zernikeCoefficientsByWavelength: [[550, coefficients]]
    });

    expect(mixedPayload[0][1]['1,-1']).toBeGreaterThan(0);
    expect(mixedPayload[0][1]['1,1']).toBeGreaterThan(0);
    expect(coefficients['1,-1']).toBeUndefined();
    expect(coefficients['1,1']).toBeUndefined();
  });

  it('does not add seeing contribution to defocus', () => {
    const coefficients = createDefaultZernikeCoefficients();
    coefficients['2,0'] = 0.125;

    const mixedPayload = applyFwhmSeeingToZernikePayload({
      apertureDiameterMm: 6,
      fwhmSeeingArcsec: 1,
      zernikeCoefficientsByWavelength: [[550, coefficients]]
    });

    expect(mixedPayload[0][1]['2,0']).toBe(0.125);
  });

  it('combines existing user coefficients with seeing by root-sum-square', () => {
    const coefficients = createDefaultZernikeCoefficients();
    coefficients['4,0'] = 0.2;

    const mixedPayload = applyFwhmSeeingToZernikePayload({
      apertureDiameterMm: 6,
      fwhmSeeingArcsec: 1,
      zernikeCoefficientsByWavelength: [[550, coefficients]]
    });

    const seeingOnlyPayload = applyFwhmSeeingToZernikePayload({
      apertureDiameterMm: 6,
      fwhmSeeingArcsec: 1,
      zernikeCoefficientsByWavelength: [[550, createDefaultZernikeCoefficients()]]
    });
    const seeingOnlySpherical = seeingOnlyPayload[0][1]['4,0'];

    expect(mixedPayload[0][1]['4,0']).toBeCloseTo(
      Math.sqrt(0.2 ** 2 + seeingOnlySpherical ** 2)
    );
    expect(mixedPayload[0][1]['4,0']).toBeLessThan(0.2 + seeingOnlySpherical);
  });

  it('scales seeing contribution by each wavelength channel', () => {
    const mixedPayload = applyFwhmSeeingToZernikePayload({
      apertureDiameterMm: 6,
      fwhmSeeingArcsec: 1,
      zernikeCoefficientsByWavelength: [
        [486, createDefaultZernikeCoefficients()],
        [656, createDefaultZernikeCoefficients()]
      ]
    });

    expect(mixedPayload[0][1]['1,1']).toBeGreaterThan(mixedPayload[1][1]['1,1']);
  });
});
