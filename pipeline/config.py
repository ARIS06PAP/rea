"""Shared settings for the Aedes albopictus suitability pipeline (Greece).

Everything is on the native NASA POWER / MERRA-2 grid: 0.5° latitude × 0.625° longitude.
The bounding box is the same one the R.E.A. trends map uses, so cell centres line up
with the existing land mask (lon 19.0–29.0, lat 34.0–42.0 → 16 × 17 cell centres).
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # rea/tiger
DATA = ROOT / "data"
RAW = DATA / "raw"
RAW_POWER = RAW / "power"
RAW_EE = RAW / "ee"
PROCESSED = DATA / "processed"
DOCS = ROOT / "docs"

for _d in (RAW_POWER, RAW_EE, PROCESSED):
    _d.mkdir(parents=True, exist_ok=True)

# NASA POWER regional requests (lat/lon of the grid's cell centres)
BBOX = {"lat0": 34.0, "lat1": 42.0, "lon0": 19.0, "lon1": 29.0}
LAT_STEP, LON_STEP = 0.5, 0.625

# The five parameters of the model, as asked: NASA POWER (MERRA-2) + MODIS NDVI
POWER_PARAMS = {
    "T2M": {"name": "Air temperature at 2 m", "unit": "°C", "monthly": "mean"},
    "PRECTOTCORR": {"name": "Precipitation (bias-corrected)", "unit": "mm/day in the API → mm/month here", "monthly": "sum"},
    "RH2M": {"name": "Relative humidity at 2 m", "unit": "%", "monthly": "mean"},
    "WS10M": {"name": "Wind speed at 10 m", "unit": "m/s", "monthly": "mean"},
}
NDVI_COLLECTION = "MODIS/061/MOD13A3"   # MODIS/Terra monthly NDVI, 1 km, collection 6.1 (MOD13C2 is not hosted in Earth Engine)
NDVI_SCALE = 0.0001

POWER_FIRST_YEAR = 1981
EE_PROJECT = "gamifiedretail"

# Refresh: cached raw files that cover the current or the previous calendar year can still change
# (NASA adds new months, and POWER replaces its near-real-time GEOS FP-IT months with MERRA-2),
# so they are downloaded again when older than REFRESH_DAYS. Older years are kept as they are.
REFRESH_DAYS = 3


def is_fresh(path: Path, year: int) -> bool:
    import datetime as _dt
    import time as _time
    if not path.exists():
        return False
    if year < _dt.date.today().year - 1:
        return True
    return _time.time() - path.stat().st_mtime < REFRESH_DAYS * 86400

# CMIP6 (NASA NEX-GDDP-CMIP6, daily, 0.25°, bias-corrected and downscaled)
GDDP = "NASA/GDDP-CMIP6"
GDDP_MODELS = ["ACCESS-CM2", "CNRM-ESM2-1", "EC-Earth3", "MPI-ESM1-2-HR", "MRI-ESM2-0", "NorESM2-MM", "IPSL-CM6A-LR", "INM-CM5-0"]
SCENARIOS = ["ssp245", "ssp585"]
HIST_BASE = (1995, 2014)            # CMIP6 historical reference for the delta method
PROJ_YEARS = (2015, 2050)

import sys as _sys
try:  # Greek text and symbols in console output on Windows
    _sys.stdout.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass
