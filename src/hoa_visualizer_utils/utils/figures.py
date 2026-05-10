"""Matplotlib figure serialization helpers."""

from __future__ import annotations

from io import BytesIO
import os
from typing import Literal

ImageFormat = Literal["png", "svg"]
DEFAULT_FIGURE_SIZE_INCHES = (10, 9)


def _load_pyplot():
    """Load matplotlib pyplot with a non-interactive backend."""

    os.environ.setdefault("MPLCONFIGDIR", "/tmp/matplotlib-prysm-test")
    import matplotlib

    matplotlib.use("Agg")
    from matplotlib import pyplot as plt

    return plt


def _figure_to_bytes(fig, image_format: ImageFormat) -> bytes:
    """Serialize a matplotlib figure to PNG or SVG bytes."""

    if image_format not in ("png", "svg"):
        raise ValueError("image_format must be 'png' or 'svg'")

    buffer = BytesIO()
    fig.savefig(buffer, format=image_format)
    _load_pyplot().close(fig)
    return buffer.getvalue()
