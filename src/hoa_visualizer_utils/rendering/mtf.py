"""MTF rendering helpers."""

from __future__ import annotations

import math

from hoa_visualizer_utils.simulation.models import OpticalSimulation
from hoa_visualizer_utils.utils.figures import (
    DEFAULT_FIGURE_SIZE_INCHES,
    ImageFormat,
    _figure_to_bytes,
    _load_pyplot,
)
from prysm.otf import diffraction_limited_mtf


def render_mtf(
    simulation: OpticalSimulation,
    *,
    image_format: ImageFormat = "png",
) -> bytes:
    """Render X, Y, and azimuthal-average MTF curves."""

    plt = _load_pyplot()
    fig, ax = plt.subplots(
        figsize=DEFAULT_FIGURE_SIZE_INCHES,
        constrained_layout=True,
    )
    dawes_frequency = _dawes_limit_frequency_cycles_per_mm(simulation)
    frequency = simulation.mtf.spatial_frequency_cycles_per_mm / dawes_frequency
    ideal_mtf = diffraction_limited_mtf(
        simulation.inputs.effective_focal_length_mm
        / simulation.inputs.entrance_pupil_diameter_mm,
        simulation.sampling.wavelength_nm / 1000,
        simulation.mtf.spatial_frequency_cycles_per_mm,
    )
    ax.plot(frequency, simulation.mtf.x_mtf, marker="o", markersize=3, label="X")
    ax.plot(frequency, simulation.mtf.y_mtf, marker="s", markersize=3, label="Y")
    ax.plot(
        frequency,
        simulation.mtf.azimuthal_average_mtf,
        marker="^",
        markersize=3,
        label="Azimuthal average",
    )
    ax.plot(frequency, ideal_mtf, linestyle="--", marker="None", label="Ideal")
    ax.set_xlabel("Spatial frequency (Dawes limit = 1)")
    ax.set_ylabel("MTF")
    ax.set_xlim(0, 1.1)
    ax.set_ylim(0, 1.05)
    ax.grid(True, alpha=0.3)
    ax.legend()
    return _figure_to_bytes(fig, image_format)


def _dawes_limit_frequency_cycles_per_mm(
    simulation: OpticalSimulation,
) -> float:
    dawes_arcsec = 116 / simulation.inputs.entrance_pupil_diameter_mm
    dawes_radians = math.radians(dawes_arcsec / 3600)
    image_plane_separation_mm = (
        simulation.inputs.effective_focal_length_mm * math.tan(dawes_radians)
    )
    return 1 / image_plane_separation_mm
