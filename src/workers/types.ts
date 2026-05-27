import type {
  ApertureSettings,
  SpectralMode,
  SupportedTargetId,
  WavefrontLegendUnit,
  ZernikeCoefficientKey
} from '../types/domain';

export type WorkerStatus = 'idle' | 'initializing' | 'ready' | 'error';

export interface WorkerDiagnostics {
  status: WorkerStatus;
  message: string;
  progressPercent?: number;
  pyodideVersion?: string;
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
