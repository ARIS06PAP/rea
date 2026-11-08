"""Phase 4 – historical statistics of the five parameters and of the ESI.

For every grid cell:
* annual series (1981–2025 for T2M, rain, humidity, wind; 2001–2025 for NDVI and ESI,
  the complete years of the common period): Mann-Kendall with the Hamed-Rao correction for
  autocorrelation (n ≥ 20), Sen's slope with its confidence interval, ordinary least squares
  with Newey-West (HAC) standard errors, Benjamini-Hochberg across cells per variable;
* every calendar month separately (all Januaries, all Februaries, …): the same tests;
* the seasonal Kendall test (Hirsch et al. 1982) over the 12 months, which handles the
  seasonal cycle, with the seasonal Sen slope;
* decade means, Spearman correlation of the annual ESI with each parameter;
* attribution: how much each parameter's change moved the ESI between 2001–2010 and
  2016–2025 (contribution of each factor to the change of log ESI).
Plus area-weighted national (Greece) and regional series.

Outputs in data/processed/: trends_annual.parquet, trends_monthly.parquet,
trends_seasonal.parquet, decades.parquet, correlations.parquet, attribution.parquet,
national_annual.parquet, national_monthly.parquet, regional_annual.parquet.
"""
from __future__ import annotations

import math
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats as sps

sys.path.insert(0, str(Path(__file__).resolve().parent))
import trendstats as ts  # noqa: E402
from config import PROCESSED  # noqa: E402
from esi import COLS, WEIGHTS, load_overrides  # noqa: E402

warnings.filterwarnings("ignore")
VARS = ["T2M", "PRECIP", "RH2M", "WS10M", "NDVI", "ESI", "ESI_eq"]
MONTHLY_VARS = ["T2M", "PRECIP", "RH2M", "WS10M", "NDVI", "ESI", "ESI_eq"]
LONG_FIRST, COMMON_FIRST, LAST = 1981, 2001, 2025


def trend(years: np.ndarray, values: np.ndarray) -> dict | None:
    ok = ~np.isnan(values)
    y, v = years[ok], values[ok]
    if len(v) < 8 or np.ptp(v) == 0:
        return None
    use_hr = len(v) >= ts.AUTOCORR_MIN_YEARS
    p, tau = ts.mann_kendall(v, hamed_rao=use_hr)
    lo, hi, _ = ts.sens_ci(y, v, hamed_rao=use_hr)
    slope = ts.sens_slope(y.astype(float), v)
    X = sm.add_constant(y.astype(float))
    ols = sm.OLS(v, X).fit(cov_type="HAC", cov_kwds={"maxlags": 1})
    return {
        "n": int(len(v)), "first": int(y[0]), "last": int(y[-1]),
        "sen_decade": slope * 10, "ci_lo": lo * 10, "ci_hi": hi * 10, "p_mk": float(p), "tau": float(tau),
        "hamed_rao": bool(use_hr), "ols_decade": float(ols.params[1] * 10), "p_ols": float(ols.pvalues[1]),
        "mean": float(v.mean()),
    }


def seasonal_kendall(df: pd.DataFrame, var: str) -> dict | None:
    """Hirsch et al. (1982): sum of the Mann-Kendall S over the 12 months, variance = sum
    of the monthly variances (independence between months assumed, see docs)."""
    s_tot, var_tot, slopes = 0.0, 0.0, []
    for _, g in df.groupby("month"):
        v = g.sort_values("year")[var].to_numpy(float)
        y = g.sort_values("year")["year"].to_numpy(float)
        ok = ~np.isnan(v)
        v, y = v[ok], y[ok]
        if len(v) < 8:
            continue
        s_tot += ts._mk_score(v)
        var_tot += ts._variance_s(v)
        i, j = np.triu_indices(len(v), k=1)
        slopes.append((v[j] - v[i]) / (y[j] - y[i]))
    if var_tot <= 0 or not slopes:
        return None
    z = ts._z_score(s_tot, var_tot)
    p = 2 * (1 - 0.5 * (1 + math.erf(abs(z) / math.sqrt(2))))
    return {"seasonal_sen_decade": float(np.median(np.concatenate(slopes)) * 10), "p_seasonal": float(p), "z": float(z)}


def add_fdr(df: pd.DataFrame, p_col: str, group_cols: list[str], out: str) -> pd.DataFrame:
    df[out] = False
    for _, idx in df.groupby(group_cols).groups.items():
        p = df.loc[idx, p_col].to_numpy(float)
        ok = ~np.isnan(p)
        keep = np.zeros(len(p), bool)
        if ok.any():
            keep[ok] = ts.benjamini_hochberg(p[ok])
        df.loc[idx, out] = keep
    return df


def weighted_mean(g: pd.DataFrame, col: str) -> float:
    v, w = g[col].to_numpy(float), g["w"].to_numpy(float)
    ok = ~np.isnan(v)
    return float(np.average(v[ok], weights=w[ok])) if ok.any() else np.nan


def main() -> None:
    load_overrides()   # trap-calibrated weights of the main ESI
    cells = pd.read_parquet(PROCESSED / "cells.parquet")
    m = pd.read_parquet(PROCESSED / "esi_monthly.parquet")
    a = pd.read_parquet(PROCESSED / "esi_annual.parquet")
    a = a[a["complete_year"]]
    w = cells.set_index("cell")["gr_land"]

    # ---------------- annual trends per cell
    rows = []
    for cell, g in a.groupby("cell"):
        g = g.sort_values("year")
        for var in VARS:
            first = LONG_FIRST if var in ("T2M", "PRECIP", "RH2M", "WS10M") else COMMON_FIRST
            gg = g[(g["year"] >= first) & (g["year"] <= LAST)]
            r = trend(gg["year"].to_numpy(), gg[var].to_numpy(float))
            if r:
                rows.append({"cell": cell, "var": var, **r})
    ta = add_fdr(pd.DataFrame(rows), "p_mk", ["var"], "sig_fdr")
    ta["sig_raw"] = ta["p_mk"] < 0.05
    ta.to_parquet(PROCESSED / "trends_annual.parquet", index=False)
    print("annual trends:", len(ta), "| FDR-significant share by variable:")
    print(ta.groupby("var")["sig_fdr"].mean().round(2).to_string())

    # ---------------- per calendar month
    rows = []
    mm = m[m["year"] <= LAST]
    for (cell, month), g in mm.groupby(["cell", "month"]):
        g = g.sort_values("year")
        for var in MONTHLY_VARS:
            first = LONG_FIRST if var in ("T2M", "PRECIP", "RH2M", "WS10M") else COMMON_FIRST
            gg = g[g["year"] >= first]
            r = trend(gg["year"].to_numpy(), gg[var].to_numpy(float))
            if r:
                rows.append({"cell": cell, "month": int(month), "var": var, **r})
    tm = add_fdr(pd.DataFrame(rows), "p_mk", ["var", "month"], "sig_fdr")
    tm.to_parquet(PROCESSED / "trends_monthly.parquet", index=False)
    print("monthly trends:", len(tm))

    # ---------------- seasonal Kendall per cell
    rows = []
    for cell, g in mm.groupby("cell"):
        for var in MONTHLY_VARS:
            first = LONG_FIRST if var in ("T2M", "PRECIP", "RH2M", "WS10M") else COMMON_FIRST
            r = seasonal_kendall(g[g["year"] >= first], var)
            if r:
                rows.append({"cell": cell, "var": var, **r})
    tsk = add_fdr(pd.DataFrame(rows), "p_seasonal", ["var"], "sig_fdr")
    tsk.to_parquet(PROCESSED / "trends_seasonal.parquet", index=False)
    print("seasonal Kendall FDR-significant share:")
    print(tsk.groupby("var")["sig_fdr"].mean().round(2).to_string())

    # ---------------- decades
    bins = {"1981–1990": (1981, 1990), "1991–2000": (1991, 2000), "2001–2010": (2001, 2010), "2011–2020": (2011, 2020), "2016–2025": (2016, 2025)}
    rows = []
    for name, (y0, y1) in bins.items():
        g = a[(a["year"] >= y0) & (a["year"] <= y1)].groupby("cell")[VARS].mean()
        g["decade"] = name
        rows.append(g.reset_index())
    dec = pd.concat(rows)
    dec.to_parquet(PROCESSED / "decades.parquet", index=False)

    # ---------------- correlations of the annual ESI with each parameter (2001–2025)
    rows = []
    for cell, g in a[a["year"] >= COMMON_FIRST].groupby("cell"):
        for var in ["T2M", "PRECIP", "RH2M", "WS10M", "NDVI"]:
            ok = g[["ESI", var]].dropna()
            if len(ok) >= 10:
                rho, p = sps.spearmanr(ok["ESI"], ok[var])
                rows.append({"cell": cell, "var": var, "rho": float(rho), "p": float(p), "n": int(len(ok))})
    cor = pd.DataFrame(rows)
    cor.to_parquet(PROCESSED / "correlations.parquet", index=False)

    # ---------------- attribution of the ESI change (2001–2010 → 2016–2025)
    e = m[(m["year"] >= 2001) & (m["year"] <= 2025)].copy()
    e["period"] = np.where(e["year"] <= 2010, "early", np.where(e["year"] >= 2016, "late", None))
    e = e.dropna(subset=["period"])
    clim = e.groupby(["cell", "period", "month"])[list(COLS.values()) + ["ESI"]].mean().reset_index()
    rows = []
    tot_w = sum(WEIGHTS.values())
    for cell, g in clim.groupby("cell"):
        early, late = g[g["period"] == "early"].set_index("month"), g[g["period"] == "late"].set_index("month")
        row = {"cell": cell, "esi_early": float(early["ESI"].mean()), "esi_late": float(late["ESI"].mean())}
        for k, c in COLS.items():  # contribution of each factor to Δ log ESI, averaged over months
            d = (WEIGHTS[k] / tot_w) * (np.log(np.clip(late[c], 1e-6, 1)) - np.log(np.clip(early[c], 1e-6, 1)))
            row[f"dlog_{k}"] = float(d.mean())
        rows.append(row)
    att = pd.DataFrame(rows)
    att.to_parquet(PROCESSED / "attribution.parquet", index=False)

    # ---------------- national and regional (weighted by Greek land in the cell)
    a2 = a.merge(cells[["cell", "region"]], on="cell")
    a2["w"] = a2["cell"].map(w)
    nat = pd.DataFrame([{**{"year": y}, **{v: weighted_mean(g, v) for v in VARS}} for y, g in a2.groupby("year")])
    nat.to_parquet(PROCESSED / "national_annual.parquet", index=False)
    reg = pd.DataFrame([{"region": r, "year": y, **{v: weighted_mean(g, v) for v in VARS}} for (r, y), g in a2.groupby(["region", "year"])])
    reg.to_parquet(PROCESSED / "regional_annual.parquet", index=False)
    m2 = m.copy()
    m2["w"] = m2["cell"].map(w)
    natm = pd.DataFrame([{"year": y, "month": mo, **{v: weighted_mean(g, v) for v in VARS}} for (y, mo), g in m2.groupby(["year", "month"])])
    natm.to_parquet(PROCESSED / "national_monthly.parquet", index=False)

    # national trends (printed; also exported by export_web.py)
    for var in VARS:
        first = LONG_FIRST if var in ("T2M", "PRECIP", "RH2M", "WS10M") else COMMON_FIRST
        g = nat[(nat["year"] >= first) & (nat["year"] <= LAST)]
        r = trend(g["year"].to_numpy(), g[var].to_numpy(float))
        if r:
            print(f"Greece {var}: Sen {r['sen_decade']:+.3f}/decade [{r['ci_lo']:+.3f}, {r['ci_hi']:+.3f}] p={r['p_mk']:.4f} ({r['first']}–{r['last']})")
    print("ESI attribution (Greece mean of cells, Δlog ESI × 100):",
          {k: round(att[f'dlog_{k}'].mean() * 100, 2) for k in COLS})


if __name__ == "__main__":
    main()
