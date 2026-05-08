"""PSF rendering helpers."""

from __future__ import annotations

import numpy as np
from matplotlib.colors import LogNorm
from matplotlib.ticker import LogFormatterSciNotation

from hoa_visualizer_utils.rendering.scale_bar import add_scale_bar
from hoa_visualizer_utils.simulation.models import OpticalSimulation
from hoa_visualizer_utils.utils.figures import ImageFormat, _figure_to_bytes, _load_pyplot


def render_psf(
    simulation: OpticalSimulation,
    *,
    image_format: ImageFormat = "png",
    show_scale_bar: bool = False,
) -> bytes:
    """Render the normalized PSF on a log intensity scale."""

    plt = _load_pyplot()
    psf_view = np.clip(simulation.psf / simulation.psf.max(), 1e-6, 1)
    fig, ax = plt.subplots(figsize=(5, 4.5), constrained_layout=True)
    image = ax.imshow(psf_view, cmap="viridis", norm=LogNorm(vmin=1e-6, vmax=1))
    if show_scale_bar:
        add_scale_bar(ax, simulation)
    ax.set_axis_off()
    fig.colorbar(
        image,
        ax=ax,
        label="normalized intensity",
        format=LogFormatterSciNotation(),
    )
    return _figure_to_bytes(fig, image_format)
