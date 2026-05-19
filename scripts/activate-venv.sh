#!/usr/bin/env bash

show_source_guidance() {
  echo "Source this script to activate the repo venv:"
  echo "  source scripts/activate-venv.sh"
}

if [[ -n "${BASH_VERSION:-}" ]]; then
  if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    show_source_guidance
    exit 1
  fi

  SCRIPT_PATH="${BASH_SOURCE[0]}"
elif [[ -n "${ZSH_VERSION:-}" ]]; then
  if [[ "${ZSH_EVAL_CONTEXT}" != *:file ]]; then
    show_source_guidance
    exit 1
  fi

  SCRIPT_PATH="${(%):-%x}"
else
  show_source_guidance
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${SCRIPT_PATH}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

source "${REPO_ROOT}/.venv/bin/activate"
