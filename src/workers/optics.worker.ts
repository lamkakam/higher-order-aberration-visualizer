/// <reference lib="webworker" />

import { expose } from 'comlink';
import type { PyodideInterface } from 'pyodide';
import type {
  AberrationInput,
  AberrationResult,
  OpticsWorkerApi,
  WorkerDiagnostics
} from './types';

let pyodide: PyodideInterface | null = null;
let diagnostics: WorkerDiagnostics = {
  status: 'idle',
  message: 'Worker idle'
};
let initializationPromise: Promise<void> | null = null;

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
    pyodide = await loadPyodide();
    await pyodide.loadPackage('micropip');
    diagnostics = {
      status: 'ready',
      message: 'Pyodide ready',
      pyodideVersion: pyodide.version
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

async function computeAberration(input: AberrationInput): Promise<AberrationResult> {
  const size = Math.max(1, Math.floor(input.gridSize));
  const values = new Float32Array(size * size);
  const center = (size - 1) / 2;
  const scale = center === 0 ? 1 : center;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x - center) / scale;
      const ny = (y - center) / scale;
      values[y * size + x] = Math.fround(input.defocus * (nx * nx + ny * ny));
    }
  }

  return {
    width: size,
    height: size,
    values
  };
}

const api: OpticsWorkerApi = {
  initialize,
  getStatus,
  computeAberration
};

expose(api);
