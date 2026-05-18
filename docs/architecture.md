# Architecture

HOA Visualizer is a Vite React app that runs the optics computation in a Web Worker backed by Pyodide.

## App Flow

The browser entry point in [`src/main.tsx`](../src/main.tsx) imports the i18n setup and mounts [`src/App.tsx`](../src/App.tsx) inside React `Suspense` so translation JSON can be lazy-loaded before visible UI renders. `App` owns the current optical inputs:

- aperture diameter in millimeters
- aperture settings for circle, square, or regular hexagon masks with optional central obstruction, spider vanes, and Gaussian apodization exposed in advanced mode
- target id
- Zernike coefficient values scoped by spectral wavelength
- spectral mode in advanced display mode
- wavefront legend unit
- display mode and worker diagnostics

Input controls keep fast-moving draft text and slider positions local so typing and dragging stay responsive on slower devices. Text inputs commit valid values to `App` after a short pause, blur, or Enter. Zernike sliders update their visible row while moving and commit to `App` on release through a shared committed-slider component. Basic Mode and Advanced Monochromatic Mode use the shared `550 nm` coefficient state. Advanced Polychromatic Mode exposes `550 nm`, `656 nm`, and `486 nm` tabbed aberration controls with fixed channel weights of `1`. Its coefficient edits are synchronized across wavelengths by default: changing one coefficient key writes that committed value into each wavelength map while leaving other coefficient keys untouched. Users can turn off `Sync wavelengths` for independent per-wavelength coefficient editing. The standard Zernike `Reset` action zeroes only the selected wavelength map, and `Reset all wavelengths` zeroes every wavelength map. The advanced aperture mask modal keeps edits local until Confirm, and requests a preview through the worker while the draft settings are valid. Shape rotation sliders use the same preview-then-commit slider behavior. After committed inputs change, `App` debounces the update and calls `computeConvolvedImage` on the worker API. The returned image URLs are passed to [`SimulatedImageCard`](../src/components/SimulatedImageCard.tsx) for display. In basic mode the UI shows the convolved target image. In advanced mode it also shows the PSF image and wavefront map, except the point-source target omits the separate PSF card.

## Internationalization

Client-side translations are configured in [`src/i18n.ts`](../src/i18n.ts) with `i18next`, `react-i18next`, `i18next-http-backend`, and `i18next-browser-languagedetector`. Runtime locale files are served from [`public/locales`](../public/locales) using the backend path `/locales/{{lng}}/{{ns}}.json`.

English is currently the only supported language. The i18n instance uses `supportedLngs: ['en']`, `fallbackLng: 'en'`, and `load: 'languageOnly'`, so unsupported browser locales resolve to English. The header language selector can either follow the browser detector or explicitly select English through `changeLanguage('en')`; returning to Browser default clears the cached explicit language before re-running detection.

## Worker Boundary

Worker-facing types live in [`src/workers/types.ts`](../src/workers/types.ts). The main contract is:

- `ConvolvedImageInput`: aperture diameter, aperture settings, diagnostic wavelength, scale-bar visibility, spectral mode, supported target id, required wavelength weights and wavelength-scoped coefficients keyed as `"n,m"` strings, and wavefront legend unit. The channel lists must contain either one entry for monochromatic runs or three entries for RGB polychromatic runs.
- `ConvolvedImageResult`: data URLs for the convolved image, PSF image, wavefront image, and worker diagnostics
- `ApertureMaskResult`: data URL for an aperture preview image and worker diagnostics
- `OpticsWorkerApi`: `initialize`, `getStatus`, `computeConvolvedImage`, and `renderApertureMask`

[`src/workers/client.ts`](../src/workers/client.ts) creates the module worker and wraps it with Comlink. [`src/hooks/useWorkerClient.ts`](../src/hooks/useWorkerClient.ts) owns the React-side session singleton for the app-created worker client and initializes diagnostics. The React UI talks to that Comlink proxy rather than importing worker or Pyodide code directly.

## Pyodide Worker

[`src/workers/optics.worker.ts`](../src/workers/optics.worker.ts) exposes the `OpticsWorkerApi` implementation with Comlink. Initialization loads Pyodide, installs Pyodide packages, writes the embedded Python sources into Pyodide's in-memory filesystem, and installs the bundled `prysm` wheel.

The worker imports Python package files with Vite `?raw` imports and writes them under `/home/pyodide/hoa_visualizer_utils`. It imports binary assets with Vite `?url` imports and writes them into the same package tree. This keeps the Python source package in [`src/hoa_visualizer_utils`](../src/hoa_visualizer_utils) as the source of truth for both Python tests and browser execution.

## Result Data Flow

`computeConvolvedImage` converts the TypeScript input into Python globals, converts wavelength-scoped Zernike keys from `"n,m"` strings to `(n, m)` tuples, converts aperture settings to an `ApertureSpec`, and calls [`compute_simulation`](../src/hoa_visualizer_utils/simulation/compute.py) with the required channel lists and diagnostic wavelength. Monochromatic calls send one `550 nm` channel and a `550 nm` diagnostic wavelength; polychromatic calls send the fixed `550 nm`, `656 nm`, and `486 nm` channels and use the active wavelength tab for PSF and wavefront diagnostics. The returned `OpticalSimulation` object is rendered by:

- [`render_convolved_image`](../src/hoa_visualizer_utils/rendering/convolved_image.py)
- [`render_psf`](../src/hoa_visualizer_utils/rendering/psf.py)
- [`render_wavefront`](../src/hoa_visualizer_utils/rendering/wavefront.py)

Each renderer returns PNG bytes. The worker base64-encodes those bytes into `data:image/png` URLs and returns them to the React UI.

`renderApertureMask` converts aperture settings to an `ApertureSpec` and calls [`render_aperture_mask`](../src/hoa_visualizer_utils/rendering/aperture_mask.py) without computing a full simulation. It returns a non-enlargeable PNG preview for the advanced aperture mask modal.

`ApertureSettings` carries the outer aperture shape, rotation, central obstruction ratio, obstruction shape, obstruction rotation, spider vane count, spider vane width ratio, spider vane rotation, Gaussian apodization enabled state, and Gaussian standard-deviation ratio. The worker maps those serializable fields directly into the Python `ApertureSpec` used by both full simulations and aperture preview rendering.
