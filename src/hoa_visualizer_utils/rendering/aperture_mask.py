"""Aperture mask rendering helpers."""

from __future__ import annotations

import numpy as np

from hoa_visualizer_utils.simulation.aperture import ApertureSpec
from hoa_visualizer_utils.utils.figures import (
    DEFAULT_FIGURE_SIZE_INCHES,
    ImageFormat,
    _figure_to_bytes,
    _load_pyplot,
)


def render_aperture_mask(
    aperture: ApertureSpec,
    *,
    image_format: ImageFormat = "png",
    samples: int = 256,
) -> bytes:
    """Render a normalized aperture amplitude mask."""

    spec = aperture.validated()
    if samples < 2:
        raise ValueError("samples must be at least 2")

    axis = np.linspace(-1, 1, samples)
    x, y = np.meshgrid(axis, axis)
    radius = np.sqrt(x**2 + y**2)
    mask = spec.amplitude(1, radius)

    plt = _load_pyplot()
    fig, ax = plt.subplots(
        figsize=DEFAULT_FIGURE_SIZE_INCHES,
        constrained_layout=True,
    )
    ax.imshow(mask, cmap="gray", vmin=0, vmax=1)
    ax.set_axis_off()
    return _figure_to_bytes(fig, image_format)
