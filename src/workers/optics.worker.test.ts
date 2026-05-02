import { describe, expect, it, vi } from 'vitest';

vi.mock('comlink', () => ({
  expose: vi.fn()
}));

vi.mock('pyodide', () => ({
  loadPyodide: vi.fn(async () => ({
    version: '0.29.3',
    loadPackage: vi.fn()
  }))
}));

describe('optics worker', () => {
  it('returns deterministic placeholder Float32Array data', async () => {
    const { expose } = await import('comlink');
    await import('./optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    const result = await api.computeAberration({
      gridSize: 4,
      defocus: 0.5
    });

    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.values).toBeInstanceOf(Float32Array);
    expect(result.values).toHaveLength(16);
    expect(Array.from(result.values)).toEqual([
      1, 0.5555555820465088, 0.5555555820465088, 1,
      0.5555555820465088, 0.1111111119389534, 0.1111111119389534, 0.5555555820465088,
      0.5555555820465088, 0.1111111119389534, 0.1111111119389534, 0.5555555820465088,
      1, 0.5555555820465088, 0.5555555820465088, 1
    ]);
  });
});
