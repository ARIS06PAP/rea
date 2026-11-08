"""Phase 3 – Environmental Suitability Index (ESI, 0–100) for Aedes albopictus.

ESI(cell, month) = 100 · Π_i s_i(x_i)^w_i   (weighted geometric mean, Σ w_i = 1)

with one suitability function s_i ∈ [0, 1] per parameter (no straight lines):

* Temperature T (monthly mean T2M, °C): plateau 1 between T_lo and T_hi (laboratory
  development optimum 25–30 °C); Gaussian fall-off on each side, its width set so that
  s = 0.02 at the cold activity limit (9 °C) and at the warm field limit (≈37 °C).
* Rain P35 (mm in the 35 days to the end of the month): double sigmoid, rising around the
  lower edge of the favourable 90–800 mm range and falling past 800 mm (flushing of larval
  habitats). More rain is NOT always better.
* Relative humidity RH (RH2M, %): plateau 75–80 % (laboratory rearing optimum), Gaussian
  fall-off below (field density rises with humidity) and above.
* Wind W (WS10M, m/s): decreasing sigmoid centred at 4.15 m/s (studies report negative
  effects above about 4–4.3 m/s). WS10M is at 10 m, where wind is stronger than at the
  height mosquitoes fly: a documented, conservative mismatch.
* Vegetation NDVI (MODIS): rising sigmoid that saturates at moderate greenness, read as
  "is there vegetation that can offer shade and resting sites": bare ground (NDVI ≈ 0.1)
  scores low, anything above ≈ 0.3 scores near 1. The weakest-evidence term: the studies
  relate abundance to low urban vegetation at 250 m, not to NDVI over 50 km cells, so it is
  not allowed to penalise greener cells.

Weights: equal (0.2 each) because no source ranks the five factors; sensitivity analysis
in analysis.py varies them. The annual climatic thresholds (January mean > 0 °C, annual
mean > 11 °C, annual rain > 500 mm) are reported as separate pass/fail flags, not
multiplied into the ESI, because they are proposed suitability thresholds, not biological
limits (see docs).
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import DOCS, PROCESSED  # noqa: E402

# Default parameters; ids point to entries of docs/science_values.json
P = {
    "T_lo": 25.0, "T_hi": 30.0,          # laboratory development optimum (value 1)
    "T_cold": 9.0, "T_warm": 37.0,       # adult activity strongly reduced below 9 °C; field biting range ends ≈37 °C
    "edge": 0.02,                        # suitability at those limits
    "P_lo": 90.0, "P_hi": 800.0,         # favourable 35-day rain range (population model)
    "RH_lo": 75.0, "RH_hi": 80.0,        # laboratory rearing optimum
    "RH_dry": 40.0, "RH_wet": 100.0,     # where the humidity score falls to `edge`
    "W_mid": 4.15, "W_scale": 0.35,      # negative wind effect above ~4–4.3 m/s
    "NDVI_mid": 0.20, "NDVI_scale": 0.05,  # vegetation present (indicative): 0.5 at NDVI 0.2, 0.88 at 0.3
}
EQUAL = {"T": 0.2, "P": 0.2, "RH": 0.2, "W": 0.2, "NDVI": 0.2}
WEIGHTS = dict(EQUAL)   # replaced by docs/esi_parameters.json (trap-calibrated) in load_overrides()
LABELS = {"T": "Θερμοκρασία", "P": "Βροχή 35 ημερών", "RH": "Σχετική υγρασία", "W": "Άνεμος", "NDVI": "Βλάστηση (NDVI)"}


def _sigma(distance: float, edge: float) -> float:
    """Gaussian σ such that exp(-d²/2σ²) = edge at the given distance from the plateau."""
    return distance / math.sqrt(2 * math.log(1 / edge))


def s_temperature(t: np.ndarray, p: dict = P) -> np.ndarray:
    t = np.asarray(t, dtype=float)
    lo_sd, hi_sd = _sigma(p["T_lo"] - p["T_cold"], p["edge"]), _sigma(p["T_warm"] - p["T_hi"], p["edge"])
    out = np.ones_like(t)
    out = np.where(t < p["T_lo"], np.exp(-((p["T_lo"] - t) ** 2) / (2 * lo_sd**2)), out)
    out = np.where(t > p["T_hi"], np.exp(-((t - p["T_hi"]) ** 2) / (2 * hi_sd**2)), out)
    return out


def s_precip35(p35: np.ndarray, p: dict = P) -> np.ndarray:
    x = np.asarray(p35, dtype=float)
    rise = 1 / (1 + np.exp(-(x - p["P_lo"] / 2) / (p["P_lo"] / 6)))        # 0.5 at 45 mm, 0.95 at 90 mm
    fall = 1 / (1 + np.exp((x - (p["P_hi"] + 100)) / 50))                   # 0.88 at 800 mm, 0.5 at 900 mm
    return rise * fall


def s_humidity(rh: np.ndarray, p: dict = P) -> np.ndarray:
    x = np.asarray(rh, dtype=float)
    lo_sd, hi_sd = _sigma(p["RH_lo"] - p["RH_dry"], p["edge"]), _sigma(p["RH_wet"] - p["RH_hi"], 0.3)
    out = np.ones_like(x)
    out = np.where(x < p["RH_lo"], np.exp(-((p["RH_lo"] - x) ** 2) / (2 * lo_sd**2)), out)
    out = np.where(x > p["RH_hi"], np.exp(-((x - p["RH_hi"]) ** 2) / (2 * hi_sd**2)), out)
    return out


def s_wind(w: np.ndarray, p: dict = P) -> np.ndarray:
    return 1 / (1 + np.exp((np.asarray(w, dtype=float) - p["W_mid"]) / p["W_scale"]))


def s_ndvi(v: np.ndarray, p: dict = P) -> np.ndarray:
    x = np.asarray(v, dtype=float)
    return 1 / (1 + np.exp(-(x - p["NDVI_mid"]) / p["NDVI_scale"]))


def scores(df: pd.DataFrame, p: dict = P) -> pd.DataFrame:
    return pd.DataFrame({
        "sT": s_temperature(df["T2M"], p),
        "sP": s_precip35(df["P35"], p),
        "sRH": s_humidity(df["RH2M"], p),
        "sW": s_wind(df["WS10M"], p),
        "sNDVI": s_ndvi(df["NDVI"], p),
    }, index=df.index)


COLS = {"T": "sT", "P": "sP", "RH": "sRH", "W": "sW", "NDVI": "sNDVI"}


def esi_from_scores(sc: pd.DataFrame, w: dict = WEIGHTS, method: str = "geometric") -> pd.Series:
    """Combine the five scores into 0–100.

    geometric (main): ESI = 100 · Π s_i^(w_i / Σw) — the weighted geometric mean used by
    Habitat Suitability Index models (U.S. Fish & Wildlife Service 1981, ESM 103): a factor
    that is very unsuitable (e.g. a 5 °C winter month) cannot be compensated by the others,
    which matches how temperature limits mosquito activity.
    arithmetic (sensitivity only): ESI = 100 · Σ w_i s_i / Σw — lets the factors compensate.

    Missing NDVI (before February 2000) → ESI missing: the combined index exists only in the
    common period of the five parameters."""
    total = sum(w.values())
    if method == "arithmetic":
        out = sum(w[k] * sc[c] for k, c in COLS.items()) / total * 100
    else:
        logs = sum((w[k] / total) * np.log(np.clip(sc[c], 1e-6, 1)) for k, c in COLS.items())
        out = np.exp(logs) * 100
    return out.where(sc[list(COLS.values())].notna().all(axis=1))


def load_overrides() -> None:
    """If docs/esi_parameters.json exists (written after the literature check), use it."""
    f = DOCS / "esi_parameters.json"
    if f.exists():
        d = json.loads(f.read_text(encoding="utf-8"))
        P.update(d.get("P", {}))
        WEIGHTS.update(d.get("weights", {}))


def main() -> None:
    load_overrides()
    m = pd.read_parquet(PROCESSED / "monthly.parquet")
    sc = scores(m)
    m = pd.concat([m, sc], axis=1)
    m["ESI"] = esi_from_scores(sc, WEIGHTS)
    m["ESI_eq"] = esi_from_scores(sc, EQUAL)
    m.to_parquet(PROCESSED / "esi_monthly.parquet", index=False)

    full = m.groupby(["cell", "year"])["month"].nunique().reset_index(name="n_months")
    ann = m.groupby(["cell", "year"]).agg(
        ESI=("ESI", "mean"), ESI_eq=("ESI_eq", "mean"), T2M=("T2M", "mean"), PRECIP=("PRECIP", "sum"), RH2M=("RH2M", "mean"),
        WS10M=("WS10M", "mean"), NDVI=("NDVI", "mean"), n_esi=("ESI", "count"),
    ).reset_index().merge(full, on=["cell", "year"])
    jan = m[m["month"] == 1][["cell", "year", "T2M"]].rename(columns={"T2M": "T_jan"})
    ann = ann.merge(jan, on=["cell", "year"], how="left")
    complete = ann["n_months"] == 12
    ann.loc[~complete, ["PRECIP"]] = np.nan                  # partial year (2026): no annual rain total
    ann.loc[ann["n_esi"] < 12, ["ESI", "ESI_eq"]] = np.nan   # annual ESI only for complete years
    ann["flag_jan_above_0"] = ann["T_jan"] > 0
    ann["flag_annual_above_11"] = (ann["T2M"] > 11).where(complete)
    ann["flag_rain_above_500"] = (ann["PRECIP"] > 500).where(complete)
    ann["complete_year"] = complete
    ann.to_parquet(PROCESSED / "esi_annual.parquet", index=False)
    (PROCESSED / "esi_parameters_used.json").write_text(json.dumps({"P": P, "weights": WEIGHTS, "equal": EQUAL}, indent=1), encoding="utf-8")

    last = ann[ann["complete_year"]]["year"].max()
    g = ann[ann["year"] == last]
    print(f"ESI {last}: Greece mean {g['ESI'].mean():.1f}, min {g['ESI'].min():.1f}, max {g['ESI'].max():.1f}")
    clim = m[(m["year"] >= 2016) & (m["year"] <= 2025)].groupby("month")[["sT", "sP", "sRH", "sW", "sNDVI", "ESI"]].mean().round(2)
    print(clim.to_string())


if __name__ == "__main__":
    main()
