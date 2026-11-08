"""Mosquito Track API – FastAPI over the DuckDB database built by the pipeline.

Run locally (from rea/tiger):  .venv/Scripts/python.exe -m uvicorn api.main:app --port 8010
Then open http://localhost:8010 (the built web app is served from web/dist) or use /docs.

Every number comes from data/tiger.duckdb (NASA POWER, MODIS, CMIP6, trap and GBIF data
processed by pipeline/). "observed" values are measurements/reanalysis; "projection"
values are model-based estimates and are always labelled as such.
"""
from __future__ import annotations

import json
import math
import sys
from functools import lru_cache
from pathlib import Path

import duckdb
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import trendstats as ts  # noqa: E402

DB = ROOT / "data" / "tiger.duckdb"
STATIC = Path(__file__).resolve().parent / "static"
WEB = ROOT / "web" / "dist"

def _san(o):
    """NaN/inf → null everywhere (JSON has no NaN)."""
    if isinstance(o, float):
        return None if (math.isnan(o) or math.isinf(o)) else o
    if isinstance(o, dict):
        return {k: _san(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_san(v) for v in o]
    if isinstance(o, np.generic):
        return _san(o.item())
    return o


class SafeJSON(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(_san(content), ensure_ascii=False, separators=(",", ":")).encode("utf-8")


app = FastAPI(default_response_class=SafeJSON, title="Mosquito Track API", description="Περιβαλλοντική καταλληλότητα του Aedes albopictus στην Ελλάδα", version="1.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])
_con = duckdb.connect(str(DB), read_only=True)

PARAMS = {
    "ESI": {"label": "Δείκτης καταλληλότητας (ESI)", "unit": "0–100"},
    "ESI_eq": {"label": "ESI με ίσα βάρη", "unit": "0–100"},
    "T2M": {"label": "Θερμοκρασία αέρα (T2M)", "unit": "°C"},
    "PRECIP": {"label": "Βροχόπτωση (PRECTOTCORR)", "unit": "mm"},
    "RH2M": {"label": "Σχετική υγρασία (RH2M)", "unit": "%"},
    "WS10M": {"label": "Ταχύτητα ανέμου 10 m (WS10M)", "unit": "m/s"},
    "NDVI": {"label": "Βλάστηση (NDVI, MODIS)", "unit": "—"},
}
ANNUAL_AGG = {"PRECIP": "sum"}   # everything else: mean
SCORES = ["sT", "sP", "sRH", "sW", "sNDVI"]
SCORE_OF = {"T": "sT", "P": "sP", "RH": "sRH", "W": "sW", "NDVI": "sNDVI"}
_USED = json.loads((ROOT / "data" / "processed" / "esi_parameters_used.json").read_text(encoding="utf-8"))
WEIGHTS = {"ESI": _USED["weights"], "ESI_eq": _USED["equal"]}
SCENARIO = "ssp245"   # the app shows the intermediate emissions scenario only
FIRST_YEAR = {"ESI": 2001, "ESI_eq": 2001, "NDVI": 2001}   # others: 1981
FIELDS = ["T2M", "PRECIP", "RH2M", "WS10M", "NDVI"]


def q(sql: str, *args) -> list[dict]:
    cur = _con.cursor()
    res = cur.execute(sql, list(args))
    cols = [d[0] for d in res.description]
    return [dict(zip(cols, [_clean(v) for v in row])) for row in res.fetchall()]


def _clean(v):
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if isinstance(v, (np.floating,)):
        return None if np.isnan(v) else float(v)
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, np.bool_):
        return bool(v)
    return v


def static_json(name: str):
    p = STATIC / name
    if not p.exists():
        raise HTTPException(404, f"{name} not built")
    return json.loads(p.read_text(encoding="utf-8"))


def check_var(var: str) -> str:
    if var not in PARAMS:
        raise HTTPException(400, f"unknown parameter {var}; use one of {list(PARAMS)}")
    return var


@lru_cache(maxsize=1)
def last_complete_year() -> int:
    return int(q("SELECT max(year) y FROM annual WHERE complete_year")[0]["y"])


@lru_cache(maxsize=1)
def last_month() -> tuple[int, int]:
    r = q("SELECT year, month FROM monthly WHERE T2M IS NOT NULL ORDER BY year DESC, month DESC LIMIT 1")[0]
    return int(r["year"]), int(r["month"])


def trend_of(years, values) -> dict | None:
    y = np.asarray(years, float)
    v = np.asarray(values, float)
    ok = ~np.isnan(v)
    if ok.sum() < 8:
        return None
    try:
        t = ts.analyze_annual(y[ok].astype(int), v[ok])
    except Exception:  # noqa: BLE001
        return None
    return {"sen_decade": t.slope_per_decade, "ci": [t.ci_decade_low, t.ci_decade_high], "p": t.p_value, "significant": t.significant,
            "n": t.n_years, "first": t.first_year, "last": t.last_year, "method": t.method, "total": t.total_change}


# ------------------------------------------------------------------ meta
@app.get("/api/meta")
def meta():
    m = static_json("meta.json")
    m["cells"] = q("SELECT cell, lat, lon, region, island, coastal, north, urban_class, urban_share, elev_m, elev_class, gr_land FROM cells ORDER BY lat DESC, lon")
    m["regions"] = [r["region"] for r in q("SELECT DISTINCT region FROM cells ORDER BY region")]
    m["params"] = PARAMS
    m["last_complete_year"] = last_complete_year()
    m["last_month"] = {"year": last_month()[0], "month": last_month()[1]}
    return m


@app.get("/api/cells.geojson")
def cells_geojson():
    return FileResponse(STATIC / "cells.geojson", media_type="application/geo+json")


# ------------------------------------------------------------------ projections of the ESI (SSP2-4.5)
def esi_sql(layer: str) -> str:
    """SQL for the ESI from the five scores: weighted geometric mean, exactly as pipeline/esi.py."""
    w = WEIGHTS[layer]
    tot = sum(w.values())
    terms = [f"{w[k] / tot!r} * ln(least(greatest({c}, 1e-6), 1))" for k, c in SCORE_OF.items()]
    return "100 * exp(" + " + ".join(terms) + ")"


def proj_values(layer: str, year: int, month: int, cell: str | None = None) -> list[dict]:
    """Projected ESI per cell for one year and month (month 0 = mean of the year), SSP2-4.5:
    median, 10th and 90th percentile of the 8 CMIP6 models (delta method on the 1995–2014 NASA POWER
    climate), the change from that climate, and the median score of each factor."""
    where = "scenario = ? AND year = ?" + (" AND month = ?" if month else "") + (" AND cell = ?" if cell else "")
    args: list = [SCENARIO, year] + ([month] if month else []) + ([cell] if cell else [])
    col = "ESI" if layer == "ESI" else "ESI_eq"
    base = (f"SELECT cell, {col} b FROM proj_baseline_monthly WHERE month = {int(month)}" if month
            else f"SELECT cell, {col} b FROM proj_baseline")
    per_model = (f"SELECT cell, model, avg({esi_sql(layer)}) e, " + ", ".join(f"avg({s}) {s}" for s in SCORES)
                 + f" FROM proj_scores WHERE {where} GROUP BY cell, model")
    sql = (f"WITH m AS ({per_model}), b AS ({base}) SELECT m.cell, median(m.e) v, quantile_cont(m.e, 0.1) p10, "
           "quantile_cont(m.e, 0.9) p90, median(m.e) - any_value(b.b) change, count(*) n_models, "
           + ", ".join(f"median(m.{s}) {s}" for s in SCORES) + " FROM m LEFT JOIN b USING (cell) GROUP BY m.cell")
    return q(sql, *args)


def proj_field_values(layer: str, year: int, month: int, cell: str | None = None) -> list[dict]:
    """Projected parameter per cell (SSP2-4.5): median, 10th and 90th percentile of the 8 models
    (delta method; NDVI = extension of its 2001–2025 trend). Month 0 = annual mean (rain: total)."""
    table, extra, args = ("proj_monthly", " AND month = ?", [SCENARIO, year, month]) if month else ("proj_annual", "", [SCENARIO, year])
    if cell:
        extra += " AND cell = ?"
        args.append(cell)
    return q(f"SELECT cell, {layer}_med v, {layer}_p10 p10, {layer}_p90 p90 FROM {table} WHERE scenario = ? AND year = ?{extra}", *args)


def proj_series(layer: str, cell: str, month: int, after: int) -> list[dict]:
    """Projected series of one cell after the last observed year: per year, median and 10th–90th
    percentile of the models (one month, or annual values)."""
    if layer in WEIGHTS:
        if month:
            return q(f"""WITH m AS (SELECT year, model, {esi_sql(layer)} e FROM proj_scores WHERE scenario = ? AND cell = ? AND month = ? AND year > ?)
                         SELECT year, median(e) v, quantile_cont(e, 0.1) p10, quantile_cont(e, 0.9) p90 FROM m GROUP BY year ORDER BY year""",
                     SCENARIO, cell, month, after)
        return q(f"SELECT year, {layer}_med v, {layer}_p10 p10, {layer}_p90 p90 FROM proj_annual WHERE scenario = ? AND cell = ? AND year > ? ORDER BY year",
                 SCENARIO, cell, after)
    table, extra, args = ("proj_monthly", " AND month = ?", [SCENARIO, cell, month, after]) if month else ("proj_annual", "", [SCENARIO, cell, after])
    return q(f"SELECT year, {layer}_med v, {layer}_p10 p10, {layer}_p90 p90 FROM {table} WHERE scenario = ? AND cell = ?{extra} AND year > ? ORDER BY year", *args)


@lru_cache(maxsize=128)
def layer_domain(layer: str, month: int) -> tuple:
    """2nd–98th percentile of a layer over all cells and complete years (one month, or annual values),
    so the colours of the map stay comparable while the year changes."""
    if month:
        r = q(f"SELECT quantile_cont({layer}, 0.02) lo, quantile_cont({layer}, 0.98) hi FROM monthly WHERE month = ? AND {layer} IS NOT NULL", month)
    else:
        r = q(f"SELECT quantile_cont({layer}, 0.02) lo, quantile_cont({layer}, 0.98) hi FROM annual WHERE complete_year AND {layer} IS NOT NULL")
    return (r[0]["lo"], r[0]["hi"])


# ------------------------------------------------------------------ map layers
@app.get("/api/map")
def map_layer(layer: str = "ESI", year: int = 2025, month: int = Query(0, ge=0, le=12), scenario: str = SCENARIO):
    """Values per cell for one year and month (0 = the whole year). Up to the last data month: NASA
    measurements. Later years: projection of the ESI only, SSP2-4.5, median of 8 CMIP6 models."""
    check_var(layer)
    ly, lm = last_month()
    if year <= ly:
        if month == 0:
            if year > last_complete_year():
                agg = "sum" if layer == "PRECIP" else "avg"
                rows = q(f"SELECT cell, {agg}({layer}) v, count({layer}) n FROM monthly WHERE year = ? GROUP BY cell", year)
                return {"kind": "observed", "partial": True, "months": rows[0]["n"] if rows else 0, "year": year, "month": 0, "layer": layer,
                        "values": {r["cell"]: r["v"] for r in rows}, "domain": layer_domain(layer, 0)}
            rows = q(f"SELECT cell, {layer} v FROM annual WHERE year = ?", year)
        else:
            rows = q(f"SELECT cell, {layer} v FROM monthly WHERE year = ? AND month = ?", year, month)
        return {"kind": "observed", "partial": False, "year": year, "month": month, "layer": layer,
                "values": {r["cell"]: r["v"] for r in rows}, "domain": layer_domain(layer, month)}
    if scenario != SCENARIO:
        raise HTTPException(400, "only the SSP2-4.5 scenario is offered")
    if year > 2050:
        raise HTTPException(400, "projections end in 2050")
    if layer in WEIGHTS:
        rows = proj_values(layer, year, month)
        return {"kind": "projection", "scenario": SCENARIO, "year": year, "month": month, "layer": layer,
                "values": {r["cell"]: r["v"] for r in rows},
                "extra": {r["cell"]: {"p10": r["p10"], "p90": r["p90"], "change": r["change"]} for r in rows}}
    rows = proj_field_values(layer, year, month)
    return {"kind": "projection", "scenario": SCENARIO, "year": year, "month": month, "layer": layer,
            "values": {r["cell"]: r["v"] for r in rows}, "domain": layer_domain(layer, month),
            "extra": {r["cell"]: {"p10": r["p10"], "p90": r["p90"]} for r in rows}}


# ------------------------------------------------------------------ the region card of the map
@app.get("/api/panel/{cell}")
def panel(cell: str, layer: str = "ESI", year: int = 2025, month: int = Query(0, ge=0, le=12)):
    """What the map shows for one cell. Always: the value of the layer at the chosen year and month
    (0 = whole year) and its series over the years (that month, or annual values; measurements only).
    ESI layers: the five factor scores (0–1) at that time and the seasonal cycle 2001–2010 against the
    last ten complete years. Parameters: the Sen trend of the same series with its Mann-Kendall p-value
    (Hamed-Rao correction where needed), as stored by the pipeline."""
    check_var(layer)
    c = q("SELECT cell, lat, lon, region FROM cells WHERE cell = ?", cell)
    if not c:
        raise HTTPException(404, "unknown cell")
    ly, lm = last_month()
    lcy = last_complete_year()
    is_esi = layer in WEIGHTS
    out: dict = {"cell": c[0], "layer": layer, "year": year, "month": month}
    if year > ly:
        if year > 2050:
            raise HTTPException(400, "projections end in 2050")
        out.update(kind="projection", scenario=SCENARIO, n_models=8)
        if is_esi:
            r = proj_values(layer, year, month, cell)
            r = r[0] if r else {}
            out.update(value=r.get("v"), p10=r.get("p10"), p90=r.get("p90"), change=r.get("change"), n_models=r.get("n_models"),
                       factors={s: r.get(s) for s in SCORES},
                       fields={f: (proj_field_values(f, year, month, cell) or [{}])[0].get("v") for f in FIELDS})
        else:
            r = (proj_field_values(layer, year, month, cell) or [{}])[0]
            out.update(value=r.get("v"), p10=r.get("p10"), p90=r.get("p90"))
    else:
        out["kind"] = "observed"
        cols = ", ".join(FIELDS) + ", " + ", ".join(SCORES)
        if month:
            r = q(f"SELECT {layer} v, {cols} FROM monthly WHERE cell = ? AND year = ? AND month = ?", cell, year, month)
            r = r[0] if r else {}
        else:
            agg = "sum" if layer == "PRECIP" else "avg"
            r = q(f"SELECT {agg}({layer}) v, count({layer}) n, sum(PRECIP) PRECIP, "
                  + ", ".join(f"avg({f}) {f}" for f in FIELDS if f != "PRECIP") + ", "
                  + ", ".join(f"avg({s}) {s}" for s in SCORES) + " FROM monthly WHERE cell = ? AND year = ?", cell, year)[0]
            if year <= lcy:   # complete year: the stored annual value (mean, or total for rain)
                a = q(f"SELECT {layer} v FROM annual WHERE cell = ? AND year = ?", cell, year)
                r["v"] = a[0]["v"] if a else None
            else:
                out["partial_months"] = r.get("n")
        out["value"] = r.get("v")
        if is_esi:
            out["factors"] = {s: r.get(s) for s in SCORES}
            out["fields"] = {f: r.get(f) for f in FIELDS}
    first = FIRST_YEAR.get(layer, 1981)   # NDVI and the ESI start in February 2000: whole years from 2001
    if month:
        out["series"] = q(f"SELECT year, {layer} v FROM monthly WHERE cell = ? AND month = ? AND year >= ? AND {layer} IS NOT NULL ORDER BY year", cell, month, first)
    else:
        out["series"] = q(f"SELECT year, {layer} v FROM annual WHERE cell = ? AND complete_year AND year >= ? AND {layer} IS NOT NULL ORDER BY year", cell, first)
    last_obs = out["series"][-1]["year"] if out["series"] else lcy
    out["projection"] = proj_series(layer, cell, month, last_obs)
    if is_esi:
        out["seasonal"] = q(f"""SELECT month, avg(CASE WHEN year BETWEEN 2001 AND 2010 THEN {layer} END) early,
                                       avg(CASE WHEN year BETWEEN ? AND ? THEN {layer} END) late
                                FROM monthly WHERE cell = ? GROUP BY month ORDER BY month""", lcy - 9, lcy, cell)
        out["seasonal_periods"] = ["2001–2010", f"{lcy - 9}–{lcy}"]
    else:
        t = (q("SELECT n, first, last, sen_decade, p_mk FROM trends_monthly WHERE cell = ? AND var = ? AND month = ?", cell, layer, month) if month
             else q("SELECT n, first, last, sen_decade, p_mk FROM trends_annual WHERE cell = ? AND var = ?", cell, layer))
        if t and t[0]["sen_decade"] is not None:
            t = t[0]
            out["trend"] = {"per5": t["sen_decade"] / 2, "sen_decade": t["sen_decade"], "p": t["p_mk"],
                            "significant": t["p_mk"] is not None and t["p_mk"] < 0.05, "first": t["first"], "last": t["last"], "n": t["n"]}
        else:
            out["trend"] = None
    return out


# ------------------------------------------------------------------ one cell
@app.get("/api/cell/{cell}")
def cell_detail(cell: str):
    c = q("SELECT * FROM cells WHERE cell = ?", cell)
    if not c:
        raise HTTPException(404, "unknown cell")
    annual = q("SELECT * FROM annual WHERE cell = ? ORDER BY year", cell)
    trends = q("SELECT var, n, first, last, sen_decade, ci_lo, ci_hi, p_mk, ols_decade, p_ols, sig_fdr, sig_raw FROM trends_annual WHERE cell = ?", cell)
    seasonal = q("SELECT var, seasonal_sen_decade, p_seasonal, sig_fdr FROM trends_seasonal WHERE cell = ?", cell)
    by_month = q("SELECT var, month, sen_decade, p_mk, sig_fdr FROM trends_monthly WHERE cell = ? AND var IN ('ESI', 'T2M') ORDER BY var, month", cell)
    clim = q("""SELECT month,
                avg(CASE WHEN year BETWEEN 2001 AND 2010 THEN ESI END) esi_2001_2010,
                avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN ESI END) esi_2016_2025,
                avg(CASE WHEN year BETWEEN 1981 AND 1990 THEN T2M END) t_1981_1990,
                avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN T2M END) t_2016_2025,
                avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN sT END) sT, avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN sP END) sP,
                avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN sRH END) sRH, avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN sW END) sW,
                avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN sNDVI END) sNDVI
             FROM monthly WHERE cell = ? GROUP BY month ORDER BY month""", cell)
    proj = q("SELECT scenario, year, ESI_med, ESI_p10, ESI_p90, T2M_med, PRECIP_med, RH2M_med, WS10M_med FROM proj_annual WHERE cell = ? ORDER BY scenario, year", cell)
    snaps = q("SELECT scenario, snapshot, ESI, ESI_p10, ESI_p90, dESI, agree_up, base FROM proj_snapshots WHERE cell = ? AND month = 0 ORDER BY scenario, snapshot", cell)
    base = q("SELECT ESI, ESI_eq FROM proj_baseline WHERE cell = ?", cell)
    att = q("SELECT * FROM attribution WHERE cell = ?", cell)
    gbif = static_json("validation.json")["gbif"]["by_cell"]
    g = next((r for r in gbif if r["cell"] == cell), None)
    return {"cell": c[0], "annual": annual, "trends": trends, "seasonal_trends": seasonal, "monthly_trends": by_month,
            "climatology": clim, "projections": proj, "snapshots": snaps, "baseline": base[0] if base else None,
            "attribution": att[0] if att else None, "gbif": g}


@app.get("/api/cell/{cell}/monthly")
def cell_monthly(cell: str, var: str = "ESI", start: int = 1981, end: int = 2026):
    check_var(var)
    return q(f"SELECT year, month, {var} v FROM monthly WHERE cell = ? AND year BETWEEN ? AND ? ORDER BY year, month", cell, start, end)


@app.get("/api/compare")
def compare(cells: str, var: str = "ESI"):
    """Annual series of several cells side by side (cells = comma-separated ids)."""
    check_var(var)
    ids = [c for c in cells.split(",") if c][:8]
    out = {}
    for c in ids:
        out[c] = q(f"SELECT year, {var} v FROM annual WHERE cell = ? AND complete_year ORDER BY year", c)
    return out


# ------------------------------------------------------------------ Greece and regions
@app.get("/api/national")
def national():
    nat = q("SELECT * FROM national_annual ORDER BY year")
    natm = q("SELECT * FROM national_monthly ORDER BY year, month")
    trends = {}
    for v in ["T2M", "PRECIP", "RH2M", "WS10M", "NDVI", "ESI", "ESI_eq"]:
        first = 1981 if v in ("T2M", "PRECIP", "RH2M", "WS10M") else 2001
        rows = [r for r in nat if first <= r["year"] <= last_complete_year()]
        trends[v] = trend_of([r["year"] for r in rows], [r[v] if r[v] is not None else np.nan for r in rows])
    ly = last_complete_year()
    reg_now = q("SELECT region, avg(ESI) esi FROM regional_annual WHERE year BETWEEN ? AND ? GROUP BY region ORDER BY esi DESC", ly - 4, ly)
    reg_old = {r["region"]: r["esi"] for r in q("SELECT region, avg(ESI) esi FROM regional_annual WHERE year BETWEEN 2001 AND 2010 GROUP BY region")}
    for r in reg_now:
        r["esi_2001_2010"] = reg_old.get(r["region"])
        r["change"] = None if r["esi_2001_2010"] is None else r["esi"] - r["esi_2001_2010"]
    cells_now = q("""SELECT a.cell, c.region, c.lat, c.lon, avg(a.ESI) esi FROM annual a JOIN cells c USING (cell)
                     WHERE a.year BETWEEN ? AND ? GROUP BY a.cell, c.region, c.lat, c.lon ORDER BY esi DESC""", ly - 4, ly)
    proj = q("SELECT * FROM proj_national ORDER BY scenario, year")
    periods = {}
    for name, (a, b) in {"2001–2010": (2001, 2010), "2011–2020": (2011, 2020), f"{ly - 4}–{ly}": (ly - 4, ly)}.items():
        vals = [r["ESI"] for r in nat if a <= r["year"] <= b and r["ESI"] is not None]
        periods[name] = float(np.mean(vals)) if vals else None
    base = q("SELECT avg(ESI) v FROM proj_baseline")[0]["v"]
    # Greece-wide change 2041–2050 vs the 1995–2014 climate (land-weighted mean of the cells' median change)
    ch = q("""SELECT s.scenario, sum(s.dESI * c.gr_land) / sum(c.gr_land) d, avg(CASE WHEN s.dESI > 0 THEN 1.0 ELSE 0.0 END) share_up
              FROM proj_snapshots s JOIN cells c USING (cell) WHERE s.snapshot = 2050 AND s.month = 0 GROUP BY s.scenario""")
    return {"annual": nat, "monthly": natm, "trends": trends, "regions": reg_now, "cells_ranked": cells_now, "projections": proj,
            "periods": periods, "last_complete_year": ly, "last_month": {"year": last_month()[0], "month": last_month()[1]},
            "projection_baseline_unweighted": base,
            "change_2050": {r["scenario"]: {"change": r["d"], "share_up": r["share_up"]} for r in ch}}


# ------------------------------------------------------------------ places (cities) and one-place summaries
# Greek cities (name, lat, lon). Each one is matched to the grid cell that contains it, or to the
# nearest cell when its own cell has too little Greek land to be in the grid (small islands).
CITIES: list[tuple[str, float, float]] = [
    ("Αθήνα", 37.98, 23.73), ("Θεσσαλονίκη", 40.64, 22.94), ("Πάτρα", 38.25, 21.73), ("Ηράκλειο", 35.34, 25.13),
    ("Λάρισα", 39.64, 22.42), ("Βόλος", 39.36, 22.94), ("Ιωάννινα", 39.66, 20.85), ("Τρίκαλα", 39.55, 21.77),
    ("Χαλκίδα", 38.46, 23.60), ("Σέρρες", 41.09, 23.55), ("Αλεξανδρούπολη", 40.85, 25.87), ("Ξάνθη", 41.14, 24.89),
    ("Κομοτηνή", 41.12, 25.40), ("Καβάλα", 40.94, 24.41), ("Δράμα", 41.15, 24.15), ("Κατερίνη", 40.27, 22.50),
    ("Βέροια", 40.52, 22.20), ("Έδεσσα", 40.80, 22.05), ("Κιλκίς", 40.99, 22.87), ("Πολύγυρος", 40.38, 23.44),
    ("Κοζάνη", 40.30, 21.79), ("Φλώρινα", 40.78, 21.41), ("Καστοριά", 40.52, 21.27), ("Γρεβενά", 40.08, 21.43),
    ("Καρδίτσα", 39.36, 21.92), ("Λαμία", 38.90, 22.43), ("Άμφισσα", 38.53, 22.38), ("Λιβαδειά", 38.44, 22.88),
    ("Θήβα", 38.32, 23.32), ("Καλαμάτα", 37.04, 22.11), ("Τρίπολη", 37.51, 22.38), ("Σπάρτη", 37.07, 22.43),
    ("Κόρινθος", 37.94, 22.93), ("Ναύπλιο", 37.57, 22.80), ("Πύργος", 37.67, 21.44), ("Αγρίνιο", 38.62, 21.41),
    ("Μεσολόγγι", 38.37, 21.43), ("Άρτα", 39.16, 20.99), ("Πρέβεζα", 38.96, 20.75), ("Ηγουμενίτσα", 39.50, 20.27),
    ("Κέρκυρα", 39.62, 19.92), ("Λευκάδα", 38.83, 20.71), ("Αργοστόλι", 38.18, 20.49), ("Ζάκυνθος", 37.79, 20.90),
    ("Χανιά", 35.51, 24.02), ("Ρέθυμνο", 35.37, 24.47), ("Άγιος Νικόλαος", 35.19, 25.72), ("Ιεράπετρα", 35.01, 25.74),
    ("Μυτιλήνη", 39.11, 26.55), ("Χίος", 38.37, 26.14), ("Σάμος", 37.76, 26.98), ("Ρόδος", 36.43, 28.22),
    ("Κως", 36.89, 27.29), ("Ερμούπολη (Σύρος)", 37.44, 24.94), ("Νάξος", 37.10, 25.38), ("Θήρα (Σαντορίνη)", 36.42, 25.43),
    ("Μύρινα (Λήμνος)", 39.87, 25.06),
]
FAVOURABLE = 45.0      # monthly ESI from which conditions count as «ευνοϊκές» (same word scale as the UI)


def _km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(a))


@lru_cache(maxsize=1)
def places_list() -> list[dict]:
    import unicodedata
    cells = q("SELECT cell, lat, lon, region FROM cells")
    out = []
    for name, lat, lon in CITIES:
        inside = [c for c in cells if abs(c["lat"] - lat) <= 0.25 and abs(c["lon"] - lon) <= 0.3125]
        best = inside[0] if inside else min(cells, key=lambda c: _km(lat, lon, c["lat"], c["lon"]))
        d = _km(lat, lon, best["lat"], best["lon"])
        if d > 60:      # too far from any grid cell to stand for the city
            continue
        out.append({"name": name, "lat": lat, "lon": lon, "cell": best["cell"], "region": best["region"],
                    "inside": bool(inside), "km": round(d)})
    key = lambda s: "".join(ch for ch in unicodedata.normalize("NFD", s) if not unicodedata.combining(ch)).lower()
    return sorted(out, key=lambda p: key(p["name"]))


@app.get("/api/places")
def places():
    """Greek cities with the grid cell that represents each one."""
    return places_list()


def _season(values: list) -> dict:
    months = [i + 1 for i, v in enumerate(values) if v is not None and v >= FAVOURABLE]
    return {"n": len(months), "months": months}


@app.get("/api/summary/{cell}")
def summary(cell: str):
    """Everything the place and comparison views need for one cell, in plain quantities:
    suitability now and before, favourable months, trend, 2050 per scenario, the five factors and the
    climate in everyday units. Observed periods: 2001–2010 and 2016–2025 (monthly climatologies),
    the last five complete years for the headline value; projections: 2041–2050 decade means."""
    c = q("SELECT * FROM cells WHERE cell = ?", cell)
    if not c:
        raise HTTPException(404, "unknown cell")
    ly = last_complete_year()
    ann = q("SELECT year, ESI, T2M, PRECIP FROM annual WHERE cell = ? AND complete_year ORDER BY year", cell)
    now = [r["ESI"] for r in ann if ly - 4 <= r["year"] <= ly and r["ESI"] is not None]
    early = [r["ESI"] for r in ann if 2001 <= r["year"] <= 2010 and r["ESI"] is not None]
    allnow = [r["v"] for r in q("SELECT avg(ESI) v FROM annual WHERE year BETWEEN ? AND ? GROUP BY cell", ly - 4, ly)]
    esi_now = float(np.mean(now)) if now else None
    pct = None if esi_now is None else round(100 * sum(v < esi_now for v in allnow) / len(allnow))
    clim = q("""SELECT month,
                avg(CASE WHEN year BETWEEN 2001 AND 2010 THEN ESI END) e_early, avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN ESI END) e_now,
                avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN T2M END) t, avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN RH2M END) rh,
                avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN WS10M END) w, avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN NDVI END) ndvi,
                avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN sT END) sT, avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN sP END) sP,
                avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN sRH END) sRH, avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN sW END) sW,
                avg(CASE WHEN year BETWEEN 2016 AND 2025 THEN sNDVI END) sNDVI
             FROM monthly WHERE cell = ? GROUP BY month ORDER BY month""", cell)
    rain = q("SELECT avg(PRECIP) v FROM annual WHERE cell = ? AND complete_year AND year BETWEEN 2016 AND 2025", cell)[0]["v"]
    proj_m = q("SELECT scenario, month, ESI, ESI_p10, ESI_p90, dESI, agree_up, n_models FROM proj_snapshots WHERE cell = ? AND snapshot = 2050 ORDER BY scenario, month", cell)
    proj = {}
    for sc in ("ssp245", "ssp585"):
        rows = [r for r in proj_m if r["scenario"] == sc]
        yr = next((r for r in rows if r["month"] == 0), None)
        monthly = [next((r["ESI"] for r in rows if r["month"] == m), None) for m in range(1, 13)]
        proj[sc] = {"esi": yr and yr["ESI"], "p10": yr and yr["ESI_p10"], "p90": yr and yr["ESI_p90"], "change": yr and yr["dESI"],
                    "agree_up": yr and yr["agree_up"], "n_models": yr and yr["n_models"], "monthly": monthly, "season": _season(monthly)}
    tr = {r["var"]: {"sen_decade": r["sen_decade"], "ci": [r["ci_lo"], r["ci_hi"]], "p": r["p_mk"], "significant": bool(r["sig_fdr"]),
                     "first": r["first"], "last": r["last"]}
          for r in q("SELECT var, sen_decade, ci_lo, ci_hi, p_mk, sig_fdr, first, last FROM trends_annual WHERE cell = ? AND var IN ('ESI', 'T2M')", cell)}
    e_early = [r["e_early"] for r in clim]
    e_now = [r["e_now"] for r in clim]
    mean = lambda k: float(np.nanmean([r[k] if r[k] is not None else np.nan for r in clim]))
    return {
        "cell": c[0], "period_now": f"{ly - 4}–{ly}", "esi_now": esi_now, "esi_early": float(np.mean(early)) if early else None,
        "percentile": pct,
        "season": {"early": _season(e_early), "now": _season(e_now)},
        "monthly": {"early": e_early, "now": e_now},
        "trend": tr.get("ESI"), "t_trend": tr.get("T2M"),
        "proj": proj,
        "factors": {k: mean(k) for k in ("sT", "sP", "sRH", "sW", "sNDVI")},
        "climate": {"t_year": mean("t"), "t_jan": clim[0]["t"], "t_jul": clim[6]["t"], "rain_year": rain, "rh": mean("rh"), "wind": mean("w"),
                    "ndvi": mean("ndvi")},
        "annual": [{"year": r["year"], "v": r["ESI"]} for r in ann if r["ESI"] is not None],
        "favourable_threshold": FAVOURABLE,
    }


GROUPINGS = [   # (key, label, SQL expression over cells c) — descriptors only, never model inputs
    ("north", "Βόρεια / νότια Ελλάδα (όριο 39° Β)", "CASE WHEN c.north THEN 'Βόρεια' ELSE 'Νότια' END"),
    ("island", "Ηπειρωτική / νησιωτική", "CASE WHEN c.island THEN 'Νησιωτική' ELSE 'Ηπειρωτική' END"),
    ("coastal", "Παράκτια / εσωτερική", "CASE WHEN c.coastal THEN 'Παράκτια' ELSE 'Εσωτερική' END"),
    ("urban", "Αστικοποίηση (ESA WorldCover, όριο 5% δομημένης γης)", "c.urban_class"),
    ("elev", "Υψόμετρο (GMTED2010, μέσος όρος κελιού)", "c.elev_class"),
]


@app.get("/api/groups")
def groups(var: str = "ESI"):
    """Greek-land-weighted comparison of cell groups: north/south, mainland/island, coastal/inland,
    more/less urbanised and elevation bands. The attributes only describe the cells; none enters the ESI.
    Early period = first ten complete years of the variable (1981–1990, or 2001–2010 for ESI/NDVI)."""
    check_var(var)
    ly = last_complete_year()
    first = 2001 if var in ("ESI", "ESI_eq", "NDVI") else 1981
    out = []
    for key, label, expr in GROUPINGS:
        rows = q(f"""SELECT {expr} grp, a.year, sum(a.{var} * c.gr_land) / sum(c.gr_land) v
                     FROM annual a JOIN cells c USING (cell)
                     WHERE a.complete_year AND a.year BETWEEN ? AND ? AND a.{var} IS NOT NULL
                     GROUP BY grp, a.year ORDER BY grp, a.year""", first, ly)
        info = {r["grp"]: r for r in q(f"SELECT {expr} grp, count(*) n, avg(c.elev_m) elev FROM cells c GROUP BY grp")}
        proj: dict = {}
        if var == "ESI":
            for r in q(f"""SELECT {expr} grp, s.scenario, sum(s.dESI * c.gr_land) / sum(c.gr_land) d
                           FROM proj_snapshots s JOIN cells c USING (cell) WHERE s.snapshot = 2050 AND s.month = 0
                           GROUP BY grp, s.scenario"""):
                proj.setdefault(r["grp"], {})[r["scenario"]] = r["d"]
        names = sorted(info, key=lambda g: info[g]["elev"] if key == "elev" else g)
        items = []
        for g in names:
            s = [r for r in rows if r["grp"] == g]
            recent = [r["v"] for r in s if ly - 4 <= r["year"] <= ly]
            early = [r["v"] for r in s if first <= r["year"] <= first + 9]
            rm = float(np.mean(recent)) if recent else None
            em = float(np.mean(early)) if early else None
            items.append({"group": g, "cells": info[g]["n"], "recent": rm, "early": em,
                          "change": None if rm is None or em is None else rm - em,
                          "trend": trend_of([r["year"] for r in s], [r["v"] for r in s]),
                          "proj_2041_2050": proj.get(g), "series": [{"year": r["year"], "v": r["v"]} for r in s]})
        out.append({"key": key, "label": label, "groups": items})
    return {"var": var, "recent_period": f"{ly - 4}–{ly}", "early_period": f"{first}–{first + 9}", "groupings": out}


@app.get("/api/regions")
def regions(var: str = "ESI"):
    check_var(var)
    rows = q(f"SELECT region, year, {var} v FROM regional_annual ORDER BY region, year")
    out: dict = {}
    for r in rows:
        out.setdefault(r["region"], []).append({"year": r["year"], "v": r["v"]})
    return out


# ------------------------------------------------------------------ trends maps and parameters
@app.get("/api/trends")
def trends_map(var: str = "ESI", scope: str = "annual", month: int = 1):
    check_var(var)
    if scope == "annual":
        rows = q("SELECT cell, sen_decade, ci_lo, ci_hi, p_mk, sig_fdr FROM trends_annual WHERE var = ?", var)
    elif scope == "seasonal":
        rows = q("SELECT cell, seasonal_sen_decade sen_decade, p_seasonal p_mk, sig_fdr FROM trends_seasonal WHERE var = ?", var)
    else:
        rows = q("SELECT cell, sen_decade, p_mk, sig_fdr FROM trends_monthly WHERE var = ? AND month = ?", var, month)
    return {r["cell"]: r for r in rows}


@app.get("/api/param/{var}")
def param(var: str, start: int = 1981, end: int = 2026):
    check_var(var)
    agg = "sum" if var == "PRECIP" else "avg"
    natm = q(f"SELECT year, month, {var} v FROM national_monthly WHERE year BETWEEN ? AND ? ORDER BY year, month", start, end)
    nat = q(f"SELECT year, {var} v FROM national_annual WHERE year BETWEEN ? AND ? ORDER BY year", start, end)
    hi = q(f"SELECT m.cell, c.region, m.year, m.month, m.{var} v FROM monthly m JOIN cells c USING (cell) WHERE m.{var} IS NOT NULL AND m.year BETWEEN ? AND ? ORDER BY m.{var} DESC LIMIT 1", start, end)
    lo = q(f"SELECT m.cell, c.region, m.year, m.month, m.{var} v FROM monthly m JOIN cells c USING (cell) WHERE m.{var} IS NOT NULL AND m.year BETWEEN ? AND ? ORDER BY m.{var} ASC LIMIT 1", start, end)
    clim = q(f"SELECT month, avg({var}) v FROM monthly WHERE year BETWEEN ? AND ? GROUP BY month ORDER BY month", start, end)
    if var == "PRECIP":   # mean annual total over the complete years of the period
        period_map = q("SELECT cell, sum(PRECIP) / count(DISTINCT year) v FROM monthly WHERE year BETWEEN ? AND ? AND year <= ? GROUP BY cell",
                       start, end, last_complete_year())
    else:
        period_map = q(f"SELECT cell, avg({var}) v FROM monthly WHERE year BETWEEN ? AND ? GROUP BY cell", start, end)
    rows = [r for r in nat if r["v"] is not None and r["year"] <= last_complete_year()]
    tr = trend_of([r["year"] for r in rows], [r["v"] for r in rows])
    fav = None
    score = {"T2M": "sT", "PRECIP": "sP", "RH2M": "sRH", "WS10M": "sW", "NDVI": "sNDVI"}.get(var)
    if score:
        fav = q(f"""SELECT (year // 10) * 10 dec, avg(CASE WHEN {score} >= 0.8 THEN 1.0 ELSE 0.0 END) share_favourable, avg({score}) mean_score
                    FROM monthly WHERE {score} IS NOT NULL AND year <= ? GROUP BY dec ORDER BY dec""", last_complete_year())
    return {"var": var, "meta": PARAMS[var], "monthly": natm, "annual": nat, "max": hi[0] if hi else None, "min": lo[0] if lo else None,
            "climatology": clim, "map": {r["cell"]: r["v"] for r in period_map}, "trend": tr, "favourable_by_decade": fav}


# ------------------------------------------------------------------ projections
@app.get("/api/projections")
def projections(year: int = 2050, scenario: str = "ssp245"):
    nat = q("SELECT * FROM proj_national ORDER BY scenario, year")
    by_model = q("SELECT model, scenario, year, ESI FROM proj_national_by_model ORDER BY model, scenario, year")
    base = q("SELECT cell, ESI FROM proj_baseline")
    base_d = {r["cell"]: r["ESI"] for r in base}
    if year in (2030, 2040, 2050):
        cells = q("SELECT s.cell, c.region, s.ESI v, s.ESI_p10 p10, s.ESI_p90 p90, s.dESI change, s.agree_up FROM proj_snapshots s JOIN cells c USING (cell) WHERE scenario = ? AND snapshot = ? AND month = 0",
                  scenario, year)
    else:
        cells = q("SELECT p.cell, c.region, p.ESI_med v, p.ESI_p10 p10, p.ESI_p90 p90 FROM proj_annual p JOIN cells c USING (cell) WHERE scenario = ? AND year = ?", scenario, year)
        for r in cells:
            r["change"] = None if r["v"] is None else r["v"] - base_d.get(r["cell"], np.nan)
    reg: dict = {}
    for r in cells:
        reg.setdefault(r["region"], []).append(r)
    regions_change = sorted([{"region": k, "change": float(np.mean([x["change"] for x in v if x["change"] is not None])), "esi": float(np.mean([x["v"] for x in v]))}
                             for k, v in reg.items()], key=lambda d: -d["change"])
    return {"year": year, "scenario": scenario, "national": nat, "by_model": by_model, "cells": cells, "regions": regions_change,
            "baseline_note": "Αναφορά: κλίμα 1995–2014 (NASA POWER) με τις ίδιες συναρτήσεις· οι αλλαγές είναι από τα μοντέλα CMIP6 (μέθοδος delta)."}


@app.get("/api/projections/region")
def projections_region(region: str):
    """Yearly projected ESI of one region (Greek-land-weighted mean of its cells), both scenarios,
    plus the observed annual ESI of the same region."""
    proj = q("""SELECT p.scenario, p.year, sum(p.ESI_med * c.gr_land) / sum(c.gr_land) med,
                       sum(p.ESI_p10 * c.gr_land) / sum(c.gr_land) p10, sum(p.ESI_p90 * c.gr_land) / sum(c.gr_land) p90
                FROM proj_annual p JOIN cells c USING (cell) WHERE c.region = ? GROUP BY p.scenario, p.year ORDER BY p.scenario, p.year""", region)
    obs = q("SELECT year, ESI v FROM regional_annual WHERE region = ? AND ESI IS NOT NULL ORDER BY year", region)
    if not proj:
        raise HTTPException(404, "unknown region")
    return {"region": region, "projections": proj, "observed": obs}


# ------------------------------------------------------------------ custom weights (sensitivity tool)
@app.get("/api/custom")
def custom(wT: float = 0.2, wP: float = 0.2, wRH: float = 0.2, wW: float = 0.2, wN: float = 0.2, year: int = 2025):
    w = np.array([wT, wP, wRH, wW, wN], float)
    if (w < 0).any() or w.sum() <= 0:
        raise HTTPException(400, "weights must be ≥ 0 and not all zero")
    w = w / w.sum()
    expr = (f"exp({w[0]}*ln(greatest(sT,1e-6)) + {w[1]}*ln(greatest(sP,1e-6)) + {w[2]}*ln(greatest(sRH,1e-6)) + "
            f"{w[3]}*ln(greatest(sW,1e-6)) + {w[4]}*ln(greatest(sNDVI,1e-6))) * 100")
    rows = q(f"""SELECT cell, avg({expr}) v, count(*) n FROM monthly WHERE year = ? AND sNDVI IS NOT NULL GROUP BY cell""", year)
    nat = q(f"""WITH a AS (SELECT cell, year, avg({expr}) e, count(*) n FROM monthly WHERE sNDVI IS NOT NULL AND year BETWEEN 2001 AND ? GROUP BY cell, year)
                SELECT year, sum(e * c.gr_land) / sum(c.gr_land) v FROM a JOIN cells c USING (cell) WHERE n = 12 GROUP BY year ORDER BY year""", last_complete_year())
    tr = trend_of([r["year"] for r in nat], [r["v"] for r in nat])
    base = q(f"""WITH b AS (SELECT cell, avg({expr}) e FROM proj_baseline_scores GROUP BY cell)
                 SELECT sum(e * c.gr_land) / sum(c.gr_land) v FROM b JOIN cells c USING (cell)""")[0]["v"]
    fut = q(f"""WITH f AS (SELECT scenario, model, cell, avg({expr}) e FROM proj_scores WHERE year BETWEEN 2041 AND 2050 GROUP BY scenario, model, cell),
                     n AS (SELECT scenario, model, sum(e * c.gr_land) / sum(c.gr_land) v FROM f JOIN cells c USING (cell) GROUP BY scenario, model)
                SELECT scenario, median(v) v, min(v) lo, max(v) hi FROM n GROUP BY scenario""")
    return {"weights": dict(zip(["T", "P", "RH", "W", "NDVI"], w.round(4).tolist())), "year": year, "values": {r["cell"]: r["v"] for r in rows},
            "national": nat, "trend": tr, "projection_2041_2050": {r["scenario"]: {"esi": r["v"], "change": r["v"] - base, "min": r["lo"], "max": r["hi"]} for r in fut},
            "projection_baseline": base}


# ------------------------------------------------------------------ validation, science
@app.get("/api/validation")
def validation():
    return {k.split(".")[0]: static_json(k) for k in ["validation.json", "calibration.json", "sensitivity.json", "abundance.json"]}


@app.get("/api/science")
def science():
    sv = static_json("science_values.json") if (STATIC / "science_values.json").exists() else []
    params = json.loads((ROOT / "docs" / "esi_parameters.json").read_text(encoding="utf-8"))
    used = json.loads((ROOT / "data" / "processed" / "esi_parameters_used.json").read_text(encoding="utf-8"))
    return {"values": sv, "esi_parameters": used, "notes": params}


@app.get("/api/health")
def health():
    return {"ok": True, "db": DB.name, "last_month": last_month(), "last_complete_year": last_complete_year()}


# ------------------------------------------------------------------ the web app (built by web/)
if WEB.exists():
    app.mount("/assets", StaticFiles(directory=WEB / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = WEB / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(WEB / "index.html")
