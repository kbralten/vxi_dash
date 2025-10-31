"""Application package for the VXI-11 dashboard backend."""

import sys

# Python 3.13 removed xdrlib from the standard library.
# python-vxi11 depends on it, so we use our vendored copy from Python 3.12.
# Inject it into sys.modules before any imports of vxi11.
try:
    import xdrlib  # type: ignore
except ModuleNotFoundError:
    from app.vendor import xdrlib
    sys.modules['xdrlib'] = xdrlib

