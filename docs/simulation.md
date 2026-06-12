# Simulation

The optics simulation is implemented in the Python package under [`src/hoa_visualizer_utils`](../src/hoa_visualizer_utils) and called from the Pyodide worker in [`src/workers/optics.worker.ts`](../src/workers/optics.worker.ts).

## Inputs

The browser passes a [`ConvolvedImageInput`](../src/workers/types.ts) to the worker:

- `apertureDiameterMm`: entrance pupil diameter in millimeters
- `apertureSettings`: [`ApertureSettings`](../src/types/domain.ts) for circle, square, or regular hexagon apertures, optional matching central obstructions, optional spider vanes, and optional Gaussian apodization
- `diagnosticWavelengthNm`: wavelength used for representative PSF, Wavefront Map, MTF, sampling wavelength, and coefficient diagnostics; Basic Mode and Advanced Monochromatic send `550`, and Advanced Polychromatic sends the active wavelength tab
- `showScaleBar`: whether Simulated Image and PSF PNG renders include burned-in scale bars; defaults to `false` in the UI
- `spectralMode`: `monochromatic` or `polychromatic`; Basic Mode always sends `monochromatic`
- `targetId`: one of the supported target ids defined in [`src/types/domain.ts`](../src/types/domain.ts)
- `wavelengthWeights`: required `(wavelength_nm, weight)` channel pairs; Basic Mode and Advanced Monochromatic send `[[550, 1]]`, and Advanced Polychromatic sends `[[550, 1], [656, 1], [486, 1]]`
- `wavefrontLegendUnit`: whether the Wavefront Map colorbar renders in waves or microns; defaults to `wave` in the UI
- `seeingZernikeSigmasByWavelength`: optional wavelength-scoped seeing sigma records using `"n,m"` coefficient keys and sigma values in waves; Advanced Mode sends this only when FWHM seeing is nonzero
- `zernikeCoefficientsByWavelength`: required wavelength-scoped records using `"n,m"` coefficient keys and coefficient values in waves; Basic Mode and Advanced Monochromatic send the `550 nm` map

The worker converts the wavelength-scoped Zernike and seeing-sigma keys to Python `(n, m)` tuples, converts `apertureSettings` to an [`ApertureSpec`](../src/hoa_visualizer_utils/simulation/aperture.py), and calls [`compute_simulation`](../src/hoa_visualizer_utils/simulation/compute.py) with fixed browser sampling values of `pupil_samples=256` and `image_samples=512`. Browser calls pass `wavelength_weights`, `zernike_coefficients_by_wavelength`, `diagnostic_wavelength_nm`, `seeing_zernike_sigmas_by_wavelength`, `seeing_sample_count=10`, and `random_seed=0`. If no seeing sigma payload is provided, the worker passes empty sigma maps for each wavelength.

The UI exposes the Zernike terms listed in [`src/components/lib/simulationConfig.ts`](../src/components/lib/simulationConfig.ts). Coefficient inputs can be displayed in waves or microns. Wave/micron conversion uses the active wavelength tab in Advanced Polychromatic Mode, and defaults to `550 nm` in Basic Mode and Advanced Monochromatic Mode. Values sent to the worker remain in waves. Basic Mode and Advanced Monochromatic Mode show a single aberration card backed by the `550 nm` coefficient state. Advanced Polychromatic Mode shows tabs for `550 nm`, `656 nm`, and `486 nm`; each tab has an independent aberration card and reset action, and the `550 nm` tab shares state with monochromatic mode. The Python simulation accepts any finite `(n, m)` coefficient key that `prysm.polynomials.zernike_nm` can evaluate.

Advanced Mode also exposes `FWHM Seeing (arcsecond)`. This value is not stored in user-editable Zernike coefficient state and does not modify `zernikeCoefficientsByWavelength`. Before `ApplicationShell` calls `computeConvolvedImage`, the browser computes a separate wavelength-scoped seeing sigma payload from Noll 1976 atmospheric variance coefficients. Tilt terms `1,-1` and `1,1` are included in the sigma payload even though they are not editable UI terms, and defocus `2,0` is included. Basic Mode omits the seeing sigma payload, which the worker treats as empty sigma maps.

WebMCP coefficient patches use the same editable Zernike term list and coefficient bounds as the UI. Basic route tool calls patch the shared `550 nm` coefficient map. Advanced route tool calls must include `wavelengthNm` as `550`, `656`, or `486`, and patch only that wavelength map even when `Sync wavelengths` is enabled.

The internal Python API and the browser worker require wavelength-scoped channel inputs:

```python
compute_simulation(
    entrance_pupil_diameter_mm,
    wavelength_weights,
    zernike_coefficients_by_wavelength,
    target_id,
    seeing_zernike_sigmas_by_wavelength=None,
    seeing_sample_count=10,
    random_seed=0,
)
```

Callers must provide exactly one or exactly three `(wavelength_nm, weight)` pairs and the same number of matching Zernike coefficient mappings. Wavelengths must be finite and positive, and weights must be finite and non-negative. One channel preserves monochromatic behavior and returns a 2D `simulation.convolved_image`; its weight is applied after convolution. Three channels produce linear RGB with shape `(H, W, 3)`. The wavelength entries are sorted by wavelength before rendering: longest wavelength becomes red, the middle wavelength becomes green, and the shortest wavelength becomes blue. Each channel gets its own wavefront, PSF, target convolution, and linear post-convolution weight multiplier. Weights are not normalized by the simulation.

For each wavelength channel, telescope coefficients and seeing sigmas stay separate until Python sampling. For each seeing sample, Python draws signed Gaussian perturbations with `numpy.random.default_rng(random_seed).standard_normal()`, multiplies each draw by that term's seeing sigma, adds the result to the telescope coefficient map, computes a normalized sample PSF, and computes that sample's total wavefront map. The channel PSF is the normalized arithmetic average of the sample PSFs, and the channel wavefront map is the arithmetic average of the sampled total wavefront maps. `seeing_sample_count` must be positive and defaults to `10`; `random_seed` defaults to `0`, so identical inputs produce identical outputs.

For three-channel results, the simulated RGB image still uses all three wavelength channels, and each channel gets its own averaged seeing PSF from that channel's telescope coefficients and seeing sigmas. The representative `simulation.psf`, `simulation.wavefront_nm`, `simulation.mtf`, `simulation.sampling.wavelength_nm`, and `simulation.inputs.zernike_coefficients` diagnostics come from `diagnostic_wavelength_nm` when it is provided, so PSF, Wavefront Map, and MTF render from the active wavelength tab. If no diagnostic wavelength is provided, these representative fields come from the middle/green channel.

## Supported Targets

Supported target ids are defined in both [`src/types/domain.ts`](../src/types/domain.ts) and [`src/hoa_visualizer_utils/simulation/targets.py`](../src/hoa_visualizer_utils/simulation/targets.py):

- `snellen_e_20_20`
- `snellen_e_20_20_inverted`
- `logmar_chart`
- `logmar_chart_inverted`
- `jupiter`
- `point_source`
- `wide_point_source`
- `siemensstar`
- `slantededge`
- `tiltedsquare`

`targets.py` builds synthetic Siemens star, slanted edge, tilted square, Snellen E, LogMAR, inverted Snellen E, inverted LogMAR, Jupiter, and point-source targets. `point_source` and `wide_point_source` both build a centered impulse target. The inverted eye-chart targets reuse the same sizing, spacing, antialiasing, and angular sampling as their originals, then return `1 - target` so the letters are light on a dark background. The public Jupiter target id is `jupiter`, while the monochrome Jupiter target continues to use the packaged [`jupiter_502nm.npz`](../src/hoa_visualizer_utils/simulation/assets/jupiter_502nm.npz) asset. In polychromatic runs, Jupiter uses [`jupiter_658nm.npz`](../src/hoa_visualizer_utils/simulation/assets/jupiter_658nm.npz) for red, `jupiter_502nm.npz` for green, and [`jupiter_395nm.npz`](../src/hoa_visualizer_utils/simulation/assets/jupiter_395nm.npz) for blue. The simulation reads the committed packaged Jupiter assets directly. Each Jupiter asset is normalized to a dark-background, bright-disk representation, cropped to the detected disk frame, resized to the requested angular diameter, and centered on the output grid so RGB wavelength channels share the same spatial registration.

## Computation Path

[`compute_simulation`](../src/hoa_visualizer_utils/simulation/compute.py) validates inputs, resolves target-specific angular sampling, and uses Prysm to:

1. build the pupil grid and aperture mask, optionally with a centered obstruction, spider vanes, and Gaussian apodization
2. sample signed seeing Zernike perturbations when seeing sigmas are provided
3. sum telescope and sampled seeing Zernike terms into each sample's wavefront OPD map
4. propagate each sample pupil to a fixed-sampling focal-plane PSF
5. normalize and average sample PSFs, then average sample wavefront maps
6. build the requested target image
7. compute X, Y, and azimuthal-average MTF slices from a representative diagnostic PSF in cycles/mm
8. convolve the target with the PSF, or use the normalized PSF directly for `point_source` and `wide_point_source`

For polychromatic runs, steps 2 through 6 are repeated for each RGB channel. Non-Jupiter image targets reuse the same grayscale target in each channel. `point_source` and `wide_point_source` return an RGB image built from the three display-normalized PSFs. Jupiter builds separate red, green, and blue target channels from the 658 nm, 502 nm, and 395 nm assets before convolution.

MTF uses a representative diagnostic PSF sampled for the Dawes-limit frequency range of the current aperture. When seeing sigmas are present, this diagnostic PSF uses the same sample count and seed as the target-scale PSF. This diagnostic PSF is independent of the selected target's angular image scale, so changing from an eye chart to Jupiter does not change the optical MTF when aperture, wavelength, aberrations, seeing, and aperture mask are unchanged.

The result is an [`OpticalSimulation`](../src/hoa_visualizer_utils/simulation/models.py) containing the target, PSF, convolved image, wavefront map, MTF data, pupil mask, sampling metadata, and normalized input metadata.

The computed `simulation.convolved_image` remains linear normalized intensity data. Display-only tone mapping is applied only by renderers that explicitly request it.

The aperture helper accepts `circle`, `square`, and `regular_hexagon` for both the outer aperture and central obstruction. The UI-facing aperture diameter remains the outer diameter. Square and regular hexagon masks use Prysm's `regular_polygon` helper. Non-circular shapes accept rotation values from 0 to 360 degrees.

`centralObstructionRatio` must satisfy `0 <= ratio < 1`. A ratio of `0` is the default unobstructed pupil and hides obstruction shape controls in the UI. A nonzero ratio subtracts a centered obstruction from the outer aperture, masks the wavefront map in the same region, and is recorded in `simulation.inputs.aperture`. In advanced display mode, the UI exposes these aperture settings through an aperture mask modal under Target.

Spider vanes are disabled by default. `spiderVaneCount` must be an integer from `0` to `12`, `spiderVaneWidthRatio` must satisfy `0 <= ratio <= 0.25`, and `spiderVaneRotationDegrees` must satisfy `0 <= rotation <= 360`. Vanes are active only when both count and width are greater than zero. Active vanes use Prysm's `spider` helper with the configured rotation, subtract from the shaped aperture after any central obstruction, and interpret width as a fraction of the outer aperture diameter.

Gaussian apodization is disabled by default. When enabled, `gaussianApodizationSigmaRatio` must satisfy `0.05 <= ratio <= 1.0` and is interpreted as a true Gaussian standard deviation divided by the outer aperture diameter. The Python aperture helper first builds the geometric aperture, central obstruction, and active spider vanes, then multiplies that amplitude by `exp(-r^2 / (2 * sigma_mm^2))`, where `sigma_mm = gaussianApodizationSigmaRatio * apertureDiameterMm`. The pupil mask remains `amp > 0`, so wavefront support still follows the geometric aperture, obstruction, and spider vanes while the PSF uses the softened amplitude.

When `image_dx_arcmin` is omitted, some targets use target-specific angular sampling. The `snellen_e_20_20` and `snellen_e_20_20_inverted` targets default to a sampling that makes the E occupy about one eighth of the square chart height, while explicit `image_dx_arcmin` values keep the physical 20/20 sizing semantics requested by Python callers. `point_source` defaults to Airy-disc angular sampling for the current aperture. `wide_point_source` defaults to four times the current-aperture point-source sampling, so changing aperture diameter keeps the Airy disc size fixed in pixels while showing a wider angular field. Explicit `image_dx_arcmin` values override both point-source defaults.

## Rendered Outputs

The worker renders four PNG outputs from each `OpticalSimulation`:

- convolved target image from [`render_convolved_image`](../src/hoa_visualizer_utils/rendering/convolved_image.py)
- log-scaled PSF image from [`render_psf`](../src/hoa_visualizer_utils/rendering/psf.py)
- wavefront OPD map from [`render_wavefront`](../src/hoa_visualizer_utils/rendering/wavefront.py)
- MTF plot from [`render_mtf`](../src/hoa_visualizer_utils/rendering/mtf.py)

The MTF plot includes X, Y, and azimuthal-average simulated curves plus a dashed Ideal diffraction-limited reference curve computed from the current f-number, diagnostic wavelength, and plotted spatial-frequency samples.

The PSF and wavefront Python renderers use a default 10 by 9 inch Matplotlib figure size, which produces approximately 1000 by 900 pixel PNG outputs at Matplotlib's default 100 DPI. Convolved target PNGs render borderless with a canvas matching the convolved array aspect ratio, so a square target renders as a square PNG without Matplotlib's default white figure padding.

The web worker renders the convolved target image with `display_scale="perceptual"`, a fixed `log1p(10 * x) / log1p(10)` display transform applied after clipping to `[0, 1]`. This improves visibility of low-intensity detail in the PNG only; the underlying `simulation.convolved_image` data stays linear.

By default, the convolved target image and PSF renderings omit scale bars. When `showScaleBar` is `true`, those two renders include burned-in angular scale bars derived from `simulation.sampling.image_dx_arcmin`. Wavefront and MTF renderings do not include scale bars. The Wavefront Map colorbar uses waves by default and can be switched to microns through `wavefrontLegendUnit`. Advanced Mode defaults the final diagnostic panel to Wavefront Map, and the Settings drawer can switch that panel to the MTF plot without another worker computation because both images are returned together.

The worker returns these as `imageUrl`, `psfImageUrl`, `wavefrontImageUrl`, and `mtfImageUrl` fields in [`ConvolvedImageResult`](../src/workers/types.ts).

The worker can also render a standalone aperture mask preview with `renderApertureMask`. That path validates the same `ApertureSpec` settings, including spider vanes and Gaussian apodization, and returns an `ApertureMaskResult` PNG data URL without running `compute_simulation`.

## Pyodide Wheel Rationale

The browser runtime loads Pyodide and installs the committed [`prysm-0.21.1-py2.py3-none-any.whl`](../public/pyodide/prysm-0.21.1-py2.py3-none-any.whl). Pyodide's `micropip` installs wheels, not source distributions, and the wheel is served from `public/pyodide` so the browser has a stable same-origin URL. The colocated rationale is in [`public/pyodide/README.md`](../public/pyodide/README.md).

The app's own Python source files are not installed from a wheel at runtime. They are embedded into the Vite worker bundle as raw source imports and written into Pyodide's in-memory filesystem during worker initialization.
