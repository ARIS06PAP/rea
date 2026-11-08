"""Phase 7 – real abundance data: does the ESI follow the mosquitoes that were actually caught?

Data (both CC BY 4.0):
* Athens, Moschato–Tavros 2018–2020 (Zenodo 10.5281/zenodo.23580672, LIFE CONOPS):
  weekly BG-Sentinel catches of adult female Aedes albopictus at six traps + HOBO
  temperature/humidity loggers at four of them.
* Thessaly 2021–2023 (Mendeley Data 10.17632/9frz4845vw.1, Ecodevelopment): 24-hour
  CO2/UV trap nights in the Larisa and Karditsa regional units; Aedes is counted at genus
  level only (in rural CO2 traps mostly floodwater Aedes, not only the tiger mosquito), so
  it is used as a secondary check.

What is done:
1. HOBO microclimate vs NASA POWER daily (same days): can NASA data stand in for local sensors?
2. Weekly ESI from NASA POWER daily data (same suitability functions) vs weekly catches,
   lags 0–4 weeks; Spearman correlations.
3. Negative binomial regression of weekly catches on the log suitability scores (trap
   effects, log trapping effort as offset) → data-driven weights. Temporal validation:
   fitted on the 2018 season, tested on the 2019 season (nothing from 2019 used in fitting).
4. Monthly ESI of the grid cell vs monthly mean catches (Athens, Thessaly).
Outputs: data/processed/abundance_*.json, docs/abundance_validation.md
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx
import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats as sps

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import DOCS, PROCESSED, RAW, RAW_POWER  # noqa: E402
from esi import COLS, EQUAL, WEIGHTS, esi_from_scores, load_overrides, s_humidity, s_ndvi, s_precip35, s_temperature, s_wind  # noqa: E402

TRAPS = RAW / "traps"
DAILY = "https://power.larc.nasa.gov/api/temporal/daily/point"


def power_daily(lat: float, lon: float, start: str, end: str, tag: str) -> pd.DataFrame:
    path = RAW_POWER / f"daily_{tag}_{start}_{end}.json"
    if not path.exists():
        params = {"parameters": "T2M,RH2M,PRECTOTCORR,WS10M", "community": "AG", "latitude": lat, "longitude": lon,
                  "start": start, "end": end, "format": "JSON"}
        for attempt in range(4):
            try:
                r = httpx.get(DAILY, params=params, timeout=300)
                r.raise_for_status()
                path.write_text(r.text, encoding="utf-8")
                break
            except Exception:  # noqa: BLE001
                time.sleep(20 * (attempt + 1))
    d = json.loads(path.read_text(encoding="utf-8"))
    par = d["properties"]["parameter"]
    fill = d["header"].get("fill_value", -999.0)
    df = pd.DataFrame({k: pd.Series(v) for k, v in par.items()})
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    return df.replace(fill, np.nan)


def weekly_predictors(daily: pd.DataFrame, start: pd.Timestamp, end: pd.Timestamp, lag_weeks: int) -> dict:
    s, e = start - pd.Timedelta(weeks=lag_weeks), end - pd.Timedelta(weeks=lag_weeks)
    win = daily.loc[s:e]
    p35 = daily.loc[e - pd.Timedelta(days=34):e, "PRECTOTCORR"].sum(min_count=30)
    return {"T": win["T2M"].mean(), "RH": win["RH2M"].mean(), "W": win["WS10M"].mean(), "P35": p35}


def esi_week(pred: dict, ndvi: float) -> dict:
    sc = {"sT": float(s_temperature([pred["T"]])[0]), "sP": float(s_precip35([pred["P35"]])[0]),
          "sRH": float(s_humidity([pred["RH"]])[0]), "sW": float(s_wind([pred["W"]])[0]), "sNDVI": float(s_ndvi([ndvi])[0])}
    sc["ESI"] = float(esi_from_scores(pd.DataFrame([sc]), EQUAL)[0])   # equal weights: the lag table must not depend on calibrated weights
    return sc


def nb_fit(df: pd.DataFrame, cols: list[str]):
    X = pd.get_dummies(df[["trap_id"]], drop_first=True, dtype=float)
    for c in cols:
        v = df[c].to_numpy(float) / (100.0 if c == "ESI" else 1.0)   # ESI is 0–100, the scores 0–1
        X[c] = np.log(np.clip(v, 1e-3, 1))
    X = sm.add_constant(X)
    df = df[df["effort"] > 0]
    X = X.loc[df.index]
    model = sm.GLM(df["count"].astype(float), X, family=sm.families.NegativeBinomial(alpha=1.0), offset=np.log(df["effort"]))
    # estimate alpha by profile over a grid (statsmodels GLM keeps alpha fixed)
    best = None
    for a in [0.2, 0.4, 0.6, 0.8, 1.0, 1.5, 2.0, 3.0]:
        res = sm.GLM(df["count"].astype(float), X, family=sm.families.NegativeBinomial(alpha=a), offset=np.log(df["effort"])).fit()
        if best is None or res.llf > best[1].llf:
            best = (a, res)
    return best, X.columns


def main() -> None:
    load_overrides()   # corrected function parameters (docs/esi_parameters.json)
    out: dict = {"athens": {}, "thessaly": {}}
    cells = pd.read_parquet(PROCESSED / "cells.parquet")
    em = pd.read_parquet(PROCESSED / "esi_monthly.parquet")

    # ---------------------------------------------------------------- Athens
    z = TRAPS / "zenodo_23580672"
    traps = pd.read_csv(z / "traps.csv")
    counts = pd.read_csv(z / "mosquito_counts.csv", parse_dates=["start_date", "end_date"])
    alb = counts[counts["species"] == "Aedes albopictus"].rename(columns={"trapping_effort_days": "effort"}).dropna(subset=["count"]).copy()
    lat0, lon0 = traps["latitude"].mean(), traps["longitude"].mean()
    daily = power_daily(lat0, lon0, "20180501", "20201231", "athens_traps")
    cell = cells.assign(d=(cells["lat"] - lat0) ** 2 + (cells["lon"] - lon0) ** 2).sort_values("d").iloc[0]["cell"]
    ndvi_m = em[em["cell"] == cell].set_index(["year", "month"])["NDVI"]

    # 1. HOBO vs NASA POWER
    hobo = pd.read_csv(z / "microclimate_hobo.csv")
    hobo["date"] = pd.to_datetime(hobo["datetime"].str[:10])
    hobo.loc[hobo["RH_perc"] < 10, "RH_perc"] = np.nan            # stuck-sensor artefacts (datapackage note)
    hd = hobo.groupby("date")[["temp_c", "RH_perc"]].mean()
    j = hd.join(daily[["T2M", "RH2M"]], how="inner").dropna()
    out["athens"]["hobo_vs_power"] = {
        "days": int(len(j)),
        "temp_bias_power_minus_hobo": round(float((j["T2M"] - j["temp_c"]).mean()), 2),
        "temp_r": round(float(np.corrcoef(j["T2M"], j["temp_c"])[0, 1]), 3),
        "rh_bias_power_minus_hobo": round(float((j["RH2M"] - j["RH_perc"]).mean()), 1),
        "rh_r": round(float(np.corrcoef(j["RH2M"], j["RH_perc"])[0, 1]), 3),
    }

    # 2. weekly ESI vs catches, lags 0–4
    lag_res = []
    rows = []
    for lag in range(0, 7):
        for _, r in alb.iterrows():
            pred = weekly_predictors(daily, r["start_date"], r["end_date"], lag)
            nd = ndvi_m.get((r["start_date"].year, r["start_date"].month), np.nan)
            sc = esi_week(pred, nd)
            rows.append({"lag": lag, "trap_id": r["trap_id"], "start": r["start_date"], "count": r["count"], "effort": r["effort"],
                         "rate": r["count"] / r["effort"], **{f"x_{k}": v for k, v in pred.items()}, **sc})
    wk = pd.DataFrame(rows).dropna(subset=["ESI"])
    for lag, g in wk.groupby("lag"):
        rho, p = sps.spearmanr(g["ESI"], g["rate"])
        rho_t, _ = sps.spearmanr(g["sT"], g["rate"])
        lag_res.append({"lag_weeks": int(lag), "rho_esi": round(float(rho), 3), "p": float(p), "rho_temperature_score": round(float(rho_t), 3),
                        "n": int(len(g))})
    out["athens"]["weekly_spearman_by_lag"] = lag_res
    # the lag is chosen on the temperature score alone (development time from egg to adult),
    # so the choice does not favour any weighting of the ESI
    best_lag = max(lag_res, key=lambda d: d["rho_temperature_score"])["lag_weeks"]
    g = wk[wk["lag"] == best_lag].copy()
    out["athens"]["best_lag_weeks"] = int(best_lag)
    out["athens"]["score_correlations"] = {c: round(float(sps.spearmanr(g[c], g["rate"])[0]), 3) for c in ["sT", "sP", "sRH", "sW", "sNDVI", "ESI"]}

    # 3. negative binomial: equal-weight ESI vs data-driven weights, temporal validation on 2020
    # the record covers 2018-07 → 2019-10: fit on the 2018 season, test on the 2019 season
    train, test = g[g["start"].dt.year == 2018], g[g["start"].dt.year == 2019]
    (a_eq, fit_eq), _ = nb_fit(train, ["ESI"])
    (a_all, fit_all), cols_all = nb_fit(train, ["sT", "sP", "sRH", "sW"])           # NDVI saturates (≈1) here
    coefs = {c: float(fit_all.params[c]) for c in ["sT", "sP", "sRH", "sW"]}
    pos = {c: max(v, 0.0) for c, v in coefs.items()}
    tot = sum(pos.values()) or 1.0
    learned = {"T": pos["sT"] / tot, "P": pos["sP"] / tot, "RH": pos["sRH"] / tot, "W": pos["sW"] / tot, "NDVI": 0.0}
    out["athens"]["nb_coefficients_log_scores"] = {c: {"coef": round(coefs[c], 3), "p": float(fit_all.pvalues[c])} for c in coefs}
    out["athens"]["nb_esi_elasticity"] = {"coef": round(float(fit_eq.params["ESI"]), 3), "p": float(fit_eq.pvalues["ESI"]), "alpha": a_eq}
    out["athens"]["learned_weights"] = {k: round(v, 3) for k, v in learned.items()}
    test = test.copy()
    sc_test = test[["sT", "sP", "sRH", "sW", "sNDVI"]]
    test["ESI_learned"] = esi_from_scores(sc_test.assign(sNDVI=1.0), {**learned, "NDVI": 1e-9})
    equal = {k: 0.2 for k in ["T", "P", "RH", "W", "NDVI"]}
    shrunk = {k: round(0.5 * learned[k] + 0.5 * equal[k], 3) for k in equal}   # learned weights pulled halfway to equal
    variants = {"equal": equal, "learned": {**learned, "NDVI": 1e-9}, "shrunk": shrunk,
                "temperature_only": {"T": 1.0, "P": 1e-9, "RH": 1e-9, "W": 1e-9, "NDVI": 1e-9}}
    val = {"n_weeks": int(len(test))}
    for name, wv in variants.items():
        e = esi_from_scores(test[["sT", "sP", "sRH", "sW", "sNDVI"]], wv)
        val[f"spearman_{name}"] = round(float(sps.spearmanr(e, test["rate"])[0]), 3)
        e_all = esi_from_scores(g[["sT", "sP", "sRH", "sW", "sNDVI"]], wv)
        val[f"spearman_{name}_both_seasons"] = round(float(sps.spearmanr(e_all, g["rate"])[0]), 3)
    out["athens"]["validation_2019_season"] = val
    out["athens"]["weights_variants"] = {k: {kk: round(vv, 3) for kk, vv in v.items()} for k, v in variants.items()}
    g.to_parquet(PROCESSED / "athens_weekly.parquet", index=False)

    # 4. monthly: grid-cell ESI vs mean catches
    alb["year"], alb["month"] = alb["start_date"].dt.year, alb["start_date"].dt.month
    mon = alb.assign(rate=alb["count"] / alb["effort"]).groupby(["year", "month"])["rate"].mean().reset_index()
    mon = mon.merge(em[em["cell"] == cell][["year", "month", "ESI", "sT", "sP", "sRH", "T2M", "RH2M", "PRECIP"]], on=["year", "month"])
    rho, p = sps.spearmanr(mon["ESI"], mon["rate"])
    out["athens"]["monthly_cell_esi"] = {"cell": cell, "n_months": int(len(mon)), "spearman": round(float(rho), 3), "p": float(p),
                                         "spearman_temperature": round(float(sps.spearmanr(mon["T2M"], mon["rate"])[0]), 3)}
    out["athens"]["monthly_series"] = mon.round(3).assign(date=lambda d: d["year"].astype(str) + "-" + d["month"].astype(str).str.zfill(2)).to_dict("records")
    clim = alb.assign(rate=alb["count"] / alb["effort"]).groupby("month")["rate"].mean()
    out["athens"]["seasonal_profile_rate_per_trap_day"] = {int(k): round(float(v), 2) for k, v in clim.items()}

    # ---------------------------------------------------------------- Thessaly (genus Aedes, secondary)
    th = pd.read_excel(TRAPS / "mendeley_9frz4845vw" / "THESSALY_Adults_2021_2023.xlsx", sheet_name=0)
    th["lat"], th["lon"] = th["y_trap"], th["x_trap"]
    def nearest(lat, lon):
        return cells.assign(d=(cells["lat"] - lat) ** 2 + (cells["lon"] - lon) ** 2).sort_values("d").iloc[0]["cell"]
    th["cell"] = [nearest(a, b) for a, b in zip(th["lat"], th["lon"])]
    tm = th.groupby(["cell", "year", "month"]).agg(aedes=("total_female_aedes_species", "mean"), culex=("total_female_culex_species", "mean"),
                                                   n=("trap_ID", "count")).reset_index()
    tm = tm.merge(em[["cell", "year", "month", "ESI", "T2M"]], on=["cell", "year", "month"])
    if len(tm) >= 8:
        out["thessaly"] = {
            "trap_nights": int(len(th)), "cell_months": int(len(tm)), "cells": sorted(tm["cell"].unique().tolist()),
            "spearman_esi_aedes_genus": round(float(sps.spearmanr(tm["ESI"], tm["aedes"])[0]), 3),
            "p_aedes": float(sps.spearmanr(tm["ESI"], tm["aedes"])[1]),
            "spearman_esi_culex": round(float(sps.spearmanr(tm["ESI"], tm["culex"])[0]), 3),
            "spearman_temperature_aedes_genus": round(float(sps.spearmanr(tm["T2M"], tm["aedes"])[0]), 3),
            "monthly_profile_aedes": {int(k): round(float(v), 2) for k, v in th.groupby("month")["total_female_aedes_species"].mean().items()},
        }

    (PROCESSED / "abundance.json").write_text(json.dumps(out, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    slim = {k: {kk: vv for kk, vv in v.items() if kk != "monthly_series"} for k, v in out.items()}
    print(json.dumps(slim, ensure_ascii=False, indent=1, default=str))


if __name__ == "__main__":
    main()
