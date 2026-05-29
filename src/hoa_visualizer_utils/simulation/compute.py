"""Prysm-backed optical simulation computation."""

from __future__ import annotations

import math
from typing import Mapping, Sequence, cast

import numpy as np

from hoa_visualizer_utils.simulation.aperture import ApertureSpec
from hoa_visualizer_utils.simulation.models import (
    OpticalSimulation,
    SimulationInputs,
    SimulationSampling,
)
from hoa_visualizer_utils.simulation.targets import (
    JUPITER_502NM_DIAMETER_ARCMIN,
    SUPPORTED_TARGET_IDS,
    _make_jupiter_rgb_target,
    _make_target,
)

# Angular equivalent of 0.5625 um image sampling at 17 mm effective focal length.
DEFAULT_EFFECTIVE_FOCAL_LENGTH_MM = 17
DEFAULT_IMAGE_DX_ARCMIN = 0.11374897399181322
SNELLEN_E_DEFAULT_IMAGE_HEIGHT_FRACTION = 0.125
LOGMAR_CHART_DEFAULT_IMAGE_WIDTH_FRACTION = 0.8
LOGMAR_CHART_WIDEST_ROW_ARCMIN = 450
JUPITER_502NM_DEFAULT_IMAGE_DIAMETER_FRACTION = 0.7
POINT_SOURCE_AIRY_DIAMETER_PX = 64
WIDE_POINT_SOURCE_SAMPLING_MULTIPLIER = 4
_DEFAULT_IMAGE_DX_ARCMIN_SENTINEL = object()


def compute_simulation(
    entrance_pupil_diameter_mm: float,
    wavelength_weights: Sequence[tuple[float, float]],
    zernike_coefficients_by_wavelength: Sequence[Mapping[tuple[int, int], float]],
    target_id: str,
    *,
    pupil_samples: int = 1024,
    image_samples: int = 2048,
    image_dx_arcmin: float | None = cast(
        float | None,
        _DEFAULT_IMAGE_DX_ARCMIN_SENTINEL,
    ),
    aperture: ApertureSpec | None = None,
    diagnostic_wavelength_nm: float | None = None,
) -> OpticalSimulation:
    """Compute target, PSF, convolved image, and wavefront data."""

    resolved_aperture = (aperture or ApertureSpec()).validated()
    validated_channels = _validate_wavelength_channels(
        wavelength_weights,
        zernike_coefficients_by_wavelength,
    )
    is_rgb = len(validated_channels) == 3
    default_representative_index = 1 if is_rgb else 0
    sampling_wavelength_nm = validated_channels[default_representative_index][0]
    representative_index = _resolve_diagnostic_channel_index(
        validated_channels,
        default_representative_index=default_representative_index,
        diagnostic_wavelength_nm=diagnostic_wavelength_nm,
    )
    representative_wavelength_nm = validated_channels[representative_index][0]
    resolved_image_dx_arcmin = _resolve_image_dx_arcmin(
        target_id,
        image_samples,
        image_dx_arcmin,
        entrance_pupil_diameter_mm=entrance_pupil_diameter_mm,
        wavelength_nm=sampling_wavelength_nm,
    )
    prysm_image_dx_um = _angular_dx_to_image_dx_um(
        DEFAULT_EFFECTIVE_FOCAL_LENGTH_MM,
        resolved_image_dx_arcmin,
    )

    from prysm import coordinates, convolution, propagation

    xi, eta = coordinates.make_xy_grid(pupil_samples, diameter=entrance_pupil_diameter_mm)
    r, t = coordinates.cart_to_polar(xi, eta)
    pupil_dx_mm = float(xi[0, 1] - xi[0, 0])
    aperture_radius_mm = entrance_pupil_diameter_mm / 2
    amp = resolved_aperture.amplitude(aperture_radius_mm, xi, eta, r)
    pupil_mask = amp > 0

    channels = [
        (
            channel_wavelength_nm,
            channel_weight,
            _validate_inputs(
                entrance_pupil_diameter_mm,
                channel_coefficients,
                target_id,
                channel_wavelength_nm,
                pupil_samples,
                image_samples,
                resolved_image_dx_arcmin,
            ),
        )
        for (
            channel_wavelength_nm,
            channel_weight,
            channel_coefficients,
        ) in validated_channels
    ]

    if not is_rgb:
        wavelength_nm, channel_weight, coefficients = channels[0]
        psf, wavefront_nm, focused_dx_um = _compute_psf(
            amp,
            r,
            t,
            pupil_mask,
            coefficients,
            wavelength_nm=wavelength_nm,
            aperture_radius_mm=aperture_radius_mm,
            pupil_dx_mm=pupil_dx_mm,
            prysm_image_dx_um=prysm_image_dx_um,
            image_samples=image_samples,
            propagation=propagation,
        )
        x, y = coordinates.make_xy_grid(psf.shape, dx=focused_dx_um)
        target = _make_target(
            target_id,
            x,
            y,
            image_dx_arcmin=resolved_image_dx_arcmin,
        )
        convolved_image = (
            _convolve_target(target, psf, target_id, convolution) * channel_weight
        )
        representative_coefficients = coefficients
    else:
        channel_results = [
            _compute_psf(
                amp,
                r,
                t,
                pupil_mask,
                channel_coefficients,
                wavelength_nm=channel_wavelength_nm,
                aperture_radius_mm=aperture_radius_mm,
                pupil_dx_mm=pupil_dx_mm,
                prysm_image_dx_um=prysm_image_dx_um,
                image_samples=image_samples,
                propagation=propagation,
            )
            for channel_wavelength_nm, _, channel_coefficients in channels
        ]
        psf = channel_results[representative_index][0]
        wavefront_nm = channel_results[representative_index][1]
        focused_dx_um = channel_results[representative_index][2]
        representative_coefficients = channels[representative_index][2]
        x, y = coordinates.make_xy_grid(psf.shape, dx=focused_dx_um)
        if target_id == "jupiter":
            target = _make_jupiter_rgb_target(
                psf.shape,
                image_dx_arcmin=resolved_image_dx_arcmin,
            )
            target_channels = [target[..., channel] for channel in range(3)]
        else:
            target = _make_target(
                target_id,
                x,
                y,
                image_dx_arcmin=resolved_image_dx_arcmin,
            )
            target_channels = [target, target, target]

        convolved_image = np.stack(
            [
                _convolve_target(channel_target, channel_psf, target_id, convolution)
                * channel_weight
                for channel_target, (channel_psf, _, _), (_, channel_weight, _) in zip(
                    target_channels,
                    channel_results,
                    channels,
                )
            ],
            axis=-1,
        )
        wavelength_nm = representative_wavelength_nm

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
            image_dx_arcmin=resolved_image_dx_arcmin,
            pupil_dx_mm=pupil_dx_mm,
        ),
        inputs=SimulationInputs(
            entrance_pupil_diameter_mm=entrance_pupil_diameter_mm,
            effective_focal_length_mm=DEFAULT_EFFECTIVE_FOCAL_LENGTH_MM,
            zernike_coefficients=dict(representative_coefficients),
            target_id=target_id,
            aperture=resolved_aperture,
        ),
    )


def _validate_wavelength_channels(
    wavelength_weights: Sequence[tuple[float, float]],
    zernike_coefficients_by_wavelength: Sequence[Mapping[tuple[int, int], float]],
) -> list[tuple[float, float, Mapping[tuple[int, int], float]]]:
    """Validate required channel inputs and sort RGB entries into display order."""

    if len(wavelength_weights) not in (1, 3):
        raise ValueError("wavelength_weights must contain exactly 1 or 3 entries")
    if len(zernike_coefficients_by_wavelength) not in (1, 3):
        raise ValueError(
            "zernike_coefficients_by_wavelength must contain exactly 1 or 3 entries"
        )
    if len(wavelength_weights) != len(zernike_coefficients_by_wavelength):
        raise ValueError(
            "wavelength_weights and zernike_coefficients_by_wavelength must have matching lengths"
        )

    channels = []
    for wavelength_weight, coefficients in zip(
        wavelength_weights,
        zernike_coefficients_by_wavelength,
    ):
        if len(wavelength_weight) != 2:
            raise ValueError("wavelength_weights entries must be wavelength/weight pairs")
        channel_wavelength_nm = float(wavelength_weight[0])
        channel_weight = float(wavelength_weight[1])
        if not math.isfinite(channel_wavelength_nm) or channel_wavelength_nm <= 0:
            raise ValueError("wavelength_weights wavelengths must be finite and positive")
        if not math.isfinite(channel_weight) or channel_weight < 0:
            raise ValueError("wavelength_weights weights must be finite and non-negative")
        channels.append((channel_wavelength_nm, channel_weight, coefficients))

    if len(channels) == 1:
        return channels
    return sorted(channels, key=lambda channel: channel[0], reverse=True)


def _resolve_diagnostic_channel_index(
    channels: Sequence[tuple[float, float, Mapping[tuple[int, int], float]]],
    *,
    default_representative_index: int,
    diagnostic_wavelength_nm: float | None,
) -> int:
    """Resolve which channel supplies diagnostic PSF and wavefront fields."""

    if len(channels) == 1 or diagnostic_wavelength_nm is None:
        return default_representative_index

    requested_wavelength_nm = float(diagnostic_wavelength_nm)
    if not math.isfinite(requested_wavelength_nm) or requested_wavelength_nm <= 0:
        raise ValueError("diagnostic_wavelength_nm must match a configured wavelength")

    for index, (channel_wavelength_nm, _, _) in enumerate(channels):
        if channel_wavelength_nm == requested_wavelength_nm:
            return index

    available_wavelengths = ", ".join(str(channel[0]) for channel in channels)
    raise ValueError(
        "diagnostic_wavelength_nm must match a configured wavelength "
        f"({available_wavelengths})"
    )


def _compute_psf(
    amp: np.ndarray,
    r: np.ndarray,
    t: np.ndarray,
    pupil_mask: np.ndarray,
    coefficients: Mapping[tuple[int, int], float],
    *,
    wavelength_nm: float,
    aperture_radius_mm: float,
    pupil_dx_mm: float,
    prysm_image_dx_um: float,
    image_samples: int,
    propagation,
) -> tuple[np.ndarray, np.ndarray, float]:
    """Compute a normalized PSF and wavefront for one wavelength."""

    from prysm import polynomials

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
    return psf / psf_sum, np.asarray(wavefront_nm, dtype=float), float(focused.dx)


def _convolve_target(target: np.ndarray, psf: np.ndarray, target_id: str, convolution):
    if target_id in {"point_source", "wide_point_source"}:
        return psf / psf.max()
    convolved_image = convolution.conv(target, psf)
    return np.clip(convolved_image, 0, 1)


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
    if target_id in {"snellen_e_20_20", "snellen_e_20_20_inverted"}:
        target_height_px = round(image_samples * SNELLEN_E_DEFAULT_IMAGE_HEIGHT_FRACTION)
        block_px = max(1, round(target_height_px / 5))
        return 1 / block_px
    if target_id in {"logmar_chart", "logmar_chart_inverted"}:
        return LOGMAR_CHART_WIDEST_ROW_ARCMIN / (
            image_samples * LOGMAR_CHART_DEFAULT_IMAGE_WIDTH_FRACTION
        )
    if target_id == "jupiter":
        target_diameter_px = round(
            image_samples * JUPITER_502NM_DEFAULT_IMAGE_DIAMETER_FRACTION
        )
        return JUPITER_502NM_DIAMETER_ARCMIN / target_diameter_px
    if target_id == "point_source":
        return _point_source_image_dx_arcmin(
            aperture_diameter_mm=entrance_pupil_diameter_mm,
            wavelength_nm=wavelength_nm,
        )
    if target_id == "wide_point_source":
        return WIDE_POINT_SOURCE_SAMPLING_MULTIPLIER * _point_source_image_dx_arcmin(
            aperture_diameter_mm=entrance_pupil_diameter_mm,
            wavelength_nm=wavelength_nm,
        )
    return DEFAULT_IMAGE_DX_ARCMIN


def _point_source_image_dx_arcmin(
    *,
    aperture_diameter_mm: float,
    wavelength_nm: float,
) -> float:
    airy_diameter_arcmin = math.degrees(
        2 * 1.22 * (wavelength_nm * 1e-6) / aperture_diameter_mm
    ) * 60
    return airy_diameter_arcmin / POINT_SOURCE_AIRY_DIAMETER_PX


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
