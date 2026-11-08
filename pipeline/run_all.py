"""Run the whole pipeline in order (re-run when NASA publishes new months).

1 fetch_power  2 fetch_ee_grid  3 fetch_ee_shapes  4 fetch_cmip6_ee   (downloads; cached)
5 build_dataset  6 esi  7 abundance  8 calibrate  9 esi (calibrated weights)
10 analysis  11 projections  12 validate  13 export
Downloads are skipped when their cached files exist; delete data/raw/... to refresh.
Use --no-fetch to only recompute from the cached raw data.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
FETCH = ["fetch_power", "fetch_ee_grid", "fetch_ee_shapes", "fetch_cmip6_ee"]
COMPUTE = ["build_dataset", "esi", "abundance", "calibrate", "esi", "analysis", "projections", "validate", "export"]

if __name__ == "__main__":
    steps = COMPUTE if "--no-fetch" in sys.argv else FETCH + COMPUTE
    for step in steps:
        print(f"=== {step}", flush=True)
        r = subprocess.run([sys.executable, "-W", "ignore", str(HERE / f"{step}.py")])
        if r.returncode != 0:
            sys.exit(f"step {step} failed")
    print("pipeline complete")
