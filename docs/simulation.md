# Simulation

The optics simulation is implemented in the Python package under [`src/hoa_visualizer_utils`](../src/hoa_visualizer_utils) and called from the Pyodide worker in [`src/workers/optics.worker.ts`](../src/workers/optics.worker.ts).

## Inputs

The browser passes a [`ConvolvedImageInput`](../src/workers/types.ts) to the worker:

- `apertureDiameterMm`: entrance pupil diameter in millimeters
- `targetId`: one of the supported target ids
- `zernikeCoefficients`: a record keyed by `"n,m"` strings with coefficient values in waves

The worker converts the Zernike keys to Python `(n, m)` tuples and calls [`compute_simulation`](../src/hoa_visualizer_utils/simulation/compute.py) with fixed browser sampling values of `pupil_samples=256` and `image_samples=512`.

The UI exposes the Zernike terms listed in [`src/components/simulationConfig.ts`](../src/components/simulationConfig.ts). The Python simulation accepts any finite `(n, m)` coefficient key that `prysm.polynomials.zernike_nm` can evaluate.

## Supported Targets

Supported target ids are defined in both [`src/workers/types.ts`](../src/workers/types.ts) and [`src/hoa_visualizer_utils/simulation/targets.py`](../src/hoa_visualizer_utils/simulation/targets.py):

- `snellen_e_20_20`
- `logmar_chart`
- `jupiter_502nm`
- `point_source`
- `siemensstar`
- `slantededge`
- `tiltedsquare`

`targets.py` builds synthetic Siemens star, slanted edge, tilted square, Snellen E, LogMAR, and point-source targets. The Jupiter target uses the packaged [`jupiter_502nm.npz`](../src/hoa_visualizer_utils/simulation/assets/jupiter_502nm.npz) asset.

## Computation Path

[`compute_simulation`](../src/hoa_visualizer_utils/simulation/compute.py) validates inputs, resolves target-specific angular sampling, and uses Prysm to:

1. build the pupil grid and circular aperture
2. sum normalized Zernike terms into a wavefront OPD map
3. propagate the pupil to a fixed-sampling focal-plane PSF
4. normalize the PSF energy
5. build the requested target image
6. convolve the target with the PSF, or use the normalized PSF directly for `point_source`

The result is an [`OpticalSimulation`](../src/hoa_visualizer_utils/simulation/models.py) containing the target, PSF, convolved image, wavefront map, pupil mask, sampling metadata, and normalized input metadata.

## Rendered Outputs

The worker renders three PNG outputs from each `OpticalSimulation`:

- convolved target image from [`render_convolved_image`](../src/hoa_visualizer_utils/rendering/convolved_image.py)
- log-scaled PSF image from [`render_psf`](../src/hoa_visualizer_utils/rendering/psf.py)
- wavefront OPD map from [`render_wavefront`](../src/hoa_visualizer_utils/rendering/wavefront.py)

The convolved target image and PSF renderings include burned-in angular scale bars derived from `simulation.sampling.image_dx_arcmin`.

The worker returns these as `imageUrl`, `psfImageUrl`, and `wavefrontImageUrl` fields in [`ConvolvedImageResult`](../src/workers/types.ts).

## Pyodide Wheel Rationale

The browser runtime loads Pyodide and installs the committed [`prysm-0.21.1-py2.py3-none-any.whl`](../public/pyodide/prysm-0.21.1-py2.py3-none-any.whl). Pyodide's `micropip` installs wheels, not source distributions, and the wheel is served from `public/pyodide` so the browser has a stable same-origin URL. The colocated rationale is in [`public/pyodide/README.md`](../public/pyodide/README.md).

The app's own Python source files are not installed from a wheel at runtime. They are embedded into the Vite worker bundle as raw source imports and written into Pyodide's in-memory filesystem during worker initialization.
