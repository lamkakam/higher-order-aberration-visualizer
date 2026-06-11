import { describe, expect, it } from 'vitest';
import {
  approximateStrehlRatio,
  calculateDOverR0FromFwhmSeeing,
  computeRmsWavefrontError,
  createFwhmSeeingZernikeSigmaPayload,
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
  it('calculates D/r0 from aperture, seeing, and wavelength', () => {
    expect(
      calculateDOverR0FromFwhmSeeing({
        apertureDiameterMm: 6,
        fwhmSeeingArcsec: 1,
        wavelengthNm: 550
      })
    ).toBeCloseTo(6 / (0.20214 * 550));
  });

  it('returns zero D/r0 for zero seeing', () => {
    expect(
      calculateDOverR0FromFwhmSeeing({
        apertureDiameterMm: 6,
        fwhmSeeingArcsec: 0,
        wavelengthNm: 550
      })
    ).toBe(0);
  });

  it('returns empty sigma maps without mutating user coefficients when seeing is zero', () => {
    const coefficients = createDefaultZernikeCoefficients();
    coefficients['4,0'] = 0.2;
    const payload = [[550, coefficients]] as const;

    const mixedPayload = createFwhmSeeingZernikeSigmaPayload({
      apertureDiameterMm: 6,
      fwhmSeeingArcsec: 0,
      zernikeCoefficientsByWavelength: payload
    });

    expect(mixedPayload).toEqual([[550, {}]]);
    expect(mixedPayload).not.toBe(payload);
    expect(mixedPayload[0][1]).not.toBe(coefficients);
    expect(coefficients['4,0']).toBe(0.2);
  });

  it('adds tilt terms for nonzero seeing while keeping user state separate', () => {
    const coefficients = createDefaultZernikeCoefficients();

    const mixedPayload = createFwhmSeeingZernikeSigmaPayload({
      apertureDiameterMm: 6,
      fwhmSeeingArcsec: 1,
      zernikeCoefficientsByWavelength: [[550, coefficients]]
    });

    expect(mixedPayload[0][1]['1,-1']).toBeGreaterThan(0);
    expect(mixedPayload[0][1]['1,1']).toBeGreaterThan(0);
    expect(coefficients['1,-1']).toBeUndefined();
    expect(coefficients['1,1']).toBeUndefined();
  });

  it('returns sigma-only defocus without root-sum-square mixing', () => {
    const coefficients = createDefaultZernikeCoefficients();
    coefficients['2,0'] = 0.125;

    const sigmaPayload = createFwhmSeeingZernikeSigmaPayload({
      apertureDiameterMm: 6,
      fwhmSeeingArcsec: 1,
      zernikeCoefficientsByWavelength: [[550, coefficients]]
    });
    const seeingOnlyPayload = createFwhmSeeingZernikeSigmaPayload({
      apertureDiameterMm: 6,
      fwhmSeeingArcsec: 1,
      zernikeCoefficientsByWavelength: [[550, createDefaultZernikeCoefficients()]]
    });
    const seeingOnlyDefocus = seeingOnlyPayload[0][1]['2,0'];

    expect(sigmaPayload[0][1]['2,0']).toBeCloseTo(seeingOnlyDefocus);
    expect(sigmaPayload[0][1]['2,0']).toBeLessThan(0.125);
    expect(coefficients['2,0']).toBe(0.125);
  });

  it('does not mutate or mix existing user coefficients into seeing sigmas', () => {
    const coefficients = createDefaultZernikeCoefficients();
    coefficients['4,0'] = 0.2;

    const sigmaPayload = createFwhmSeeingZernikeSigmaPayload({
      apertureDiameterMm: 6,
      fwhmSeeingArcsec: 1,
      zernikeCoefficientsByWavelength: [[550, coefficients]]
    });

    const seeingOnlyPayload = createFwhmSeeingZernikeSigmaPayload({
      apertureDiameterMm: 6,
      fwhmSeeingArcsec: 1,
      zernikeCoefficientsByWavelength: [[550, createDefaultZernikeCoefficients()]]
    });
    const seeingOnlySpherical = seeingOnlyPayload[0][1]['4,0'];

    expect(sigmaPayload[0][1]['4,0']).toBeCloseTo(seeingOnlySpherical);
    expect(coefficients['4,0']).toBe(0.2);
  });

  it('scales seeing contribution by each wavelength channel', () => {
    const mixedPayload = createFwhmSeeingZernikeSigmaPayload({
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
