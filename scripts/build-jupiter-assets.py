#!/usr/bin/env python3
"""Build packaged Jupiter luminance assets from source JPEGs."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[1]
ASSET_SOURCES = {
    "docs/jupiter_395nm.jpg": "src/hoa_visualizer_utils/simulation/assets/jupiter_395nm.npz",
    "docs/jupiter_658nm.jpg": "src/hoa_visualizer_utils/simulation/assets/jupiter_658nm.npz",
}


def main() -> None:
    for source_path, output_path in ASSET_SOURCES.items():
        source = REPO_ROOT / source_path
        output = REPO_ROOT / output_path
        with Image.open(source) as image:
            luminance = np.asarray(image.convert("L"), dtype=np.float64) / 255.0
        output.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(output, image=luminance)


if __name__ == "__main__":
    main()
