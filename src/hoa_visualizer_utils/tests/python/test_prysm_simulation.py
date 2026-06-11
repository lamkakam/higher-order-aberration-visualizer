import math
from io import BytesIO
from dataclasses import replace

from matplotlib.image import imread
from matplotlib.colors import LogNorm
from matplotlib.ticker import LogFormatterSciNotation, ScalarFormatter
import numpy as np
import pytest
from prysm.otf import diffraction_limited_mtf
from scipy import ndimage

from hoa_visualizer_utils.rendering.convolved_image import render_convolved_image
from hoa_visualizer_utils.rendering.aperture_mask import render_aperture_mask
from hoa_visualizer_utils.rendering.mtf import render_mtf
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
    compute_simulation as _compute_simulation,
)
from hoa_visualizer_utils.simulation.aperture import ApertureSpec
from hoa_visualizer_utils.simulation import targets
from hoa_visualizer_utils.simulation.targets import SUPPORTED_TARGET_IDS


def compute_simulation(
    entrance_pupil_diameter_mm: float,
    zernike_coefficients: dict[tuple[int, int], float],
    target_id: str,
    *,
    wavelength_nm: float = 550.0,
    wavelength_weights: list[tuple[float, float]] | None = None,
    zernike_coefficients_by_wavelength: list[dict[tuple[int, int], float]] | None = None,
    **kwargs: object,
):
    if wavelength_weights is None:
        wavelength_weights = [(wavelength_nm, 1)]
    if zernike_coefficients_by_wavelength is None:
        zernike_coefficients_by_wavelength = [zernike_coefficients]

    return _compute_simulation(
        entrance_pupil_diameter_mm,
        wavelength_weights,
        zernike_coefficients_by_wavelength,
        target_id,
        **kwargs,
    )


def _png_pixels(png_bytes: bytes) -> np.ndarray:
    return imread(BytesIO(png_bytes), format="png")


def _outer_pixels(image: np.ndarray) -> np.ndarray:
    return np.concatenate(
        [
            image[0, :, :3],
            image[-1, :, :3],
            image[:, 0, :3],
            image[:, -1, :3],
        ],
        axis=0,
    )


def _visible_content_bbox(image: np.ndarray) -> tuple[int, int]:
    foreground = np.abs(image - float(image[0, 0])) > 0.05
    rows, columns = np.nonzero(foreground)
    if rows.size == 0 or columns.size == 0:
        return (0, 0)
    return (int(rows.max() - rows.min() + 1), int(columns.max() - columns.min() + 1))


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
    assert simulation.inputs.aperture == ApertureSpec()


def test_compute_simulation_zero_seeing_sigma_matches_single_psf_behavior() -> None:
    baseline = compute_simulation(
        10,
        {(4, 0): 0.1},
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
    )

    sampled = _compute_simulation(
        10,
        [(550, 1)],
        [{(4, 0): 0.1}],
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
        seeing_zernike_sigmas_by_wavelength=[{(4, 0): 0}],
        seeing_sample_count=10,
        random_seed=0,
    )

    np.testing.assert_allclose(sampled.psf, baseline.psf)
    np.testing.assert_allclose(sampled.wavefront_nm, baseline.wavefront_nm)


def test_compute_simulation_sampled_seeing_is_deterministic_for_seed() -> None:
    kwargs = {
        "pupil_samples": 32,
        "image_samples": 64,
        "seeing_zernike_sigmas_by_wavelength": [{(4, 0): 0.2}],
        "seeing_sample_count": 3,
        "random_seed": 123,
    }

    first = _compute_simulation(10, [(550, 1)], [{}], "siemensstar", **kwargs)
    second = _compute_simulation(10, [(550, 1)], [{}], "siemensstar", **kwargs)

    np.testing.assert_allclose(first.psf, second.psf)
    np.testing.assert_allclose(first.wavefront_nm, second.wavefront_nm)


def test_compute_simulation_sampled_seeing_changes_with_seed() -> None:
    first = _compute_simulation(
        10,
        [(550, 1)],
        [{}],
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
        seeing_zernike_sigmas_by_wavelength=[{(4, 0): 0.2}],
        seeing_sample_count=3,
        random_seed=123,
    )
    second = _compute_simulation(
        10,
        [(550, 1)],
        [{}],
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
        seeing_zernike_sigmas_by_wavelength=[{(4, 0): 0.2}],
        seeing_sample_count=3,
        random_seed=456,
    )

    assert not np.allclose(first.psf, second.psf)


def test_compute_simulation_rejects_non_positive_seeing_sample_count() -> None:
    with pytest.raises(ValueError, match="seeing_sample_count"):
        _compute_simulation(
            10,
            [(550, 1)],
            [{}],
            "siemensstar",
            pupil_samples=32,
            image_samples=64,
            seeing_sample_count=0,
        )


def test_sampled_seeing_keeps_psf_normalized_and_convolved_output_valid() -> None:
    simulation = _compute_simulation(
        10,
        [(550, 1)],
        [{}],
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
        seeing_zernike_sigmas_by_wavelength=[{(4, 0): 0.2}],
        seeing_sample_count=4,
        random_seed=123,
    )

    assert np.isclose(simulation.psf.sum(), 1.0)
    assert simulation.psf.min() >= 0
    assert simulation.convolved_image.min() >= 0
    assert simulation.convolved_image.max() <= 1


def test_sampled_seeing_wavefront_is_average_total_wavefront() -> None:
    telescope_coefficients = {(4, 0): 0.1}
    seeing_sigmas = {(4, 0): 0.2}
    simulation = _compute_simulation(
        10,
        [(550, 1)],
        [telescope_coefficients],
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
        seeing_zernike_sigmas_by_wavelength=[seeing_sigmas],
        seeing_sample_count=3,
        random_seed=123,
    )
    rng = np.random.default_rng(123)
    average_draw = float(rng.standard_normal(3).mean())
    expected = compute_simulation(
        10,
        {(4, 0): telescope_coefficients[(4, 0)] + seeing_sigmas[(4, 0)] * average_draw},
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
    )

    np.testing.assert_allclose(simulation.wavefront_nm, expected.wavefront_nm)


def test_compute_simulation_monochrome_contract_stays_2d() -> None:
    simulation = compute_simulation(
        10,
        {},
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
    )

    assert simulation.convolved_image.shape == (64, 64)
    assert simulation.psf.shape == (64, 64)
    assert simulation.wavefront_nm.shape == (32, 32)
    assert simulation.sampling.wavelength_nm == 550.0
    assert simulation.inputs.zernike_coefficients == {}


def test_compute_simulation_requires_plural_channel_inputs() -> None:
    with pytest.raises(TypeError, match="required positional argument"):
        _compute_simulation(10, "siemensstar", pupil_samples=32, image_samples=64)  # type: ignore[call-arg]


@pytest.mark.parametrize(
    "wavelength_weights, zernike_coefficients_by_wavelength, expected_message",
    [
        ([], [], "wavelength_weights"),
        ([(550, 1), (650, 1)], [{}, {}], "wavelength_weights"),
        ([(450, 1), (550, 1), (650, 1), (700, 1)], [{}, {}, {}, {}], "wavelength_weights"),
        ([(550, 1)], [{}, {}], "zernike_coefficients_by_wavelength"),
        ([(550, 1), (650, 1), (450, 1)], [{}, {}], "zernike_coefficients_by_wavelength"),
    ],
)
def test_compute_simulation_rejects_invalid_channel_lengths(
    wavelength_weights: list[tuple[float, float]],
    zernike_coefficients_by_wavelength: list[dict[tuple[int, int], float]],
    expected_message: str,
) -> None:
    with pytest.raises(ValueError, match=expected_message):
        _compute_simulation(
            10,
            wavelength_weights,
            zernike_coefficients_by_wavelength,
            "siemensstar",
            pupil_samples=32,
            image_samples=64,
        )


def test_compute_simulation_rejects_invalid_wavelength_weight_pairs() -> None:
    with pytest.raises(ValueError, match="wavelength_weights"):
        _compute_simulation(
            10,
            [(550, 1, 0)],  # type: ignore[list-item]
            [{}],
            "siemensstar",
            pupil_samples=32,
            image_samples=64,
        )


@pytest.mark.parametrize(
    "wavelength_weights",
    [
        [],
        [(450, 1), (550, 1)],
        [(450, 1), (550, 1), (650, 1), (700, 1)],
        [(math.nan, 1), (550, 1), (650, 1)],
        [(-450, 1), (550, 1), (650, 1)],
        [(450, -1), (550, 1), (650, 1)],
    ],
)
def test_polychromatic_simulation_rejects_invalid_wavelength_weights(
    wavelength_weights: list[tuple[float, float]],
) -> None:
    with pytest.raises(ValueError, match="wavelength_weights"):
        compute_simulation(
            10,
            {},
            "siemensstar",
            pupil_samples=32,
            image_samples=64,
            wavelength_weights=wavelength_weights,
            zernike_coefficients_by_wavelength=[{}, {}, {}],
        )


def test_polychromatic_simulation_rejects_coefficient_length_mismatch() -> None:
    with pytest.raises(ValueError, match="zernike_coefficients_by_wavelength"):
        compute_simulation(
            10,
            {},
            "siemensstar",
            pupil_samples=32,
            image_samples=64,
            wavelength_weights=[(450, 1), (550, 1), (650, 1)],
            zernike_coefficients_by_wavelength=[{}, {}],
        )


def test_polychromatic_point_source_maps_longest_middle_shortest_to_rgb() -> None:
    simulation = compute_simulation(
        10,
        {},
        "point_source",
        pupil_samples=32,
        image_samples=64,
        wavelength_weights=[(550, 0.2), (650, 0.7), (450, 0.4)],
        zernike_coefficients_by_wavelength=[{}, {}, {}],
    )

    assert simulation.convolved_image.shape == (64, 64, 3)
    assert simulation.convolved_image[..., 0].max() == pytest.approx(0.7)
    assert simulation.convolved_image[..., 1].max() == pytest.approx(0.2)
    assert simulation.convolved_image[..., 2].max() == pytest.approx(0.4)
    assert simulation.sampling.wavelength_nm == 550


def test_polychromatic_non_jupiter_output_is_linear_rgb() -> None:
    simulation = compute_simulation(
        10,
        {},
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
        wavelength_weights=[(650, 1), (550, 0.5), (450, 0.25)],
        zernike_coefficients_by_wavelength=[{}, {}, {}],
    )

    assert simulation.convolved_image.shape == (64, 64, 3)
    assert simulation.convolved_image.min() >= 0
    assert simulation.convolved_image.max() <= 1
    assert simulation.target.shape == (64, 64)


def test_polychromatic_zernike_mappings_are_used_per_channel() -> None:
    wavelength_weights = [(650, 1), (550, 1), (450, 1)]
    coefficients = [{(4, 0): 0.05}, {(4, 0): 0.15}, {(4, 0): 0.25}]
    simulation = compute_simulation(
        10,
        {},
        "point_source",
        pupil_samples=32,
        image_samples=64,
        wavelength_weights=wavelength_weights,
        zernike_coefficients_by_wavelength=coefficients,
    )

    for channel, (wavelength_nm, coefficient_mapping) in enumerate(
        [(650, coefficients[0]), (550, coefficients[1]), (450, coefficients[2])]
    ):
        monochrome = compute_simulation(
            10,
            coefficient_mapping,
            "point_source",
            wavelength_nm=wavelength_nm,
            pupil_samples=32,
            image_samples=64,
            image_dx_arcmin=simulation.sampling.image_dx_arcmin,
        )
        assert simulation.convolved_image[..., channel] == pytest.approx(
            monochrome.convolved_image
        )

    assert simulation.inputs.zernike_coefficients == coefficients[1]
    green_monochrome = compute_simulation(
        10,
        coefficients[1],
        "point_source",
        wavelength_nm=550,
        pupil_samples=32,
        image_samples=64,
        image_dx_arcmin=simulation.sampling.image_dx_arcmin,
    )
    assert simulation.wavefront_nm == pytest.approx(green_monochrome.wavefront_nm)


@pytest.mark.parametrize(
    "diagnostic_wavelength_nm, coefficient_mapping",
    [
        (656, {(4, 0): 0.05}),
        (550, {(4, 0): 0.15}),
        (486, {(4, 0): 0.25}),
    ],
)
def test_polychromatic_diagnostics_can_select_wavelength_channel(
    diagnostic_wavelength_nm: float,
    coefficient_mapping: dict[tuple[int, int], float],
) -> None:
    image_dx_arcmin = 0.25
    simulation = compute_simulation(
        10,
        {},
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
        image_dx_arcmin=image_dx_arcmin,
        wavelength_weights=[(550, 1), (656, 1), (486, 1)],
        zernike_coefficients_by_wavelength=[
            {(4, 0): 0.15},
            {(4, 0): 0.05},
            {(4, 0): 0.25},
        ],
        diagnostic_wavelength_nm=diagnostic_wavelength_nm,
    )
    monochrome = compute_simulation(
        10,
        coefficient_mapping,
        "siemensstar",
        wavelength_nm=diagnostic_wavelength_nm,
        pupil_samples=32,
        image_samples=64,
        image_dx_arcmin=image_dx_arcmin,
    )

    assert simulation.sampling.wavelength_nm == diagnostic_wavelength_nm
    assert simulation.inputs.zernike_coefficients == coefficient_mapping
    assert simulation.psf == pytest.approx(monochrome.psf)
    assert simulation.wavefront_nm == pytest.approx(monochrome.wavefront_nm)


def test_polychromatic_diagnostics_default_to_middle_channel() -> None:
    simulation = compute_simulation(
        10,
        {},
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
        wavelength_weights=[(656, 1), (550, 1), (486, 1)],
        zernike_coefficients_by_wavelength=[
            {(4, 0): 0.05},
            {(4, 0): 0.15},
            {(4, 0): 0.25},
        ],
    )

    assert simulation.sampling.wavelength_nm == 550
    assert simulation.inputs.zernike_coefficients == {(4, 0): 0.15}


def test_polychromatic_diagnostics_reject_unknown_wavelength() -> None:
    with pytest.raises(ValueError, match="diagnostic_wavelength_nm"):
        compute_simulation(
            10,
            {},
            "siemensstar",
            pupil_samples=32,
            image_samples=64,
            wavelength_weights=[(656, 1), (550, 1), (486, 1)],
            zernike_coefficients_by_wavelength=[{}, {}, {}],
            diagnostic_wavelength_nm=600,
        )


def test_jupiter_polychromatic_target_uses_rgb_wavelength_assets() -> None:
    red_target = targets._make_jupiter_target(
        "jupiter_658nm.npz",
        (128, 128),
        image_dx_arcmin=JUPITER_502NM_DIAMETER_ARCMIN / 64,
    )
    green_target = targets._make_jupiter_target(
        "jupiter_502nm.npz",
        (128, 128),
        image_dx_arcmin=JUPITER_502NM_DIAMETER_ARCMIN / 64,
    )
    blue_target = targets._make_jupiter_target(
        "jupiter_395nm.npz",
        (128, 128),
        image_dx_arcmin=JUPITER_502NM_DIAMETER_ARCMIN / 64,
    )

    assert not np.array_equal(red_target, green_target)
    assert not np.array_equal(green_target, blue_target)

    simulation = compute_simulation(
        10,
        {},
        "jupiter",
        pupil_samples=32,
        image_samples=128,
        image_dx_arcmin=JUPITER_502NM_DIAMETER_ARCMIN / 64,
        wavelength_weights=[(658, 1), (502, 1), (395, 1)],
        zernike_coefficients_by_wavelength=[{}, {}, {}],
    )

    assert simulation.convolved_image.shape == (128, 128, 3)
    assert simulation.target.shape == (128, 128, 3)
    assert simulation.target[..., 0] == pytest.approx(red_target)
    assert simulation.target[..., 1] == pytest.approx(green_target)
    assert simulation.target[..., 2] == pytest.approx(blue_target)


def test_jupiter_polychromatic_target_registers_rgb_channel_disks() -> None:
    target = targets._make_jupiter_rgb_target(
        (128, 128),
        image_dx_arcmin=JUPITER_502NM_DIAMETER_ARCMIN / 64,
    )

    bboxes = [_target_bbox(target[..., channel]) for channel in range(3)]
    centers = [
        ndimage.center_of_mass(target[..., channel] > 0.05) for channel in range(3)
    ]
    heights = [y_max - y_min + 1 for y_min, _, y_max, _ in bboxes]
    widths = [x_max - x_min + 1 for _, x_min, _, x_max in bboxes]

    for center_y, center_x in centers:
        assert center_y == pytest.approx(centers[1][0], abs=1)
        assert center_x == pytest.approx(centers[1][1], abs=1)

    assert max(heights) - min(heights) <= 1
    assert max(widths) - min(widths) <= 1


def test_default_aperture_is_unobstructed_circle() -> None:
    default_simulation = compute_simulation(
        10,
        {},
        "point_source",
        pupil_samples=64,
        image_samples=128,
    )
    explicit_simulation = compute_simulation(
        10,
        {},
        "point_source",
        pupil_samples=64,
        image_samples=128,
        aperture=ApertureSpec(central_obstruction_ratio=0),
    )

    assert default_simulation.inputs.aperture == ApertureSpec(
        shape="circle",
        central_obstruction_ratio=0,
    )
    assert np.array_equal(default_simulation.pupil_mask, explicit_simulation.pupil_mask)
    assert np.array_equal(default_simulation.wavefront_nm, explicit_simulation.wavefront_nm)


def test_central_obstruction_masks_center_and_keeps_outputs_valid() -> None:
    simulation = compute_simulation(
        10,
        {(4, 0): 0.1},
        "point_source",
        pupil_samples=64,
        image_samples=128,
        aperture=ApertureSpec(central_obstruction_ratio=0.35),
    )

    center = simulation.pupil_mask.shape[0] // 2

    assert not simulation.pupil_mask[center, center]
    assert simulation.inputs.aperture == ApertureSpec(
        shape="circle",
        central_obstruction_ratio=0.35,
    )
    assert np.isclose(simulation.psf.sum(), 1)
    assert np.isfinite(simulation.convolved_image).all()
    assert np.isfinite(simulation.wavefront_nm).all()
    assert simulation.wavefront_nm[center, center] == 0


def test_gaussian_apodization_produces_non_binary_amplitude_and_valid_psf() -> None:
    aperture = ApertureSpec(
        gaussian_apodization_enabled=True,
        gaussian_apodization_sigma_ratio=0.5,
    )
    axis = np.linspace(-5, 5, 64)
    x, y = np.meshgrid(axis, axis)
    radius = np.sqrt(x**2 + y**2)
    amplitude = aperture.amplitude(5, x, y, radius)
    simulation = compute_simulation(
        10,
        {},
        "point_source",
        pupil_samples=64,
        image_samples=128,
        aperture=aperture,
    )

    inside_values = amplitude[amplitude > 0]

    assert inside_values.min() > 0
    assert inside_values.max() <= 1
    assert np.unique(np.round(inside_values, decimals=6)).size > 2
    assert np.isclose(simulation.psf.sum(), 1)
    assert np.isfinite(simulation.convolved_image).all()
    assert np.isfinite(simulation.wavefront_nm).all()


def test_spider_vanes_mask_aperture_pixels_and_keep_outputs_valid() -> None:
    aperture = ApertureSpec(
        spider_vane_count=4,
        spider_vane_width_ratio=0.02,
    )
    axis = np.linspace(-5, 5, 128)
    x, y = np.meshgrid(axis, axis)
    radius = np.sqrt(x**2 + y**2)
    amplitude = aperture.amplitude(5, x, y, radius)
    default_amplitude = ApertureSpec().amplitude(5, x, y, radius)
    simulation = compute_simulation(
        10,
        {(4, 0): 0.1},
        "point_source",
        pupil_samples=64,
        image_samples=128,
        aperture=aperture,
    )

    assert np.count_nonzero((default_amplitude > 0) & (amplitude == 0)) > 0
    assert amplitude.sum() < default_amplitude.sum()
    assert amplitude.sum() > default_amplitude.sum() * 0.8
    assert np.isclose(simulation.psf.sum(), 1)
    assert np.isfinite(simulation.convolved_image).all()
    assert np.isfinite(simulation.wavefront_nm).all()


def test_spider_vane_rotation_changes_aperture_mask() -> None:
    default_aperture = ApertureSpec(
        spider_vane_count=4,
        spider_vane_width_ratio=0.02,
    )
    rotated_aperture = ApertureSpec(
        spider_vane_count=4,
        spider_vane_width_ratio=0.02,
        spider_vane_rotation_degrees=30,
    )
    axis = np.linspace(-5, 5, 128)
    x, y = np.meshgrid(axis, axis)
    radius = np.sqrt(x**2 + y**2)

    default_amplitude = default_aperture.amplitude(5, x, y, radius)
    rotated_amplitude = rotated_aperture.amplitude(5, x, y, radius)

    assert not np.array_equal(default_amplitude, rotated_amplitude)
    assert default_aperture.validated().spider_vane_rotation_degrees == 0
    assert rotated_aperture.validated().spider_vane_rotation_degrees == 30
    assert (
        ApertureSpec(spider_vane_rotation_degrees=360)
        .validated()
        .spider_vane_rotation_degrees
        == 0
    )


@pytest.mark.parametrize(
    "aperture",
    [
        ApertureSpec(spider_vane_count=0, spider_vane_width_ratio=0.02),
        ApertureSpec(spider_vane_count=4, spider_vane_width_ratio=0),
    ],
)
def test_inactive_spider_config_matches_default_unobstructed_aperture(
    aperture: ApertureSpec,
) -> None:
    default_simulation = compute_simulation(
        10,
        {},
        "point_source",
        pupil_samples=64,
        image_samples=128,
    )
    spider_simulation = compute_simulation(
        10,
        {},
        "point_source",
        pupil_samples=64,
        image_samples=128,
        aperture=aperture,
    )

    assert np.array_equal(default_simulation.pupil_mask, spider_simulation.pupil_mask)
    assert np.array_equal(default_simulation.wavefront_nm, spider_simulation.wavefront_nm)


def test_square_aperture_differs_from_circle_and_keeps_outputs_valid() -> None:
    circle = compute_simulation(
        10,
        {},
        "point_source",
        pupil_samples=64,
        image_samples=128,
    )
    square = compute_simulation(
        10,
        {},
        "point_source",
        pupil_samples=64,
        image_samples=128,
        aperture=ApertureSpec(shape="square", rotation_degrees=45),
    )

    assert not np.array_equal(circle.pupil_mask, square.pupil_mask)
    assert np.isclose(square.psf.sum(), 1)
    assert np.isfinite(square.convolved_image).all()
    assert np.isfinite(square.wavefront_nm).all()


def test_regular_hexagon_aperture_uses_polygon_path_and_keeps_outputs_valid(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from prysm import geometry

    calls: list[tuple[int, float]] = []
    original_regular_polygon = geometry.regular_polygon

    def recording_regular_polygon(*args, **kwargs):
        calls.append((args[0], kwargs["rotation"]))
        return original_regular_polygon(*args, **kwargs)

    monkeypatch.setattr(geometry, "regular_polygon", recording_regular_polygon)
    simulation = compute_simulation(
        10,
        {},
        "point_source",
        pupil_samples=64,
        image_samples=128,
        aperture=ApertureSpec(shape="regular_hexagon", rotation_degrees=30),
    )

    assert calls == [(6, 30)]
    assert np.isclose(simulation.psf.sum(), 1)
    assert np.isfinite(simulation.convolved_image).all()
    assert np.isfinite(simulation.wavefront_nm).all()


@pytest.mark.parametrize(
    "aperture",
    [
        ApertureSpec(
            shape="square",
            central_obstruction_ratio=0.35,
            central_obstruction_shape="square",
            central_obstruction_rotation_degrees=45,
        ),
        ApertureSpec(
            shape="regular_hexagon",
            central_obstruction_ratio=0.35,
            central_obstruction_shape="regular_hexagon",
            central_obstruction_rotation_degrees=30,
        ),
    ],
)
def test_shaped_central_obstructions_mask_center_and_keep_outputs_valid(
    aperture: ApertureSpec,
) -> None:
    simulation = compute_simulation(
        10,
        {(4, 0): 0.1},
        "point_source",
        pupil_samples=64,
        image_samples=128,
        aperture=aperture,
    )

    center = simulation.pupil_mask.shape[0] // 2

    assert not simulation.pupil_mask[center, center]
    assert np.isclose(simulation.psf.sum(), 1)
    assert np.isfinite(simulation.convolved_image).all()
    assert np.isfinite(simulation.wavefront_nm).all()
    assert simulation.wavefront_nm[center, center] == 0


@pytest.mark.parametrize(
    "aperture",
    [
        ApertureSpec(
            shape="square",
            central_obstruction_ratio=0.35,
            central_obstruction_shape="square",
            central_obstruction_rotation_degrees=45,
            gaussian_apodization_enabled=True,
            gaussian_apodization_sigma_ratio=0.5,
        ),
        ApertureSpec(
            shape="regular_hexagon",
            central_obstruction_ratio=0.35,
            central_obstruction_shape="regular_hexagon",
            central_obstruction_rotation_degrees=30,
            gaussian_apodization_enabled=True,
            gaussian_apodization_sigma_ratio=0.5,
        ),
    ],
)
def test_apodized_shaped_central_obstructions_mask_center_and_keep_outputs_valid(
    aperture: ApertureSpec,
) -> None:
    simulation = compute_simulation(
        10,
        {(4, 0): 0.1},
        "point_source",
        pupil_samples=64,
        image_samples=128,
        aperture=aperture,
    )

    center = simulation.pupil_mask.shape[0] // 2

    assert not simulation.pupil_mask[center, center]
    assert np.isclose(simulation.psf.sum(), 1)
    assert np.isfinite(simulation.convolved_image).all()
    assert np.isfinite(simulation.wavefront_nm).all()
    assert simulation.wavefront_nm[center, center] == 0


@pytest.mark.parametrize(
    "aperture",
    [
        ApertureSpec(shape="hex"),
        ApertureSpec(central_obstruction_ratio=-0.1),
        ApertureSpec(central_obstruction_ratio=1),
        ApertureSpec(central_obstruction_ratio=math.inf),
        ApertureSpec(rotation_degrees=-1),
        ApertureSpec(rotation_degrees=math.inf),
        ApertureSpec(central_obstruction_shape="hex"),
        ApertureSpec(central_obstruction_ratio=0.2, central_obstruction_rotation_degrees=-1),
        ApertureSpec(
            gaussian_apodization_enabled=True,
            gaussian_apodization_sigma_ratio=0.04,
        ),
        ApertureSpec(
            gaussian_apodization_enabled=True,
            gaussian_apodization_sigma_ratio=1.01,
        ),
        ApertureSpec(
            gaussian_apodization_enabled=True,
            gaussian_apodization_sigma_ratio=math.inf,
        ),
        ApertureSpec(spider_vane_count=-1),
        ApertureSpec(spider_vane_count=13),
        ApertureSpec(spider_vane_count=1.5),
        ApertureSpec(spider_vane_count=math.inf),
        ApertureSpec(spider_vane_width_ratio=-0.01),
        ApertureSpec(spider_vane_width_ratio=0.26),
        ApertureSpec(spider_vane_width_ratio=math.inf),
        ApertureSpec(spider_vane_rotation_degrees=-1),
        ApertureSpec(spider_vane_rotation_degrees=361),
        ApertureSpec(spider_vane_rotation_degrees=math.inf),
    ],
)
def test_aperture_spec_rejects_invalid_values(aperture: ApertureSpec) -> None:
    with pytest.raises(ValueError):
        aperture.validated()


@pytest.mark.parametrize(
    "aperture",
    [
        ApertureSpec(),
        ApertureSpec(central_obstruction_ratio=0.35),
        ApertureSpec(
            gaussian_apodization_enabled=True,
            gaussian_apodization_sigma_ratio=0.5,
        ),
        ApertureSpec(spider_vane_count=4, spider_vane_width_ratio=0.02),
    ],
)
def test_render_aperture_mask_returns_png_bytes(aperture: ApertureSpec) -> None:
    image_bytes = render_aperture_mask(aperture)

    assert image_bytes.startswith(b"\x89PNG")
    assert len(image_bytes) > 1000


def test_aperture_mask_png_has_no_white_figure_border() -> None:
    png_bytes = render_aperture_mask(ApertureSpec(), image_format="png")
    pixels = _png_pixels(png_bytes)

    corner_pixels = pixels[[0, 0, -1, -1], [0, -1, 0, -1], :3]

    assert png_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    assert not np.allclose(corner_pixels, 1.0, atol=1 / 255)


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
    expected_height_fraction = 0.125
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
        round(round(image_samples * expected_height_fraction) / 5),
    )

    assert height_px == 5 * expected_block_px
    assert width_px == height_px
    assert height_px == pytest.approx(
        image_samples * expected_height_fraction,
        abs=3,
    )
    assert SNELLEN_E_DEFAULT_IMAGE_HEIGHT_FRACTION == expected_height_fraction
    assert simulation.sampling.image_dx_arcmin == pytest.approx(1 / expected_block_px)


def test_snellen_e_20_20_default_sampling_records_angular_spacing() -> None:
    expected_height_fraction = 0.125
    simulation = compute_simulation(
        300,
        {},
        "snellen_e_20_20",
        pupil_samples=64,
        image_samples=128,
    )

    expected_block_px = max(
        1,
        round(round(128 * expected_height_fraction) / 5),
    )

    assert _target_size_px(simulation.target) == (
        5 * expected_block_px,
        5 * expected_block_px,
    )
    assert SNELLEN_E_DEFAULT_IMAGE_HEIGHT_FRACTION == expected_height_fraction
    assert simulation.sampling.image_dx_arcmin == pytest.approx(1 / expected_block_px)


def test_snellen_e_20_20_inverted_matches_original_footprint() -> None:
    original = compute_simulation(
        10,
        {},
        "snellen_e_20_20",
        pupil_samples=32,
        image_samples=64,
        image_dx_arcmin=0.25,
    )
    inverted = compute_simulation(
        10,
        {},
        "snellen_e_20_20_inverted",
        pupil_samples=32,
        image_samples=64,
        image_dx_arcmin=0.25,
    )

    assert "snellen_e_20_20_inverted" in SUPPORTED_TARGET_IDS
    assert inverted.target_id == "snellen_e_20_20_inverted"
    assert _target_size_px(inverted.target) == _target_size_px(original.target)
    np.testing.assert_allclose(inverted.target, 1 - original.target)


def test_snellen_e_20_20_inverted_preserves_default_angular_sampling() -> None:
    original = compute_simulation(
        300,
        {},
        "snellen_e_20_20",
        pupil_samples=64,
        image_samples=128,
    )
    inverted = compute_simulation(
        300,
        {},
        "snellen_e_20_20_inverted",
        pupil_samples=64,
        image_samples=128,
    )

    assert inverted.sampling.image_dx_arcmin == pytest.approx(
        original.sampling.image_dx_arcmin
    )
    assert _target_size_px(inverted.target) == _target_size_px(original.target)
    np.testing.assert_allclose(inverted.target, 1 - original.target)


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


def test_logmar_chart_inverted_matches_original_footprint() -> None:
    original = compute_simulation(
        10,
        {},
        "logmar_chart",
        pupil_samples=32,
        image_samples=512,
    )
    inverted = compute_simulation(
        10,
        {},
        "logmar_chart_inverted",
        pupil_samples=32,
        image_samples=512,
    )

    assert "logmar_chart_inverted" in SUPPORTED_TARGET_IDS
    assert inverted.target_id == "logmar_chart_inverted"
    assert _target_size_px(inverted.target) == _target_size_px(original.target)
    np.testing.assert_allclose(inverted.target, 1 - original.target)


def test_jupiter_uses_supported_target_id() -> None:
    simulation = compute_simulation(
        10,
        {},
        "jupiter",
        pupil_samples=32,
        image_samples=512,
    )

    assert "jupiter" in SUPPORTED_TARGET_IDS
    assert "jupiter_502nm" not in SUPPORTED_TARGET_IDS
    assert simulation.target_id == "jupiter"
    assert simulation.target.shape == (512, 512)
    assert simulation.psf.shape == (512, 512)
    assert simulation.convolved_image.shape == (512, 512)


def test_jupiter_uses_fifty_arcsecond_diameter() -> None:
    image_dx_arcmin = 0.005
    simulation = compute_simulation(
        10,
        {},
        "jupiter",
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


def test_jupiter_default_diameter_tracks_image_samples() -> None:
    simulation = compute_simulation(
        10,
        {},
        "jupiter",
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


def test_jupiter_contains_smooth_grayscale_detail() -> None:
    simulation = compute_simulation(
        10,
        {},
        "jupiter",
        pupil_samples=32,
        image_samples=256,
    )

    intermediate_values = simulation.target[
        (simulation.target > 0.05) & (simulation.target < 0.95)
    ]

    assert intermediate_values.size > 1_000
    assert np.unique(np.round(intermediate_values, 3)).size > 100


def test_jupiter_is_centered_and_fits_grid() -> None:
    simulation = compute_simulation(
        10,
        {},
        "jupiter",
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


def test_wide_point_source_uses_supported_target_id() -> None:
    simulation = compute_simulation(
        10,
        {},
        "wide_point_source",
        pupil_samples=32,
        image_samples=64,
    )

    assert "wide_point_source" in SUPPORTED_TARGET_IDS
    assert simulation.target_id == "wide_point_source"
    assert simulation.target.shape == (64, 64)
    assert simulation.psf.shape == (64, 64)
    assert simulation.convolved_image.shape == (64, 64)


def test_wide_point_source_default_sampling_is_four_times_point_source_sampling() -> None:
    wavelength_nm = 550
    point_source = compute_simulation(
        10,
        {},
        "point_source",
        wavelength_nm=wavelength_nm,
        pupil_samples=32,
        image_samples=128,
    )
    wide_point_source = compute_simulation(
        10,
        {},
        "wide_point_source",
        wavelength_nm=wavelength_nm,
        pupil_samples=32,
        image_samples=128,
    )

    assert wide_point_source.sampling.image_dx_arcmin == pytest.approx(
        4 * point_source.sampling.image_dx_arcmin
    )


@pytest.mark.parametrize("aperture_mm", [3, 60])
def test_wide_point_source_default_sampling_tracks_airy_diameter(
    aperture_mm: float,
) -> None:
    wavelength_nm = 550
    simulation = compute_simulation(
        aperture_mm,
        {},
        "wide_point_source",
        wavelength_nm=wavelength_nm,
        pupil_samples=32,
        image_samples=128,
    )

    airy_diameter_arcmin = math.degrees(
        2 * 1.22 * (wavelength_nm * 1e-6) / aperture_mm
    ) * 60

    assert airy_diameter_arcmin / simulation.sampling.image_dx_arcmin == pytest.approx(
        16
    )


def test_wide_point_source_default_sampling_changes_with_aperture() -> None:
    small_aperture = compute_simulation(
        3,
        {},
        "wide_point_source",
        pupil_samples=32,
        image_samples=128,
    )
    large_aperture = compute_simulation(
        6,
        {},
        "wide_point_source",
        pupil_samples=32,
        image_samples=128,
    )

    assert small_aperture.sampling.image_dx_arcmin == pytest.approx(
        large_aperture.sampling.image_dx_arcmin * 2
    )


def test_wide_point_source_convolved_image_is_display_normalized_psf() -> None:
    simulation = compute_simulation(
        10,
        {},
        "wide_point_source",
        pupil_samples=32,
        image_samples=128,
    )

    assert simulation.convolved_image.shape == simulation.psf.shape
    assert simulation.convolved_image.max() == pytest.approx(1)
    assert simulation.convolved_image == pytest.approx(simulation.psf / simulation.psf.max())


def test_wide_point_source_explicit_sampling_overrides_wide_default() -> None:
    simulation = compute_simulation(
        10,
        {},
        "wide_point_source",
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
    assert render_mtf(simulation, image_format="png").startswith(b"\x89PNG\r\n\x1a\n")
    assert render_wavefront(simulation, image_format="svg").lstrip().startswith(b"<?xml")
    assert render_psf(simulation, image_format="svg").lstrip().startswith(b"<?xml")
    assert render_convolved_image(simulation, image_format="svg").lstrip().startswith(b"<?xml")
    assert render_mtf(simulation, image_format="svg").lstrip().startswith(b"<?xml")


def test_compute_simulation_returns_finite_mtf_data() -> None:
    simulation = compute_simulation(
        10,
        {(4, 0): 0.1},
        "tiltedsquare",
        pupil_samples=32,
        image_samples=64,
    )

    mtf_data = simulation.mtf
    lengths = {
        len(mtf_data.spatial_frequency_cycles_per_mm),
        len(mtf_data.x_mtf),
        len(mtf_data.y_mtf),
        len(mtf_data.azimuthal_average_mtf),
    }

    assert lengths == {len(mtf_data.spatial_frequency_cycles_per_mm)}
    assert len(mtf_data.spatial_frequency_cycles_per_mm) > 2
    assert np.all(np.isfinite(mtf_data.spatial_frequency_cycles_per_mm))
    assert np.all(np.isfinite(mtf_data.x_mtf))
    assert np.all(np.isfinite(mtf_data.y_mtf))
    assert np.all(np.isfinite(mtf_data.azimuthal_average_mtf))
    assert mtf_data.spatial_frequency_cycles_per_mm[0] == pytest.approx(0)
    assert np.all(np.diff(mtf_data.spatial_frequency_cycles_per_mm) >= 0)


def test_compute_simulation_mtf_sampling_reaches_dawes_limit_for_coarse_targets() -> None:
    simulation = compute_simulation(
        6,
        {},
        "logmar_chart",
        pupil_samples=32,
        image_samples=512,
    )
    dawes_arcsec = 116 / simulation.inputs.entrance_pupil_diameter_mm
    dawes_radians = math.radians(dawes_arcsec / 3600)
    image_plane_separation_mm = (
        simulation.inputs.effective_focal_length_mm * math.tan(dawes_radians)
    )
    dawes_frequency_cycles_per_mm = 1 / image_plane_separation_mm

    assert (
        simulation.mtf.spatial_frequency_cycles_per_mm[-1]
        >= dawes_frequency_cycles_per_mm * 1.1
    )
    assert (
        np.interp(
            dawes_frequency_cycles_per_mm,
            simulation.mtf.spatial_frequency_cycles_per_mm,
            simulation.mtf.azimuthal_average_mtf,
        )
        < 0.05
    )


def test_compute_simulation_mtf_is_target_independent_for_unaberrated_aperture() -> None:
    jupiter = compute_simulation(
        6,
        {},
        "jupiter",
        pupil_samples=32,
        image_samples=512,
        wavelength_nm=550,
    )
    logmar_chart = compute_simulation(
        6,
        {},
        "logmar_chart",
        pupil_samples=32,
        image_samples=512,
        wavelength_nm=550,
    )
    fno = (
        jupiter.inputs.effective_focal_length_mm
        / jupiter.inputs.entrance_pupil_diameter_mm
    )
    ideal_mtf = diffraction_limited_mtf(
        fno,
        jupiter.sampling.wavelength_nm / 1000,
        jupiter.mtf.spatial_frequency_cycles_per_mm,
    )

    assert jupiter.mtf.spatial_frequency_cycles_per_mm == pytest.approx(
        logmar_chart.mtf.spatial_frequency_cycles_per_mm
    )
    assert jupiter.mtf.x_mtf == pytest.approx(logmar_chart.mtf.x_mtf)
    assert jupiter.mtf.y_mtf == pytest.approx(logmar_chart.mtf.y_mtf)
    assert jupiter.mtf.azimuthal_average_mtf == pytest.approx(
        logmar_chart.mtf.azimuthal_average_mtf
    )
    assert jupiter.mtf.azimuthal_average_mtf == pytest.approx(ideal_mtf, abs=0.08)


def test_rgb_convolved_image_renderer_can_show_scale_bar() -> None:
    simulation = compute_simulation(
        10,
        {},
        "siemensstar",
        pupil_samples=32,
        image_samples=64,
        wavelength_weights=[(650, 1), (550, 1), (450, 1)],
        zernike_coefficients_by_wavelength=[{}, {}, {}],
    )

    assert simulation.convolved_image.shape == (64, 64, 3)
    assert render_convolved_image(
        simulation,
        image_format="png",
        show_scale_bar=True,
    ).startswith(b"\x89PNG\r\n\x1a\n")


@pytest.mark.parametrize("edge_value", [0.0, 0.85])
def test_convolved_image_png_has_no_white_figure_border(edge_value: float) -> None:
    simulation = compute_simulation(
        10,
        {},
        "tiltedsquare",
        pupil_samples=32,
        image_samples=64,
    )
    convolved_image = np.full((64, 64), edge_value, dtype=float)
    convolved_image[20:44, 20:44] = 1 - edge_value
    simulation = replace(simulation, convolved_image=convolved_image)

    png_bytes = render_convolved_image(simulation, image_format="png")
    pixels = _png_pixels(png_bytes)

    assert png_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    assert len(png_bytes) > 100
    assert pixels.shape[0] == pixels.shape[1]
    assert not np.allclose(_outer_pixels(pixels), 1.0, atol=1 / 255)


def test_convolved_image_borderless_png_keeps_scale_bar_rendering() -> None:
    simulation = compute_simulation(
        10,
        {},
        "tiltedsquare",
        pupil_samples=32,
        image_samples=64,
    )
    simulation = replace(simulation, convolved_image=np.zeros((64, 64), dtype=float))

    png_bytes = render_convolved_image(
        simulation,
        image_format="png",
        show_scale_bar=True,
    )
    pixels = _png_pixels(png_bytes)

    assert png_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    assert len(png_bytes) > 100
    assert pixels.shape[0] == pixels.shape[1]
    assert pixels[..., :3].max() > 0.9


def test_supported_targets_keep_same_convolved_grid_with_current_visible_sizes() -> None:
    visible_sizes = {}
    for target_id in sorted(SUPPORTED_TARGET_IDS):
        simulation = compute_simulation(
            10,
            {},
            target_id,
            pupil_samples=32,
            image_samples=128,
        )

        assert simulation.convolved_image.shape == (128, 128)
        visible_sizes[target_id] = _visible_content_bbox(simulation.target)

    assert visible_sizes == {
        "jupiter": (90, 90),
        "logmar_chart": (76, 104),
        "logmar_chart_inverted": (76, 104),
        "point_source": (1, 1),
        "siemensstar": (101, 101),
        "slantededge": (128, 68),
        "snellen_e_20_20": (15, 15),
        "snellen_e_20_20_inverted": (15, 15),
        "tiltedsquare": (47, 47),
        "wide_point_source": (1, 1),
    }


@pytest.mark.parametrize(
    ("renderer", "figure_to_bytes_path", "expected_figure_size"),
    [
        (
            render_convolved_image,
            "hoa_visualizer_utils.rendering.convolved_image._figure_to_bytes",
            (10, 10),
        ),
        (render_psf, "hoa_visualizer_utils.rendering.psf._figure_to_bytes", (10, 9)),
        (
            render_wavefront,
            "hoa_visualizer_utils.rendering.wavefront._figure_to_bytes",
            (10, 9),
        ),
        (
            render_mtf,
            "hoa_visualizer_utils.rendering.mtf._figure_to_bytes",
            (10, 9),
        ),
    ],
)
def test_render_helpers_use_large_default_figure_size(
    monkeypatch: pytest.MonkeyPatch,
    renderer,
    figure_to_bytes_path: str,
    expected_figure_size: tuple[int, int],
) -> None:
    simulation = compute_simulation(
        10,
        {},
        "tiltedsquare",
        pupil_samples=32,
        image_samples=64,
    )
    rendered_figures = []

    def figure_to_bytes(fig, image_format):
        rendered_figures.append(fig)
        return b"rendered"

    monkeypatch.setattr(figure_to_bytes_path, figure_to_bytes)

    assert renderer(simulation, image_format="png") == b"rendered"

    fig = rendered_figures[0]
    try:
        assert tuple(fig.get_size_inches()) == pytest.approx(expected_figure_size)
    finally:
        _load_pyplot().close(fig)


def test_convolved_image_renderer_can_apply_perceptual_display_scale(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    simulation = compute_simulation(
        10,
        {},
        "tiltedsquare",
        pupil_samples=32,
        image_samples=64,
    )
    linear_image = np.array([[0, 0.01], [0.25, 1]], dtype=float)
    simulation = replace(simulation, convolved_image=linear_image)
    rendered_arrays = []

    def figure_to_bytes(fig, image_format):
        rendered_arrays.append(np.asarray(fig.axes[0].images[0].get_array()))
        return b"rendered"

    monkeypatch.setattr(
        "hoa_visualizer_utils.rendering.convolved_image._figure_to_bytes",
        figure_to_bytes,
    )

    assert render_convolved_image(simulation, display_scale="perceptual") == b"rendered"

    expected = np.log1p(10 * np.clip(linear_image, 0, 1)) / np.log1p(10)
    assert rendered_arrays[0] == pytest.approx(expected)


def test_convolved_image_renderer_rejects_invalid_display_scale() -> None:
    simulation = compute_simulation(
        10,
        {},
        "tiltedsquare",
        pupil_samples=32,
        image_samples=64,
    )

    with pytest.raises(ValueError, match="display_scale"):
        render_convolved_image(simulation, display_scale="gamma")


def test_psf_renderer_uses_viridis_log_normalized_intensity_colorbar(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    simulation = compute_simulation(
        10,
        {},
        "point_source",
        pupil_samples=32,
        image_samples=64,
    )
    rendered_figures = []

    def figure_to_bytes(fig, image_format):
        rendered_figures.append(fig)
        return b"rendered"

    monkeypatch.setattr(
        "hoa_visualizer_utils.rendering.psf._figure_to_bytes",
        figure_to_bytes,
    )

    assert render_psf(simulation, image_format="png") == b"rendered"

    fig = rendered_figures[0]
    try:
        fig.canvas.draw()
        image = fig.axes[0].images[0]
        colorbar_axis = fig.axes[1]
        tick_labels = [
            tick.get_text()
            for tick in colorbar_axis.get_yticklabels()
            if tick.get_text()
        ]

        assert image.get_cmap().name == "viridis"
        assert isinstance(image.norm, LogNorm)
        assert isinstance(
            colorbar_axis.yaxis.get_major_formatter(),
            LogFormatterSciNotation,
        )
        assert colorbar_axis.get_ylabel() == "normalized intensity"
        assert "log10" not in colorbar_axis.get_ylabel()
        assert any("\\mathdefault" in tick and "10^" in tick for tick in tick_labels)
    finally:
        _load_pyplot().close(fig)


def test_wavefront_renderer_uses_waves_viridis_and_compact_tick_format(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    simulation = compute_simulation(
        10,
        {(4, 0): 0.2},
        "tiltedsquare",
        wavelength_nm=500,
        pupil_samples=32,
        image_samples=64,
    )
    rendered_figures = []

    def figure_to_bytes(fig, image_format):
        rendered_figures.append(fig)
        return b"rendered"

    monkeypatch.setattr(
        "hoa_visualizer_utils.rendering.wavefront._figure_to_bytes",
        figure_to_bytes,
    )

    assert render_wavefront(simulation, image_format="png") == b"rendered"

    fig = rendered_figures[0]
    try:
        image = fig.axes[0].images[0]
        colorbar_axis = fig.axes[1]
        plotted_wavefront = np.asarray(image.get_array())
        expected_wavefront = np.where(
            simulation.pupil_mask,
            simulation.wavefront_nm / simulation.sampling.wavelength_nm,
            np.nan,
        )
        formatter = colorbar_axis.yaxis.get_major_formatter()

        assert plotted_wavefront == pytest.approx(expected_wavefront, nan_ok=True)
        assert image.get_cmap().name == "viridis"
        assert colorbar_axis.get_ylabel() == "waves"
        assert isinstance(formatter, ScalarFormatter)
        assert formatter.get_useMathText()
        assert "\\mathdefault" in formatter(0.001, None)
        assert "10^" in formatter(0.001, None)
        assert formatter(0.1, None) == "0.1"
        assert "\\mathdefault" in formatter(1000, None)
        assert "10^" in formatter(1000, None)
    finally:
        _load_pyplot().close(fig)


def test_wavefront_renderer_can_use_microns(monkeypatch: pytest.MonkeyPatch) -> None:
    simulation = compute_simulation(
        10,
        {(4, 0): 0.2},
        "tiltedsquare",
        wavelength_nm=500,
        pupil_samples=32,
        image_samples=64,
    )
    rendered_figures = []

    def figure_to_bytes(fig, image_format):
        rendered_figures.append(fig)
        return b"rendered"

    monkeypatch.setattr(
        "hoa_visualizer_utils.rendering.wavefront._figure_to_bytes",
        figure_to_bytes,
    )

    assert render_wavefront(simulation, image_format="png", unit="micron") == b"rendered"

    fig = rendered_figures[0]
    try:
        image = fig.axes[0].images[0]
        colorbar_axis = fig.axes[1]
        plotted_wavefront = np.asarray(image.get_array())
        expected_wavefront = np.where(
            simulation.pupil_mask,
            simulation.wavefront_nm / 1000,
            np.nan,
        )

        assert plotted_wavefront == pytest.approx(expected_wavefront, nan_ok=True)
        assert colorbar_axis.get_ylabel() == "microns"
    finally:
        _load_pyplot().close(fig)


def test_wavefront_renderer_rejects_invalid_unit() -> None:
    simulation = compute_simulation(
        10,
        {},
        "tiltedsquare",
        pupil_samples=32,
        image_samples=64,
    )

    with pytest.raises(ValueError, match="Unsupported wavefront unit"):
        render_wavefront(simulation, unit="nanometer")


def test_mtf_renderer_plots_mtf_curves_and_ideal_reference_with_axis_labels(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    simulation = compute_simulation(
        10,
        {(4, 0): 0.2},
        "tiltedsquare",
        pupil_samples=32,
        image_samples=64,
    )
    rendered_figures = []

    def figure_to_bytes(fig, image_format):
        rendered_figures.append(fig)
        return b"rendered"

    monkeypatch.setattr(
        "hoa_visualizer_utils.rendering.mtf._figure_to_bytes",
        figure_to_bytes,
    )

    assert render_mtf(simulation, image_format="png") == b"rendered"

    fig = rendered_figures[0]
    try:
        ax = fig.axes[0]

        assert ax.get_xlabel() == "Spatial frequency (Dawes limit = 1)"
        assert ax.get_ylabel() == "MTF"
        assert len(ax.lines) == 4
        assert {line.get_label() for line in ax.lines} == {
            "X",
            "Y",
            "Azimuthal average",
            "Ideal",
        }
        expected_colors = {
            "X": "#0072B2",
            "Y": "#D55E00",
            "Azimuthal average": "#009E73",
            "Ideal": "#000000",
        }
        ideal_line = next(line for line in ax.lines if line.get_label() == "Ideal")

        assert {
            line.get_label(): line.get_color()
            for line in ax.lines
        } == expected_colors
        assert all(line.get_marker() == "None" for line in ax.lines)
        assert ideal_line.get_linestyle() == "--"
        assert ax.get_legend() is not None
    finally:
        _load_pyplot().close(fig)


def test_mtf_renderer_plots_prysm_diffraction_limited_ideal_reference(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    simulation = compute_simulation(
        10,
        {(4, 0): 0.2},
        "tiltedsquare",
        pupil_samples=32,
        image_samples=64,
    )
    rendered_figures = []

    def figure_to_bytes(fig, image_format):
        rendered_figures.append(fig)
        return b"rendered"

    monkeypatch.setattr(
        "hoa_visualizer_utils.rendering.mtf._figure_to_bytes",
        figure_to_bytes,
    )

    assert render_mtf(simulation, image_format="png") == b"rendered"

    fig = rendered_figures[0]
    try:
        ax = fig.axes[0]
        ideal_line = next(line for line in ax.lines if line.get_label() == "Ideal")
        fno = (
            simulation.inputs.effective_focal_length_mm
            / simulation.inputs.entrance_pupil_diameter_mm
        )
        wavelength_um = simulation.sampling.wavelength_nm / 1000

        assert ideal_line.get_ydata() == pytest.approx(
            diffraction_limited_mtf(
                fno,
                wavelength_um,
                simulation.mtf.spatial_frequency_cycles_per_mm,
            )
        )
    finally:
        _load_pyplot().close(fig)


def test_mtf_renderer_plots_spatial_frequency_in_dawes_limit_units(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    simulation = compute_simulation(
        10,
        {(4, 0): 0.2},
        "tiltedsquare",
        pupil_samples=32,
        image_samples=64,
    )
    rendered_figures = []

    def figure_to_bytes(fig, image_format):
        rendered_figures.append(fig)
        return b"rendered"

    monkeypatch.setattr(
        "hoa_visualizer_utils.rendering.mtf._figure_to_bytes",
        figure_to_bytes,
    )

    assert render_mtf(simulation, image_format="png") == b"rendered"

    fig = rendered_figures.pop()
    try:
        ax = fig.axes[0]
        dawes_arcsec = 116 / simulation.inputs.entrance_pupil_diameter_mm
        dawes_radians = math.radians(dawes_arcsec / 3600)
        image_plane_separation_mm = (
            simulation.inputs.effective_focal_length_mm * math.tan(dawes_radians)
        )
        dawes_frequency_cycles_per_mm = 1 / image_plane_separation_mm

        assert ax.lines[0].get_xdata() == pytest.approx(
            simulation.mtf.spatial_frequency_cycles_per_mm
            / dawes_frequency_cycles_per_mm
        )
        assert ax.get_xlim()[0] == pytest.approx(0)
        assert ax.get_xlim()[1] == pytest.approx(1.1)
    finally:
        _load_pyplot().close(fig)

    narrower_aperture_simulation = replace(
        simulation,
        inputs=replace(simulation.inputs, entrance_pupil_diameter_mm=5),
    )

    assert render_mtf(narrower_aperture_simulation, image_format="png") == b"rendered"

    fig = rendered_figures.pop()
    try:
        ax = fig.axes[0]
        narrower_dawes_frequency_cycles_per_mm = (
            dawes_frequency_cycles_per_mm / 2
        )
        assert ax.lines[0].get_xdata() == pytest.approx(
            narrower_aperture_simulation.mtf.spatial_frequency_cycles_per_mm
            / narrower_dawes_frequency_cycles_per_mm
        )
        assert ax.get_xlim()[0] == pytest.approx(0)
        assert ax.get_xlim()[1] == pytest.approx(1.1)
    finally:
        _load_pyplot().close(fig)


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


def test_convolved_image_and_psf_renderers_can_show_scale_bar(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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

    render_convolved_image(simulation, image_format="png", show_scale_bar=True)
    render_psf(simulation, image_format="png", show_scale_bar=True)

    assert [call[1] for call in calls] == [simulation, simulation]


def test_convolved_image_and_psf_renderers_hide_scale_bar_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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

    assert calls == []


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
