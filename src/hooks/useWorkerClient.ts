import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { createWorkerClient, type WorkerClient } from '../workers/client';
import type { WorkerDiagnostics } from '../workers/types';

const initialDiagnostics: WorkerDiagnostics = {
  status: 'idle',
  message: 'Worker not initialized'
};

let ownedWorkerClient: WorkerClient | undefined;

interface UseWorkerClientResult {
  readonly client: WorkerClient;
  readonly diagnostics: WorkerDiagnostics;
  readonly setDiagnostics: Dispatch<SetStateAction<WorkerDiagnostics>>;
}

export function useWorkerClient(workerClient?: WorkerClient): UseWorkerClientResult {
  const client = workerClient ?? getOwnedWorkerClient();
  const [diagnostics, setDiagnostics] = useState<WorkerDiagnostics>(initialDiagnostics);

  useEffect(() => {
    let cancelled = false;

    setDiagnostics({
      status: 'initializing',
      message: 'Starting worker'
    });

    client.api
      .initialize()
      .then((nextDiagnostics) => {
        if (!cancelled) {
          setDiagnostics(nextDiagnostics);
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setDiagnostics({
            status: 'error',
            message:
              caughtError instanceof Error ? caughtError.message : 'Worker failed to initialize'
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  return {
    client,
    diagnostics,
    setDiagnostics
  };
}

function getOwnedWorkerClient(): WorkerClient {
  ownedWorkerClient ??= createWorkerClient();

  return ownedWorkerClient;
}
