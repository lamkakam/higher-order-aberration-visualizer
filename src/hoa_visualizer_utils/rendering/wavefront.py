"""Wavefront rendering helpers."""

from __future__ import annotations

import numpy as np

from hoa_visualizer_utils.simulation.models import OpticalSimulation
from hoa_visualizer_utils.utils.figures import ImageFormat, _figure_to_bytes, _load_pyplot


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
    ax.set_axis_off()
    fig.colorbar(image, ax=ax, label="OPD (nm)")
    return _figure_to_bytes(fig, image_format)
