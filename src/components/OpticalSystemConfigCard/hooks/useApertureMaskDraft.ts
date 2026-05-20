import { useMemo, useState } from 'react';
import type { ApertureSettings, ApertureShape } from '../../../types/domain';
import type { ApertureMaskDraftActions } from '../ApertureMaskControls';
import type { ApertureMaskDraftState } from '../apertureMaskRules';

export interface ApertureMaskDraft {
  readonly state: ApertureMaskDraftState;
  readonly actions: ApertureMaskDraftActions;
}

export function useApertureMaskDraft(apertureSettings: ApertureSettings): ApertureMaskDraft {
  const [shape, setShape] = useState<ApertureShape>(apertureSettings.shape);
  const [rotationDegrees, setRotationDegrees] = useState(apertureSettings.rotationDegrees);
  const [centralObstructionRatio, setCentralObstructionRatio] = useState(
    apertureSettings.centralObstructionRatio
  );
  const [centralObstructionShape, setCentralObstructionShape] = useState<ApertureShape>(
    apertureSettings.centralObstructionShape
  );
  const [centralObstructionRotationDegrees, setCentralObstructionRotationDegrees] =
    useState(apertureSettings.centralObstructionRotationDegrees);
  const [gaussianApodizationEnabled, setGaussianApodizationEnabled] = useState(
    apertureSettings.gaussianApodizationEnabled
  );
  const [gaussianApodizationSigmaRatio, setGaussianApodizationSigmaRatio] = useState(
    apertureSettings.gaussianApodizationSigmaRatio
  );
  const [spiderVaneCount, setSpiderVaneCount] = useState(apertureSettings.spiderVaneCount);
  const [spiderVaneWidthRatio, setSpiderVaneWidthRatio] = useState(
    apertureSettings.spiderVaneWidthRatio
  );
  const [spiderVaneRotationDegrees, setSpiderVaneRotationDegrees] = useState(
    apertureSettings.spiderVaneRotationDegrees
  );

  const state = useMemo(
    () => ({
      shape,
      rotationDegrees,
      centralObstructionRatio,
      centralObstructionShape,
      centralObstructionRotationDegrees,
      gaussianApodizationEnabled,
      gaussianApodizationSigmaRatio,
      spiderVaneCount,
      spiderVaneWidthRatio,
      spiderVaneRotationDegrees
    }),
    [
      shape,
      rotationDegrees,
      centralObstructionRatio,
      centralObstructionShape,
      centralObstructionRotationDegrees,
      gaussianApodizationEnabled,
      gaussianApodizationSigmaRatio,
      spiderVaneCount,
      spiderVaneWidthRatio,
      spiderVaneRotationDegrees
    ]
  );
  const actions = useMemo(
    () => ({
      setShape,
      setRotationDegrees,
      setCentralObstructionRatio,
      setCentralObstructionShape,
      setCentralObstructionRotationDegrees,
      setGaussianApodizationEnabled,
      setGaussianApodizationSigmaRatio,
      setSpiderVaneCount,
      setSpiderVaneWidthRatio,
      setSpiderVaneRotationDegrees
    }),
    []
  );

  return { state, actions };
}
