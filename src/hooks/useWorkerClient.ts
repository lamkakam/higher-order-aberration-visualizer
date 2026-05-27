import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { createWorkerClient, type WorkerClient } from '../workers/client';
import type { WorkerDiagnostics } from '../workers/types';

const initialDiagnostics: WorkerDiagnostics = {
  status: 'idle',
  message: 'Worker not initialized',
  progressPercent: 0
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
      message: 'Starting worker',
      progressPercent: 0
    });
    let shouldPoll = true;

    const pollInitializationStatus = async () => {
      while (!cancelled && shouldPoll) {
        await waitForStatusPoll();
        if (cancelled || !shouldPoll) {
          return;
        }

        try {
          const nextDiagnostics = await client.api.getStatus();
          if (cancelled) {
            return;
          }

          setDiagnostics(nextDiagnostics);
          if (nextDiagnostics.status !== 'initializing') {
            shouldPoll = false;
          }
        } catch {
          shouldPoll = false;
        }
      }
    };

    void pollInitializationStatus();

    client.api
      .initialize()
      .then((nextDiagnostics) => {
        if (!cancelled) {
          if (nextDiagnostics.status === 'initializing' && !shouldPoll) {
            return;
          }
          setDiagnostics(nextDiagnostics);
          if (nextDiagnostics.status !== 'initializing') {
            shouldPoll = false;
          }
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          shouldPoll = false;
          setDiagnostics({
            status: 'error',
            message:
              caughtError instanceof Error ? caughtError.message : 'Worker failed to initialize',
            progressPercent: 0
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

function waitForStatusPoll(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 250);
  });
}
