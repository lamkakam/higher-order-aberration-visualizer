import { describe, expect, it } from 'vitest';
import type { ApertureSettings } from '../../../types/domain';
import {
  formatApertureSummary,
  formatRatioValue,
  getApertureMaskVisibility,
  normalizeApertureMaskDraft,
  type ApertureMaskDraftState
} from '../apertureMaskRules';

const defaultDraft: ApertureMaskDraftState = {
  shape: 'circle',
  rotationDegrees: 45,
  centralObstructionRatio: 0,
  centralObstructionShape: 'circle',
  centralObstructionRotationDegrees: 30,
  gaussianApodizationEnabled: false,
  gaussianApodizationSigmaRatio: 0.5,
  spiderVaneCount: 0,
  spiderVaneWidthRatio: 0,
  spiderVaneRotationDegrees: 0
};

describe('apertureMaskRules', () => {
  it('normalizes circle aperture rotation to zero', () => {
    expect(normalizeApertureMaskDraft(defaultDraft)?.rotationDegrees).toBe(0);
  });

  it('preserves valid non-circle aperture rotation', () => {
    expect(
      normalizeApertureMaskDraft({
        ...defaultDraft,
        shape: 'square',
        rotationDegrees: 25
      })?.rotationDegrees
    ).toBe(25);
  });

  it('hides obstruction controls and normalizes obstruction shape and rotation for zero obstruction', () => {
    const draft: ApertureMaskDraftState = {
      ...defaultDraft,
      centralObstructionRatio: 0,
      centralObstructionShape: 'square',
      centralObstructionRotationDegrees: 45
    };
    const normalizedDraft = normalizeApertureMaskDraft(draft);

    expect(normalizedDraft).toMatchObject({
      centralObstructionShape: 'circle',
      centralObstructionRotationDegrees: 0
    });
    expect(getApertureMaskVisibility(draft, normalizedDraft).showObstructionControls).toBe(false);
  });

  it('exposes obstruction rotation and preserves valid non-circle obstruction settings', () => {
    const draft: ApertureMaskDraftState = {
      ...defaultDraft,
      centralObstructionRatio: 0.3,
      centralObstructionShape: 'regular_hexagon',
      centralObstructionRotationDegrees: 60
    };
    const normalizedDraft = normalizeApertureMaskDraft(draft);

    expect(normalizedDraft).toMatchObject({
      centralObstructionShape: 'regular_hexagon',
      centralObstructionRotationDegrees: 60
    });
    expect(getApertureMaskVisibility(draft, normalizedDraft)).toMatchObject({
      showObstructionControls: true,
      showObstructionRotation: true
    });
  });

  it.each([
    {
      name: 'out-of-range obstruction ratio',
      draft: { centralObstructionRatio: 1 }
    },
    {
      name: 'invalid spider vane count',
      draft: { spiderVaneCount: 2.5 }
    },
    {
      name: 'invalid vane width',
      draft: { spiderVaneWidthRatio: 0.26 }
    },
    {
      name: 'invalid aperture rotation',
      draft: { shape: 'square' as const, rotationDegrees: 361 }
    },
    {
      name: 'invalid obstruction rotation',
      draft: {
        centralObstructionRatio: 0.2,
        centralObstructionShape: 'square' as const,
        centralObstructionRotationDegrees: -1
      }
    },
    {
      name: 'invalid spider vane rotation',
      draft: { spiderVaneRotationDegrees: Number.NaN }
    },
    {
      name: 'invalid Gaussian sigma',
      draft: {
        gaussianApodizationEnabled: true,
        gaussianApodizationSigmaRatio: 0.04
      }
    }
  ])('returns undefined for $name', ({ draft }) => {
    expect(normalizeApertureMaskDraft({ ...defaultDraft, ...draft })).toBeUndefined();
  });

  it('shows Gaussian sigma only when Gaussian apodization is enabled', () => {
    const enabledDraft = {
      ...defaultDraft,
      gaussianApodizationEnabled: true
    };

    expect(
      getApertureMaskVisibility(defaultDraft, normalizeApertureMaskDraft(defaultDraft))
        .showGaussianSigma
    ).toBe(false);
    expect(
      getApertureMaskVisibility(enabledDraft, normalizeApertureMaskDraft(enabledDraft))
        .showGaussianSigma
    ).toBe(true);
  });

  it('summarizes aperture settings with only active effects without a translator', () => {
    expect(
      formatApertureSummary({
        ...defaultDraft,
        shape: 'square',
        centralObstructionRatio: 0.25,
        centralObstructionShape: 'regular_hexagon',
        spiderVaneCount: 4,
        spiderVaneWidthRatio: 0.03,
        spiderVaneRotationDegrees: 12,
        gaussianApodizationEnabled: true,
        gaussianApodizationSigmaRatio: 0.5
      } satisfies ApertureSettings)
    ).toBe(
      'Square, 25% regular hexagon obstruction, 4-vane spider rotated 12 deg, each vane 0.03D wide, Gaussian apodization with 0.5D sigma'
    );

    expect(
      formatApertureSummary({
        ...defaultDraft,
        spiderVaneCount: 4,
        spiderVaneWidthRatio: 0,
        gaussianApodizationEnabled: false
      } satisfies ApertureSettings)
    ).toBe('Circle, 0% obstruction');
  });

  it.each([
    [0, '0'],
    [0.5, '0.5'],
    [0.1, '0.1'],
    [0.12, '0.12'],
    [0.126, '0.13'],
    [1, '1']
  ])('formats ratio %s as %s', (value, expected) => {
    expect(formatRatioValue(value)).toBe(expected);
  });
});
