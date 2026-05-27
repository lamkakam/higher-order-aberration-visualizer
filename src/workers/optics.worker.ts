/// <reference lib="webworker" />

import { expose } from 'comlink';
import type { PyodideInterface } from 'pyodide';
import type { PyProxy } from 'pyodide/ffi';
import packageInitSource from '../hoa_visualizer_utils/__init__.py?raw';
import renderingInitSource from '../hoa_visualizer_utils/rendering/__init__.py?raw';
import apertureMaskSource from '../hoa_visualizer_utils/rendering/aperture_mask.py?raw';
import convolvedImageSource from '../hoa_visualizer_utils/rendering/convolved_image.py?raw';
import psfSource from '../hoa_visualizer_utils/rendering/psf.py?raw';
import scaleBarSource from '../hoa_visualizer_utils/rendering/scale_bar.py?raw';
import wavefrontSource from '../hoa_visualizer_utils/rendering/wavefront.py?raw';
import jupiter502nmAssetUrl from '../hoa_visualizer_utils/simulation/assets/jupiter_502nm.npz?url';
import jupiter658nmAssetUrl from '../hoa_visualizer_utils/simulation/assets/jupiter_658nm.npz?url';
import jupiter395nmAssetUrl from '../hoa_visualizer_utils/simulation/assets/jupiter_395nm.npz?url';
import simulationAssetsInitSource from '../hoa_visualizer_utils/simulation/assets/__init__.py?raw';
import simulationInitSource from '../hoa_visualizer_utils/simulation/__init__.py?raw';
import apertureSource from '../hoa_visualizer_utils/simulation/aperture.py?raw';
import computeSource from '../hoa_visualizer_utils/simulation/compute.py?raw';
import modelsSource from '../hoa_visualizer_utils/simulation/models.py?raw';
import targetsSource from '../hoa_visualizer_utils/simulation/targets.py?raw';
import utilsInitSource from '../hoa_visualizer_utils/utils/__init__.py?raw';
import figuresSource from '../hoa_visualizer_utils/utils/figures.py?raw';
import type { ApertureSettings } from '../types/domain';
import { resolvePublicAssetPath } from '../publicAssetUrls';
import type {
  ApertureMaskResult,
  ConvolvedImageInput,
  ConvolvedImageResult,
  OpticsWorkerApi,
  WorkerDiagnostics
} from './types';

const pyodidePackageBaseUrl = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';
const pyodideIndexUrl = import.meta.env.DEV
  ? resolvePublicAssetPath('/node_modules/pyodide/')
  : pyodidePackageBaseUrl;
const prysmWheelUrl = resolvePublicAssetPath('/pyodide/prysm-0.21.1-py2.py3-none-any.whl');
const pythonPackageRoot = '/home/pyodide';
const pythonSources = [
  ['hoa_visualizer_utils/__init__.py', packageInitSource],
  ['hoa_visualizer_utils/rendering/__init__.py', renderingInitSource],
  ['hoa_visualizer_utils/rendering/aperture_mask.py', apertureMaskSource],
  ['hoa_visualizer_utils/rendering/convolved_image.py', convolvedImageSource],
  ['hoa_visualizer_utils/rendering/psf.py', psfSource],
  ['hoa_visualizer_utils/rendering/scale_bar.py', scaleBarSource],
  ['hoa_visualizer_utils/rendering/wavefront.py', wavefrontSource],
  ['hoa_visualizer_utils/simulation/__init__.py', simulationInitSource],
  ['hoa_visualizer_utils/simulation/assets/__init__.py', simulationAssetsInitSource],
  ['hoa_visualizer_utils/simulation/aperture.py', apertureSource],
  ['hoa_visualizer_utils/simulation/compute.py', computeSource],
  ['hoa_visualizer_utils/simulation/models.py', modelsSource],
  ['hoa_visualizer_utils/simulation/targets.py', targetsSource],
  ['hoa_visualizer_utils/utils/__init__.py', utilsInitSource],
  ['hoa_visualizer_utils/utils/figures.py', figuresSource]
] as const;
const pythonAssets = [
  [
    'hoa_visualizer_utils/simulation/assets/jupiter_658nm.npz',
    jupiter658nmAssetUrl
  ],
  [
    'hoa_visualizer_utils/simulation/assets/jupiter_502nm.npz',
    jupiter502nmAssetUrl
  ],
  [
    'hoa_visualizer_utils/simulation/assets/jupiter_395nm.npz',
    jupiter395nmAssetUrl
  ]
] as const;

let pyodide: PyodideInterface | undefined;
let diagnostics: WorkerDiagnostics = {
  status: 'idle',
  message: 'Worker idle'
};
let initializationPromise: Promise<void> | undefined;

function initialize(): Promise<WorkerDiagnostics> {
  if (diagnostics.status === 'ready' || diagnostics.status === 'initializing') {
    return Promise.resolve(diagnostics);
  }

  diagnostics = {
    status: 'initializing',
    message: 'Starting worker',
    progressPercent: 0
  };

  initializationPromise ??= Promise.resolve().then(initializePyodide);

  return Promise.resolve(diagnostics);
}

async function initializePyodide(): Promise<void> {
  try {
    setDiagnostics('initializing', 'Loading Pyodide', 20);
    const { loadPyodide } = await import('pyodide');
    const nextPyodide = await loadPyodide({
      indexURL: pyodideIndexUrl,
      packageBaseUrl: pyodidePackageBaseUrl
    });
    pyodide = nextPyodide;
    setDiagnostics('initializing', 'Loading Python packages', 45);
    await nextPyodide.loadPackage([
      'micropip',
      'numpy',
      'scipy',
      'matplotlib',
      'setuptools'
    ]);
    setDiagnostics('initializing', 'Loading bundled Python sources and assets', 65);
    await loadPythonSources(nextPyodide);
    setDiagnostics('initializing', 'Installing prysm', 85);
    const installGlobals = nextPyodide.toPy({
      prysm_wheel_url: prysmWheelUrl,
      python_package_root: pythonPackageRoot
    });
    await nextPyodide.runPythonAsync(
      `
import sys
import micropip

if python_package_root not in sys.path:
    sys.path.insert(0, python_package_root)

await micropip.install(prysm_wheel_url, deps=False)
`,
      { globals: installGlobals }
    );
    setDiagnostics('ready', 'Pyodide ready', 100, nextPyodide.version);
  } catch (error) {
    diagnostics = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Pyodide failed to initialize',
      progressPercent: diagnostics.progressPercent
    };
  }
}

async function getStatus(): Promise<WorkerDiagnostics> {
  return diagnostics;
}

async function computeConvolvedImage(
  input: ConvolvedImageInput
): Promise<ConvolvedImageResult> {
  await ensureInitialized();
  if (!pyodide || diagnostics.status !== 'ready') {
    throw new Error(diagnostics.message);
  }

  const globals = pyodide.toPy({
    aperture_settings: input.apertureSettings,
    aperture_diameter_mm: input.apertureDiameterMm,
    diagnostic_wavelength_nm: input.diagnosticWavelengthNm,
    show_scale_bar: input.showScaleBar,
    target_id: input.targetId,
    spectral_mode: input.spectralMode,
    wavelength_weights: input.wavelengthWeights,
    zernike_coefficients_by_wavelength_input: input.zernikeCoefficientsByWavelength,
    wavefront_legend_unit: input.wavefrontLegendUnit,
  });

  const simulationSource = `
from hoa_visualizer_utils.simulation.compute import compute_simulation
from hoa_visualizer_utils.simulation.aperture import ApertureSpec

zernike_coefficients_by_wavelength = [
    {
        tuple(int(index) for index in key.split(",")): float(value)
        for key, value in scoped_coefficients.items()
    }
    for _wavelength, scoped_coefficients in zernike_coefficients_by_wavelength_input
]
aperture = ApertureSpec(
    shape=str(aperture_settings["shape"]),
    rotation_degrees=float(aperture_settings["rotationDegrees"]),
    central_obstruction_shape=str(aperture_settings["centralObstructionShape"]),
    central_obstruction_rotation_degrees=float(aperture_settings["centralObstructionRotationDegrees"]),
    central_obstruction_ratio=float(aperture_settings["centralObstructionRatio"]),
    spider_vane_count=float(aperture_settings["spiderVaneCount"]),
    spider_vane_width_ratio=float(aperture_settings["spiderVaneWidthRatio"]),
    spider_vane_rotation_degrees=float(aperture_settings["spiderVaneRotationDegrees"]),
    gaussian_apodization_enabled=bool(aperture_settings["gaussianApodizationEnabled"]),
    gaussian_apodization_sigma_ratio=float(aperture_settings["gaussianApodizationSigmaRatio"]),
)
simulation = compute_simulation(
    entrance_pupil_diameter_mm=float(aperture_diameter_mm),
    wavelength_weights=wavelength_weights,
    zernike_coefficients_by_wavelength=zernike_coefficients_by_wavelength,
    target_id=str(target_id),
    pupil_samples=256,
    image_samples=512,
    aperture=aperture,
    diagnostic_wavelength_nm=float(diagnostic_wavelength_nm),
)
`;

  await pyodide.runPythonAsync(simulationSource, { globals });

  const imageBytes = await renderSimulationImage(
    globals,
    'from hoa_visualizer_utils.rendering.convolved_image import render_convolved_image\nrender_convolved_image(simulation, show_scale_bar=bool(show_scale_bar), display_scale="perceptual")'
  );
  const psfImageBytes = await renderSimulationImage(
    globals,
    'from hoa_visualizer_utils.rendering.psf import render_psf\nrender_psf(simulation, show_scale_bar=bool(show_scale_bar))'
  );
  const wavefrontImageBytes = await renderSimulationImage(
    globals,
    'from hoa_visualizer_utils.rendering.wavefront import render_wavefront\nrender_wavefront(simulation, unit=str(wavefront_legend_unit))'
  );

  return {
    imageUrl: `data:image/png;base64,${bytesToBase64(imageBytes)}`,
    psfImageUrl: `data:image/png;base64,${bytesToBase64(psfImageBytes)}`,
    wavefrontImageUrl: `data:image/png;base64,${bytesToBase64(wavefrontImageBytes)}`,
    diagnostics
  };
}

async function renderApertureMask(input: ApertureSettings): Promise<ApertureMaskResult> {
  await ensureInitialized();
  if (!pyodide || diagnostics.status !== 'ready') {
    throw new Error(diagnostics.message);
  }

  const globals = pyodide.toPy({
    aperture_settings: input
  });
  const imageBytes = await renderSimulationImage(
    globals,
    `
from hoa_visualizer_utils.rendering.aperture_mask import render_aperture_mask
from hoa_visualizer_utils.simulation.aperture import ApertureSpec

aperture = ApertureSpec(
    shape=str(aperture_settings["shape"]),
    rotation_degrees=float(aperture_settings["rotationDegrees"]),
    central_obstruction_shape=str(aperture_settings["centralObstructionShape"]),
    central_obstruction_rotation_degrees=float(aperture_settings["centralObstructionRotationDegrees"]),
    central_obstruction_ratio=float(aperture_settings["centralObstructionRatio"]),
    spider_vane_count=float(aperture_settings["spiderVaneCount"]),
    spider_vane_width_ratio=float(aperture_settings["spiderVaneWidthRatio"]),
    spider_vane_rotation_degrees=float(aperture_settings["spiderVaneRotationDegrees"]),
    gaussian_apodization_enabled=bool(aperture_settings["gaussianApodizationEnabled"]),
    gaussian_apodization_sigma_ratio=float(aperture_settings["gaussianApodizationSigmaRatio"]),
)
render_aperture_mask(aperture)
`
  );

  return {
    imageUrl: `data:image/png;base64,${bytesToBase64(imageBytes)}`,
    diagnostics
  };
}

const api: OpticsWorkerApi = {
  initialize,
  getStatus,
  computeConvolvedImage,
  renderApertureMask
};

expose(api);

async function renderSimulationImage(
  globals: PyProxy,
  source: string
): Promise<Uint8Array> {
  if (!pyodide) {
    throw new Error('Pyodide is not initialized');
  }

  return (await pyodide.runPythonAsync(source, { globals })) as Uint8Array;
}

async function ensureInitialized(): Promise<void> {
  if (diagnostics.status === 'ready') {
    return;
  }
  if (!initializationPromise) {
    diagnostics = {
      status: 'initializing',
      message: 'Starting worker',
      progressPercent: 0
    };
    initializationPromise = Promise.resolve().then(initializePyodide);
  }
  await initializationPromise;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function setDiagnostics(
  status: WorkerDiagnostics['status'],
  message: string,
  progressPercent: number,
  pyodideVersion?: string
): void {
  const nextDiagnostics: WorkerDiagnostics = {
    status,
    message,
    progressPercent
  };
  if (pyodideVersion !== undefined) {
    nextDiagnostics.pyodideVersion = pyodideVersion;
  }

  diagnostics = nextDiagnostics;
}

async function loadPythonSources(nextPyodide: PyodideInterface): Promise<void> {
  const directories = new Set<string>();

  for (const [relativePath] of pythonSources) {
    const directory = relativePath.split('/').slice(0, -1).join('/');
    directories.add(`${pythonPackageRoot}/${directory}`);
  }
  for (const [relativePath] of pythonAssets) {
    const directory = relativePath.split('/').slice(0, -1).join('/');
    directories.add(`${pythonPackageRoot}/${directory}`);
  }

  for (const directory of directories) {
    nextPyodide.FS.mkdirTree(directory);
  }

  for (const [relativePath, source] of pythonSources) {
    nextPyodide.FS.writeFile(`${pythonPackageRoot}/${relativePath}`, source);
  }
  for (const [relativePath, assetUrl] of pythonAssets) {
    const response = await fetch(assetUrl);
    const bytes = new Uint8Array(await response.arrayBuffer());
    nextPyodide.FS.writeFile(`${pythonPackageRoot}/${relativePath}`, bytes);
  }
}
