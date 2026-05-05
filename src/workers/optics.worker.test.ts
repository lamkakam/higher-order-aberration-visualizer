import { describe, expect, it, vi } from 'vitest';
import { supportedTargetIds } from './types';

vi.mock('comlink', () => ({
  expose: vi.fn()
}));

const arrayBuffer = vi.fn(async () => new Uint8Array([1, 2, 3]).buffer);
vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({
    arrayBuffer
  }))
);

const loadPackage = vi.fn();
const runPythonAsync = vi.fn(async () => new TextEncoder().encode('pyng-bytes'));
const writeFile = vi.fn();
const mkdirTree = vi.fn();

vi.mock('pyodide', () => ({
  loadPyodide: vi.fn(async () => ({
    version: '0.29.3',
    FS: {
      mkdirTree,
      writeFile
    },
    loadPackage,
    pyimport: vi.fn(() => ({
      install: vi.fn()
    })),
    toPy: vi.fn((value: unknown) => value),
    runPythonAsync
  }))
}));

describe('optics worker', () => {
  it('exposes the Jupiter HST target id', () => {
    expect(supportedTargetIds).toContain('jupiter_502nm');
  });

  it('initializes Pyodide without installing local wheel URLs', async () => {
    const { expose } = await import('comlink');
    await import('./optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    await api.computeConvolvedImage({
      apertureDiameterMm: 3,
      targetId: 'siemensstar',
      zernikeCoefficients: {}
    });

    expect(loadPackage).toHaveBeenCalledWith([
      'micropip',
      'numpy',
      'scipy',
      'matplotlib',
      'setuptools'
    ]);
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('await micropip.install(prysm_wheel_url, deps=False)'),
      expect.objectContaining({
        globals: expect.objectContaining({
          prysm_wheel_url: '/pyodide/prysm-0.21.1-py2.py3-none-any.whl'
        })
      })
    );
    expect(runPythonAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('.whl'),
      expect.any(Object)
    );
  });

  it('loads the internal Python package from source files', async () => {
    const { expose } = await import('comlink');
    await import('./optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    await api.computeConvolvedImage({
      apertureDiameterMm: 3,
      targetId: 'siemensstar',
      zernikeCoefficients: {}
    });

    expect(mkdirTree).toHaveBeenCalledWith('/home/pyodide/hoa_visualizer_utils');
    expect(writeFile).toHaveBeenCalledWith(
      '/home/pyodide/hoa_visualizer_utils/simulation/compute.py',
      expect.stringContaining('def compute_simulation(')
    );
    expect(writeFile).toHaveBeenCalledWith(
      '/home/pyodide/hoa_visualizer_utils/simulation/assets/jupiter_502nm.npz',
      expect.any(Uint8Array)
    );
  });

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
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('simulation = compute_simulation('),
      expect.objectContaining({
        globals: expect.not.objectContaining({
          effective_focal_length_mm: expect.any(Number)
        })
      })
    );
    expect(runPythonAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('effective_focal_length_mm='),
      expect.any(Object)
    );
  });
});
