"""Prysm-backed optical simulation computation."""

from __future__ import annotations

import math
from typing import Mapping, cast

import numpy as np

from hoa_visualizer_utils.simulation.models import (
    OpticalSimulation,
    SimulationInputs,
    SimulationSampling,
)
from hoa_visualizer_utils.simulation.targets import (
    JUPITER_502NM_DIAMETER_ARCMIN,
    SUPPORTED_TARGET_IDS,
    _make_target,
)

# Angular equivalent of 0.5625 um image sampling at 17 mm effective focal length.
DEFAULT_EFFECTIVE_FOCAL_LENGTH_MM = 17
DEFAULT_IMAGE_DX_ARCMIN = 0.11374897399181322
SNELLEN_E_DEFAULT_IMAGE_HEIGHT_FRACTION = 0.6
LOGMAR_CHART_DEFAULT_IMAGE_WIDTH_FRACTION = 0.8
LOGMAR_CHART_WIDEST_ROW_ARCMIN = 450
JUPITER_502NM_DEFAULT_IMAGE_DIAMETER_FRACTION = 0.7
POINT_SOURCE_AIRY_DIAMETER_PX = 64
_DEFAULT_IMAGE_DX_ARCMIN_SENTINEL = object()


def compute_simulation(
    entrance_pupil_diameter_mm: float,
    zernike_coefficients: Mapping[tuple[int, int], float],
    target_id: str,
    *,
    wavelength_nm: float = 550.0,
    pupil_samples: int = 1024,
    image_samples: int = 2048,
    image_dx_arcmin: float | None = cast(
        float | None,
        _DEFAULT_IMAGE_DX_ARCMIN_SENTINEL,
    ),
) -> OpticalSimulation:
    """Compute target, PSF, convolved image, and wavefront data."""

    resolved_image_dx_arcmin = _resolve_image_dx_arcmin(
        target_id,
        image_samples,
        image_dx_arcmin,
        entrance_pupil_diameter_mm=entrance_pupil_diameter_mm,
        wavelength_nm=wavelength_nm,
    )
    coefficients = _validate_inputs(
        entrance_pupil_diameter_mm,
        zernike_coefficients,
        target_id,
        wavelength_nm,
        pupil_samples,
        image_samples,
        resolved_image_dx_arcmin,
    )
    prysm_image_dx_um = _angular_dx_to_image_dx_um(
        DEFAULT_EFFECTIVE_FOCAL_LENGTH_MM,
        resolved_image_dx_arcmin,
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
        DEFAULT_EFFECTIVE_FOCAL_LENGTH_MM,
        prysm_image_dx_um,
        image_samples,
        method="czt",
    )
    psf = np.asarray(focused.intensity.data, dtype=float)
    psf = _suppress_psf_replicas(
        psf,
        wavelength_nm=wavelength_nm,
        effective_focal_length_mm=DEFAULT_EFFECTIVE_FOCAL_LENGTH_MM,
        pupil_dx_mm=pupil_dx_mm,
        image_dx_um=float(focused.dx),
    )
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
        image_dx_arcmin=resolved_image_dx_arcmin,
        effective_focal_length_mm=DEFAULT_EFFECTIVE_FOCAL_LENGTH_MM,
    )
    if target_id == "point_source":
        convolved_image = psf / psf.max()
    else:
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
            image_dx_arcmin=resolved_image_dx_arcmin,
            pupil_dx_mm=pupil_dx_mm,
        ),
        inputs=SimulationInputs(
            entrance_pupil_diameter_mm=entrance_pupil_diameter_mm,
            effective_focal_length_mm=DEFAULT_EFFECTIVE_FOCAL_LENGTH_MM,
            zernike_coefficients=dict(coefficients),
            target_id=target_id,
        ),
    )


def _validate_inputs(
    entrance_pupil_diameter_mm: float,
    zernike_coefficients: Mapping[tuple[int, int], float],
    target_id: str,
    wavelength_nm: float,
    pupil_samples: int,
    image_samples: int,
    image_dx_arcmin: float,
) -> dict[tuple[int, int], float]:
    """Validate simulation inputs and normalize coefficient values."""

    _validate_positive_finite(
        entrance_pupil_diameter_mm,
        "entrance_pupil_diameter_mm",
    )
    _validate_positive_finite(wavelength_nm, "wavelength_nm")
    _validate_positive_finite(image_dx_arcmin, "image_dx_arcmin")
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


def _resolve_image_dx_arcmin(
    target_id: str,
    image_samples: int,
    image_dx_arcmin: float | None,
    *,
    entrance_pupil_diameter_mm: float,
    wavelength_nm: float,
) -> float:
    """Resolve omitted angular sampling defaults."""

    if image_dx_arcmin is not _DEFAULT_IMAGE_DX_ARCMIN_SENTINEL and image_dx_arcmin is not None:
        return image_dx_arcmin
    if target_id == "snellen_e_20_20":
        target_height_px = round(image_samples * SNELLEN_E_DEFAULT_IMAGE_HEIGHT_FRACTION)
        block_px = max(1, round(target_height_px / 5))
        return 1 / block_px
    if target_id == "logmar_chart":
        return LOGMAR_CHART_WIDEST_ROW_ARCMIN / (
            image_samples * LOGMAR_CHART_DEFAULT_IMAGE_WIDTH_FRACTION
        )
    if target_id == "jupiter_502nm":
        target_diameter_px = round(
            image_samples * JUPITER_502NM_DEFAULT_IMAGE_DIAMETER_FRACTION
        )
        return JUPITER_502NM_DIAMETER_ARCMIN / target_diameter_px
    if target_id == "point_source":
        airy_diameter_arcmin = math.degrees(
            2 * 1.22 * (wavelength_nm * 1e-6) / entrance_pupil_diameter_mm
        ) * 60
        return airy_diameter_arcmin / POINT_SOURCE_AIRY_DIAMETER_PX
    return DEFAULT_IMAGE_DX_ARCMIN


def _angular_dx_to_image_dx_um(
    effective_focal_length_mm: float,
    image_dx_arcmin: float,
) -> float:
    """Convert angular image sampling to prysm focal-plane spacing."""

    return effective_focal_length_mm * 1_000 * math.tan(math.radians(image_dx_arcmin / 60))


def _suppress_psf_replicas(
    psf: np.ndarray,
    *,
    wavelength_nm: float,
    effective_focal_length_mm: float,
    pupil_dx_mm: float,
    image_dx_um: float,
) -> np.ndarray:
    """Remove off-axis PSF replicas caused by sampled pupil propagation."""

    wavelength_mm = wavelength_nm / 1_000_000
    replica_spacing_px = (
        wavelength_mm
        * effective_focal_length_mm
        / pupil_dx_mm
        / (image_dx_um / 1_000)
    )
    rows, columns = psf.shape
    if replica_spacing_px >= min(rows, columns):
        return psf

    half_width = max(1, math.floor(replica_spacing_px / 2) - 1)
    y_center = rows // 2
    x_center = columns // 2
    filtered = np.zeros_like(psf)
    filtered[
        y_center - half_width : y_center + half_width + 1,
        x_center - half_width : x_center + half_width + 1,
    ] = psf[
        y_center - half_width : y_center + half_width + 1,
        x_center - half_width : x_center + half_width + 1,
    ]
    return filtered


def _validate_positive_finite(value: float, name: str) -> None:
    """Validate that a numeric value is finite and greater than zero."""

    if not math.isfinite(float(value)) or value <= 0:
        raise ValueError(f"{name} must be positive and finite")


def _validate_positive_int(value: int, name: str) -> None:
    """Validate that a value is a positive integer."""

    if not isinstance(value, int) or value <= 0:
        raise ValueError(f"{name} must be a positive integer")
