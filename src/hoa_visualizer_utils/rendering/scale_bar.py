"""Scale bar helpers for rendered simulation images."""

from __future__ import annotations

from dataclasses import dataclass
import math

from hoa_visualizer_utils.simulation.models import OpticalSimulation


@dataclass(frozen=True)
class ScaleBarSpec:
    """Resolved angular and pixel size for a scale bar."""

    length_arcmin: float
    length_px: float
    label: str


def add_scale_bar(ax, simulation: OpticalSimulation) -> None:
    """Draw an angular scale bar in image data coordinates."""

    height_px, width_px = simulation.convolved_image.shape[:2]
    spec = _scale_bar_spec(
        image_width_px=width_px,
        image_dx_arcmin=simulation.sampling.image_dx_arcmin,
    )
    x_start = width_px * 0.08
    y = height_px * 0.9
    text_y = y - height_px * 0.035
    outline = _text_outline()
    _add_contrast_backing(
        ax,
        x=x_start - width_px * 0.025,
        y=text_y - height_px * 0.03,
        width=spec.length_px + width_px * 0.05,
        height=height_px * 0.085,
    )

    ax.plot(
        [x_start, x_start + spec.length_px],
        [y, y],
        color="white",
        linewidth=3,
        solid_capstyle="butt",
        path_effects=outline,
        zorder=3,
    )
    ax.text(
        x_start + spec.length_px / 2,
        text_y,
        spec.label,
        color="white",
        fontsize=9,
        ha="center",
        va="bottom",
        path_effects=outline,
        zorder=3,
    )


def _scale_bar_spec(*, image_width_px: int, image_dx_arcmin: float) -> ScaleBarSpec:
    image_width_arcmin = image_width_px * image_dx_arcmin
    target_arcmin = image_width_arcmin * 0.225
    length_arcmin = _nice_length(target_arcmin)
    length_px = length_arcmin / image_dx_arcmin
    label = _scale_label(length_arcmin)
    return ScaleBarSpec(length_arcmin=length_arcmin, length_px=length_px, label=label)


def _nice_length(target_arcmin: float) -> float:
    exponent = math.floor(math.log10(target_arcmin))
    candidates = [
        multiple * 10**candidate_exponent
        for candidate_exponent in (exponent - 1, exponent, exponent + 1)
        for multiple in (1, 2, 5)
    ]
    return min(candidates, key=lambda value: abs(math.log(value / target_arcmin)))


def _scale_label(length_arcmin: float) -> str:
    if length_arcmin < 1:
        return f"{length_arcmin * 60:g} arcsec"
    return f"{length_arcmin:g} arcmin"


def _add_contrast_backing(ax, *, x: float, y: float, width: float, height: float) -> None:
    from matplotlib.patches import Rectangle

    ax.add_patch(
        Rectangle(
            (x, y),
            width,
            height,
            facecolor="black",
            edgecolor="none",
            alpha=0.55,
            zorder=2,
        )
    )


def _text_outline():
    from matplotlib import patheffects

    return [patheffects.Stroke(linewidth=2, foreground="black"), patheffects.Normal()]
