#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
VENV_DIR="${REPO_ROOT}/.venv"

if [[ ! -x "${VENV_DIR}/bin/python" ]]; then
  python3 -m venv "${VENV_DIR}"
fi

source "${VENV_DIR}/bin/activate"
python -m pip install --upgrade pip
python -m pip install pytest setuptools==78.1.1
python -m pip install --editable "${REPO_ROOT}"
python -m pytest "${REPO_ROOT}/src/hoa_visualizer_utils/tests/python"
