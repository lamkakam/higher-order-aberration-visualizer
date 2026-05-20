import { createDefaultZernikeCoefficients } from '../../simulationConfig';
import type {
  ApertureSettings,
  SupportedTargetId,
  ZernikeCoefficientKey
} from '../../../types/domain';

export const defaultTargetId: SupportedTargetId = 'logmar_chart';
export const defaultApertureDiameterMm = 6;
export const defaultApertureSettings: ApertureSettings = {
  shape: 'circle',
  rotationDegrees: 0,
  centralObstructionShape: 'circle',
  centralObstructionRotationDegrees: 0,
  centralObstructionRatio: 0,
  spiderVaneCount: 0,
  spiderVaneWidthRatio: 0,
  spiderVaneRotationDegrees: 0,
  gaussianApodizationEnabled: false,
  gaussianApodizationSigmaRatio: 0.5
};
export const debounceMs = 300;
export const computeTimeoutMs = 60_000;
export const mobileStickyTopPx = 16;
export const desktopStickyTopPx = 24;
export const advancedGridHalfGapPx = 12;
export const spectralWavelengths = [550, 656, 486] as const;

export type SpectralWavelength = (typeof spectralWavelengths)[number];
export type ZernikeCoefficientMap = Record<ZernikeCoefficientKey, number>;
export type ZernikeCoefficientsByWavelength = Record<
  SpectralWavelength,
  ZernikeCoefficientMap
>;

export function createDefaultZernikeCoefficientsByWavelength(): ZernikeCoefficientsByWavelength {
  return {
    550: createDefaultZernikeCoefficients(),
    656: createDefaultZernikeCoefficients(),
    486: createDefaultZernikeCoefficients()
  };
}
