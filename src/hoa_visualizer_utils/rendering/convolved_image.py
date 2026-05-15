"""Convolved image rendering helpers."""

from __future__ import annotations

from typing import Literal

import numpy as np

from hoa_visualizer_utils.rendering.scale_bar import add_scale_bar
from hoa_visualizer_utils.simulation.models import OpticalSimulation
from hoa_visualizer_utils.utils.figures import (
    DEFAULT_FIGURE_SIZE_INCHES,
    ImageFormat,
    _figure_to_bytes,
    _load_pyplot,
)


PERCEPTUAL_DISPLAY_SCALE_STRENGTH = 10


def _convolved_image_figure_size(image_shape: tuple[int, ...]) -> tuple[float, float]:
    rows, columns = image_shape[:2]
    width_inches = DEFAULT_FIGURE_SIZE_INCHES[0]
    return (width_inches, width_inches * rows / columns)


def render_convolved_image(
    simulation: OpticalSimulation,
    *,
    image_format: ImageFormat = "png",
    show_scale_bar: bool = False,
    display_scale: Literal["linear", "perceptual"] = "linear",
) -> bytes:
    """Render the target image convolved with the normalized PSF."""

    image = np.clip(simulation.convolved_image, 0, 1)
    if display_scale == "linear":
        display_image = image
    elif display_scale == "perceptual":
        display_image = np.log1p(PERCEPTUAL_DISPLAY_SCALE_STRENGTH * image) / np.log1p(
            PERCEPTUAL_DISPLAY_SCALE_STRENGTH,
        )
    else:
        raise ValueError("display_scale must be 'linear' or 'perceptual'")

    plt = _load_pyplot()
    fig = plt.figure(figsize=_convolved_image_figure_size(display_image.shape), frameon=False)
    fig.patch.set_facecolor("black")
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("black")
    ax.imshow(
        display_image,
        cmap="gray",
        vmin=0,
        vmax=1,
        interpolation="bilinear",
    )
    if show_scale_bar:
        add_scale_bar(ax, simulation)
    ax.set_axis_off()
    return _figure_to_bytes(fig, image_format)
