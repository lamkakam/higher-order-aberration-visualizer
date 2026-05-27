import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerClient } from '../workers/client';
import type { OpticsWorkerApi, WorkerDiagnostics } from '../workers/types';

function createTestWorkerClient(
  initialize = vi.fn(() => new Promise<WorkerDiagnostics>(() => {})),
  getStatus: OpticsWorkerApi['getStatus'] = vi.fn(async (): Promise<WorkerDiagnostics> => ({
    status: 'ready',
    message: 'Mock worker ready'
  }))
): WorkerClient {
  const api: OpticsWorkerApi = {
    initialize,
    getStatus,
    async computeConvolvedImage() {
      return {
        imageUrl: 'data:image/png;base64,c2ltdWxhdGVk',
        psfImageUrl: 'data:image/png;base64,cHNm',
        wavefrontImageUrl: 'data:image/png;base64,d2F2ZWZyb250',
        diagnostics: {
          status: 'ready',
          message: 'Mock worker ready'
        }
      };
    },
    async renderApertureMask() {
      return {
        imageUrl: 'data:image/png;base64,YXBlcnR1cmU=',
        diagnostics: {
          status: 'ready',
          message: 'Mock worker ready'
        }
      };
    }
  };

  return {
    api,
    dispose: vi.fn()
  } as unknown as WorkerClient;
}

async function loadHook(createWorkerClient = vi.fn(createTestWorkerClient)) {
  vi.resetModules();
  vi.doMock('../workers/client', async (importOriginal) => {
    const original = await importOriginal<typeof import('../workers/client')>();

    return {
      ...original,
      createWorkerClient
    };
  });

  const hookModule = await import('./useWorkerClient');

  return {
    createWorkerClient,
    useWorkerClient: hookModule.useWorkerClient
  };
}

describe('useWorkerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the owned worker client lazily when no injected client exists', async () => {
    const { createWorkerClient, useWorkerClient } = await loadHook();

    expect(createWorkerClient).not.toHaveBeenCalled();

    renderHook(() => useWorkerClient());

    expect(createWorkerClient).toHaveBeenCalledTimes(1);
  });

  it('reuses the same owned client across remounts without disposing it', async () => {
    const ownedClient = createTestWorkerClient();
    const { useWorkerClient } = await loadHook(vi.fn(() => ownedClient));

    const firstRender = renderHook(() => useWorkerClient());
    const firstClient = firstRender.result.current.client;

    firstRender.unmount();

    const secondRender = renderHook(() => useWorkerClient());

    expect(secondRender.result.current.client).toBe(firstClient);
    expect(ownedClient.dispose).not.toHaveBeenCalled();
  });

  it('uses injected clients without creating or disposing the singleton', async () => {
    const injectedClient = createTestWorkerClient();
    const { createWorkerClient, useWorkerClient } = await loadHook();

    const { result, unmount } = renderHook(() => useWorkerClient(injectedClient));

    expect(result.current.client).toBe(injectedClient);
    expect(createWorkerClient).not.toHaveBeenCalled();

    unmount();

    expect(injectedClient.dispose).not.toHaveBeenCalled();
  });

  it('reports successful initialization diagnostics', async () => {
    const diagnostics: WorkerDiagnostics = {
      status: 'ready',
      message: 'Worker ready',
      pyodideVersion: '0.29.3'
    };
    const initialize = vi.fn(async () => diagnostics);
    const { useWorkerClient } = await loadHook(vi.fn(() => createTestWorkerClient(initialize)));

    const { result } = renderHook(() => useWorkerClient());

    expect(result.current.diagnostics).toEqual({
      status: 'initializing',
      message: 'Starting worker',
      progressPercent: 0
    });

    await waitFor(() => {
      expect(result.current.diagnostics).toEqual(diagnostics);
    });
  });

  it('polls initialization diagnostics until the worker is ready', async () => {
    vi.useFakeTimers();
    let resolveInitialize: (diagnostics: WorkerDiagnostics) => void = () => {};
    const readyDiagnostics: WorkerDiagnostics = {
      status: 'ready',
      message: 'Worker ready',
      progressPercent: 100
    };
    const initialize = vi.fn(
      () =>
        new Promise<WorkerDiagnostics>((resolve) => {
          resolveInitialize = resolve;
        })
    );
    const getStatus = vi
      .fn<OpticsWorkerApi['getStatus']>()
      .mockResolvedValueOnce({
        status: 'initializing',
        message: 'Loading Pyodide',
        progressPercent: 20
      })
      .mockResolvedValueOnce({
        status: 'initializing',
        message: 'Loading Python packages',
        progressPercent: 45
      })
      .mockResolvedValue(readyDiagnostics);
    const { useWorkerClient } = await loadHook(
      vi.fn(() => createTestWorkerClient(initialize, getStatus))
    );

    const { result } = renderHook(() => useWorkerClient());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(result.current.diagnostics).toEqual({
      status: 'initializing',
      message: 'Loading Pyodide',
      progressPercent: 20
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(result.current.diagnostics).toEqual({
      status: 'initializing',
      message: 'Loading Python packages',
      progressPercent: 45
    });

    await act(async () => {
      resolveInitialize(readyDiagnostics);
    });

    expect(result.current.diagnostics).toEqual(readyDiagnostics);
    const statusCallsAfterReady = getStatus.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(getStatus).toHaveBeenCalledTimes(statusCallsAfterReady);
    vi.useRealTimers();
  });

  it('keeps polling when initialize resolves with an initializing status', async () => {
    vi.useFakeTimers();
    const initialize = vi.fn(async (): Promise<WorkerDiagnostics> => ({
      status: 'initializing',
      message: 'Starting worker',
      progressPercent: 0
    }));
    const getStatus = vi
      .fn<OpticsWorkerApi['getStatus']>()
      .mockResolvedValueOnce({
        status: 'initializing',
        message: 'Loading Pyodide',
        progressPercent: 20
      })
      .mockResolvedValue({
        status: 'ready',
        message: 'Worker ready',
        progressPercent: 100
      });
    const { useWorkerClient } = await loadHook(
      vi.fn(() => createTestWorkerClient(initialize, getStatus))
    );

    const { result } = renderHook(() => useWorkerClient());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(result.current.diagnostics).toEqual({
      status: 'initializing',
      message: 'Loading Pyodide',
      progressPercent: 20
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(result.current.diagnostics).toEqual({
      status: 'ready',
      message: 'Worker ready',
      progressPercent: 100
    });
    vi.useRealTimers();
  });

  it('stops polling initialization diagnostics after an error status', async () => {
    vi.useFakeTimers();
    const initialize = vi.fn(() => new Promise<WorkerDiagnostics>(() => {}));
    const getStatus = vi.fn<OpticsWorkerApi['getStatus']>().mockResolvedValue({
      status: 'error',
      message: 'Pyodide failed',
      progressPercent: 20
    });
    const { useWorkerClient } = await loadHook(
      vi.fn(() => createTestWorkerClient(initialize, getStatus))
    );

    const { result } = renderHook(() => useWorkerClient());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(result.current.diagnostics).toEqual({
      status: 'error',
      message: 'Pyodide failed',
      progressPercent: 20
    });
    const statusCallsAfterError = getStatus.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(getStatus).toHaveBeenCalledTimes(statusCallsAfterError);
    vi.useRealTimers();
  });

  it('reports initialization failure diagnostics', async () => {
    const initialize = vi.fn(async () => {
      throw new Error('Initialization exploded');
    });
    const { useWorkerClient } = await loadHook(vi.fn(() => createTestWorkerClient(initialize)));

    const { result } = renderHook(() => useWorkerClient());

    await waitFor(() => {
      expect(result.current.diagnostics).toEqual({
        status: 'error',
        message: 'Initialization exploded',
        progressPercent: 0
      });
    });
  });

  it('ignores stale initialization diagnostics after the active client changes', async () => {
    let resolveFirstInitialize: (diagnostics: WorkerDiagnostics) => void = () => {};
    const firstInitialize = vi.fn(
      () =>
        new Promise<WorkerDiagnostics>((resolve) => {
          resolveFirstInitialize = resolve;
        })
    );
    const secondDiagnostics: WorkerDiagnostics = {
      status: 'ready',
      message: 'Second worker ready'
    };
    const firstClient = createTestWorkerClient(firstInitialize);
    const secondClient = createTestWorkerClient(vi.fn(async () => secondDiagnostics));
    const { useWorkerClient } = await loadHook();

    const { result, rerender } = renderHook(
      ({ client }) => useWorkerClient(client),
      {
        initialProps: {
          client: firstClient
        }
      }
    );

    rerender({
      client: secondClient
    });

    await waitFor(() => {
      expect(result.current.diagnostics).toEqual(secondDiagnostics);
    });

    await act(async () => {
      resolveFirstInitialize({
        status: 'ready',
        message: 'First worker ready'
      });
    });

    expect(result.current.diagnostics).toEqual(secondDiagnostics);
  });
});
