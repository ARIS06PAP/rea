"""Phase 3b – choose the ESI weights with data, without information leakage.

Two independent kinds of evidence, both split in time:
* WHEN (seasonal timing): weekly tiger-mosquito catches in Athens. Train = 2018 season,
  test = 2019 season. Metric: Spearman ρ between the weekly ESI (NASA POWER daily data,
  lag 2 weeks = egg-to-adult development time) and catches per trap-day.
* WHERE (spatial pattern): GBIF presence records of Aedes albopictus in Greece. Train =
  cells with a record up to 2018 vs cells never recorded; test = cells whose FIRST record
  came in 2019 or later vs cells never recorded ("can the index tell where it will be found
  next?"). Metric: ROC AUC of the cell's mean annual ESI over 2001–2018 (climate known
  before the test period).

All weight vectors on the simplex with step 0.1 (1001 combinations) are scored on the
training data only: objective = mean of ρ_train and Gini_train (= 2·AUC − 1). The best
weights are then evaluated once on the test data. Equal weights and temperature-only are
evaluated the same way for comparison.
Output: docs/esi_parameters.json (weights of the main ESI) and data/processed/calibration.json
"""
from __future__ import annotations

import itertools
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats as sps

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import DOCS, PROCESSED, RAW  # noqa: E402
import esi as E  # noqa: E402

KEYS = ["T", "P", "RH", "W", "NDVI"]
# Upper limits from the strength of the published evidence (docs/science_values.md):
# temperature strong; rainfall weak-to-moderate; humidity, wind and vegetation weak and local,
# so these may only nudge the index, never dominate it.
CAPS = {"T": 1.0, "P": 0.25, "RH": 0.15, "W": 0.15, "NDVI": 0.15}
SC = ["sT", "sP", "sRH", "sW", "sNDVI"]


def auc(pos: np.ndarray, neg: np.ndarray) -> float:
    if len(pos) == 0 or len(neg) == 0:
        return float("nan")
    return float(sps.mannwhitneyu(pos, neg, alternative="two-sided").statistic / (len(pos) * len(neg)))


def main() -> None:
    E.load_overrides()                       # function parameters from docs/esi_parameters.json
    old = json.loads((DOCS / "esi_parameters.json").read_text(encoding="utf-8")) if (DOCS / "esi_parameters.json").exists() else {}
    cells = pd.read_parquet(PROCESSED / "cells.parquet")
    m = pd.read_parquet(PROCESSED / "monthly.parquet")
    m = m[(m["year"] >= 2001) & (m["year"] <= 2018)].reset_index(drop=True)
    sc = E.scores(m)[SC]
    ok = sc.notna().all(axis=1).to_numpy()
    m, sc = m[ok].reset_index(drop=True), sc[ok].reset_index(drop=True)
    logs = np.log(np.clip(sc.to_numpy(), 1e-6, 1))        # monthly log-scores, 2001–2018 (common period only)

    athens = pd.read_parquet(PROCESSED / "athens_weekly.parquet")
    athens = athens.dropna(subset=SC + ["rate"])
    athens["yr"] = pd.to_datetime(athens["start"]).dt.year
    a_tr, a_te = athens[athens["yr"] == 2018], athens[athens["yr"] == 2019]
    la_tr = np.log(np.clip(a_tr[SC].to_numpy(), 1e-6, 1))
    la_te = np.log(np.clip(a_te[SC].to_numpy(), 1e-6, 1))

    g = pd.DataFrame(json.loads((RAW / "gbif_aedes_albopictus_GR.json").read_text(encoding="utf-8"))).dropna(subset=["lat", "lon", "year"])
    g = g[(g["uncertainty_m"].isna()) | (g["uncertainty_m"] <= 25000)]
    g["cell"] = [f"{34.0 + 0.5 * round((a - 34.0) / 0.5):.3f}_{19.375 + 0.625 * round((b - 19.375) / 0.625):.3f}" for a, b in zip(g["lat"], g["lon"])]
    first = g.groupby("cell")["year"].min()
    cell_ids = m["cell"].to_numpy()
    uniq = cells["cell"].to_numpy()
    idx = {c: i for i, c in enumerate(uniq)}
    ci = np.array([idx[c] for c in cell_ids])
    counts = np.bincount(ci, minlength=len(uniq))
    first_year = np.array([first.get(c, np.nan) for c in uniq])
    train_pos = first_year <= 2018
    test_pos = first_year >= 2019
    never = np.isnan(first_year)

    def evaluate(wv: np.ndarray) -> dict:
        wv = wv / wv.sum()
        cell_esi = np.bincount(ci, weights=np.exp(logs @ wv) * 100, minlength=len(uniq)) / counts
        return {
            "rho_train": float(sps.spearmanr(np.exp(la_tr @ wv), a_tr["rate"])[0]),
            "rho_test": float(sps.spearmanr(np.exp(la_te @ wv), a_te["rate"])[0]),
            "auc_train": auc(cell_esi[train_pos], cell_esi[never]),
            "auc_test": auc(cell_esi[test_pos], cell_esi[never]),
        }

    grid = [np.array(c) / 20 for c in itertools.product(range(21), repeat=5) if sum(c) == 20]
    grid = [g_ for g_ in grid if all(g_[i] <= CAPS[k] + 1e-9 for i, k in enumerate(KEYS))]
    best, best_obj = None, -np.inf
    for wv in grid:
        if wv.sum() == 0:
            continue
        r = evaluate(np.where(wv == 0, 1e-9, wv))
        obj = 0.5 * r["rho_train"] + 0.5 * (2 * r["auc_train"] - 1)
        if obj > best_obj:
            best, best_obj = (wv, r), obj
    wv_best, _ = best
    # Keep all five parameters: blend the best weights with equal weights and take the most
    # "equal" blend whose TRAINING objective stays within 0.03 of the best (decided on training data only).
    blends = []
    for alpha in (1.0, 0.9, 0.8, 0.7, 0.6, 0.5):  # blends stay inside the caps (equal weights 0.2 > 0.15 is avoided below)
        wb = alpha * wv_best + (1 - alpha) * np.full(5, 0.2)
        wb = np.minimum(wb, np.array([CAPS[k] for k in KEYS]))
        wb = wb / wb.sum()
        rb = evaluate(np.where(wb == 0, 1e-9, wb))
        objb = 0.5 * rb["rho_train"] + 0.5 * (2 * rb["auc_train"] - 1)
        blends.append({"alpha": alpha, "weights": {k: round(float(v), 3) for k, v in zip(KEYS, wb)}, "objective_train": round(float(objb), 3),
                       **{k: round(v, 3) for k, v in rb.items()}})
    ok = [b_ for b_ in blends if b_["objective_train"] >= best_obj - 0.03]
    pick = min(ok, key=lambda b_: b_["alpha"])
    wv = np.array([pick["weights"][k] for k in KEYS])
    r = {k: pick[k] for k in ("rho_train", "rho_test", "auc_train", "auc_test")}
    best_obj = pick["objective_train"]
    chosen = {k: round(float(v), 3) for k, v in zip(KEYS, wv)}
    res = {"split": {"athens_train": "2018 season", "athens_test": "2019 season", "gbif_train": "cells with a record ≤ 2018",
                     "gbif_test": "cells first recorded ≥ 2019", "n_train_cells": int(train_pos.sum()), "n_test_cells": int(test_pos.sum()),
                     "n_never": int(never.sum())},
           "best_on_grid": {"weights": {k: round(float(v), 3) for k, v in zip(KEYS, wv_best)}},
           "blends": blends,
           "chosen": {"weights": chosen, **{k: round(v, 3) for k, v in r.items()}, "objective_train": round(float(best_obj), 3)},
           "equal": {"weights": {k: 0.2 for k in KEYS}, **{k: round(v, 3) for k, v in evaluate(np.full(5, 0.2)).items()}},
           "temperature_only": {"weights": {"T": 1.0}, **{k: round(v, 3) for k, v in evaluate(np.array([1, 1e-9, 1e-9, 1e-9, 1e-9])).items()}}}
    (PROCESSED / "calibration.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    weights = {k: (v if v > 0 else 0.0) for k, v in chosen.items()}
    doc = {"note": ("Weights of the main ESI, chosen on training data only (Athens 2018 trap season + GBIF records up to 2018) "
                    "among all weight vectors with step 0.05 inside evidence-based caps (temperature free; rain ≤ 0.25; humidity, wind, vegetation ≤ 0.15), by the mean of the seasonal correlation and the spatial Gini; "
                    "tested once on later data (Athens 2019 season, cells first recorded from 2019 on). Equal weights are kept "
                    "as ESI_eq. See data/processed/calibration.json."),
           "weights": weights, "caps": CAPS, "P": old.get("P", {}), "P_notes": old.get("P_notes", {})}
    (DOCS / "esi_parameters.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(res, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
