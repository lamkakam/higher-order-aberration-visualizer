"""Convolved image rendering helpers."""

from __future__ import annotations

from hoa_visualizer_utils.rendering.scale_bar import add_scale_bar
from hoa_visualizer_utils.simulation.models import OpticalSimulation
from hoa_visualizer_utils.utils.figures import ImageFormat, _figure_to_bytes, _load_pyplot


def render_convolved_image(
    simulation: OpticalSimulation,
    *,
    image_format: ImageFormat = "png",
) -> bytes:
    """Render the target image convolved with the normalized PSF."""

    plt = _load_pyplot()
    fig, ax = plt.subplots(figsize=(5, 4.5), constrained_layout=True)
    ax.imshow(
        simulation.convolved_image,
        cmap="gray",
        vmin=0,
        vmax=1,
        interpolation="bilinear",
    )
    add_scale_bar(ax, simulation)
    ax.set_axis_off()
    return _figure_to_bytes(fig, image_format)
