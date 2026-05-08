import math

import numpy as np
import pytest
from scipy import ndimage

from hoa_visualizer_utils.rendering.convolved_image import render_convolved_image
from hoa_visualizer_utils.rendering.psf import render_psf
from hoa_visualizer_utils.rendering.scale_bar import _scale_bar_spec, add_scale_bar
from hoa_visualizer_utils.rendering.wavefront import render_wavefront
from hoa_visualizer_utils.utils.figures import _load_pyplot
from hoa_visualizer_utils.simulation.compute import (
    DEFAULT_EFFECTIVE_FOCAL_LENGTH_MM,
    DEFAULT_IMAGE_DX_ARCMIN,
    JUPITER_502NM_DEFAULT_IMAGE_DIAMETER_FRACTION,
    JUPITER_502NM_DIAMETER_ARCMIN,
    LOGMAR_CHART_DEFAULT_IMAGE_WIDTH_FRACTION,
    LOGMAR_CHART_WIDEST_ROW_ARCMIN,
    SNELLEN_E_DEFAULT_IMAGE_HEIGHT_FRACTION,
    compute_simulation,
)
from hoa_visualizer_utils.simulation.targets import SUPPORTED_TARGET_IDS


def test_compute_simulation_rejects_invalid_inputs() -> None:
    with pytest.raises(ValueError, match="entrance_pupil_diameter_mm"):
        compute_simulation(0, {}, "siemensstar", pupil_samples=32, image_samples=32)

    with pytest.raises(ValueError, match="image_dx_arcmin"):
        compute_simulation(
            10,
            {},
            "siemensstar",
            pupil_samples=32,
            image_samples=32,
            image_dx_arcmin=-1,
        )

    with pytest.raises(ValueError, match="target_id"):
        compute_simulation(10, {}, "unknown", pupil_samples=32, image_samples=32)

    with pytest.raises(ValueError, match="Zernike coefficient key"):
        compute_simulation(
            10,
            {(4,): 0.1},  # type: ignore[dict-item]
            "siemensstar",
            pupil_samples=32,
            image_samples=32,
        )


@pytest.mark.parametrize("target_id", sorted(SUPPORTED_TARGET_IDS))
def test_compute_simulation_supports_declared_target_ids(target_id: str) -> None:
    simulation = compute_simulation(
        10,
        {},
        target_id,
        pupil_samples=32,
        image_samples=64,
    )

    assert simulation.target_id == target_id
    assert simulation.target.shape == (64, 64)
    assert simulation.psf.shape == (64, 64)
    assert simulation.convolved_image.shape == (64, 64)
    assert simulation.wavefront_nm.shape == (32, 32)


def test_compute_simulation_normalizes_psf_and_records_metadata() -> None:
    image_dx_arcmin = 0.25
    simulation = compute_simulation(
        10,
        {(4, 0): 0.1},
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
        image_dx_arcmin=image_dx_arcmin,
    )

    assert np.isclose(simulation.psf.sum(), 1.0)
    assert simulation.psf.min() >= 0
    assert simulation.convolved_image.min() >= 0
    assert simulation.convolved_image.max() <= 1
    assert simulation.inputs.zernike_coefficients == {(4, 0): 0.1}
    assert simulation.inputs.effective_focal_length_mm == DEFAULT_EFFECTIVE_FOCAL_LENGTH_MM
    assert simulation.sampling.pupil_samples == 32
    assert simulation.sampling.image_samples == 64
    assert simulation.sampling.image_dx_arcmin == image_dx_arcmin
    assert simulation.sampling.wavelength_nm == 550.0


def test_snellen_e_20_20_uses_five_arcminute_height() -> None:
    image_dx_arcmin = 0.25
    simulation = compute_simulation(
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
    simulation = compute_simulation(
        10,
        {},
        "snellen_e_20_20",
        pupil_samples=32,
        image_samples=64,
        image_dx_arcmin=0.25,
    )

    assert _target_size_px(simulation.target) == (20, 20)
    assert simulation.inputs.effective_focal_length_mm == DEFAULT_EFFECTIVE_FOCAL_LENGTH_MM


@pytest.mark.parametrize("image_samples", [64, 128, 512])
def test_snellen_e_20_20_default_height_tracks_image_samples(
    image_samples: int,
) -> None:
    simulation = compute_simulation(
        10,
        {},
        "snellen_e_20_20",
        pupil_samples=32,
        image_samples=image_samples,
    )

    height_px, width_px = _target_size_px(simulation.target)
    expected_block_px = max(
        1,
        round(round(image_samples * SNELLEN_E_DEFAULT_IMAGE_HEIGHT_FRACTION) / 5),
    )

    assert height_px == 5 * expected_block_px
    assert width_px == height_px
    assert height_px == pytest.approx(
        image_samples * SNELLEN_E_DEFAULT_IMAGE_HEIGHT_FRACTION,
        abs=3,
    )
    assert simulation.sampling.image_dx_arcmin == pytest.approx(1 / expected_block_px)


def test_snellen_e_20_20_default_sampling_records_angular_spacing() -> None:
    simulation = compute_simulation(
        300,
        {},
        "snellen_e_20_20",
        pupil_samples=64,
        image_samples=128,
    )

    expected_block_px = max(
        1,
        round(round(128 * SNELLEN_E_DEFAULT_IMAGE_HEIGHT_FRACTION) / 5),
    )

    assert _target_size_px(simulation.target) == (
        5 * expected_block_px,
        5 * expected_block_px,
    )
    assert simulation.sampling.image_dx_arcmin == pytest.approx(1 / expected_block_px)


def test_logmar_chart_uses_supported_target_id() -> None:
    simulation = compute_simulation(
        10,
        {},
        "logmar_chart",
        pupil_samples=32,
        image_samples=512,
    )

    assert "logmar_chart" in SUPPORTED_TARGET_IDS
    assert simulation.target_id == "logmar_chart"
    assert simulation.target.shape == (512, 512)


def test_logmar_chart_first_row_uses_fifty_arcminute_letter_height() -> None:
    image_dx_arcmin = 1
    simulation = compute_simulation(
        10,
        {},
        "logmar_chart",
        pupil_samples=32,
        image_samples=512,
        image_dx_arcmin=image_dx_arcmin,
    )

    first_row_height_px, _ = _row_bbox_size_px(simulation.target < 0.5, row_index=0)

    assert first_row_height_px * image_dx_arcmin == pytest.approx(50, abs=image_dx_arcmin)


def test_logmar_chart_first_row_uses_ten_arcminute_stroke_width() -> None:
    image_dx_arcmin = 1
    simulation = compute_simulation(
        10,
        {},
        "logmar_chart",
        pupil_samples=32,
        image_samples=512,
        image_dx_arcmin=image_dx_arcmin,
    )

    y_min, x_min, y_max, _ = _row_bbox(simulation.target < 0.5, row_index=0)
    y_sample = y_min + (y_max - y_min + 1) // 4
    stroke_width_px = _dark_run_length(simulation.target[y_sample, x_min:] < 0.5)

    assert stroke_width_px * image_dx_arcmin == pytest.approx(10, abs=image_dx_arcmin)


def test_logmar_chart_antialiases_letter_edges() -> None:
    simulation = compute_simulation(
        10,
        {},
        "logmar_chart",
        pupil_samples=32,
        image_samples=512,
    )

    assert np.any((simulation.target > 0) & (simulation.target < 1))


def test_logmar_chart_diagonal_letters_are_not_block_stair_steps() -> None:
    simulation = compute_simulation(
        10,
        {},
        "logmar_chart",
        pupil_samples=32,
        image_samples=512,
    )

    v_mask = _letter_mask(simulation.target < 0.5, row_index=0, letter_index=1)
    left_edge_by_row = [
        int(np.flatnonzero(row)[0])
        for row in v_mask
        if np.any(row)
    ]

    assert len(set(left_edge_by_row)) >= 8


def test_logmar_chart_row_heights_follow_logmar_values() -> None:
    image_dx_arcmin = 0.25
    simulation = compute_simulation(
        10,
        {},
        "logmar_chart",
        pupil_samples=32,
        image_samples=2048,
        image_dx_arcmin=image_dx_arcmin,
    )

    row_heights_arcmin = [
        _row_bbox_size_px(simulation.target < 0.5, row_index=index)[0]
        * image_dx_arcmin
        for index in range(6)
    ]

    assert row_heights_arcmin == sorted(row_heights_arcmin, reverse=True)
    assert row_heights_arcmin == pytest.approx(
        [5 * 10**logmar for logmar in (1.0, 0.9, 0.8, 0.7, 0.6, 0.5)],
        abs=image_dx_arcmin * 2.5,
    )


def test_logmar_chart_keeps_pixel_size_with_fixed_angular_sampling() -> None:
    simulation = compute_simulation(
        10,
        {},
        "logmar_chart",
        pupil_samples=32,
        image_samples=512,
        image_dx_arcmin=1,
    )

    assert _target_size_px(simulation.target)[0] > 0
    assert simulation.inputs.effective_focal_length_mm == DEFAULT_EFFECTIVE_FOCAL_LENGTH_MM


def test_logmar_chart_default_sampling_records_angular_spacing() -> None:
    simulation = compute_simulation(
        300,
        {},
        "logmar_chart",
        pupil_samples=64,
        image_samples=512,
    )

    assert simulation.sampling.image_dx_arcmin == pytest.approx(
        LOGMAR_CHART_WIDEST_ROW_ARCMIN
        / (512 * LOGMAR_CHART_DEFAULT_IMAGE_WIDTH_FRACTION)
    )


def test_jupiter_502nm_uses_supported_target_id() -> None:
    simulation = compute_simulation(
        10,
        {},
        "jupiter_502nm",
        pupil_samples=32,
        image_samples=512,
    )

    assert "jupiter_502nm" in SUPPORTED_TARGET_IDS
    assert simulation.target_id == "jupiter_502nm"
    assert simulation.target.shape == (512, 512)
    assert simulation.psf.shape == (512, 512)
    assert simulation.convolved_image.shape == (512, 512)


def test_jupiter_502nm_uses_fifty_arcsecond_diameter() -> None:
    image_dx_arcmin = 0.005
    simulation = compute_simulation(
        10,
        {},
        "jupiter_502nm",
        pupil_samples=32,
        image_samples=256,
        image_dx_arcmin=image_dx_arcmin,
    )

    height_px, width_px = _target_size_px(simulation.target)

    assert height_px * image_dx_arcmin == pytest.approx(
        JUPITER_502NM_DIAMETER_ARCMIN,
        abs=image_dx_arcmin,
    )
    assert width_px * image_dx_arcmin == pytest.approx(
        JUPITER_502NM_DIAMETER_ARCMIN,
        abs=image_dx_arcmin,
    )


def test_jupiter_502nm_default_diameter_tracks_image_samples() -> None:
    simulation = compute_simulation(
        10,
        {},
        "jupiter_502nm",
        pupil_samples=32,
        image_samples=512,
    )

    height_px, width_px = _target_size_px(simulation.target)
    expected_diameter_px = round(512 * JUPITER_502NM_DEFAULT_IMAGE_DIAMETER_FRACTION)

    assert height_px == pytest.approx(expected_diameter_px, abs=2)
    assert width_px == pytest.approx(expected_diameter_px, abs=2)
    assert simulation.sampling.image_dx_arcmin == pytest.approx(
        JUPITER_502NM_DIAMETER_ARCMIN / expected_diameter_px,
    )


def test_jupiter_502nm_contains_smooth_grayscale_detail() -> None:
    simulation = compute_simulation(
        10,
        {},
        "jupiter_502nm",
        pupil_samples=32,
        image_samples=256,
    )

    intermediate_values = simulation.target[
        (simulation.target > 0.05) & (simulation.target < 0.95)
    ]

    assert intermediate_values.size > 1_000
    assert np.unique(np.round(intermediate_values, 3)).size > 100


def test_jupiter_502nm_is_centered_and_fits_grid() -> None:
    simulation = compute_simulation(
        10,
        {},
        "jupiter_502nm",
        pupil_samples=32,
        image_samples=512,
    )

    y_min, x_min, y_max, x_max = _target_bbox(simulation.target)
    center_y = (y_min + y_max) / 2
    center_x = (x_min + x_max) / 2

    assert y_min > 0
    assert x_min > 0
    assert y_max < simulation.target.shape[0] - 1
    assert x_max < simulation.target.shape[1] - 1
    assert center_y == pytest.approx((simulation.target.shape[0] - 1) / 2, abs=1)
    assert center_x == pytest.approx((simulation.target.shape[1] - 1) / 2, abs=1)


def test_point_source_uses_supported_target_id() -> None:
    simulation = compute_simulation(
        10,
        {},
        "point_source",
        pupil_samples=32,
        image_samples=64,
    )

    assert "point_source" in SUPPORTED_TARGET_IDS
    assert simulation.target_id == "point_source"
    assert simulation.target.shape == (64, 64)
    assert simulation.psf.shape == (64, 64)
    assert simulation.convolved_image.shape == (64, 64)


@pytest.mark.parametrize("aperture_mm", [3, 6])
def test_point_source_default_sampling_tracks_airy_diameter(
    aperture_mm: float,
) -> None:
    wavelength_nm = 550
    simulation = compute_simulation(
        aperture_mm,
        {},
        "point_source",
        wavelength_nm=wavelength_nm,
        pupil_samples=32,
        image_samples=128,
    )

    airy_diameter_arcmin = math.degrees(
        2 * 1.22 * (wavelength_nm * 1e-6) / aperture_mm
    ) * 60

    assert simulation.sampling.image_dx_arcmin == pytest.approx(
        airy_diameter_arcmin / 64
    )
    assert airy_diameter_arcmin / simulation.sampling.image_dx_arcmin == pytest.approx(64)


def test_point_source_default_sampling_changes_with_aperture() -> None:
    small_aperture = compute_simulation(
        3,
        {},
        "point_source",
        pupil_samples=32,
        image_samples=128,
    )
    large_aperture = compute_simulation(
        6,
        {},
        "point_source",
        pupil_samples=32,
        image_samples=128,
    )

    assert small_aperture.sampling.image_dx_arcmin == pytest.approx(
        large_aperture.sampling.image_dx_arcmin * 2
    )


def test_point_source_convolved_image_is_display_normalized_psf() -> None:
    simulation = compute_simulation(
        10,
        {},
        "point_source",
        pupil_samples=32,
        image_samples=128,
    )

    assert simulation.convolved_image.shape == simulation.psf.shape
    assert simulation.convolved_image.max() == pytest.approx(1)
    assert simulation.convolved_image == pytest.approx(simulation.psf / simulation.psf.max())


def test_point_source_explicit_sampling_overrides_airy_default() -> None:
    simulation = compute_simulation(
        10,
        {},
        "point_source",
        pupil_samples=32,
        image_samples=128,
        image_dx_arcmin=0.25,
    )

    assert simulation.sampling.image_dx_arcmin == 0.25


def test_non_snellen_target_uses_default_angular_sampling() -> None:
    simulation = compute_simulation(
        10,
        {},
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
    )

    assert simulation.sampling.image_dx_arcmin == pytest.approx(DEFAULT_IMAGE_DX_ARCMIN)


def test_snellen_e_20_20_suppresses_replicated_psf_without_growing_pupil_grid() -> None:
    simulation = compute_simulation(
        30,
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
        {},
        "snellen_e_20_20",
        pupil_samples=256,
        image_samples=512,
    )

    assert _component_count(simulation.convolved_image < 0.99) == 1
    assert simulation.sampling.pupil_samples == 256
    assert simulation.wavefront_nm.shape == (256, 256)


def test_angular_sampling_metadata_records_angular_grid_spacing() -> None:
    simulation = compute_simulation(
        10,
        {},
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
        image_dx_arcmin=0.25,
    )

    assert simulation.sampling.image_dx_arcmin == 0.25


def test_render_helpers_return_png_and_svg_bytes() -> None:
    simulation = compute_simulation(
        10,
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


def test_scale_bar_uses_arcsec_label_for_sub_arcminute_length() -> None:
    spec = _scale_bar_spec(image_width_px=100, image_dx_arcmin=0.005)

    assert spec.label == "6 arcsec"
    assert spec.length_arcmin == pytest.approx(0.1)


def test_scale_bar_uses_arcmin_label_for_arcminute_length() -> None:
    spec = _scale_bar_spec(image_width_px=100, image_dx_arcmin=0.2)

    assert spec.label == "5 arcmin"
    assert spec.length_arcmin == pytest.approx(5)


def test_scale_bar_converts_angular_length_to_pixels() -> None:
    spec = _scale_bar_spec(image_width_px=100, image_dx_arcmin=0.25)

    assert spec.length_arcmin == pytest.approx(5)
    assert spec.length_px == pytest.approx(20)


def test_scale_bar_draws_contrast_backing() -> None:
    simulation = compute_simulation(
        10,
        {},
        "tiltedsquare",
        pupil_samples=32,
        image_samples=64,
    )
    plt = _load_pyplot()
    fig, ax = plt.subplots()

    try:
        add_scale_bar(ax, simulation)

        assert len(ax.patches) == 1
        assert ax.patches[0].get_alpha() == pytest.approx(0.55)
        assert ax.patches[0].get_facecolor()[:3] == pytest.approx((0, 0, 0))
    finally:
        plt.close(fig)


def test_convolved_image_and_psf_renderers_add_scale_bar(monkeypatch: pytest.MonkeyPatch) -> None:
    simulation = compute_simulation(
        10,
        {},
        "tiltedsquare",
        pupil_samples=32,
        image_samples=64,
    )
    calls = []

    def add_scale_bar(ax, rendered_simulation):
        calls.append((ax, rendered_simulation))

    monkeypatch.setattr(
        "hoa_visualizer_utils.rendering.convolved_image.add_scale_bar",
        add_scale_bar,
    )
    monkeypatch.setattr("hoa_visualizer_utils.rendering.psf.add_scale_bar", add_scale_bar)

    render_convolved_image(simulation, image_format="png")
    render_psf(simulation, image_format="png")

    assert [call[1] for call in calls] == [simulation, simulation]


def test_wavefront_renderer_does_not_add_scale_bar(monkeypatch: pytest.MonkeyPatch) -> None:
    simulation = compute_simulation(
        10,
        {},
        "tiltedsquare",
        pupil_samples=32,
        image_samples=64,
    )
    figure_axes = []

    def figure_to_bytes(fig, image_format):
        figure_axes.extend(fig.axes)
        return b"rendered"

    monkeypatch.setattr(
        "hoa_visualizer_utils.rendering.wavefront._figure_to_bytes",
        figure_to_bytes,
    )

    assert render_wavefront(simulation, image_format="png") == b"rendered"
    assert list(figure_axes[0].texts) == []
    assert list(figure_axes[0].lines) == []


def _target_size_px(target: np.ndarray) -> tuple[int, int]:
    y_min, x_min, y_max, x_max = _target_bbox(target)
    return y_max - y_min + 1, x_max - x_min + 1


def _target_bbox(target: np.ndarray) -> tuple[int, int, int, int]:
    foreground_mask = target < 0.5 if np.median(target) > 0.5 else target > 0.05
    foreground_pixels = np.argwhere(foreground_mask)
    y_min, x_min = foreground_pixels.min(axis=0)
    y_max, x_max = foreground_pixels.max(axis=0)
    return int(y_min), int(x_min), int(y_max), int(x_max)


def _row_bbox(mask: np.ndarray, *, row_index: int) -> tuple[int, int, int, int]:
    occupied_rows = np.flatnonzero(mask.any(axis=1))
    row_bands = np.split(occupied_rows, np.where(np.diff(occupied_rows) > 1)[0] + 1)
    row_pixels = np.argwhere(mask[row_bands[row_index], :])
    y_min = int(row_bands[row_index][row_pixels[:, 0].min()])
    y_max = int(row_bands[row_index][row_pixels[:, 0].max()])
    x_min = int(row_pixels[:, 1].min())
    x_max = int(row_pixels[:, 1].max())
    return y_min, x_min, y_max, x_max


def _row_bbox_size_px(mask: np.ndarray, *, row_index: int) -> tuple[int, int]:
    y_min, x_min, y_max, x_max = _row_bbox(mask, row_index=row_index)
    return y_max - y_min + 1, x_max - x_min + 1


def _letter_mask(mask: np.ndarray, *, row_index: int, letter_index: int) -> np.ndarray:
    y_min, _, y_max, _ = _row_bbox(mask, row_index=row_index)
    row_mask = mask[y_min : y_max + 1, :]
    occupied_columns = np.flatnonzero(row_mask.any(axis=0))
    column_bands = np.split(
        occupied_columns,
        np.where(np.diff(occupied_columns) > 1)[0] + 1,
    )
    return row_mask[:, column_bands[letter_index]]


def _dark_run_length(mask: np.ndarray) -> int:
    white_indices = np.flatnonzero(~mask)
    if white_indices.size == 0:
        return int(mask.size)
    return int(white_indices[0])


def _component_count(mask: np.ndarray) -> int:
    labels, count = ndimage.label(mask)
    return sum((labels == component).sum() > 5 for component in range(1, count + 1))
