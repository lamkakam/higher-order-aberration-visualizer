import type {
  ApertureSettings,
  SpectralMode,
  SupportedTargetId,
  WavefrontLegendUnit,
  ZernikeCoefficientKey
} from '../types/domain';

export type WorkerStatus = 'idle' | 'initializing' | 'ready' | 'error';

export type WorkerDiagnosticsMessageKey =
  | 'status.worker.idle'
  | 'status.worker.starting'
  | 'status.worker.loadingPyodide'
  | 'status.worker.loadingPythonPackages'
  | 'status.worker.loadingBundledSources'
  | 'status.worker.installingPrysm'
  | 'status.worker.ready'
  | 'status.worker.failed';

export interface WorkerDiagnostics {
  status: WorkerStatus;
  message: string;
  messageKey?: WorkerDiagnosticsMessageKey;
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
  mtfImageUrl: string;
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
