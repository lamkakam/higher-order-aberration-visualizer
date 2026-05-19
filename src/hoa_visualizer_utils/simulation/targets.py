"""Target image generation for optical simulations."""

from __future__ import annotations

import math
from functools import lru_cache
from importlib import resources

import numpy as np
from numpy.typing import NDArray
from scipy import ndimage

SUPPORTED_TARGET_IDS = frozenset(
    {
        "siemensstar",
        "slantededge",
        "tiltedsquare",
        "snellen_e_20_20",
        "snellen_e_20_20_inverted",
        "logmar_chart",
        "logmar_chart_inverted",
        "jupiter",
        "point_source",
    }
)

JUPITER_502NM_DIAMETER_ARCMIN = 50 / 60

_LOGMAR_ROWS = (
    ("HVZDS", 1.0),
    ("NCVKD", 0.9),
    ("CZSHN", 0.8),
    ("ONVSR", 0.7),
    ("KDNRO", 0.6),
    ("ZKCSV", 0.5),
)
_LOGMAR_ANTIALIASING_FACTOR = 4
_JUPITER_DISK_THRESHOLD = 0.2

_VECTOR_OPTOTYPE_STROKES = {
    "C": (
        ((0.5, 0.5), (4.5, 0.5)),
        ((0.5, 0.5), (0.5, 4.5)),
        ((0.5, 4.5), (4.5, 4.5)),
    ),
    "D": (
        ((0.5, 0.5), (0.5, 4.5)),
        ((0.5, 0.5), (3.5, 0.5)),
        ((3.5, 0.5), (4.5, 1.5)),
        ((4.5, 1.5), (4.5, 3.5)),
        ((4.5, 3.5), (3.5, 4.5)),
        ((0.5, 4.5), (3.5, 4.5)),
    ),
    "H": (
        ((0.5, 0.5), (0.5, 4.5)),
        ((4.5, 0.5), (4.5, 4.5)),
        ((0.5, 2.5), (4.5, 2.5)),
    ),
    "K": (
        ((0.5, 0.5), (0.5, 4.5)),
        ((4.5, 0.5), (0.5, 2.5)),
        ((0.5, 2.5), (4.5, 4.5)),
    ),
    "N": (
        ((0.5, 0.5), (0.5, 4.5)),
        ((0.5, 0.5), (4.5, 4.5)),
        ((4.5, 0.5), (4.5, 4.5)),
    ),
    "O": (
        ((0.5, 0.5), (4.5, 0.5)),
        ((4.5, 0.5), (4.5, 4.5)),
        ((4.5, 4.5), (0.5, 4.5)),
        ((0.5, 4.5), (0.5, 0.5)),
    ),
    "R": (
        ((0.5, 0.5), (0.5, 4.5)),
        ((0.5, 0.5), (4.0, 0.5)),
        ((4.0, 0.5), (4.5, 1.0)),
        ((4.5, 1.0), (4.5, 2.0)),
        ((4.5, 2.0), (4.0, 2.5)),
        ((0.5, 2.5), (4.0, 2.5)),
        ((2.5, 2.5), (4.5, 4.5)),
    ),
    "S": (
        ((0.5, 0.5), (4.5, 0.5)),
        ((0.5, 0.5), (0.5, 2.5)),
        ((0.5, 2.5), (4.5, 2.5)),
        ((4.5, 2.5), (4.5, 4.5)),
        ((0.5, 4.5), (4.5, 4.5)),
    ),
    "V": (
        ((0.5, 0.5), (2.5, 4.5)),
        ((4.5, 0.5), (2.5, 4.5)),
    ),
    "Z": (
        ((0.5, 0.5), (4.5, 0.5)),
        ((4.5, 0.5), (0.5, 4.5)),
        ((0.5, 4.5), (4.5, 4.5)),
    ),
}


def _make_target(
    target_id: str,
    x: NDArray[np.float64],
    y: NDArray[np.float64],
    *,
    image_dx_arcmin: float,
) -> NDArray[np.float64]:
    """Build the requested target image on the provided image grid."""

    from prysm import coordinates, objects

    if target_id == "siemensstar":
        obj_r, obj_t = coordinates.cart_to_polar(x, y)
        return objects.siemensstar(
            obj_r,
            obj_t,
            spokes=100,
            oradius=float(x.max()) * 0.8,
        )
    if target_id == "slantededge":
        return objects.slantededge(x, y)
    if target_id == "tiltedsquare":
        return objects.tiltedsquare(x, y, radius=float(x.max()) * 0.35)
    if target_id == "snellen_e_20_20":
        return _make_snellen_e(
            x.shape,
            image_dx_arcmin=image_dx_arcmin,
        )
    if target_id == "snellen_e_20_20_inverted":
        return 1 - _make_snellen_e(
            x.shape,
            image_dx_arcmin=image_dx_arcmin,
        )
    if target_id == "logmar_chart":
        return _make_logmar_chart(
            x.shape,
            image_dx_arcmin=image_dx_arcmin,
        )
    if target_id == "logmar_chart_inverted":
        return 1 - _make_logmar_chart(
            x.shape,
            image_dx_arcmin=image_dx_arcmin,
        )
    if target_id == "jupiter":
        return _make_jupiter(
            x.shape,
            image_dx_arcmin=image_dx_arcmin,
        )
    if target_id == "point_source":
        return _make_point_source(x.shape)

    raise ValueError(f"target_id must be one of {sorted(SUPPORTED_TARGET_IDS)}")


def _make_snellen_e(
    shape: tuple[int, int],
    *,
    image_dx_arcmin: float,
) -> NDArray[np.float64]:
    """Build a 20/20 Snellen E target with five-arcminute letter height."""

    block_px = max(1, round(1.0 / image_dx_arcmin))
    height_px = 5 * block_px
    rows, columns = shape
    if height_px > rows or height_px > columns:
        raise ValueError("snellen_e_20_20 target is larger than the image grid")

    target = np.ones(shape, dtype=float)
    pattern = np.array(
        [
            [1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0],
            [1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0],
            [1, 1, 1, 1, 1],
        ],
        dtype=bool,
    )
    y0 = (rows - height_px) // 2
    x0 = (columns - height_px) // 2
    for row in range(5):
        for column in range(5):
            if pattern[row, column]:
                y_start = y0 + row * block_px
                x_start = x0 + column * block_px
                target[
                    y_start : y_start + block_px,
                    x_start : x_start + block_px,
                ] = 0
    return target


def _make_logmar_chart(
    shape: tuple[int, int],
    *,
    image_dx_arcmin: float,
) -> NDArray[np.float64]:
    """Build a six-row LogMAR chart from deterministic block optotypes."""

    row_specs = [
        (
            letters,
            _logmar_stroke_px(
                logmar,
                image_dx_arcmin,
            ),
        )
        for letters, logmar in _LOGMAR_ROWS
    ]
    row_heights_px = [5 * stroke_px for _, stroke_px in row_specs]
    row_widths_px = [
        len(letters) * row_height_px + (len(letters) - 1) * row_height_px
        for (letters, _), row_height_px in zip(row_specs, row_heights_px)
    ]
    chart_height_px = row_heights_px[0] + sum(
        next_row_height_px + next_row_height_px
        for next_row_height_px in row_heights_px[1:]
    )

    rows, columns = shape
    if chart_height_px > rows or max(row_widths_px) > columns:
        raise ValueError("logmar_chart target is larger than the image grid")

    target = np.ones(
        (
            rows * _LOGMAR_ANTIALIASING_FACTOR,
            columns * _LOGMAR_ANTIALIASING_FACTOR,
        ),
        dtype=float,
    )
    y_cursor = (rows - chart_height_px) / 2
    for row_index, ((letters, stroke_px), row_height_px, row_width_px) in enumerate(
        zip(row_specs, row_heights_px, row_widths_px)
    ):
        if row_index > 0:
            y_cursor += row_height_px
        x_cursor = (columns - row_width_px) / 2
        for letter_index, letter in enumerate(letters):
            if letter_index > 0:
                x_cursor += row_height_px
            _draw_vector_optotype(target, letter, y_cursor, x_cursor, stroke_px)
            x_cursor += row_height_px
        y_cursor += row_height_px

    return target.reshape(
        rows,
        _LOGMAR_ANTIALIASING_FACTOR,
        columns,
        _LOGMAR_ANTIALIASING_FACTOR,
    ).mean(axis=(1, 3))


def _logmar_stroke_px(
    logmar: float,
    image_dx_arcmin: float,
) -> float:
    stroke_arcmin = 10**logmar
    return max(1.0, stroke_arcmin / image_dx_arcmin)


def _make_jupiter(
    shape: tuple[int, int],
    *,
    image_dx_arcmin: float,
) -> NDArray[np.float64]:
    """Build a centered monochrome HST Jupiter target with 50 arcsec diameter."""

    return _make_jupiter_target(
        "jupiter_502nm.npz",
        shape,
        image_dx_arcmin=image_dx_arcmin,
    )


def _make_jupiter_rgb_target(
    shape: tuple[int, int],
    *,
    image_dx_arcmin: float,
) -> NDArray[np.float64]:
    """Build centered red, green, and blue Jupiter channels."""

    return np.stack(
        [
            _make_jupiter_target(
                "jupiter_658nm.npz",
                shape,
                image_dx_arcmin=image_dx_arcmin,
            ),
            _make_jupiter_target(
                "jupiter_502nm.npz",
                shape,
                image_dx_arcmin=image_dx_arcmin,
            ),
            _make_jupiter_target(
                "jupiter_395nm.npz",
                shape,
                image_dx_arcmin=image_dx_arcmin,
            ),
        ],
        axis=-1,
    )


def _make_jupiter_target(
    asset_filename: str,
    shape: tuple[int, int],
    *,
    image_dx_arcmin: float,
) -> NDArray[np.float64]:
    """Build a centered monochrome HST Jupiter target with 50 arcsec diameter."""

    diameter_px = max(1, round(JUPITER_502NM_DIAMETER_ARCMIN / image_dx_arcmin))
    rows, columns = shape
    if diameter_px > rows or diameter_px > columns:
        raise ValueError("jupiter target is larger than the image grid")

    source = _load_prepared_jupiter_asset(asset_filename)
    zoom = (diameter_px / source.shape[0], diameter_px / source.shape[1])
    resized = ndimage.zoom(source, zoom, order=3, mode="nearest", prefilter=True)
    resized = np.clip(resized, 0, 1)

    target = np.zeros(shape, dtype=float)
    y0 = (rows - resized.shape[0]) // 2
    x0 = (columns - resized.shape[1]) // 2
    target[y0 : y0 + resized.shape[0], x0 : x0 + resized.shape[1]] = resized
    return target


@lru_cache(maxsize=3)
def _load_prepared_jupiter_asset(asset_filename: str) -> NDArray[np.float64]:
    return _prepare_jupiter_asset(_load_jupiter_asset(asset_filename))


def _prepare_jupiter_asset(source: NDArray[np.float64]) -> NDArray[np.float64]:
    source = _normalize_jupiter_polarity(source)
    y_min, x_min, y_max, x_max = _jupiter_disk_bbox(source)
    disk = source[y_min : y_max + 1, x_min : x_max + 1]
    background = _corner_median(disk)
    disk = np.clip(disk - background, 0, None)
    maximum = float(disk.max())
    if maximum > 0:
        disk = disk / maximum
    return disk


def _normalize_jupiter_polarity(source: NDArray[np.float64]) -> NDArray[np.float64]:
    rows, columns = source.shape
    patch_size = max(1, min(rows, columns) // 10)
    y0 = (rows - patch_size) // 2
    x0 = (columns - patch_size) // 2
    center = source[y0 : y0 + patch_size, x0 : x0 + patch_size]

    if float(center.mean()) < float(_corner_samples(source, patch_size).mean()):
        return 1 - source
    return source


def _jupiter_disk_bbox(source: NDArray[np.float64]) -> tuple[int, int, int, int]:
    labels, label_count = ndimage.label(source > _JUPITER_DISK_THRESHOLD)
    if label_count == 0:
        raise ValueError("Jupiter asset does not contain a detectable disk")

    sizes = np.bincount(labels.ravel())
    objects = ndimage.find_objects(labels)
    fallback_bbox: tuple[int, int, int, int] | None = None
    fallback_size = -1
    best_bbox: tuple[int, int, int, int] | None = None
    best_size = -1

    for label, slices in enumerate(objects, start=1):
        if slices is None:
            continue
        y_slice, x_slice = slices
        bbox = (
            y_slice.start,
            x_slice.start,
            y_slice.stop - 1,
            x_slice.stop - 1,
        )
        size = int(sizes[label])
        if size > fallback_size:
            fallback_bbox = bbox
            fallback_size = size
        if _bbox_touches_border(bbox, source.shape):
            continue
        if size > best_size:
            best_bbox = bbox
            best_size = size

    if best_bbox is not None:
        return best_bbox
    if fallback_bbox is not None:
        return fallback_bbox
    raise ValueError("Jupiter asset does not contain a detectable disk")


def _bbox_touches_border(
    bbox: tuple[int, int, int, int],
    shape: tuple[int, int],
) -> bool:
    y_min, x_min, y_max, x_max = bbox
    rows, columns = shape
    return y_min == 0 or x_min == 0 or y_max == rows - 1 or x_max == columns - 1


def _corner_median(source: NDArray[np.float64]) -> float:
    patch_size = max(1, min(source.shape) // 20)
    return float(np.median(_corner_samples(source, patch_size)))


def _corner_samples(
    source: NDArray[np.float64],
    patch_size: int,
) -> NDArray[np.float64]:
    return np.concatenate(
        [
            source[:patch_size, :patch_size].ravel(),
            source[:patch_size, -patch_size:].ravel(),
            source[-patch_size:, :patch_size].ravel(),
            source[-patch_size:, -patch_size:].ravel(),
        ]
    )


def _make_point_source(shape: tuple[int, int]) -> NDArray[np.float64]:
    """Build a centered impulse target."""

    target = np.zeros(shape, dtype=float)
    rows, columns = shape
    target[rows // 2, columns // 2] = 1
    return target


@lru_cache(maxsize=3)
def _load_jupiter_asset(asset_filename: str) -> NDArray[np.float64]:
    if asset_filename not in {
        "jupiter_395nm.npz",
        "jupiter_502nm.npz",
        "jupiter_658nm.npz",
    }:
        raise ValueError("Unsupported Jupiter asset")

    asset = resources.files("hoa_visualizer_utils.simulation.assets").joinpath(
        asset_filename
    )
    with asset.open("rb") as file:
        return np.asarray(np.load(file)["image"], dtype=float)


def _draw_vector_optotype(
    target: NDArray[np.float64],
    letter: str,
    y0: float,
    x0: float,
    stroke_px: float,
) -> None:
    scale = _LOGMAR_ANTIALIASING_FACTOR
    letter_height_px = 5 * stroke_px
    y_start = max(0, math.floor(y0 * scale))
    y_stop = min(target.shape[0], math.ceil((y0 + letter_height_px) * scale))
    x_start = max(0, math.floor(x0 * scale))
    x_stop = min(target.shape[1], math.ceil((x0 + letter_height_px) * scale))

    yy, xx = np.mgrid[y_start:y_stop, x_start:x_stop]
    x_units = ((xx + 0.5) / scale - x0) / stroke_px
    y_units = ((yy + 0.5) / scale - y0) / stroke_px
    mask = np.zeros_like(x_units, dtype=bool)
    for start, end in _VECTOR_OPTOTYPE_STROKES[letter]:
        mask |= _within_stroke(x_units, y_units, start, end)
    target[y_start:y_stop, x_start:x_stop] = np.where(
        mask,
        0,
        target[y_start:y_stop, x_start:x_stop],
    )


def _within_stroke(
    x_units: NDArray[np.float64],
    y_units: NDArray[np.float64],
    start: tuple[float, float],
    end: tuple[float, float],
) -> NDArray[np.bool_]:
    x1, y1 = start
    x2, y2 = end
    dx = x2 - x1
    dy = y2 - y1
    segment_length_squared = dx * dx + dy * dy
    projection = ((x_units - x1) * dx + (y_units - y1) * dy) / segment_length_squared
    projection = np.clip(projection, 0, 1)
    closest_x = x1 + projection * dx
    closest_y = y1 + projection * dy
    return (x_units - closest_x) ** 2 + (y_units - closest_y) ** 2 <= 0.5**2
