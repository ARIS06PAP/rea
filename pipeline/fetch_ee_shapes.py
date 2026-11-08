"""Phase 2d – the shape of each grid cell on the map: the Greek land inside the cell.

Cell rectangle ∩ Greece (US Dept of State LSIB, simplified boundaries), simplified to
~300 m so the map shows coastlines and islands instead of square blocks. Writes
data/raw/ee/cell_shapes.geojson (only cells with Greek land, as in cells.parquet).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import ee

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import EE_PROJECT, LAT_STEP, LON_STEP, RAW_EE  # noqa: E402

if __name__ == "__main__":
    ee.Initialize(project=EE_PROJECT)
    attrs = json.loads((RAW_EE / "cell_attributes.json").read_text(encoding="utf-8"))
    keep = [r for r in attrs if (r.get("gr_land") or 0) >= 0.02]
    gr = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017").filter(ee.Filter.eq("country_na", "Greece")).geometry()
    feats = []
    for r in keep:
        lat, lon = r["lat"], r["lon"]
        rect = ee.Geometry.Rectangle([lon - LON_STEP / 2, lat - LAT_STEP / 2, lon + LON_STEP / 2, lat + LAT_STEP / 2], None, False)
        feats.append(ee.Feature(rect.intersection(gr, 100).simplify(300), {"cell": r["cell"]}))
    out = []
    for i in range(0, len(feats), 20):
        out += ee.FeatureCollection(feats[i:i + 20]).getInfo()["features"]
        print(f"{min(i + 20, len(feats))}/{len(feats)}", flush=True)
    gj = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": f["properties"], "geometry": f["geometry"]} for f in out]}
    (RAW_EE / "cell_shapes.geojson").write_text(json.dumps(gj), encoding="utf-8")
    print("done", len(out))
