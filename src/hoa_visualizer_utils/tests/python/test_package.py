from hoa_visualizer_utils import __version__


def test_package_exposes_version() -> None:
    assert __version__ == "0.4.0"
