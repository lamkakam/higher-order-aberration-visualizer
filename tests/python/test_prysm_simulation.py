import math

import numpy as np
import pytest

from hoa_visualizer_utils.rendering.convolved_image import render_convolved_image
from hoa_visualizer_utils.rendering.psf import render_psf
from hoa_visualizer_utils.rendering.wavefront import render_wavefront
from hoa_visualizer_utils.simulation.compute import compute_simulation
from hoa_visualizer_utils.simulation.targets import SUPPORTED_TARGET_IDS


def test_compute_simulation_rejects_invalid_inputs() -> None:
    with pytest.raises(ValueError, match="entrance_pupil_diameter_mm"):
        compute_simulation(0, 100, {}, "siemensstar", pupil_samples=32, image_samples=32)

    with pytest.raises(ValueError, match="effective_focal_length_mm"):
        compute_simulation(10, -1, {}, "siemensstar", pupil_samples=32, image_samples=32)

    with pytest.raises(ValueError, match="target_id"):
        compute_simulation(10, 100, {}, "unknown", pupil_samples=32, image_samples=32)

    with pytest.raises(ValueError, match="Zernike coefficient key"):
        compute_simulation(
            10,
            100,
            {(4,): 0.1},  # type: ignore[dict-item]
            "siemensstar",
            pupil_samples=32,
            image_samples=32,
        )


@pytest.mark.parametrize("target_id", sorted(SUPPORTED_TARGET_IDS))
def test_compute_simulation_supports_declared_target_ids(target_id: str) -> None:
    simulation = compute_simulation(
        10,
        10 if target_id == "snellen_e_20_20" else 100,
        {},
        target_id,
        pupil_samples=32,
        image_samples=64,
        image_dx_um=1 if target_id == "snellen_e_20_20" else 0.5625,
    )

    assert simulation.target_id == target_id
    assert simulation.target.shape == (64, 64)
    assert simulation.psf.shape == (64, 64)
    assert simulation.convolved_image.shape == (64, 64)
    assert simulation.wavefront_nm.shape == (32, 32)


def test_compute_simulation_normalizes_psf_and_records_metadata() -> None:
    simulation = compute_simulation(
        10,
        100,
        {(4, 0): 0.1},
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
        image_dx_um=1.25,
    )

    assert np.isclose(simulation.psf.sum(), 1.0)
    assert simulation.psf.min() >= 0
    assert simulation.convolved_image.min() >= 0
    assert simulation.convolved_image.max() <= 1
    assert simulation.inputs.zernike_coefficients == {(4, 0): 0.1}
    assert simulation.sampling.pupil_samples == 32
    assert simulation.sampling.image_samples == 64
    assert simulation.sampling.image_dx_um == 1.25
    assert simulation.sampling.wavelength_nm == 550.0


def test_snellen_e_20_20_uses_five_arcminute_height() -> None:
    efl_mm = 10
    image_dx_um = 1
    simulation = compute_simulation(
        10,
        efl_mm,
        {},
        "snellen_e_20_20",
        pupil_samples=32,
        image_samples=64,
        image_dx_um=image_dx_um,
    )

    dark_pixels = np.argwhere(simulation.target < 0.5)
    y_min, x_min = dark_pixels.min(axis=0)
    y_max, x_max = dark_pixels.max(axis=0)
    actual_height_um = (y_max - y_min + 1) * image_dx_um
    actual_width_um = (x_max - x_min + 1) * image_dx_um
    expected_height_um = efl_mm * math.tan(math.radians(5 / 60)) * 1_000

    assert actual_height_um == pytest.approx(expected_height_um, abs=image_dx_um)
    assert actual_width_um == actual_height_um


def test_render_helpers_return_png_and_svg_bytes() -> None:
    simulation = compute_simulation(
        10,
        100,
        {},
        "tiltedsquare",
        pupil_samples=32,
        image_samples=64,
    )

    assert render_wavefront(simulation, image_format="png").startswith(b"\x89PNG\r\n\x1a\n")
    assert render_psf(simulation, image_format="png").startswith(b"\x89PNG\r\n\x1a\n")
    assert render_convolved_image(simulation, image_format="png").startswith(b"\x89PNG\r\n\x1a\n")
    assert render_wavefront(simulation, image_format="svg").lstrip().startswith(b"<?xml")
    assert render_psf(simulation, image_format="svg").lstrip().startswith(b"<?xml")
    assert render_convolved_image(simulation, image_format="svg").lstrip().startswith(b"<?xml")
