"""PSF rendering helpers."""

from __future__ import annotations

import numpy as np

from hoa_visualizer_utils.simulation.models import OpticalSimulation
from hoa_visualizer_utils.utils.figures import ImageFormat, _figure_to_bytes, _load_pyplot


def render_psf(
    simulation: OpticalSimulation,
    *,
    image_format: ImageFormat = "png",
) -> bytes:
    """Render the normalized PSF on a log intensity scale."""

    plt = _load_pyplot()
    psf_view = np.log10(simulation.psf / simulation.psf.max() + 1e-6)
    fig, ax = plt.subplots(figsize=(5, 4.5), constrained_layout=True)
    image = ax.imshow(psf_view, cmap="magma", vmin=-6, vmax=0)
    ax.set_title("PSF, Log Normalized Intensity")
    ax.set_axis_off()
    fig.colorbar(image, ax=ax, label="log10(normalized intensity)")
    return _figure_to_bytes(fig, image_format)
