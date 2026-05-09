# Architecture

HOA Visualizer is a Vite React app that runs the optics computation in a Web Worker backed by Pyodide.

## App Flow

The browser entry point in [`src/main.tsx`](../src/main.tsx) mounts [`src/App.tsx`](../src/App.tsx). `App` owns the current optical inputs:

- aperture diameter in millimeters
- target id
- Zernike coefficient values
- wavefront legend unit
- display mode and worker diagnostics

Input controls keep fast-moving draft text and slider positions local so typing and dragging stay responsive on slower devices. Text inputs commit valid values to `App` after a short pause, blur, or Enter. Zernike sliders update their visible row while moving and commit to `App` on release. After committed inputs change, `App` debounces the update and calls `computeConvolvedImage` on the worker API. The returned image URLs are passed to [`SimulatedImageCard`](../src/components/SimulatedImageCard.tsx) for display. In basic mode the UI shows the convolved target image. In advanced mode it also shows the PSF image and wavefront map, except the point-source target omits the separate PSF card.

## Worker Boundary

Worker-facing types live in [`src/workers/types.ts`](../src/workers/types.ts). The main contract is:

- `ConvolvedImageInput`: aperture diameter, scale-bar visibility, supported target id, wavefront legend unit, and Zernike coefficients keyed as `"n,m"` strings
- `ConvolvedImageResult`: data URLs for the convolved image, PSF image, wavefront image, and worker diagnostics
- `OpticsWorkerApi`: `initialize`, `getStatus`, and `computeConvolvedImage`

[`src/workers/client.ts`](../src/workers/client.ts) creates the module worker and wraps it with Comlink. [`src/hooks/useWorkerClient.ts`](../src/hooks/useWorkerClient.ts) owns the React-side session singleton for the app-created worker client and initializes diagnostics. The React UI talks to that Comlink proxy rather than importing worker or Pyodide code directly.

## Pyodide Worker

[`src/workers/optics.worker.ts`](../src/workers/optics.worker.ts) exposes the `OpticsWorkerApi` implementation with Comlink. Initialization loads Pyodide, installs Pyodide packages, writes the embedded Python sources into Pyodide's in-memory filesystem, and installs the bundled `prysm` wheel.

The worker imports Python package files with Vite `?raw` imports and writes them under `/home/pyodide/hoa_visualizer_utils`. It imports binary assets with Vite `?url` imports and writes them into the same package tree. This keeps the Python source package in [`src/hoa_visualizer_utils`](../src/hoa_visualizer_utils) as the source of truth for both Python tests and browser execution.

## Result Data Flow

`computeConvolvedImage` converts the TypeScript input into Python globals, converts Zernike keys from `"n,m"` strings to `(n, m)` tuples, and calls [`compute_simulation`](../src/hoa_visualizer_utils/simulation/compute.py). The returned `OpticalSimulation` object is rendered by:

- [`render_convolved_image`](../src/hoa_visualizer_utils/rendering/convolved_image.py)
- [`render_psf`](../src/hoa_visualizer_utils/rendering/psf.py)
- [`render_wavefront`](../src/hoa_visualizer_utils/rendering/wavefront.py)

Each renderer returns PNG bytes. The worker base64-encodes those bytes into `data:image/png` URLs and returns them to the React UI.
