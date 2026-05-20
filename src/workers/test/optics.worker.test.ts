import { describe, expect, it, vi } from 'vitest';
import { supportedTargetIds } from '../types';

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
    rotationDegrees: 0,
    centralObstructionShape: 'circle',
    centralObstructionRotationDegrees: 0,
    centralObstructionRatio: 0,
    spiderVaneCount: 0,
    spiderVaneWidthRatio: 0,
    spiderVaneRotationDegrees: 0,
    gaussianApodizationEnabled: false,
    gaussianApodizationSigmaRatio: 0.5
  } as const;
  const defaultMonochromaticChannels = {
    diagnosticWavelengthNm: 550,
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, {}]]
  } as const;

  it('exposes the Jupiter target id without the asset wavelength suffix', () => {
    expect(supportedTargetIds).toContain('jupiter');
    expect(supportedTargetIds).not.toContain('jupiter_502nm');
  });

  it('exposes the point source target id', () => {
    expect(supportedTargetIds).toContain('point_source');
  });

  it('exposes inverted eye-chart target ids', () => {
    expect(supportedTargetIds).toContain('logmar_chart_inverted');
    expect(supportedTargetIds).toContain('snellen_e_20_20_inverted');
  });

  it('initializes Pyodide without installing local wheel URLs', async () => {
    const { expose } = await import('comlink');
    await import('../optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    await api.computeConvolvedImage({
      apertureSettings: defaultApertureSettings,
      apertureDiameterMm: 3,
      showScaleBar: true,
      spectralMode: 'monochromatic',
      targetId: 'siemensstar',
      wavefrontLegendUnit: 'wave',
      ...defaultMonochromaticChannels
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
    await import('../optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    await api.computeConvolvedImage({
      apertureSettings: defaultApertureSettings,
      apertureDiameterMm: 3,
      showScaleBar: true,
      spectralMode: 'monochromatic',
      targetId: 'siemensstar',
      wavefrontLegendUnit: 'wave',
      ...defaultMonochromaticChannels
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
    expect(writeFile).toHaveBeenCalledWith(
      '/home/pyodide/hoa_visualizer_utils/simulation/assets/jupiter_658nm.npz',
      expect.any(Uint8Array)
    );
    expect(writeFile).toHaveBeenCalledWith(
      '/home/pyodide/hoa_visualizer_utils/simulation/assets/jupiter_395nm.npz',
      expect.any(Uint8Array)
    );
  });

  it('computes a convolved image through Pyodide using serializable inputs', async () => {
    const { expose } = await import('comlink');
    await import('../optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    const result = await api.computeConvolvedImage({
      apertureSettings: {
        shape: 'circle',
        rotationDegrees: 0,
        centralObstructionShape: 'circle',
        centralObstructionRotationDegrees: 0,
        centralObstructionRatio: 0.25,
        spiderVaneCount: 4,
        spiderVaneWidthRatio: 0.02,
        spiderVaneRotationDegrees: 15,
        gaussianApodizationEnabled: true,
        gaussianApodizationSigmaRatio: 0.5
      },
      apertureDiameterMm: 3,
      diagnosticWavelengthNm: 550,
      showScaleBar: true,
      spectralMode: 'monochromatic',
      targetId: 'siemensstar',
      wavefrontLegendUnit: 'micron',
      wavelengthWeights: [[550, 1]],
      zernikeCoefficientsByWavelength: [[550, {
        '2,0': 0.25,
        '4,0': 0
      }]]
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
            rotationDegrees: 0,
            centralObstructionShape: 'circle',
            centralObstructionRotationDegrees: 0,
            centralObstructionRatio: 0.25,
            spiderVaneCount: 4,
            spiderVaneWidthRatio: 0.02,
            spiderVaneRotationDegrees: 15,
            gaussianApodizationEnabled: true,
            gaussianApodizationSigmaRatio: 0.5
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
      expect.stringContaining(
        'render_convolved_image(simulation, show_scale_bar=bool(show_scale_bar), display_scale="perceptual")'
      ),
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

  it('passes single-channel wavelength weights and scoped coefficients for monochromatic payloads', async () => {
    const { expose } = await import('comlink');
    await import('../optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    await api.computeConvolvedImage({
      apertureSettings: defaultApertureSettings,
      apertureDiameterMm: 3,
      showScaleBar: true,
      spectralMode: 'monochromatic',
      targetId: 'siemensstar',
      wavefrontLegendUnit: 'wave',
      ...defaultMonochromaticChannels
    });

    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('simulation = compute_simulation('),
      expect.objectContaining({
        globals: expect.objectContaining({
          wavelength_weights: [[550, 1]],
          zernike_coefficients_by_wavelength_input: [[550, {}]]
        })
      })
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('wavelength_weights=wavelength_weights'),
      expect.any(Object)
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'zernike_coefficients_by_wavelength=zernike_coefficients_by_wavelength'
      ),
      expect.any(Object)
    );
  });

  it('passes polychromatic wavelength weights and scoped coefficients into simulation', async () => {
    const { expose } = await import('comlink');
    await import('../optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    await api.computeConvolvedImage({
      apertureSettings: defaultApertureSettings,
      apertureDiameterMm: 3,
      diagnosticWavelengthNm: 656,
      showScaleBar: true,
      spectralMode: 'polychromatic',
      targetId: 'siemensstar',
      wavelengthWeights: [
        [550, 1],
        [656, 1],
        [486, 1]
      ],
      wavefrontLegendUnit: 'wave',
      zernikeCoefficientsByWavelength: [
        [550, { '4,0': 0.25 }],
        [656, { '4,0': 0.5 }],
        [486, { '4,0': 0.75 }]
      ]
    });

    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('wavelength_weights=wavelength_weights'),
      expect.objectContaining({
        globals: expect.objectContaining({
          spectral_mode: 'polychromatic',
          diagnostic_wavelength_nm: 656,
          wavelength_weights: [
            [550, 1],
            [656, 1],
            [486, 1]
          ],
          zernike_coefficients_by_wavelength_input: [
            [550, { '4,0': 0.25 }],
            [656, { '4,0': 0.5 }],
            [486, { '4,0': 0.75 }]
          ]
        })
      })
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'zernike_coefficients_by_wavelength=zernike_coefficients_by_wavelength'
      ),
      expect.any(Object)
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'for _wavelength, scoped_coefficients in zernike_coefficients_by_wavelength_input'
      ),
      expect.any(Object)
    );
    expect(runPythonAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('float(wavelength)'),
      expect.any(Object)
    );
  });

  it('renders an aperture mask preview through Pyodide using serializable inputs', async () => {
    const { expose } = await import('comlink');
    await import('../optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    const result = await api.renderApertureMask({
      shape: 'circle',
      rotationDegrees: 0,
      centralObstructionShape: 'circle',
      centralObstructionRotationDegrees: 0,
      centralObstructionRatio: 0.35,
      spiderVaneCount: 4,
      spiderVaneWidthRatio: 0.03,
      spiderVaneRotationDegrees: 30,
      gaussianApodizationEnabled: true,
      gaussianApodizationSigmaRatio: 0.75
    });

    expect(result.imageUrl).toBe('data:image/png;base64,cHluZy1ieXRlcw==');
    expect(result.diagnostics.status).toBe('ready');
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('render_aperture_mask(aperture)'),
      expect.objectContaining({
        globals: expect.objectContaining({
          aperture_settings: {
            shape: 'circle',
            rotationDegrees: 0,
            centralObstructionShape: 'circle',
            centralObstructionRotationDegrees: 0,
            centralObstructionRatio: 0.35,
            spiderVaneCount: 4,
            spiderVaneWidthRatio: 0.03,
            spiderVaneRotationDegrees: 30,
            gaussianApodizationEnabled: true,
            gaussianApodizationSigmaRatio: 0.75
          }
        })
      })
    );
  });

  it('passes expanded aperture settings into simulation ApertureSpec', async () => {
    const { expose } = await import('comlink');
    await import('../optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    await api.computeConvolvedImage({
      apertureSettings: {
        shape: 'square',
        rotationDegrees: 25,
        centralObstructionShape: 'regular_hexagon',
        centralObstructionRotationDegrees: 30,
        centralObstructionRatio: 0.2,
        spiderVaneCount: 6,
        spiderVaneWidthRatio: 0.04,
        spiderVaneRotationDegrees: 45,
        gaussianApodizationEnabled: true,
        gaussianApodizationSigmaRatio: 0.6
      },
      apertureDiameterMm: 3,
      showScaleBar: true,
      spectralMode: 'monochromatic',
      targetId: 'siemensstar',
      wavefrontLegendUnit: 'wave',
      ...defaultMonochromaticChannels
    });

    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('central_obstruction_shape=str(aperture_settings["centralObstructionShape"])'),
      expect.objectContaining({
        globals: expect.objectContaining({
          aperture_settings: {
            shape: 'square',
            rotationDegrees: 25,
            centralObstructionShape: 'regular_hexagon',
            centralObstructionRotationDegrees: 30,
            centralObstructionRatio: 0.2,
            spiderVaneCount: 6,
            spiderVaneWidthRatio: 0.04,
            spiderVaneRotationDegrees: 45,
            gaussianApodizationEnabled: true,
            gaussianApodizationSigmaRatio: 0.6
          }
        })
      })
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('gaussian_apodization_enabled=bool(aperture_settings["gaussianApodizationEnabled"])'),
      expect.any(Object)
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('gaussian_apodization_sigma_ratio=float(aperture_settings["gaussianApodizationSigmaRatio"])'),
      expect.any(Object)
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('spider_vane_count=float(aperture_settings["spiderVaneCount"])'),
      expect.any(Object)
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('spider_vane_width_ratio=float(aperture_settings["spiderVaneWidthRatio"])'),
      expect.any(Object)
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('spider_vane_rotation_degrees=float(aperture_settings["spiderVaneRotationDegrees"])'),
      expect.any(Object)
    );
  });

  it('passes expanded aperture settings into preview ApertureSpec', async () => {
    const { expose } = await import('comlink');
    await import('../optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    await api.renderApertureMask({
      shape: 'square',
      rotationDegrees: 45,
      centralObstructionShape: 'regular_hexagon',
      centralObstructionRotationDegrees: 20,
      centralObstructionRatio: 0.25,
      spiderVaneCount: 3,
      spiderVaneWidthRatio: 0.05,
      spiderVaneRotationDegrees: 60,
      gaussianApodizationEnabled: true,
      gaussianApodizationSigmaRatio: 0.4
    });

    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('central_obstruction_rotation_degrees=float(aperture_settings["centralObstructionRotationDegrees"])'),
      expect.objectContaining({
        globals: expect.objectContaining({
          aperture_settings: {
            shape: 'square',
            rotationDegrees: 45,
            centralObstructionShape: 'regular_hexagon',
            centralObstructionRotationDegrees: 20,
            centralObstructionRatio: 0.25,
            spiderVaneCount: 3,
            spiderVaneWidthRatio: 0.05,
            spiderVaneRotationDegrees: 60,
            gaussianApodizationEnabled: true,
            gaussianApodizationSigmaRatio: 0.4
          }
        })
      })
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('gaussian_apodization_enabled=bool(aperture_settings["gaussianApodizationEnabled"])'),
      expect.any(Object)
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('gaussian_apodization_sigma_ratio=float(aperture_settings["gaussianApodizationSigmaRatio"])'),
      expect.any(Object)
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('spider_vane_count=float(aperture_settings["spiderVaneCount"])'),
      expect.any(Object)
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('spider_vane_width_ratio=float(aperture_settings["spiderVaneWidthRatio"])'),
      expect.any(Object)
    );
    expect(runPythonAsync).toHaveBeenCalledWith(
      expect.stringContaining('spider_vane_rotation_degrees=float(aperture_settings["spiderVaneRotationDegrees"])'),
      expect.any(Object)
    );
  });

  it('passes disabled scale bar preference to image and PSF renderers only', async () => {
    const { expose } = await import('comlink');
    await import('../optics.worker');

    const api = vi.mocked(expose).mock.calls[0][0];
    await api.computeConvolvedImage({
      apertureSettings: defaultApertureSettings,
      apertureDiameterMm: 3,
      showScaleBar: false,
      spectralMode: 'monochromatic',
      targetId: 'siemensstar',
      wavefrontLegendUnit: 'wave',
      ...defaultMonochromaticChannels
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
