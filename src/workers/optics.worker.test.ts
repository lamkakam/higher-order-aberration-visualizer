import { describe, expect, it, vi } from 'vitest';

vi.mock('comlink', () => ({
  expose: vi.fn()
}));

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
  });
});
