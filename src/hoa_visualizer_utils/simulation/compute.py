"""Prysm-backed optical simulation computation."""

from __future__ import annotations

import math
from typing import Mapping

import numpy as np

from hoa_visualizer_utils.simulation.models import (
    OpticalSimulation,
    SimulationInputs,
    SimulationSampling,
)
from hoa_visualizer_utils.simulation.targets import SUPPORTED_TARGET_IDS, _make_target


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
    """Validate simulation inputs and normalize coefficient values."""

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
    """Validate that a numeric value is finite and greater than zero."""

    if not math.isfinite(float(value)) or value <= 0:
        raise ValueError(f"{name} must be positive and finite")


def _validate_positive_int(value: int, name: str) -> None:
    """Validate that a value is a positive integer."""

    if not isinstance(value, int) or value <= 0:
        raise ValueError(f"{name} must be a positive integer")
