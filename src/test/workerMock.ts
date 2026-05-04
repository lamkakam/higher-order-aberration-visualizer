import type { WorkerClient } from '../workers/client';
import type {
  ConvolvedImageInput,
  ConvolvedImageResult,
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
    async computeConvolvedImage(
      input: ConvolvedImageInput
    ): Promise<ConvolvedImageResult> {
      return {
        imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
        diagnostics
      };
    },
    ...overrides
  };

  return {
    api,
    dispose() {}
  } as WorkerClient;
}
