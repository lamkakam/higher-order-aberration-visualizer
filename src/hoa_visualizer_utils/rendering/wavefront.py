"""Wavefront rendering helpers."""

from __future__ import annotations

from typing import Literal

import numpy as np
from matplotlib.ticker import ScalarFormatter

from hoa_visualizer_utils.simulation.models import OpticalSimulation
from hoa_visualizer_utils.utils.figures import ImageFormat, _figure_to_bytes, _load_pyplot


def render_wavefront(
    simulation: OpticalSimulation,
    *,
    image_format: ImageFormat = "png",
    unit: Literal["wave", "micron"] = "wave",
) -> bytes:
    """Render the wavefront OPD map."""

    plt = _load_pyplot()
    if unit == "wave":
        wavefront = simulation.wavefront_nm / simulation.sampling.wavelength_nm
        label = "waves"
    elif unit == "micron":
        wavefront = simulation.wavefront_nm / 1000
        label = "microns"
    else:
        raise ValueError(f"Unsupported wavefront unit: {unit}")

    masked_wavefront = np.where(simulation.pupil_mask, wavefront, np.nan)
    fig, ax = plt.subplots(figsize=(5, 4.5), constrained_layout=True)
    image = ax.imshow(masked_wavefront, cmap="viridis")
    ax.set_axis_off()
    fig.colorbar(
        image,
        ax=ax,
        label=label,
        format=_WavefrontTickFormatter(),
    )
    return _figure_to_bytes(fig, image_format)


class _WavefrontTickFormatter(ScalarFormatter):
    def __init__(self) -> None:
        super().__init__(useMathText=True)

    def __call__(self, value: float, pos: int | None = None) -> str:
        if value != 0 and (abs(value) < 0.01 or abs(value) >= 1000):
            return _format_scientific_mathtext(value)
        return f"{value:g}"


def _format_scientific_mathtext(value: float) -> str:
    mantissa_text, exponent_text = f"{value:.0e}".split("e")
    mantissa = int(mantissa_text)
    exponent = int(exponent_text)
    if mantissa == 1:
        value_text = f"10^{{{exponent}}}"
    elif mantissa == -1:
        value_text = f"-10^{{{exponent}}}"
    else:
        value_text = f"{mantissa}\\times10^{{{exponent}}}"
    return f"$\\mathdefault{{{value_text}}}$"
