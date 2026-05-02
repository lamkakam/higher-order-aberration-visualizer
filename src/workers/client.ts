import { wrap, type Remote } from 'comlink';
import type { OpticsWorkerApi } from './types';

export interface WorkerClient {
  api: Remote<OpticsWorkerApi>;
  dispose(): void;
}

export function createWorkerClient(): WorkerClient {
  const worker = new Worker(new URL('./optics.worker.ts', import.meta.url), {
    type: 'module'
  });

  return {
    api: wrap<OpticsWorkerApi>(worker),
    dispose() {
      worker.terminate();
    }
  };
}
