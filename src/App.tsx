import { useEffect, useMemo, useState } from 'react';
import { createWorkerClient, type WorkerClient } from './workers/client';
import type { AberrationResult, WorkerDiagnostics } from './workers/types';

interface AppProps {
  workerClient?: WorkerClient;
}

const initialDiagnostics: WorkerDiagnostics = {
  status: 'idle',
  message: 'Worker not initialized'
};

const computeTimeoutMs = 2000;

export function App({ workerClient }: AppProps) {
  const client = useMemo(() => workerClient ?? createWorkerClient(), [workerClient]);
  const [diagnostics, setDiagnostics] = useState<WorkerDiagnostics>(initialDiagnostics);
  const [result, setResult] = useState<AberrationResult | null>(null);
  const [computeStatus, setComputeStatus] = useState('No compute run yet');

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
      .catch((error) => {
        if (!cancelled) {
          setDiagnostics({
            status: 'error',
            message: error instanceof Error ? error.message : 'Worker failed to initialize'
          });
        }
      });

    return () => {
      cancelled = true;
      if (!workerClient) {
        client.dispose();
      }
    };
  }, [client, workerClient]);

  async function handleCompute() {
    setComputeStatus('Computing placeholder aberration');

    try {
      const nextResult = await withTimeout(
        client.api.computeAberration({
          gridSize: 16,
          defocus: 0.25
        }),
        computeTimeoutMs
      );
      setResult(nextResult);
      setComputeStatus(`Computed ${nextResult.width} by ${nextResult.height} placeholder grid`);
    } catch (error) {
      setComputeStatus(error instanceof Error ? error.message : 'Compute failed');
    }
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-800">
            HOA Visualizer
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            Client-only optics scaffold
          </h1>
        </div>

        <div className="rounded border border-slate-300 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Worker status</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="font-medium text-slate-600">State</dt>
              <dd data-testid="worker-status" className="mt-1 text-slate-950">
                {diagnostics.status}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600">Message</dt>
              <dd className="mt-1 text-slate-950">{diagnostics.message}</dd>
            </div>
            {diagnostics.pyodideVersion ? (
              <div>
                <dt className="font-medium text-slate-600">Pyodide</dt>
                <dd className="mt-1 text-slate-950">{diagnostics.pyodideVersion}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="rounded border border-slate-300 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Placeholder compute</h2>
          <button
            type="button"
            onClick={handleCompute}
            className="mt-4 rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700"
          >
            Compute
          </button>
          <p data-testid="compute-status" className="mt-3 text-sm text-slate-700">
            {computeStatus}
          </p>
          {result ? (
            <p data-testid="compute-shape" className="mt-2 text-sm text-slate-700">
              {result.values.length} Float32 samples
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error('Compute failed: worker is still initializing'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
