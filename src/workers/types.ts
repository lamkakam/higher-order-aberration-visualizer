export type WorkerStatus = 'idle' | 'initializing' | 'ready' | 'error';

export interface WorkerDiagnostics {
  status: WorkerStatus;
  message: string;
  pyodideVersion?: string;
}

export const supportedTargetIds = [
  'snellen_e_20_20',
  'logmar_chart',
  'siemensstar',
  'slantededge',
  'tiltedsquare'
] as const;

export type SupportedTargetId = (typeof supportedTargetIds)[number];

export type ZernikeCoefficientKey = `${number},${number}`;

export interface ConvolvedImageInput {
  apertureDiameterMm: number;
  targetId: SupportedTargetId;
  zernikeCoefficients: Record<ZernikeCoefficientKey, number>;
}

export interface ConvolvedImageResult {
  imageUrl: string;
  diagnostics: WorkerDiagnostics;
}

export interface OpticsWorkerApi {
  initialize(): Promise<WorkerDiagnostics>;
  getStatus(): Promise<WorkerDiagnostics>;
  computeConvolvedImage(input: ConvolvedImageInput): Promise<ConvolvedImageResult>;
}
