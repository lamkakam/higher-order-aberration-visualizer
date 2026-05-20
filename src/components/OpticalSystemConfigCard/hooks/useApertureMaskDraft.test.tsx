import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ApertureSettings } from '../../../types/domain';
import { useApertureMaskDraft } from './useApertureMaskDraft';

const apertureSettings: ApertureSettings = {
  shape: 'regular_hexagon',
  rotationDegrees: 30,
  centralObstructionShape: 'square',
  centralObstructionRotationDegrees: 45,
  centralObstructionRatio: 0.25,
  spiderVaneCount: 4,
  spiderVaneWidthRatio: 0.03,
  spiderVaneRotationDegrees: 15,
  gaussianApodizationEnabled: true,
  gaussianApodizationSigmaRatio: 0.4
};

describe('useApertureMaskDraft', () => {
  it('initializes draft state from aperture settings', () => {
    const { result } = renderHook(() => useApertureMaskDraft(apertureSettings));

    expect(result.current.state).toEqual(apertureSettings);
  });

  it('updates each draft field through actions', () => {
    const { result } = renderHook(() => useApertureMaskDraft(apertureSettings));

    act(() => {
      result.current.actions.setShape('circle');
      result.current.actions.setRotationDegrees(10);
      result.current.actions.setCentralObstructionRatio(0.1);
      result.current.actions.setCentralObstructionShape('circle');
      result.current.actions.setCentralObstructionRotationDegrees(20);
      result.current.actions.setGaussianApodizationEnabled(false);
      result.current.actions.setGaussianApodizationSigmaRatio(0.6);
      result.current.actions.setSpiderVaneCount(6);
      result.current.actions.setSpiderVaneWidthRatio(0.04);
      result.current.actions.setSpiderVaneRotationDegrees(25);
    });

    expect(result.current.state).toEqual({
      shape: 'circle',
      rotationDegrees: 10,
      centralObstructionRatio: 0.1,
      centralObstructionShape: 'circle',
      centralObstructionRotationDegrees: 20,
      gaussianApodizationEnabled: false,
      gaussianApodizationSigmaRatio: 0.6,
      spiderVaneCount: 6,
      spiderVaneWidthRatio: 0.04,
      spiderVaneRotationDegrees: 25
    });
  });

  it('keeps actions stable across state updates', () => {
    const { result } = renderHook(() => useApertureMaskDraft(apertureSettings));
    const actions = result.current.actions;

    act(() => {
      result.current.actions.setSpiderVaneCount(8);
    });

    expect(result.current.actions).toBe(actions);
  });
});
