export type WorkerStatus = 'idle' | 'initializing' | 'ready' | 'error';

export interface WorkerDiagnostics {
  status: WorkerStatus;
  message: string;
  pyodideVersion?: string;
}

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

export interface ConvolvedImageInput {
  apertureSettings: ApertureSettings;
  apertureDiameterMm: number;
  diagnosticWavelengthNm: number;
  showScaleBar: boolean;
  spectralMode: SpectralMode;
  targetId: SupportedTargetId;
  wavelengthWeights: readonly (readonly [number, number])[];
  wavefrontLegendUnit: WavefrontLegendUnit;
  zernikeCoefficientsByWavelength: readonly (readonly [
    number,
    Record<ZernikeCoefficientKey, number>
  ])[];
}

export interface ConvolvedImageResult {
  imageUrl: string;
  psfImageUrl: string;
  wavefrontImageUrl: string;
  diagnostics: WorkerDiagnostics;
}

export interface ApertureMaskResult {
  imageUrl: string;
  diagnostics: WorkerDiagnostics;
}

export interface OpticsWorkerApi {
  initialize(): Promise<WorkerDiagnostics>;
  getStatus(): Promise<WorkerDiagnostics>;
  computeConvolvedImage(input: ConvolvedImageInput): Promise<ConvolvedImageResult>;
  renderApertureMask(input: ApertureSettings): Promise<ApertureMaskResult>;
}
