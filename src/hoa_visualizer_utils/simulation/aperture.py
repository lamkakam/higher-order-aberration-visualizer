"""Aperture mask helpers for optical simulation."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

APERTURE_SHAPES = frozenset(("circle", "square", "regular_hexagon"))


@dataclass(frozen=True)
class ApertureSpec:
    """Normalized aperture settings for mask support."""

    shape: str = "circle"
    rotation_degrees: float = 0.0
    central_obstruction_shape: str = "circle"
    central_obstruction_rotation_degrees: float = 0.0
    central_obstruction_ratio: float = 0.0
    gaussian_apodization_enabled: bool = False
    gaussian_apodization_sigma_ratio: float = 0.5

    def validated(self) -> "ApertureSpec":
        """Return a normalized aperture spec or raise for unsupported settings."""

        ratio = float(self.central_obstruction_ratio)
        rotation = float(self.rotation_degrees)
        obstruction_rotation = float(self.central_obstruction_rotation_degrees)
        gaussian_sigma_ratio = float(self.gaussian_apodization_sigma_ratio)
        if self.shape not in APERTURE_SHAPES:
            raise ValueError("aperture shape is not supported")
        if self.central_obstruction_shape not in APERTURE_SHAPES:
            raise ValueError("central_obstruction_shape is not supported")
        if not math.isfinite(rotation) or rotation < 0 or rotation > 360:
            raise ValueError("rotation_degrees must be finite and satisfy 0 <= rotation <= 360")
        if not math.isfinite(ratio) or ratio < 0 or ratio >= 1:
            raise ValueError("central_obstruction_ratio must be finite and satisfy 0 <= ratio < 1")
        if (
            not math.isfinite(obstruction_rotation)
            or obstruction_rotation < 0
            or obstruction_rotation > 360
        ):
            raise ValueError(
                "central_obstruction_rotation_degrees must be finite and satisfy "
                "0 <= rotation <= 360"
            )
        if self.gaussian_apodization_enabled and (
            not math.isfinite(gaussian_sigma_ratio)
            or gaussian_sigma_ratio < 0.05
            or gaussian_sigma_ratio > 1
        ):
            raise ValueError(
                "gaussian_apodization_sigma_ratio must be finite and satisfy "
                "0.05 <= ratio <= 1 when Gaussian apodization is enabled"
            )
        return ApertureSpec(
            shape=self.shape,
            rotation_degrees=rotation,
            central_obstruction_shape=self.central_obstruction_shape,
            central_obstruction_rotation_degrees=obstruction_rotation,
            central_obstruction_ratio=ratio,
            gaussian_apodization_enabled=bool(self.gaussian_apodization_enabled),
            gaussian_apodization_sigma_ratio=gaussian_sigma_ratio,
        )

    def amplitude(
        self,
        aperture_radius_mm: float,
        x: NDArray[np.float64],
        y: NDArray[np.float64],
        r: NDArray[np.float64],
    ) -> NDArray[np.float64]:
        """Build the aperture amplitude mask on a radial coordinate grid."""

        spec = self.validated()
        amp = _shape_amplitude(
            spec.shape,
            aperture_radius_mm,
            x,
            y,
            r,
            spec.rotation_degrees,
        )
        if spec.central_obstruction_ratio > 0:
            obstruction_radius_mm = aperture_radius_mm * spec.central_obstruction_ratio
            obstruction = _shape_amplitude(
                spec.central_obstruction_shape,
                obstruction_radius_mm,
                x,
                y,
                r,
                spec.central_obstruction_rotation_degrees,
            )
            amp = np.clip(amp - obstruction, 0, 1)

        if not spec.gaussian_apodization_enabled:
            return amp

        aperture_diameter_mm = aperture_radius_mm * 2
        sigma_mm = spec.gaussian_apodization_sigma_ratio * aperture_diameter_mm
        return amp * np.exp(-(r**2) / (2 * sigma_mm**2))


def _shape_amplitude(
    shape: str,
    radius: float,
    x: NDArray[np.float64],
    y: NDArray[np.float64],
    r: NDArray[np.float64],
    rotation: float,
) -> NDArray[np.float64]:
    from prysm import geometry

    if shape == "circle":
        return np.asarray(geometry.circle(radius, r), dtype=float)
    if shape == "square":
        return np.asarray(
            geometry.regular_polygon(4, radius, x, y, center=(0, 0), rotation=rotation),
            dtype=float,
        )
    if shape == "regular_hexagon":
        return np.asarray(
            geometry.regular_polygon(6, radius, x, y, center=(0, 0), rotation=rotation),
            dtype=float,
        )
    raise ValueError("aperture shape is not supported")
