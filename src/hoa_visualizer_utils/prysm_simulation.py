"""Prysm-backed optical simulation helpers."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import math
import os
from typing import Literal, Mapping

import numpy as np
from numpy.typing import NDArray

SUPPORTED_TARGET_IDS = frozenset(
    {
        "siemensstar",
        "slantededge",
        "tiltedsquare",
        "snellen_e_20_20",
    }
)

ImageFormat = Literal["png", "svg"]


@dataclass(frozen=True)
class SimulationInputs:
    entrance_pupil_diameter_mm: float
    effective_focal_length_mm: float
    zernike_coefficients: dict[tuple[int, int], float]
    target_id: str


@dataclass(frozen=True)
class SimulationSampling:
    wavelength_nm: float
    pupil_samples: int
    image_samples: int
    image_dx_um: float
    pupil_dx_mm: float


@dataclass(frozen=True)
class OpticalSimulation:
    target_id: str
    target: NDArray[np.float64]
    psf: NDArray[np.float64]
    convolved_image: NDArray[np.float64]
    wavefront_nm: NDArray[np.float64]
    pupil_mask: NDArray[np.bool_]
    sampling: SimulationSampling
    inputs: SimulationInputs


def compute_simulation(
    entrance_pupil_diameter_mm: float,
    effective_focal_length_mm: float,
    zernike_coefficients: Mapping[tuple[int, int], float],
    target_id: str,
    *,
    wavelength_nm: float = 550.0,
    pupil_samples: int = 1024,
    image_samples: int = 2048,
    image_dx_um: float = 0.5625,
) -> OpticalSimulation:
    """Compute target, PSF, convolved image, and wavefront data."""

    coefficients = _validate_inputs(
        entrance_pupil_diameter_mm,
        effective_focal_length_mm,
        zernike_coefficients,
        target_id,
        wavelength_nm,
        pupil_samples,
        image_samples,
        image_dx_um,
    )

    from prysm import coordinates, convolution, geometry, polynomials, propagation

    xi, eta = coordinates.make_xy_grid(pupil_samples, diameter=entrance_pupil_diameter_mm)
    r, t = coordinates.cart_to_polar(xi, eta)
    pupil_dx_mm = float(xi[0, 1] - xi[0, 0])
    aperture_radius_mm = entrance_pupil_diameter_mm / 2
    amp = geometry.circle(aperture_radius_mm, r)
    pupil_mask = amp > 0

    normalized_radius = r / aperture_radius_mm
    wavefront_nm = np.zeros_like(r, dtype=float)
    for (n, m), coefficient_waves in coefficients.items():
        wavefront_nm += (
            coefficient_waves
            * wavelength_nm
            * polynomials.zernike_nm(n, m, normalized_radius, t, norm=True)
        )
    wavefront_nm = np.where(pupil_mask, wavefront_nm, 0)

    pupil = propagation.Wavefront.from_amp_and_phase(
        amp,
        wavefront_nm,
        wavelength_nm / 1_000,
        pupil_dx_mm,
    )
    focused = pupil.focus_fixed_sampling(
        effective_focal_length_mm,
        image_dx_um,
        image_samples,
        method="czt",
    )
    psf = np.asarray(focused.intensity.data, dtype=float)
    psf_sum = psf.sum()
    if not np.isfinite(psf_sum) or psf_sum <= 0:
        raise ValueError("PSF energy must be finite and positive")
    psf = psf / psf_sum

    x, y = coordinates.make_xy_grid(psf.shape, dx=focused.dx)
    target = _make_target(
        target_id,
        x,
        y,
        image_dx_um=float(focused.dx),
        effective_focal_length_mm=effective_focal_length_mm,
    )
    convolved_image = convolution.conv(target, psf)
    convolved_image = np.clip(convolved_image, 0, 1)

    return OpticalSimulation(
        target_id=target_id,
        target=np.asarray(target, dtype=float),
        psf=psf,
        convolved_image=np.asarray(convolved_image, dtype=float),
        wavefront_nm=np.asarray(wavefront_nm, dtype=float),
        pupil_mask=np.asarray(pupil_mask, dtype=bool),
        sampling=SimulationSampling(
            wavelength_nm=wavelength_nm,
            pupil_samples=pupil_samples,
            image_samples=image_samples,
            image_dx_um=float(focused.dx),
            pupil_dx_mm=pupil_dx_mm,
        ),
        inputs=SimulationInputs(
            entrance_pupil_diameter_mm=entrance_pupil_diameter_mm,
            effective_focal_length_mm=effective_focal_length_mm,
            zernike_coefficients=dict(coefficients),
            target_id=target_id,
        ),
    )


def render_wavefront(
    simulation: OpticalSimulation,
    *,
    image_format: ImageFormat = "png",
) -> bytes:
    """Render the wavefront OPD map."""

    plt = _load_pyplot()
    masked_wavefront = np.where(simulation.pupil_mask, simulation.wavefront_nm, np.nan)
    fig, ax = plt.subplots(figsize=(5, 4.5), constrained_layout=True)
    image = ax.imshow(masked_wavefront, cmap="RdBu_r")
    ax.set_title("Wavefront OPD")
    ax.set_axis_off()
    fig.colorbar(image, ax=ax, label="OPD (nm)")
    return _figure_to_bytes(fig, image_format)


def render_psf(
    simulation: OpticalSimulation,
    *,
    image_format: ImageFormat = "png",
) -> bytes:
    """Render the normalized PSF on a log intensity scale."""

    plt = _load_pyplot()
    psf_view = np.log10(simulation.psf / simulation.psf.max() + 1e-6)
    fig, ax = plt.subplots(figsize=(5, 4.5), constrained_layout=True)
    image = ax.imshow(psf_view, cmap="magma", vmin=-6, vmax=0)
    ax.set_title("PSF, Log Normalized Intensity")
    ax.set_axis_off()
    fig.colorbar(image, ax=ax, label="log10(normalized intensity)")
    return _figure_to_bytes(fig, image_format)


def render_convolved_image(
    simulation: OpticalSimulation,
    *,
    image_format: ImageFormat = "png",
) -> bytes:
    """Render the target image convolved with the normalized PSF."""

    plt = _load_pyplot()
    fig, ax = plt.subplots(figsize=(5, 4.5), constrained_layout=True)
    ax.imshow(simulation.convolved_image, cmap="gray", vmin=0, vmax=1)
    ax.set_title("Convolved Image")
    ax.set_axis_off()
    return _figure_to_bytes(fig, image_format)


def _validate_inputs(
    entrance_pupil_diameter_mm: float,
    effective_focal_length_mm: float,
    zernike_coefficients: Mapping[tuple[int, int], float],
    target_id: str,
    wavelength_nm: float,
    pupil_samples: int,
    image_samples: int,
    image_dx_um: float,
) -> dict[tuple[int, int], float]:
    _validate_positive_finite(
        entrance_pupil_diameter_mm,
        "entrance_pupil_diameter_mm",
    )
    _validate_positive_finite(
        effective_focal_length_mm,
        "effective_focal_length_mm",
    )
    _validate_positive_finite(wavelength_nm, "wavelength_nm")
    _validate_positive_finite(image_dx_um, "image_dx_um")
    _validate_positive_int(pupil_samples, "pupil_samples")
    _validate_positive_int(image_samples, "image_samples")
    if target_id not in SUPPORTED_TARGET_IDS:
        raise ValueError(f"target_id must be one of {sorted(SUPPORTED_TARGET_IDS)}")

    coefficients: dict[tuple[int, int], float] = {}
    for key, value in zernike_coefficients.items():
        if (
            not isinstance(key, tuple)
            or len(key) != 2
            or not all(isinstance(index, int) for index in key)
        ):
            raise ValueError("Zernike coefficient key must be a tuple[int, int]")
        coefficient = float(value)
        if not math.isfinite(coefficient):
            raise ValueError("Zernike coefficient values must be finite")
        coefficients[key] = coefficient
    return coefficients


def _validate_positive_finite(value: float, name: str) -> None:
    if not math.isfinite(float(value)) or value <= 0:
        raise ValueError(f"{name} must be positive and finite")


def _validate_positive_int(value: int, name: str) -> None:
    if not isinstance(value, int) or value <= 0:
        raise ValueError(f"{name} must be a positive integer")


def _make_target(
    target_id: str,
    x: NDArray[np.float64],
    y: NDArray[np.float64],
    *,
    image_dx_um: float,
    effective_focal_length_mm: float,
) -> NDArray[np.float64]:
    from prysm import coordinates, objects

    if target_id == "siemensstar":
        obj_r, obj_t = coordinates.cart_to_polar(x, y)
        return objects.siemensstar(
            obj_r,
            obj_t,
            spokes=100,
            oradius=float(x.max()) * 0.8,
        )
    if target_id == "slantededge":
        return objects.slantededge(x, y)
    if target_id == "tiltedsquare":
        return objects.tiltedsquare(x, y, radius=float(x.max()) * 0.35)
    if target_id == "snellen_e_20_20":
        return _make_snellen_e(
            x.shape,
            image_dx_um=image_dx_um,
            effective_focal_length_mm=effective_focal_length_mm,
        )

    raise ValueError(f"target_id must be one of {sorted(SUPPORTED_TARGET_IDS)}")


def _make_snellen_e(
    shape: tuple[int, int],
    *,
    image_dx_um: float,
    effective_focal_length_mm: float,
) -> NDArray[np.float64]:
    height_um = effective_focal_length_mm * math.tan(math.radians(5 / 60)) * 1_000
    block_px = max(1, round(height_um / (5 * image_dx_um)))
    height_px = 5 * block_px
    rows, columns = shape
    if height_px > rows or height_px > columns:
        raise ValueError("snellen_e_20_20 target is larger than the image grid")

    target = np.ones(shape, dtype=float)
    pattern = np.array(
        [
            [1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0],
            [1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0],
            [1, 1, 1, 1, 1],
        ],
        dtype=bool,
    )
    y0 = (rows - height_px) // 2
    x0 = (columns - height_px) // 2
    for row in range(5):
        for column in range(5):
            if pattern[row, column]:
                y_start = y0 + row * block_px
                x_start = x0 + column * block_px
                target[
                    y_start : y_start + block_px,
                    x_start : x_start + block_px,
                ] = 0
    return target


def _load_pyplot():
    os.environ.setdefault("MPLCONFIGDIR", "/tmp/matplotlib-prysm-test")
    import matplotlib

    matplotlib.use("Agg")
    from matplotlib import pyplot as plt

    return plt


def _figure_to_bytes(fig, image_format: ImageFormat) -> bytes:
    if image_format not in ("png", "svg"):
        raise ValueError("image_format must be 'png' or 'svg'")

    buffer = BytesIO()
    fig.savefig(buffer, format=image_format)
    _load_pyplot().close(fig)
    return buffer.getvalue()
