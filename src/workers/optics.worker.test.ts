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
  const defaultApertureSettings = {
    shape: 'circle',
    centralObstructionRatio: 0
  } as const;

  it('exposes the Jupiter HST target id', () => {
    expect(supportedTargetIds).toContain('jupiter_502nm');
  });

  it('exposes the point source target id', () => {
    expect(supportedTargetIds).toContain('point_source');
  });

  it('initializes Pyodide without installing local wheel URLs', async () => {
    const { expose } = await import('comlink');
    await import('./optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    await api.computeConvolvedImage({
      apertureSettings: defaultApertureSettings,
      apertureDiameterMm: 3,
      showScaleBar: true,
      targetId: 'siemensstar',
      wavefrontLegendUnit: 'wave',
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
      apertureSettings: defaultApertureSettings,
      apertureDiameterMm: 3,
      showScaleBar: true,
      targetId: 'siemensstar',
      wavefrontLegendUnit: 'wave',
      zernikeCoefficients: {}
    });

    expect(mkdirTree).toHaveBeenCalledWith('/home/pyodide/hoa_visualizer_utils');
    expect(writeFile).toHaveBeenCalledWith(
      '/home/pyodide/hoa_visualizer_utils/simulation/compute.py',
      expect.stringContaining('def compute_simulation(')
    );
    expect(writeFile).toHaveBeenCalledWith(
      '/home/pyodide/hoa_visualizer_utils/simulation/aperture.py',
      expect.stringContaining('class ApertureSpec')
    );
    expect(writeFile).toHaveBeenCalledWith(
      '/home/pyodide/hoa_visualizer_utils/rendering/scale_bar.py',
      expect.stringContaining('def add_scale_bar(')
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
      apertureSettings: {
        shape: 'circle',
        centralObstructionRatio: 0.25
      },
      apertureDiameterMm: 3,
      showScaleBar: true,
      targetId: 'siemensstar',
      wavefrontLegendUnit: 'micron',
      zernikeCoefficients: {
        '2,0': 0.25,
        '4,0': 0
      }
    });

    expect(result.imageUrl).toBe('data:image/png;base64,cHluZy1ieXRlcw==');
    expect(result.psfImageUrl).toBe('data:image/png;base64,cHluZy1ieXRlcw==');
    expect(result.wavefrontImageUrl).toBe('data:image/png;base64,cHluZy1ieXRlcw==');
    expect(result.diagnostics.status).toBe('ready');
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('simulation = compute_simulation('),
      expect.objectContaining({
        globals: expect.objectContaining({
          aperture_settings: {
            shape: 'circle',
            centralObstructionRatio: 0.25
          }
        })
      })
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('ApertureSpec('),
      expect.any(Object)
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('aperture=aperture'),
      expect.any(Object)
    );
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
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('render_convolved_image(simulation, show_scale_bar=bool(show_scale_bar))'),
      expect.any(Object)
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('render_psf(simulation, show_scale_bar=bool(show_scale_bar))'),
      expect.any(Object)
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('render_wavefront(simulation, unit=str(wavefront_legend_unit))'),
      expect.objectContaining({
        globals: expect.objectContaining({
          wavefront_legend_unit: 'micron'
        })
      })
    );
    expect(runPythonAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('render_wavefront(simulation, show_scale_bar='),
      expect.any(Object)
    );
  });

  it('passes disabled scale bar preference to image and PSF renderers only', async () => {
    const { expose } = await import('comlink');
    await import('./optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    await api.computeConvolvedImage({
      apertureSettings: defaultApertureSettings,
      apertureDiameterMm: 3,
      showScaleBar: false,
      targetId: 'siemensstar',
      wavefrontLegendUnit: 'wave',
      zernikeCoefficients: {}
    });

    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('show_scale_bar=bool(show_scale_bar)'),
      expect.objectContaining({
        globals: expect.objectContaining({
          show_scale_bar: false
        })
      })
    );
    expect(runPythonAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('render_wavefront(simulation, show_scale_bar='),
      expect.any(Object)
    );
  });
});
