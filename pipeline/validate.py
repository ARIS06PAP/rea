"""Phase 8a – reliability checks: spatial validation, sensitivity and uncertainty.

1. Spatial validation with independent presence records: GBIF occurrences of Aedes
   albopictus in Greece (taxonKey 1651430, with coordinates). Cells with at least one
   record vs cells without: does the ESI rank them higher? (ROC AUC = Mann-Whitney U / n1·n2).
   Presence-only data follow where people look (cities, surveillance programmes), so a
   "no record" cell is not a confirmed absence: the AUC is a check, not a skill score.
2. Sensitivity of the ESI to its weights (equal, trap-calibrated main, learned, temperature
   only, leave-one-parameter-out, 300 random Dirichlet weight sets around the main ones),
   to the parameters of each suitability function (±), to the way the five scores are
   combined (geometric vs arithmetic) and, for the projections, to NDVI ±10 %.
   For each variant: Greece mean ESI 2016–2025, trend 2001–2025, change by 2041–2050 under
   both scenarios, and (for weights) the correlation with the Athens 2019 trap season.
Outputs: data/processed/validation.json, data/processed/sensitivity.json
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx
import numpy as np
import pandas as pd
from scipy import stats as sps

sys.path.insert(0, str(Path(__file__).resolve().parent))
import trendstats as ts  # noqa: E402
from config import PROCESSED, RAW  # noqa: E402
import esi as E  # noqa: E402

GBIF = "https://api.gbif.org/v1/occurrence/search"


def gbif_records() -> pd.DataFrame:
    path = RAW / "gbif_aedes_albopictus_GR.json"
    if not path.exists():
        rows, offset = [], 0
        with httpx.Client(timeout=120) as c:
            while True:
                r = c.get(GBIF, params={"taxonKey": 1651430, "country": "GR", "hasCoordinate": "true",
                                        "hasGeospatialIssue": "false", "limit": 300, "offset": offset})
                r.raise_for_status()
                d = r.json()
                rows += [{"key": x.get("key"), "lat": x.get("decimalLatitude"), "lon": x.get("decimalLongitude"),
                          "year": x.get("year"), "basis": x.get("basisOfRecord"), "dataset": x.get("datasetName") or x.get("datasetKey"),
                          "uncertainty_m": x.get("coordinateUncertaintyInMeters")} for x in d["results"]]
                offset += 300
                if d.get("endOfRecords") or offset >= d.get("count", 0):
                    break
                time.sleep(0.5)
        path.write_text(json.dumps(rows), encoding="utf-8")
    return pd.DataFrame(json.loads(path.read_text(encoding="utf-8")))


def auc(pos: np.ndarray, neg: np.ndarray) -> float:
    u = sps.mannwhitneyu(pos, neg, alternative="two-sided").statistic
    return float(u / (len(pos) * len(neg)))


def national(esi_monthly: pd.Series, m: pd.DataFrame, w: pd.Series) -> pd.DataFrame:
    d = m[["cell", "year", "month"]].copy()
    d["ESI"] = esi_monthly.to_numpy()
    ann = d.groupby(["cell", "year"]).agg(ESI=("ESI", "mean"), n=("ESI", "count")).reset_index()
    ann = ann[ann["n"] == 12]
    ann["w"] = ann["cell"].map(w)
    return ann.groupby("year").apply(lambda g: np.average(g["ESI"], weights=g["w"])).rename("ESI").reset_index()


def summarise(name: str, esi_obs: pd.Series, m: pd.DataFrame, w: pd.Series, proj: dict | None) -> dict:
    nat = national(esi_obs, m, w)
    nat = nat[(nat["year"] >= 2001) & (nat["year"] <= 2025)]
    t = ts.analyze_annual(nat["year"].to_numpy(), nat["ESI"].to_numpy())
    out = {"variant": name, "esi_2016_2025": round(float(nat[nat["year"] >= 2016]["ESI"].mean()), 2),
           "trend_decade": round(t.slope_per_decade, 2), "trend_p": round(t.p_value, 4)}
    if proj:
        out.update(proj)
    return out


def main() -> None:
    E.load_overrides()
    cells = pd.read_parquet(PROCESSED / "cells.parquet")
    w = cells.set_index("cell")["gr_land"]
    m = pd.read_parquet(PROCESSED / "monthly.parquet")
    m = m[m["year"] <= 2025].reset_index(drop=True)
    ann = pd.read_parquet(PROCESSED / "esi_annual.parquet")
    recent = ann[(ann["year"] >= 2016) & (ann["year"] <= 2025)].groupby("cell")[["ESI", "ESI_eq"]].mean()

    # ---------------------------------------------------------------- 1. GBIF spatial check
    g = gbif_records().dropna(subset=["lat", "lon"])
    g = g[(g["uncertainty_m"].isna()) | (g["uncertainty_m"] <= 25000)]
    def to_cell(lat, lon):
        la = 34.0 + 0.5 * round((lat - 34.0) / 0.5)
        lo = 19.375 + 0.625 * round((lon - 19.375) / 0.625)
        return f"{la:.3f}_{lo:.3f}"
    g["cell"] = [to_cell(a, b) for a, b in zip(g["lat"], g["lon"])]
    g = g[g["cell"].isin(cells["cell"])]
    pres = g.groupby("cell").agg(n=("key", "count"), first_year=("year", "min")).reset_index()
    r = recent.reset_index().merge(pres, on="cell", how="left")
    r["present"] = r["n"].fillna(0) > 0
    validation = {
        "gbif": {"records_used": int(len(g)), "cells_with_records": int(r["present"].sum()), "cells_total": int(len(r)),
                 "years": [int(g["year"].min()), int(g["year"].max())] if g["year"].notna().any() else None,
                 "auc_main_esi": round(auc(r.loc[r["present"], "ESI"].to_numpy(), r.loc[~r["present"], "ESI"].to_numpy()), 3),
                 "auc_equal_weights": round(auc(r.loc[r["present"], "ESI_eq"].to_numpy(), r.loc[~r["present"], "ESI_eq"].to_numpy()), 3),
                 "mean_esi_with_records": round(float(r.loc[r["present"], "ESI"].mean()), 1),
                 "mean_esi_without": round(float(r.loc[~r["present"], "ESI"].mean()), 1),
                 "by_cell": r[["cell", "ESI", "n", "first_year"]].fillna({"n": 0}).round(2).to_dict("records")},
    }
    ab = json.loads((PROCESSED / "abundance.json").read_text(encoding="utf-8"))
    validation["temporal_athens"] = ab["athens"].get("validation_2019_season")
    validation["hobo_vs_nasa"] = ab["athens"].get("hobo_vs_power")
    validation["thessaly_genus_aedes"] = {k: v for k, v in ab.get("thessaly", {}).items() if k != "cells"}
    (PROCESSED / "validation.json").write_text(json.dumps(validation, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print(json.dumps({k: (v if k != "gbif" else {kk: vv for kk, vv in v.items() if kk != "by_cell"}) for k, v in validation.items()}, ensure_ascii=False, indent=1, default=str))

    # ---------------------------------------------------------------- 2. sensitivity
    sc_obs = E.scores(m)
    fields = pd.read_parquet(PROCESSED / "projections_fields.parquet")
    fields = fields[fields["year"].between(2041, 2050)]
    base_f = pd.read_parquet(PROCESSED / "projection_baseline_fields.parquet")
    athens = pd.read_parquet(PROCESSED / "athens_weekly.parquet")
    test = athens[pd.to_datetime(athens["start"]).dt.year == 2019]

    def proj_change(weights: dict, params: dict, method: str = "geometric", ndvi_factor: float = 1.0) -> dict:
        def esi_of(df):
            d = df.copy()
            d["NDVI"] = d["NDVI"] * ndvi_factor
            return E.esi_from_scores(E.scores(d, params), weights, method)
        b = base_f.copy()
        b["ESI"] = esi_of(base_f)
        b_ann = b.groupby("cell")["ESI"].mean()
        base_nat = np.average(b_ann, weights=b_ann.index.map(w))
        out = {}
        f = fields.copy()
        f["ESI"] = esi_of(fields)
        per = f.groupby(["scenario", "model", "cell"])["ESI"].mean().reset_index()
        for sc, d in per.groupby("scenario"):
            nat = d.groupby("model").apply(lambda x: np.average(x["ESI"], weights=x["cell"].map(w)))
            out[f"d2050_{sc}"] = round(float(np.median(nat) - base_nat), 2)
        return out

    def trap_rho(weights: dict) -> float:
        e = E.esi_from_scores(test[["sT", "sP", "sRH", "sW", "sNDVI"]], weights)
        return round(float(sps.spearmanr(e, test["rate"])[0]), 3)

    rows = []
    main_w = dict(E.WEIGHTS)
    variants = {"main (trap-calibrated)": main_w, "equal": E.EQUAL,
                "temperature only": {"T": 1, "P": 1e-9, "RH": 1e-9, "W": 1e-9, "NDVI": 1e-9}}
    for k in main_w:
        variants[f"without {k}"] = {kk: (1e-9 if kk == k else v) for kk, v in main_w.items()}
    for name, wv in variants.items():
        row = summarise(name, E.esi_from_scores(sc_obs, wv), m, w, proj_change(wv, E.P))
        row["athens_2019_rho"] = trap_rho(wv)
        row["weights"] = {k: round(v, 3) for k, v in wv.items()}
        rows.append(row)
    rows.append({**summarise("arithmetic combination (main weights)", E.esi_from_scores(sc_obs, main_w, "arithmetic"), m, w,
                             proj_change(main_w, E.P, "arithmetic")), "athens_2019_rho": None})
    for f in (0.9, 1.1):
        rows.append({"variant": f"NDVI ×{f} in the future", **proj_change(main_w, E.P, ndvi_factor=f)})
    perturb = {"T_lo": (-1, 1), "T_hi": (-1, 1), "T_cold": (-2, 2), "P_lo": (-27, 27), "RH_lo": (-10, 10), "W_mid": (-0.5, 0.5), "NDVI_mid": (-0.05, 0.05)}
    for k, deltas in perturb.items():
        for dlt in deltas:
            pp = {**E.P, k: E.P[k] + dlt}
            rows.append({**summarise(f"{k} {dlt:+g}", E.esi_from_scores(E.scores(m, pp), main_w), m, w, proj_change(main_w, pp))})
    # random weights around the main ones (Dirichlet, concentration 20)
    rng = np.random.default_rng(42)
    keys = list(main_w)
    mc = []
    for _ in range(300):
        draw = rng.dirichlet(np.array([main_w[k] for k in keys]) * 20)
        wv = dict(zip(keys, draw))
        e = E.esi_from_scores(sc_obs, wv)
        nat = national(e, m, w)
        mc.append({"esi_2016_2025": float(nat[nat["year"] >= 2016]["ESI"].mean()), "athens_2019_rho": trap_rho(wv)})
    mcd = pd.DataFrame(mc)
    sens = {"variants": rows, "monte_carlo_weights": {
        "n": len(mcd), "esi_2016_2025_p05_p95": [round(float(mcd["esi_2016_2025"].quantile(q)), 2) for q in (0.05, 0.95)],
        "athens_rho_p05_p95": [round(float(mcd["athens_2019_rho"].quantile(q)), 3) for q in (0.05, 0.95)]}}
    (PROCESSED / "sensitivity.json").write_text(json.dumps(sens, ensure_ascii=False, indent=1), encoding="utf-8")
    print(pd.DataFrame(rows).drop(columns=["weights"], errors="ignore").to_string())
    print(sens["monte_carlo_weights"])


if __name__ == "__main__":
    main()
