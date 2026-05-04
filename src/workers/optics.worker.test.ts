import { describe, expect, it, vi } from 'vitest';

vi.mock('comlink', () => ({
  expose: vi.fn()
}));

vi.mock('pyodide', () => ({
  loadPyodide: vi.fn(async () => ({
    version: '0.29.3',
    loadPackage: vi.fn(),
    pyimport: vi.fn(() => ({
      install: vi.fn()
    })),
    toPy: vi.fn((value: unknown) => value),
    runPythonAsync: vi.fn(async () => new TextEncoder().encode('pyng-bytes'))
  }))
}));

describe('optics worker', () => {
  it('computes a convolved image through Pyodide using serializable inputs', async () => {
    const { expose } = await import('comlink');
    await import('./optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    const result = await api.computeConvolvedImage({
      apertureDiameterMm: 3,
      targetId: 'siemensstar',
      zernikeCoefficients: {
        '2,0': 0.25,
        '4,0': 0
      }
    });

    expect(result.imageUrl).toBe('data:image/png;base64,cHluZy1ieXRlcw==');
    expect(result.diagnostics.status).toBe('ready');
  });
});
