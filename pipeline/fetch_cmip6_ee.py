"""Phase 5a – monthly CMIP6 climate for every grid cell (NASA NEX-GDDP-CMIP6 via Earth Engine).

For each model × scenario × year: monthly means of near-surface air temperature (tas),
precipitation (pr), relative humidity (hurs) and 10 m wind speed (sfcWind), averaged over
each 0.5° × 0.625° POWER grid cell. Historical runs 1995–2014 (reference for the delta
method), SSP2-4.5 and SSP5-8.5 for 2015–2050.

One Earth Engine request per model × scenario × year (12 months × 4 variables × all cells),
4 requests in parallel, every result cached in data/raw/ee/cmip6/ so the run can be
stopped and resumed.

Run:  python pipeline/fetch_cmip6_ee.py
"""
from __future__ import annotations

import concurrent.futures as cf
import json
import sys
import time
from pathlib import Path

import ee

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import EE_PROJECT, GDDP, GDDP_MODELS, HIST_BASE, LAT_STEP, LON_STEP, PROJ_YEARS, RAW_EE, SCENARIOS  # noqa: E402

OUT = RAW_EE / "cmip6"
OUT.mkdir(parents=True, exist_ok=True)
LATS = [34.0 + 0.5 * i for i in range(17)]
LONS = [19.375 + 0.625 * i for i in range(16)]
BANDS = ["tas", "pr", "hurs", "sfcWind"]


def cells_fc() -> ee.FeatureCollection:
    feats = []
    for lat in LATS:
        for lon in LONS:
            rect = ee.Geometry.Rectangle([lon - LON_STEP / 2, lat - LAT_STEP / 2, lon + LON_STEP / 2, lat + LAT_STEP / 2], None, False)
            feats.append(ee.Feature(rect, {"cell": f"{lat:.3f}_{lon:.3f}"}))
    return ee.FeatureCollection(feats)


def job(model: str, scenario: str, year: int, fc: ee.FeatureCollection) -> str:
    path = OUT / f"{model}_{scenario}_{year}.json"
    if path.exists():
        return f"cached {path.name}"
    col = (ee.ImageCollection(GDDP).filter(ee.Filter.eq("model", model)).filter(ee.Filter.eq("scenario", scenario))
           .filterDate(f"{year}-01-01", f"{year + 1}-01-01").select(BANDS))
    months = []
    for m in range(1, 13):
        mc = col.filter(ee.Filter.calendarRange(m, m, "month")).mean()
        months.append(mc.rename([f"{b}_{m:02d}" for b in BANDS]))
    img = ee.Image.cat(months)
    for attempt in range(4):
        try:
            t = time.time()
            res = img.reduceRegions(fc, ee.Reducer.mean(), 27830).getInfo()
            rows = [{k: v for k, v in f["properties"].items()} for f in res["features"]]
            path.write_text(json.dumps(rows), encoding="utf-8")
            return f"{model} {scenario} {year}: {len(rows)} cells ({time.time() - t:.0f}s)"
        except Exception as e:  # noqa: BLE001
            time.sleep(15 * (attempt + 1))
            err = str(e)[:120]
    return f"FAILED {model} {scenario} {year}: {err}"


def main() -> None:
    ee.Initialize(project=EE_PROJECT)
    fc = cells_fc()
    tasks = []
    for model in GDDP_MODELS:
        tasks += [(model, "historical", y) for y in range(HIST_BASE[0], HIST_BASE[1] + 1)]
        for sc in SCENARIOS:
            tasks += [(model, sc, y) for y in range(PROJ_YEARS[0], PROJ_YEARS[1] + 1)]
    print(f"{len(tasks)} requests", flush=True)
    done = 0
    with cf.ThreadPoolExecutor(max_workers=4) as pool:
        futs = [pool.submit(job, m, s, y, fc) for m, s, y in tasks]
        for f in cf.as_completed(futs):
            done += 1
            msg = f.result()
            if not msg.startswith("cached"):
                print(f"[{done}/{len(tasks)}] {msg}", flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main()
