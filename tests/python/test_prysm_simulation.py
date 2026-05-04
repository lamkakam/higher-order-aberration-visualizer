import math

import numpy as np
import pytest
from scipy import ndimage

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
    assert simulation.sampling.image_dx_arcmin is None
    assert simulation.sampling.wavelength_nm == 550.0


def test_snellen_e_20_20_uses_five_arcminute_height() -> None:
    image_dx_arcmin = 0.25
    simulation = compute_simulation(
        10,
        10,
        {},
        "snellen_e_20_20",
        pupil_samples=32,
        image_samples=64,
        image_dx_arcmin=image_dx_arcmin,
    )

    height_px, width_px = _target_size_px(simulation.target)
    actual_height_arcmin = height_px * image_dx_arcmin
    actual_width_arcmin = width_px * image_dx_arcmin

    assert actual_height_arcmin == pytest.approx(5, abs=image_dx_arcmin)
    assert actual_width_arcmin == actual_height_arcmin


def test_snellen_e_20_20_keeps_pixel_size_with_fixed_angular_sampling() -> None:
    simulations = [
        compute_simulation(
            10,
            efl_mm,
            {},
            "snellen_e_20_20",
            pupil_samples=32,
            image_samples=64,
            image_dx_arcmin=0.25,
        )
        for efl_mm in (10, 17)
    ]

    sizes = [_target_size_px(simulation.target) for simulation in simulations]

    assert sizes == [(20, 20), (20, 20)]


def test_snellen_e_20_20_legacy_default_physical_sampling_uses_angular_mode() -> None:
    simulation = compute_simulation(
        300,
        3000,
        {},
        "snellen_e_20_20",
        pupil_samples=64,
        image_samples=128,
        image_dx_um=0.5625,
    )

    assert _target_size_px(simulation.target) == (45, 45)
    assert simulation.sampling.image_dx_arcmin == pytest.approx(0.11374897399181322)
    assert simulation.sampling.image_dx_um == pytest.approx(
        3000 * math.tan(math.radians(0.11374897399181322 / 60)) * 1_000
    )


def test_snellen_e_20_20_suppresses_replicated_psf_without_growing_pupil_grid() -> None:
    simulation = compute_simulation(
        30,
        3000,
        {},
        "snellen_e_20_20",
        pupil_samples=256,
        image_samples=512,
    )

    assert _component_count(simulation.convolved_image < 0.99) == 1
    assert simulation.sampling.pupil_samples == 256
    assert simulation.wavefront_nm.shape == (256, 256)


@pytest.mark.parametrize("aperture_mm", [100, 300])
def test_large_aperture_snellen_e_does_not_raise_pupil_samples_past_pyodide_budget(
    aperture_mm: float,
) -> None:
    simulation = compute_simulation(
        aperture_mm,
        3000,
        {},
        "snellen_e_20_20",
        pupil_samples=256,
        image_samples=512,
    )

    assert _component_count(simulation.convolved_image < 0.99) == 1
    assert simulation.sampling.pupil_samples == 256
    assert simulation.wavefront_nm.shape == (256, 256)


def test_angular_sampling_metadata_records_physical_grid_spacing() -> None:
    simulations = [
        compute_simulation(
            10,
            efl_mm,
            {},
            "siemensstar",
            pupil_samples=32,
            image_samples=64,
            image_dx_arcmin=0.25,
        )
        for efl_mm in (10, 17)
    ]

    assert simulations[0].sampling.image_dx_arcmin == 0.25
    assert simulations[1].sampling.image_dx_arcmin == 0.25
    assert simulations[0].sampling.image_dx_um == pytest.approx(
        10 * math.tan(math.radians(0.25 / 60)) * 1_000
    )
    assert simulations[1].sampling.image_dx_um == pytest.approx(
        17 * math.tan(math.radians(0.25 / 60)) * 1_000
    )
    assert simulations[0].sampling.image_dx_um != simulations[1].sampling.image_dx_um


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


def _target_size_px(target: np.ndarray) -> tuple[int, int]:
    dark_pixels = np.argwhere(target < 0.5)
    y_min, x_min = dark_pixels.min(axis=0)
    y_max, x_max = dark_pixels.max(axis=0)
    return y_max - y_min + 1, x_max - x_min + 1


def _component_count(mask: np.ndarray) -> int:
    labels, count = ndimage.label(mask)
    return sum((labels == component).sum() > 5 for component in range(1, count + 1))
