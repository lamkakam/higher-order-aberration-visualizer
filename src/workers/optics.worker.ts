/// <reference lib="webworker" />

import { expose } from 'comlink';
import type { PyodideInterface } from 'pyodide';
import packageInitSource from '../hoa_visualizer_utils/__init__.py?raw';
import renderingInitSource from '../hoa_visualizer_utils/rendering/__init__.py?raw';
import convolvedImageSource from '../hoa_visualizer_utils/rendering/convolved_image.py?raw';
import psfSource from '../hoa_visualizer_utils/rendering/psf.py?raw';
import wavefrontSource from '../hoa_visualizer_utils/rendering/wavefront.py?raw';
import jupiter502nmAssetUrl from '../hoa_visualizer_utils/simulation/assets/jupiter_502nm.npz?url';
import simulationAssetsInitSource from '../hoa_visualizer_utils/simulation/assets/__init__.py?raw';
import simulationInitSource from '../hoa_visualizer_utils/simulation/__init__.py?raw';
import computeSource from '../hoa_visualizer_utils/simulation/compute.py?raw';
import modelsSource from '../hoa_visualizer_utils/simulation/models.py?raw';
import targetsSource from '../hoa_visualizer_utils/simulation/targets.py?raw';
import utilsInitSource from '../hoa_visualizer_utils/utils/__init__.py?raw';
import figuresSource from '../hoa_visualizer_utils/utils/figures.py?raw';
import type {
  ConvolvedImageInput,
  ConvolvedImageResult,
  OpticsWorkerApi,
  WorkerDiagnostics
} from './types';

const pyodideIndexUrl = '/node_modules/pyodide/';
const pyodidePackageBaseUrl = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';
const prysmWheelUrl = '/pyodide/prysm-0.21.1-py2.py3-none-any.whl';
const pythonPackageRoot = '/home/pyodide';
const pythonSources = [
  ['hoa_visualizer_utils/__init__.py', packageInitSource],
  ['hoa_visualizer_utils/rendering/__init__.py', renderingInitSource],
  ['hoa_visualizer_utils/rendering/convolved_image.py', convolvedImageSource],
  ['hoa_visualizer_utils/rendering/psf.py', psfSource],
  ['hoa_visualizer_utils/rendering/wavefront.py', wavefrontSource],
  ['hoa_visualizer_utils/simulation/__init__.py', simulationInitSource],
  ['hoa_visualizer_utils/simulation/assets/__init__.py', simulationAssetsInitSource],
  ['hoa_visualizer_utils/simulation/compute.py', computeSource],
  ['hoa_visualizer_utils/simulation/models.py', modelsSource],
  ['hoa_visualizer_utils/simulation/targets.py', targetsSource],
  ['hoa_visualizer_utils/utils/__init__.py', utilsInitSource],
  ['hoa_visualizer_utils/utils/figures.py', figuresSource]
] as const;
const pythonAssets = [
  [
    'hoa_visualizer_utils/simulation/assets/jupiter_502nm.npz',
    jupiter502nmAssetUrl
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
    message: 'Initializing Pyodide'
  };

  initializationPromise ??= initializePyodide();

  return Promise.resolve(diagnostics);
}

async function initializePyodide(): Promise<void> {
  try {
    const { loadPyodide } = await import('pyodide');
    const nextPyodide = await loadPyodide({
      indexURL: pyodideIndexUrl,
      packageBaseUrl: pyodidePackageBaseUrl
    });
    pyodide = nextPyodide;
    await nextPyodide.loadPackage([
      'micropip',
      'numpy',
      'scipy',
      'matplotlib',
      'setuptools'
    ]);
    await loadPythonSources(nextPyodide);
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
    diagnostics = {
      status: 'ready',
      message: 'Pyodide ready',
      pyodideVersion: nextPyodide.version
    };
  } catch (error) {
    diagnostics = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Pyodide failed to initialize'
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
    aperture_diameter_mm: input.apertureDiameterMm,
    target_id: input.targetId,
    zernike_coefficients: input.zernikeCoefficients
  });

  const imageBytes = (await pyodide.runPythonAsync(
    `
from hoa_visualizer_utils.simulation.compute import compute_simulation
from hoa_visualizer_utils.rendering.convolved_image import render_convolved_image

coefficients = {
    tuple(int(index) for index in key.split(",")): float(value)
    for key, value in zernike_coefficients.items()
}
simulation = compute_simulation(
    entrance_pupil_diameter_mm=float(aperture_diameter_mm),
    zernike_coefficients=coefficients,
    target_id=str(target_id),
    pupil_samples=256,
    image_samples=512,
)
render_convolved_image(simulation)
`,
    { globals }
  )) as Uint8Array;

  return {
    imageUrl: `data:image/png;base64,${bytesToBase64(imageBytes)}`,
    diagnostics
  };
}

const api: OpticsWorkerApi = {
  initialize,
  getStatus,
  computeConvolvedImage
};

expose(api);

async function ensureInitialized(): Promise<void> {
  if (diagnostics.status === 'ready') {
    return;
  }
  if (!initializationPromise) {
    diagnostics = {
      status: 'initializing',
      message: 'Initializing Pyodide'
    };
    initializationPromise = initializePyodide();
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
