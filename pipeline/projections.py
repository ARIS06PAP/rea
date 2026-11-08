"""Phase 5b – ESI to 2050 under SSP2-4.5 and SSP5-8.5 (NASA NEX-GDDP-CMIP6, 8 models).

Delta (change-factor) method, per grid cell, calendar month and model:
* temperature:  T_future = T_obs(1995–2014) + [tas_model(year) − tas_model(1995–2014)]
* rain:         P_future = P_obs(1995–2014) × [pr_model(year) / pr_model(1995–2014)]   (ratio capped 0.2–3)
* humidity:     RH_future = RH_obs(1995–2014) + Δhurs                                   (clipped 1–100 %)
* wind:         W_future = W_obs(1995–2014) × [sfcWind_model(year) / sfcWind_model(1995–2014)]
* NDVI:         no climate model projects it, so its observed Sen trend (MODIS 2001–2025, per
                cell and month) is extended from the 2016–2025 monthly climatology (centred on
                2020.5), clipped to 0.05–0.95. A statistical extension, labelled as such; ±10 % in
                the sensitivity analysis.
The ESI of every model, month and year is then computed from these five projected
parameters with the same suitability functions and weighted geometric mean as the observed
ESI. projections_monthly.parquet keeps the ensemble (median, 10th, 90th percentile) of each
projected parameter, so the app can show the parameters as well as the ESI.
The model changes are smoothed with an 11-year centred running mean so the yearly series
shows the climate signal, not one model year's weather. "Observed" means NASA POWER;
the model's own bias cancels in the delta. The baseline ESI is computed from the observed
1995–2014 climatology with the same functions, so every change is like-for-like.

Snapshots for the map: 2030 = 2021–2030, 2040 = 2031–2040, 2050 = 2041–2050 (ensemble
median of the 8 models, with the 10th–90th percentile and the share of models that agree
on the sign of the change).
"""
from __future__ import annotations

import calendar
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import GDDP_MODELS, HIST_BASE, PROCESSED, RAW_EE, SCENARIOS  # noqa: E402
from esi import EQUAL, WEIGHTS, esi_from_scores, load_overrides, scores  # noqa: E402

CMIP = RAW_EE / "cmip6"
BANDS = ["tas", "pr", "hurs", "sfcWind"]


def load_cmip(cells: set[str]) -> pd.DataFrame:
    frames = []
    for f in CMIP.glob("*.json"):
        model, scenario, year = f.stem.rsplit("_", 2)
        rows = json.loads(f.read_text(encoding="utf-8"))
        recs = []
        for r in rows:
            if r["cell"] not in cells:
                continue
            for mth in range(1, 13):
                recs.append((r["cell"], mth, *[r.get(f"{b}_{mth:02d}") for b in BANDS]))
        df = pd.DataFrame(recs, columns=["cell", "month", *BANDS])
        df["model"], df["scenario"], df["year"] = model, scenario, int(year)
        frames.append(df)
    d = pd.concat(frames, ignore_index=True)
    d["tas"] = d["tas"] - 273.15
    d["pr"] = d["pr"] * 86400.0                     # kg m-2 s-1 → mm/day
    return d


def p35_from_monthly(df: pd.DataFrame, key: list[str]) -> pd.Series:
    """Same 35-day approximation as for the observations: the month plus the last
    (35 − days) days of the previous month. January takes December of the same group
    (a climatological stand-in for the previous year's December)."""
    df = df.sort_values(key + ["month"])
    nd = df["month"].map(lambda m: calendar.monthrange(2001, int(m))[1])
    prev = df.groupby(key)["PRECIP"].shift(1)
    dec = df.groupby(key)["PRECIP"].transform("last")
    prev = prev.where(df["month"] != 1, dec)
    prev_nd = df["month"].map(lambda m: calendar.monthrange(2001, 12 if int(m) == 1 else int(m) - 1)[1])
    return (df["PRECIP"] + prev * (35 - nd) / prev_nd).reindex(df.index)


def esi_frame(df: pd.DataFrame) -> pd.DataFrame:
    sc = scores(df)
    df = df.copy()
    df["ESI"] = esi_from_scores(sc, WEIGHTS)
    df["ESI_eq"] = esi_from_scores(sc, EQUAL)
    return df


def main() -> None:
    load_overrides()
    cells = pd.read_parquet(PROCESSED / "cells.parquet")
    w = cells.set_index("cell")["gr_land"]
    obs = pd.read_parquet(PROCESSED / "monthly.parquet")
    base = obs[(obs["year"] >= HIST_BASE[0]) & (obs["year"] <= HIST_BASE[1])].groupby(["cell", "month"])[["T2M", "PRECIP", "RH2M", "WS10M"]].mean()
    ndvi = obs[(obs["year"] >= 2016) & (obs["year"] <= 2025)].groupby(["cell", "month"])["NDVI"].mean()
    base = base.join(ndvi).reset_index()

    cm = load_cmip(set(cells["cell"]))
    hist = cm[(cm["scenario"] == "historical") & (cm["year"].between(*HIST_BASE))].groupby(["model", "cell", "month"])[BANDS].mean()
    fut = cm[cm["scenario"].isin(SCENARIOS)].copy()
    fut = fut.join(hist, on=["model", "cell", "month"], rsuffix="_h")  # noqa
    fut["dT"] = fut["tas"] - fut["tas_h"]
    fut["rP"] = (fut["pr"] / fut["pr_h"]).clip(0.2, 3.0)
    fut["dRH"] = fut["hurs"] - fut["hurs_h"]
    fut["rW"] = (fut["sfcWind"] / fut["sfcWind_h"]).clip(0.5, 2.0)
    fut = fut.sort_values(["model", "scenario", "cell", "month", "year"])
    g = fut.groupby(["model", "scenario", "cell", "month"])
    for c in ["dT", "rP", "dRH", "rW"]:
        fut[c + "_s"] = g[c].transform(lambda s: s.rolling(11, center=True, min_periods=6).mean())

    fut = fut.merge(base, on=["cell", "month"], how="left")
    fut["T2M"] = fut["T2M"] + fut["dT_s"]
    fut["PRECIP"] = fut["PRECIP"] * fut["rP_s"]
    fut["RH2M"] = (fut["RH2M"] + fut["dRH_s"]).clip(1, 100)
    fut["WS10M"] = fut["WS10M"] * fut["rW_s"]
    nd = pd.read_parquet(PROCESSED / "trends_monthly.parquet")
    nd = nd[nd["var"] == "NDVI"][["cell", "month", "sen_decade"]].rename(columns={"sen_decade": "ndvi_dec"})
    fut = fut.merge(nd, on=["cell", "month"], how="left")
    fut["NDVI"] = (fut["NDVI"] + fut["ndvi_dec"].fillna(0.0) / 10.0 * (fut["year"] - 2020.5)).clip(0.05, 0.95)
    fut["P35"] = p35_from_monthly(fut, ["model", "scenario", "cell", "year"])
    fut = esi_frame(fut)
    keep = ["model", "scenario", "cell", "year", "month", "T2M", "PRECIP", "RH2M", "WS10M", "NDVI", "P35"]
    fut[keep].to_parquet(PROCESSED / "projections_fields.parquet", index=False)   # for the sensitivity analysis
    fields = ["T2M", "PRECIP", "RH2M", "WS10M", "NDVI"]
    gm = fut.groupby(["scenario", "cell", "year", "month"])[fields]
    mon = gm.median().add_suffix("_med").join(gm.quantile(0.1).add_suffix("_p10")).join(gm.quantile(0.9).add_suffix("_p90")).reset_index()
    mon.to_parquet(PROCESSED / "projections_monthly.parquet", index=False)

    b = base.copy()
    b["P35"] = p35_from_monthly(b.assign(k=1), ["cell"])
    b = esi_frame(b)
    b[["cell", "month", "T2M", "PRECIP", "RH2M", "WS10M", "NDVI", "P35"]].to_parquet(PROCESSED / "projection_baseline_fields.parquet", index=False)
    base_ann = b.groupby("cell")[["ESI", "ESI_eq", "T2M", "PRECIP", "RH2M", "WS10M"]].agg(
        {"ESI": "mean", "ESI_eq": "mean", "T2M": "mean", "PRECIP": "sum", "RH2M": "mean", "WS10M": "mean"})
    base_ann.to_parquet(PROCESSED / "projection_baseline.parquet")
    b[["cell", "month", "ESI", "ESI_eq"]].to_parquet(PROCESSED / "projection_baseline_monthly.parquet", index=False)

    ann = fut.groupby(["model", "scenario", "cell", "year"]).agg(
        ESI=("ESI", "mean"), ESI_eq=("ESI_eq", "mean"), T2M=("T2M", "mean"), PRECIP=("PRECIP", "sum"),
        RH2M=("RH2M", "mean"), WS10M=("WS10M", "mean"), NDVI=("NDVI", "mean")).reset_index()
    ann.to_parquet(PROCESSED / "projections_by_model.parquet", index=False)

    cols = ["ESI", "ESI_eq", "T2M", "PRECIP", "RH2M", "WS10M", "NDVI"]
    q = ann.groupby(["scenario", "cell", "year"])
    ens = q[cols].median().add_suffix("_med").join(q[cols].quantile(0.1).add_suffix("_p10")).join(
        q[cols].quantile(0.9).add_suffix("_p90")).reset_index()
    ens.to_parquet(PROCESSED / "projections_annual.parquet", index=False)

    # national series (weighted by Greek land), per model then ensemble
    ann["w"] = ann["cell"].map(w)
    nat = ann.groupby(["model", "scenario", "year"]).apply(
        lambda d: pd.Series({c: np.average(d[c], weights=d["w"]) for c in cols})).reset_index()
    natq = nat.groupby(["scenario", "year"])
    nat_ens = natq[cols].median().add_suffix("_med").join(natq[cols].quantile(0.1).add_suffix("_p10")).join(
        natq[cols].quantile(0.9).add_suffix("_p90")).join(
        natq["ESI"].min().rename("ESI_min")).join(natq["ESI"].max().rename("ESI_max")).reset_index()
    nat_ens.to_parquet(PROCESSED / "projections_national.parquet", index=False)
    nat.to_parquet(PROCESSED / "projections_national_by_model.parquet", index=False)

    # snapshots (decade ending in the year): annual and monthly ESI, change vs observed baseline
    snaps = {2030: (2021, 2030), 2040: (2031, 2040), 2050: (2041, 2050)}
    rows = []
    for snap, (y0, y1) in snaps.items():
        sel = fut[fut["year"].between(y0, y1)]
        per_model_month = sel.groupby(["scenario", "model", "cell", "month"])[["ESI", "ESI_eq"]].mean().reset_index()
        per_model_ann = per_model_month.groupby(["scenario", "model", "cell"])[["ESI", "ESI_eq"]].mean().reset_index().assign(month=0)
        both = pd.concat([per_model_month, per_model_ann])
        bmon = b.set_index(["cell", "month"])[["ESI", "ESI_eq"]]
        bann = base_ann[["ESI", "ESI_eq"]]
        def base_of(r):
            return bann.loc[r["cell"]] if r["month"] == 0 else bmon.loc[(r["cell"], r["month"])]
        both = both.join(pd.concat([bmon.reset_index(), bann.reset_index().assign(month=0)]).set_index(["cell", "month"]),
                         on=["cell", "month"], rsuffix="_base")  # noqa
        both["dESI"] = both["ESI"] - both["ESI_base"]
        agg = both.groupby(["scenario", "cell", "month"]).agg(
            ESI=("ESI", "median"), ESI_p10=("ESI", lambda s: s.quantile(0.1)), ESI_p90=("ESI", lambda s: s.quantile(0.9)),
            ESI_eq=("ESI_eq", "median"), base=("ESI_base", "first"), dESI=("dESI", "median"),
            agree_up=("dESI", lambda s: float((s > 0).mean())), n_models=("model", "nunique")).reset_index()
        agg["snapshot"] = snap
        rows.append(agg)
    snap_df = pd.concat(rows, ignore_index=True)
    snap_df.to_parquet(PROCESSED / "projections_snapshots.parquet", index=False)

    base_nat = float(np.average(base_ann["ESI"], weights=base_ann.index.map(w)))
    print(f"baseline ESI (observed 1995–2014 climate): Greece {base_nat:.1f}")
    for sc in SCENARIOS:
        for snap in snaps:
            s = snap_df[(snap_df["scenario"] == sc) & (snap_df["snapshot"] == snap) & (snap_df["month"] == 0)]
            wm = np.average(s["ESI"], weights=s["cell"].map(w))
            up = (s["dESI"] > 0).mean()
            robust = ((s["agree_up"] >= 0.75) | (s["agree_up"] <= 0.25)).mean()
            print(f"{sc} {snap}: Greece ESI {wm:.1f} (Δ {wm - base_nat:+.1f}); cells up {up:.0%}; ≥75% model agreement {robust:.0%}")


if __name__ == "__main__":
    main()
