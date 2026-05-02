export type WorkerStatus = 'idle' | 'initializing' | 'ready' | 'error';

export interface WorkerDiagnostics {
  status: WorkerStatus;
  message: string;
  pyodideVersion?: string;
}

export interface AberrationInput {
  gridSize: number;
  defocus: number;
}

export interface AberrationResult {
  width: number;
  height: number;
  values: Float32Array;
}

export interface OpticsWorkerApi {
  initialize(): Promise<WorkerDiagnostics>;
  getStatus(): Promise<WorkerDiagnostics>;
  computeAberration(input: AberrationInput): Promise<AberrationResult>;
}
