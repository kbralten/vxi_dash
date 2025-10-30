"""Application package for the VXI-11 dashboard backend."""

import sys
import xdrlib  # This is the replacement for xdrlib

# Inject py_xdrlib into sys.modules so vxi11 can use it
sys.modules['xdrlib'] = xdrlib

