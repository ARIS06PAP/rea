"""Phase 6a – store everything in one database for the API: data/tiger.duckdb (DuckDB,
an embedded SQL database; the API queries it read-only) + a few static files.

Tables: cells, monthly (observations + suitability scores + ESI), annual, trends_annual,
trends_monthly, trends_seasonal, decades, correlations, attribution, national_annual,
national_monthly, regional_annual, proj_annual, proj_national, proj_national_by_model,
proj_snapshots, proj_baseline, proj_baseline_monthly, proj_scores (monthly scores of every
model/scenario/year, for the "your own weights" tool), proj_monthly (ensemble median and
10th–90th percentile of each projected parameter per cell, year and month), gbif, athens_weekly.
Static: api/static/cells.geojson (cell shapes = Greek land in each cell), meta.json,
validation.json, calibration.json, sensitivity.json, abundance.json, science_values.json.
Re-run the whole pipeline (pipeline/run_all.py) when new NASA months are published.
"""
from __future__ import annotations

import datetime as dt
import json
import shutil
import sys
from pathlib import Path

import duckdb
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import DATA, DOCS, PROCESSED, RAW, RAW_EE, ROOT  # noqa: E402
import esi as E  # noqa: E402

DB = DATA / "tiger.duckdb"
STATIC = ROOT / "api" / "static"


def main() -> None:
    E.load_overrides()
    STATIC.mkdir(parents=True, exist_ok=True)
    tmp = DATA / "tiger.duckdb.tmp"
    if tmp.exists():
        tmp.unlink()
    con = duckdb.connect(str(tmp))
    tables = {
        "cells": "cells.parquet", "monthly": "esi_monthly.parquet", "annual": "esi_annual.parquet",
        "trends_annual": "trends_annual.parquet", "trends_monthly": "trends_monthly.parquet", "trends_seasonal": "trends_seasonal.parquet",
        "decades": "decades.parquet", "correlations": "correlations.parquet", "attribution": "attribution.parquet",
        "national_annual": "national_annual.parquet", "national_monthly": "national_monthly.parquet", "regional_annual": "regional_annual.parquet",
        "proj_annual": "projections_annual.parquet", "proj_national": "projections_national.parquet",
        "proj_national_by_model": "projections_national_by_model.parquet", "proj_snapshots": "projections_snapshots.parquet",
        "proj_baseline_monthly": "projection_baseline_monthly.parquet", "athens_weekly": "athens_weekly.parquet",
        "proj_monthly": "projections_monthly.parquet",
    }
    for name, f in tables.items():
        con.execute(f"CREATE TABLE {name} AS SELECT * FROM read_parquet('{(PROCESSED / f).as_posix()}')")
    con.execute(f"CREATE TABLE proj_baseline AS SELECT * FROM read_parquet('{(PROCESSED / 'projection_baseline.parquet').as_posix()}')")

    # monthly suitability scores of every projection run (custom-weights tool)
    fields = pd.read_parquet(PROCESSED / "projections_fields.parquet")
    sc = E.scores(fields)
    proj_scores = pd.concat([fields[["model", "scenario", "cell", "year", "month"]], sc], axis=1)
    con.register("ps", proj_scores)
    con.execute("CREATE TABLE proj_scores AS SELECT * FROM ps")
    base_f = pd.read_parquet(PROCESSED / "projection_baseline_fields.parquet")
    con.register("bs", pd.concat([base_f[["cell", "month"]], E.scores(base_f)], axis=1))
    con.execute("CREATE TABLE proj_baseline_scores AS SELECT * FROM bs")

    g = pd.DataFrame(json.loads((RAW / "gbif_aedes_albopictus_GR.json").read_text(encoding="utf-8")))
    con.register("g", g)
    con.execute("CREATE TABLE gbif AS SELECT * FROM g")
    con.close()
    if DB.exists():
        DB.unlink()
    tmp.rename(DB)

    # static files
    gj = json.loads((RAW_EE / "cell_shapes.geojson").read_text(encoding="utf-8"))
    def rnd(c):
        return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], 4), round(c[1], 4)]
    for f in gj["features"]:
        geo = f["geometry"]
        if geo["type"] == "GeometryCollection":   # keep only the polygon parts of a mixed intersection
            polys = []
            for part in geo["geometries"]:
                if part["type"] == "Polygon":
                    polys.append(part["coordinates"])
                elif part["type"] == "MultiPolygon":
                    polys += part["coordinates"]
            geo = {"type": "MultiPolygon", "coordinates": polys}
        geo["coordinates"] = rnd(geo["coordinates"])
        f["geometry"] = geo
    (STATIC / "cells.geojson").write_text(json.dumps(gj, separators=(",", ":")), encoding="utf-8")
    for f in ["validation.json", "calibration.json", "sensitivity.json", "abundance.json", "coverage.json"]:
        shutil.copy(PROCESSED / f, STATIC / f)
    for f in ["science_values.json"]:
        if (DOCS / f).exists():
            shutil.copy(DOCS / f, STATIC / f)
    cov = json.loads((PROCESSED / "coverage.json").read_text(encoding="utf-8"))
    meta = {
        "built_at": dt.datetime.now().isoformat(timespec="minutes"),
        "coverage": cov,
        "weights": {"main": E.WEIGHTS, "equal": E.EQUAL},
        "esi_parameters": E.P,
        "grid": {"lat_step": 0.5, "lon_step": 0.625, "source": "NASA POWER / MERRA-2 native grid", "cells": cov["cells"]},
        "scenarios": {"ssp245": "SSP2-4.5 (ενδιάμεσες εκπομπές)", "ssp585": "SSP5-8.5 (υψηλές εκπομπές)"},
        "snapshots": [2030, 2040, 2050],
        "models": sorted(pd.read_parquet(PROCESSED / "projections_national_by_model.parquet")["model"].unique().tolist()),
    }
    (STATIC / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"database {DB} ({DB.stat().st_size / 1e6:.1f} MB), static files in {STATIC}")


if __name__ == "__main__":
    main()
