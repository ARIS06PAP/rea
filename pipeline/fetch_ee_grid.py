"""Phase 2b – Earth Engine: describe every grid cell and collect monthly MODIS NDVI.

For each 0.5° × 0.625° cell of the NASA POWER grid:
* how much of it is Greek land (US Dept of State LSIB boundaries ∩ MODIS land/water),
* region (FAO GAUL level 1 = the 13 Greek regions), mainland vs island share, coastal or not,
  mean elevation (GMTED2010, only as a descriptor, never as a model input), urban share
  (ESA WorldCover 2021, built-up class),
* monthly NDVI from MODIS/Terra MOD13A3 collection 6.1 (1 km monthly; the 0.05° MOD13C2
  version of the same monthly product is not hosted in Earth Engine), averaged over the
  Greek land of the cell, pixels with SummaryQA ≤ 1 (good or marginal) only.

Raw results go to data/raw/ee/ as JSON. Uses the local Earth Engine login of this PC.

Run:  python pipeline/fetch_ee_grid.py            (attributes + NDVI)
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import ee

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import EE_PROJECT, LAT_STEP, LON_STEP, NDVI_COLLECTION, NDVI_SCALE, RAW_EE, is_fresh  # noqa: E402

LATS = [34.0 + 0.5 * i for i in range(17)]
LONS = [19.375 + 0.625 * i for i in range(16)]


def cells_fc() -> ee.FeatureCollection:
    feats = []
    for lat in LATS:
        for lon in LONS:
            rect = ee.Geometry.Rectangle([lon - LON_STEP / 2, lat - LAT_STEP / 2, lon + LON_STEP / 2, lat + LAT_STEP / 2], None, False)
            feats.append(ee.Feature(rect, {"cell": f"{lat:.3f}_{lon:.3f}", "lat": lat, "lon": lon}))
    return ee.FeatureCollection(feats)


def greece() -> tuple[ee.Geometry, ee.Geometry]:
    gr = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017").filter(ee.Filter.eq("country_na", "Greece")).geometry()
    parts = ee.List(gr.geometries())
    areas = parts.map(lambda g: ee.Geometry(g).area(1000))
    biggest = ee.Geometry(parts.get(ee.List(areas).indexOf(ee.List(areas).reduce(ee.Reducer.max()))))
    return gr, biggest


def attributes() -> None:
    out = RAW_EE / "cell_attributes.json"
    if out.exists():
        print("attributes cached")
        return
    t = time.time()
    gr, mainland = greece()
    land = ee.ImageCollection("MODIS/006/MOD44W").sort("system:time_start", False).first().select("water_mask").eq(0)
    gr_img = ee.Image.constant(1).clip(gr).mask()
    main_img = ee.Image.constant(1).clip(mainland).mask()
    gr_land = land.And(gr_img.gt(0))
    elev = ee.Image("USGS/GMTED2010_FULL").select("mea")
    built = ee.ImageCollection("ESA/WorldCover/v200").first().select("Map").eq(50)
    stack = (ee.Image.cat([
        ee.Image.constant(1).rename("all"),
        land.rename("land"),
        gr_land.rename("gr_land"),
        gr_land.And(main_img.gt(0)).rename("gr_mainland"),
        elev.updateMask(gr_land).rename("elev"),
        built.updateMask(gr_land).rename("urban"),
    ]).unmask(0, False))
    # fractions: mean of 0/1 bands over the whole cell; elevation/urban over Greek land only
    frac = stack.select(["land", "gr_land", "gr_mainland"]).reduceRegions(cells_fc(), ee.Reducer.mean(), 1000)
    over_land = ee.Image.cat([elev.updateMask(gr_land).rename("elev"), built.updateMask(gr_land).rename("urban")])
    fc = frac.map(lambda f: f.set(over_land.reduceRegion(ee.Reducer.mean(), f.geometry(), 1000, maxPixels=1e8)))
    regions = ee.FeatureCollection("FAO/GAUL/2015/level1").filter(ee.Filter.eq("ADM0_NAME", "Greece"))

    def add_region(f):
        inter = regions.map(lambda r: r.set("ov", r.geometry().intersection(f.geometry(), 1000).area(1000)))
        best = inter.sort("ov", False).first()
        return f.set({"region": ee.Algorithms.If(ee.Number(best.get("ov")).gt(0), best.get("ADM1_NAME"), None)})

    fc = fc.map(add_region)
    rows = [f["properties"] for f in fc.getInfo()["features"]]
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"attributes: {len(rows)} cells, {sum(1 for r in rows if (r.get('gr_land') or 0) > 0)} with Greek land ({time.time()-t:.0f}s)", flush=True)


def ndvi() -> None:
    attrs = json.loads((RAW_EE / "cell_attributes.json").read_text(encoding="utf-8"))
    keep = {r["cell"] for r in attrs if (r.get("gr_land") or 0) >= 0.02}
    gr, _ = greece()
    land = ee.ImageCollection("MODIS/006/MOD44W").sort("system:time_start", False).first().select("water_mask").eq(0)
    gr_land = land.And(ee.Image.constant(1).clip(gr).mask().gt(0))
    fc = cells_fc().filter(ee.Filter.inList("cell", list(keep)))
    col = ee.ImageCollection(NDVI_COLLECTION)
    first, last = col.aggregate_min("system:time_start").getInfo(), col.aggregate_max("system:time_start").getInfo()
    y0 = int(time.strftime("%Y", time.gmtime(first / 1000)))
    y1 = int(time.strftime("%Y", time.gmtime(last / 1000)))
    for year in range(y0, y1 + 1):
        out = RAW_EE / f"ndvi_{year}.json"
        if is_fresh(out, year):   # the current and previous year are downloaded again after REFRESH_DAYS
            continue
        t = time.time()
        yc = col.filterDate(f"{year}-01-01", f"{year + 1}-01-01")

        def per_image(img):
            good = img.select("SummaryQA").lte(1)
            nd = img.select("NDVI").multiply(NDVI_SCALE).updateMask(good).updateMask(gr_land).rename("ndvi")
            cnt = nd.mask().rename("n")
            stats = ee.Image.cat([nd, cnt]).reduceRegions(fc, ee.Reducer.mean().combine(ee.Reducer.count(), None, True), 1000)
            return stats.map(lambda f: ee.Feature(None, {
                "cell": f.get("cell"), "date": img.date().format("YYYY-MM"),
                "ndvi": f.get("ndvi_mean"), "n_good": f.get("ndvi_count")}))

        rows = [f["properties"] for f in yc.map(per_image).flatten().getInfo()["features"]]
        out.write_text(json.dumps(rows), encoding="utf-8")
        print(f"ndvi {year}: {len(rows)} rows ({time.time()-t:.0f}s)", flush=True)


if __name__ == "__main__":
    ee.Initialize(project=EE_PROJECT)
    attributes()
    ndvi()
    print("done")
