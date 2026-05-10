"""Aperture mask helpers for optical simulation."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray


@dataclass(frozen=True)
class ApertureSpec:
    """Normalized aperture settings for mask support."""

    shape: str = "circle"
    central_obstruction_ratio: float = 0.0

    def validated(self) -> "ApertureSpec":
        """Return a normalized aperture spec or raise for unsupported settings."""

        ratio = float(self.central_obstruction_ratio)
        if self.shape != "circle":
            raise ValueError('aperture shape must be "circle"')
        if not math.isfinite(ratio) or ratio < 0 or ratio >= 1:
            raise ValueError("central_obstruction_ratio must be finite and satisfy 0 <= ratio < 1")
        return ApertureSpec(shape=self.shape, central_obstruction_ratio=ratio)

    def amplitude(
        self,
        aperture_radius_mm: float,
        r: NDArray[np.float64],
    ) -> NDArray[np.float64]:
        """Build the aperture amplitude mask on a radial coordinate grid."""

        from prysm import geometry

        spec = self.validated()
        amp = np.asarray(geometry.circle(aperture_radius_mm, r), dtype=float)
        if spec.central_obstruction_ratio == 0:
            return amp

        obstruction_radius_mm = aperture_radius_mm * spec.central_obstruction_ratio
        obstruction = np.asarray(geometry.circle(obstruction_radius_mm, r), dtype=float)
        return np.clip(amp - obstruction, 0, 1)
