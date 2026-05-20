export const supportedTargetIds = [
  'snellen_e_20_20',
  'snellen_e_20_20_inverted',
  'logmar_chart',
  'logmar_chart_inverted',
  'jupiter',
  'point_source',
  'siemensstar',
  'slantededge',
  'tiltedsquare'
] as const;

export type SupportedTargetId = (typeof supportedTargetIds)[number];

export type ZernikeCoefficientKey = `${number},${number}`;
export type WavefrontLegendUnit = 'wave' | 'micron';
export type SpectralMode = 'monochromatic' | 'polychromatic';
export type ApertureShape = 'circle' | 'square' | 'regular_hexagon';

export interface ApertureSettings {
  shape: ApertureShape;
  rotationDegrees: number;
  centralObstructionShape: ApertureShape;
  centralObstructionRotationDegrees: number;
  centralObstructionRatio: number;
  spiderVaneCount: number;
  spiderVaneWidthRatio: number;
  spiderVaneRotationDegrees: number;
  gaussianApodizationEnabled: boolean;
  gaussianApodizationSigmaRatio: number;
}
