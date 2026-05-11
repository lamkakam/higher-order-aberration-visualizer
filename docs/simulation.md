# Simulation

The optics simulation is implemented in the Python package under [`src/hoa_visualizer_utils`](../src/hoa_visualizer_utils) and called from the Pyodide worker in [`src/workers/optics.worker.ts`](../src/workers/optics.worker.ts).

## Inputs

The browser passes a [`ConvolvedImageInput`](../src/workers/types.ts) to the worker:

- `apertureDiameterMm`: entrance pupil diameter in millimeters
- `apertureSettings`: aperture mask settings for circle, square, or regular hexagon apertures and optional matching central obstructions
- `showScaleBar`: whether Simulated Image and PSF PNG renders include burned-in scale bars; defaults to `false` in the UI
- `targetId`: one of the supported target ids
- `wavefrontLegendUnit`: whether the Wavefront Map colorbar renders in waves or microns; defaults to `wave` in the UI
- `zernikeCoefficients`: a record keyed by `"n,m"` strings with coefficient values in waves

The worker converts the Zernike keys to Python `(n, m)` tuples, converts `apertureSettings` to an [`ApertureSpec`](../src/hoa_visualizer_utils/simulation/aperture.py), and calls [`compute_simulation`](../src/hoa_visualizer_utils/simulation/compute.py) with fixed browser sampling values of `pupil_samples=256` and `image_samples=512`.

The UI exposes the Zernike terms listed in [`src/components/simulationConfig.ts`](../src/components/simulationConfig.ts). Coefficient inputs can be displayed in waves or microns, using the configured 550 nm wavelength for conversion, but values sent to the worker remain in waves. The Python simulation accepts any finite `(n, m)` coefficient key that `prysm.polynomials.zernike_nm` can evaluate.

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

1. build the pupil grid and aperture mask, optionally with a centered obstruction
2. sum normalized Zernike terms into a wavefront OPD map
3. propagate the pupil to a fixed-sampling focal-plane PSF
4. normalize the PSF energy
5. build the requested target image
6. convolve the target with the PSF, or use the normalized PSF directly for `point_source`

The result is an [`OpticalSimulation`](../src/hoa_visualizer_utils/simulation/models.py) containing the target, PSF, convolved image, wavefront map, pupil mask, sampling metadata, and normalized input metadata.

The aperture helper accepts `circle`, `square`, and `regular_hexagon` for both the outer aperture and central obstruction. The UI-facing aperture diameter remains the outer diameter. Square and regular hexagon masks use Prysm's `regular_polygon` helper. Non-circular shapes accept rotation values from 0 to 360 degrees.

`centralObstructionRatio` must satisfy `0 <= ratio < 1`. A ratio of `0` is the default unobstructed pupil and hides obstruction shape controls in the UI. A nonzero ratio subtracts a centered obstruction from the outer aperture, masks the wavefront map in the same region, and is recorded in `simulation.inputs.aperture`. In advanced display mode, the UI exposes these aperture settings through an aperture mask modal under Target.

When `image_dx_arcmin` is omitted, some targets use target-specific angular sampling. The `snellen_e_20_20` target defaults to a sampling that makes the E occupy about one eighth of the square chart height, while explicit `image_dx_arcmin` values keep the physical 20/20 sizing semantics requested by Python callers.

## Rendered Outputs

The worker renders three PNG outputs from each `OpticalSimulation`:

- convolved target image from [`render_convolved_image`](../src/hoa_visualizer_utils/rendering/convolved_image.py)
- log-scaled PSF image from [`render_psf`](../src/hoa_visualizer_utils/rendering/psf.py)
- wavefront OPD map from [`render_wavefront`](../src/hoa_visualizer_utils/rendering/wavefront.py)

The Python renderers use a default 10 by 9 inch Matplotlib figure size, which produces approximately 1000 by 900 pixel PNG outputs at Matplotlib's default 100 DPI.

By default, the convolved target image and PSF renderings omit scale bars. When `showScaleBar` is `true`, those two renders include burned-in angular scale bars derived from `simulation.sampling.image_dx_arcmin`. Wavefront renderings do not include scale bars. The Wavefront Map colorbar uses waves by default and can be switched to microns through `wavefrontLegendUnit`.

The worker returns these as `imageUrl`, `psfImageUrl`, and `wavefrontImageUrl` fields in [`ConvolvedImageResult`](../src/workers/types.ts).

The worker can also render a standalone aperture mask preview with `renderApertureMask`. That path validates the same `ApertureSpec` settings and returns an `ApertureMaskResult` PNG data URL without running `compute_simulation`.

## Pyodide Wheel Rationale

The browser runtime loads Pyodide and installs the committed [`prysm-0.21.1-py2.py3-none-any.whl`](../public/pyodide/prysm-0.21.1-py2.py3-none-any.whl). Pyodide's `micropip` installs wheels, not source distributions, and the wheel is served from `public/pyodide` so the browser has a stable same-origin URL. The colocated rationale is in [`public/pyodide/README.md`](../public/pyodide/README.md).

The app's own Python source files are not installed from a wheel at runtime. They are embedded into the Vite worker bundle as raw source imports and written into Pyodide's in-memory filesystem during worker initialization.
