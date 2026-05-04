"""Target image generation for optical simulations."""

from __future__ import annotations

import math

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


def _make_target(
    target_id: str,
    x: NDArray[np.float64],
    y: NDArray[np.float64],
    *,
    image_dx_um: float,
    image_dx_arcmin: float | None,
    effective_focal_length_mm: float,
) -> NDArray[np.float64]:
    """Build the requested target image on the provided image grid."""

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
            image_dx_arcmin=image_dx_arcmin,
            effective_focal_length_mm=effective_focal_length_mm,
        )

    raise ValueError(f"target_id must be one of {sorted(SUPPORTED_TARGET_IDS)}")


def _make_snellen_e(
    shape: tuple[int, int],
    *,
    image_dx_um: float,
    image_dx_arcmin: float | None,
    effective_focal_length_mm: float,
) -> NDArray[np.float64]:
    """Build a 20/20 Snellen E target with five-arcminute letter height."""

    if image_dx_arcmin is None:
        height_um = effective_focal_length_mm * math.tan(math.radians(5 / 60)) * 1_000
        block_px = max(1, round(height_um / (5 * image_dx_um)))
    else:
        block_px = max(1, round(1.0 / image_dx_arcmin))
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
