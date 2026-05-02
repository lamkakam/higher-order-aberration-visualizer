import type { WorkerClient } from '../workers/client';
import type {
  AberrationInput,
  AberrationResult,
  OpticsWorkerApi,
  WorkerDiagnostics
} from '../workers/types';

export function createMockWorkerClient(
  overrides: Partial<OpticsWorkerApi> = {}
): WorkerClient {
  const diagnostics: WorkerDiagnostics = {
    status: 'ready',
    message: 'Mock worker ready',
    pyodideVersion: '0.29.3'
  };

  const api: OpticsWorkerApi = {
    async initialize() {
      return diagnostics;
    },
    async getStatus() {
      return diagnostics;
    },
    async computeAberration(input: AberrationInput): Promise<AberrationResult> {
      const values = new Float32Array(input.gridSize * input.gridSize);
      values.fill(Math.fround(input.defocus));
      return {
        width: input.gridSize,
        height: input.gridSize,
        values
      };
    },
    ...overrides
  };

  return {
    api,
    dispose() {}
  } as WorkerClient;
}
