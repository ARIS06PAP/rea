"""Phase 2c – turn the raw downloads into the stored dataset (Parquet + JSON).

Outputs (data/processed/):
* cells.parquet   – one row per grid cell that contains Greek land (≥ 2 % of the cell):
                    lat, lon, region (13 Greek regions), mainland/island share, coastal,
                    north/south, urban share, mean elevation (descriptor only).
* monthly.parquet – one row per cell × month: T2M (°C), PRECIP (mm/month), RH2M (%),
                    WS10M (m/s) from NASA POWER, NDVI from MODIS (from 2000-02), plus the
                    35-day precipitation estimate used by the suitability function.
* coverage.json   – first/last month of every parameter, the common period, gaps.

Rules kept here: no gap filling, no invented values; NASA fill values (−999) become
missing; months that are not complete are not created.
"""
from __future__ import annotations

import calendar
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import PROCESSED, RAW_EE, RAW_POWER  # noqa: E402

REGION_EL = {
    "Anatoliki Makedonia Kai Thraki": "Ανατολική Μακεδονία και Θράκη",
    "Kentriki Makedonia": "Κεντρική Μακεδονία",
    "Dytiki Makedonia": "Δυτική Μακεδονία",
    "Ipeiros": "Ήπειρος",
    "Thessalia": "Θεσσαλία",
    "Ionioi Nisoi": "Ιόνια Νησιά",
    "Dytiki Ellada": "Δυτική Ελλάδα",
    "Sterea Ellada": "Στερεά Ελλάδα",
    "Attiki": "Αττική",
    "Peloponnisos": "Πελοπόννησος",
    "Voreio Aigaio": "Βόρειο Αιγαίο",
    "Notio Aigaio": "Νότιο Αιγαίο",
    "Kriti": "Κρήτη",
}
MIN_GREEK_LAND = 0.02


def cell_id(lat: float, lon: float) -> str:
    return f"{lat:.3f}_{lon:.3f}"


def load_power() -> pd.DataFrame:
    frames = []
    for param in ["T2M", "PRECTOTCORR", "RH2M", "WS10M"]:
        path = sorted(RAW_POWER.glob(f"{param}_monthly_*.json"))[-1]
        d = json.loads(path.read_text(encoding="utf-8"))
        fill = d["header"].get("fill_value", -999.0)
        rows = []
        for f in d["features"]:
            lon, lat = f["geometry"]["coordinates"][:2]
            for key, v in f["properties"]["parameter"][param].items():
                y, m = int(key[:4]), int(key[4:])
                if m == 13 or v is None or v == fill:
                    continue
                rows.append((cell_id(lat, lon), lat, lon, y, m, float(v)))
        df = pd.DataFrame(rows, columns=["cell", "lat", "lon", "year", "month", param])
        frames.append(df.set_index(["cell", "lat", "lon", "year", "month"]))
    out = pd.concat(frames, axis=1).reset_index()
    days = out.apply(lambda r: calendar.monthrange(int(r.year), int(r.month))[1], axis=1)
    out["PRECIP"] = out.pop("PRECTOTCORR") * days          # POWER gives the month's mean daily rate (mm/day)
    return out


def precip_35(df: pd.DataFrame) -> pd.Series:
    """35-day rainfall ending on the last day of each month, from monthly totals:
    the whole month plus the last (35 − days) days of the previous month, with rain spread
    evenly inside each month. An approximation (no daily data in this product); documented."""
    df = df.sort_values(["cell", "year", "month"])
    nd = df.apply(lambda r: calendar.monthrange(int(r.year), int(r.month))[1], axis=1)
    prev = df.groupby("cell")["PRECIP"].shift(1)
    prev_nd = nd.groupby(df["cell"]).shift(1)
    return df["PRECIP"] + prev * (35 - nd) / prev_nd


def load_attributes() -> pd.DataFrame:
    rows = json.loads((RAW_EE / "cell_attributes.json").read_text(encoding="utf-8"))
    a = pd.DataFrame(rows)
    a = a[a["gr_land"].fillna(0) >= MIN_GREEK_LAND].copy()
    a["region"] = a["region"].map(REGION_EL).fillna(a["region"])
    share_main = (a["gr_mainland"] / a["gr_land"]).clip(0, 1)
    a["island"] = share_main < 0.5
    a["coastal"] = a["land"] < 0.95
    a["north"] = a["lat"] >= 39.0
    a["urban_share"] = a["urban"].fillna(0)
    a["urban_class"] = np.where(a["urban_share"] >= 0.05, "πιο αστικοποιημένο", "λιγότερο αστικοποιημένο")
    a["elev_m"] = a["elev"]
    a["elev_class"] = pd.cut(a["elev_m"], [-1e9, 200, 600, 1e9], labels=["χαμηλό (<200 m)", "μέσο (200–600 m)", "υψηλό (>600 m)"]).astype(str)
    a["mainland_share"] = share_main
    return a[["cell", "lat", "lon", "land", "gr_land", "mainland_share", "island", "coastal", "north",
              "region", "urban_share", "urban_class", "elev_m", "elev_class"]]


def load_ndvi() -> pd.DataFrame:
    rows = []
    for p in sorted(RAW_EE.glob("ndvi_*.json")):
        rows += json.loads(p.read_text(encoding="utf-8"))
    n = pd.DataFrame(rows)
    n["year"] = n["date"].str[:4].astype(int)
    n["month"] = n["date"].str[5:7].astype(int)
    n = n.rename(columns={"ndvi": "NDVI", "n_good": "NDVI_n"})
    return n[["cell", "year", "month", "NDVI", "NDVI_n"]]


def main() -> None:
    cells = load_attributes()
    power = load_power()
    power = power[power["cell"].isin(cells["cell"])]
    power["P35"] = precip_35(power)
    ndvi = load_ndvi()
    monthly = power.merge(ndvi, on=["cell", "year", "month"], how="left").sort_values(["cell", "year", "month"])
    monthly.loc[monthly["NDVI_n"].fillna(0) < 10, "NDVI"] = np.nan   # too few good pixels: missing, not guessed

    coverage = {}
    for col in ["T2M", "PRECIP", "RH2M", "WS10M", "NDVI"]:
        ok = monthly.dropna(subset=[col])
        first = ok.sort_values(["year", "month"]).iloc[0]
        last = ok.sort_values(["year", "month"]).iloc[-1]
        coverage[col] = {"first": f"{int(first.year)}-{int(first.month):02d}", "last": f"{int(last.year)}-{int(last.month):02d}",
                         "missing_cell_months": int(monthly[col].isna().sum())}
    starts = [coverage[c]["first"] for c in coverage]
    ends = [coverage[c]["last"] for c in coverage]
    coverage["common_period"] = {"first": max(starts), "last": min(ends)}
    coverage["cells"] = int(len(cells))
    coverage["last_complete_year"] = int(monthly.groupby("year")["month"].nunique().loc[lambda s: s == 12].index.max())

    cells.to_parquet(PROCESSED / "cells.parquet", index=False)
    monthly.to_parquet(PROCESSED / "monthly.parquet", index=False)
    (PROCESSED / "coverage.json").write_text(json.dumps(coverage, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(coverage, ensure_ascii=False, indent=1))
    print(cells.groupby("region").size().to_string())


if __name__ == "__main__":
    main()
