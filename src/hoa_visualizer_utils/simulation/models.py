"""Data models for optical simulation results."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from hoa_visualizer_utils.simulation.aperture import ApertureSpec


@dataclass(frozen=True)
class SimulationInputs:
    """Input parameters used to compute an optical simulation."""

    entrance_pupil_diameter_mm: float
    effective_focal_length_mm: float
    zernike_coefficients: dict[tuple[int, int], float]
    target_id: str
    aperture: ApertureSpec


@dataclass(frozen=True)
class SimulationSampling:
    """Sampling metadata for pupil and image grids."""

    wavelength_nm: float
    pupil_samples: int
    image_samples: int
    image_dx_arcmin: float
    pupil_dx_mm: float


@dataclass(frozen=True)
class MtfData:
    """MTF slices derived from the representative diagnostic PSF."""

    spatial_frequency_cycles_per_mm: NDArray[np.float64]
    x_mtf: NDArray[np.float64]
    y_mtf: NDArray[np.float64]
    azimuthal_average_mtf: NDArray[np.float64]


@dataclass(frozen=True)
class OpticalSimulation:
    """Computed optical simulation arrays and metadata."""

    target_id: str
    target: NDArray[np.float64]
    psf: NDArray[np.float64]
    convolved_image: NDArray[np.float64]
    wavefront_nm: NDArray[np.float64]
    mtf: MtfData
    pupil_mask: NDArray[np.bool_]
    sampling: SimulationSampling
    inputs: SimulationInputs
