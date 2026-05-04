/// <reference lib="webworker" />

import { expose } from 'comlink';
import type { PyodideInterface } from 'pyodide';
import type {
  ConvolvedImageInput,
  ConvolvedImageResult,
  OpticsWorkerApi,
  WorkerDiagnostics
} from './types';

const wheelUrl = '/pyodide/hoa_visualizer_utils-0.1.0-py3-none-any.whl';
const prysmWheelUrl = '/pyodide/prysm-0.21.1-py2.py3-none-any.whl';
const pyodideIndexUrl = '/node_modules/pyodide/';
const pyodidePackageBaseUrl = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';
const effectiveFocalLengthMm = 17;

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
    const installGlobals = nextPyodide.toPy({
      prysm_wheel_url: prysmWheelUrl,
      wheel_url: wheelUrl
    });
    await nextPyodide.runPythonAsync(
      `
import micropip

await micropip.install(prysm_wheel_url, deps=False)
await micropip.install(wheel_url, deps=False)
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
    effective_focal_length_mm: effectiveFocalLengthMm,
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
    effective_focal_length_mm=float(effective_focal_length_mm),
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
