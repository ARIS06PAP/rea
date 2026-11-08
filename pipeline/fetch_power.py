"""Phase 2a – download NASA POWER (MERRA-2) monthly data for the whole Greek grid.

* 1981 → last complete year: the POWER *monthly regional* endpoint, one request per
  parameter for the whole bounding box (17 × 16 cells at the native 0.5° × 0.625°).
* The current year (2026): the monthly endpoint only publishes complete years, so the
  months of 2026 come from the *daily regional* endpoint and are aggregated later, only
  for months whose days are all present (an incomplete month is never shown as complete).

Raw responses are cached under data/raw/power/ so the pipeline can be re-run offline.
Files that cover the current or previous year are downloaded again when older than
config.REFRESH_DAYS, so a re-run picks up the months NASA has added since (delete any
file to force a new download).

Run:  .venv/Scripts/python.exe pipeline/fetch_power.py
"""
from __future__ import annotations

import datetime as dt
import json
import sys
import time

import httpx

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from config import BBOX, POWER_FIRST_YEAR, POWER_PARAMS, RAW_POWER, is_fresh  # noqa: E402

MONTHLY = "https://power.larc.nasa.gov/api/temporal/monthly/regional"
DAILY = "https://power.larc.nasa.gov/api/temporal/daily/regional"
COMMON = {
    "community": "AG", "format": "JSON",
    "latitude-min": BBOX["lat0"], "latitude-max": BBOX["lat1"],
    "longitude-min": BBOX["lon0"], "longitude-max": BBOX["lon1"],
}


def _get(client: httpx.Client, url: str, params: dict) -> httpx.Response:
    for attempt in range(4):
        try:
            r = client.get(url, params=params)
            if r.status_code in (429, 500, 502, 503, 504):
                raise httpx.HTTPStatusError("retry", request=r.request, response=r)
            return r
        except (httpx.TransportError, httpx.HTTPStatusError) as e:  # noqa: PERF203
            wait = 20 * (attempt + 1)
            print(f"  {e!s:.80} – retry in {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"POWER request failed: {url} {params.get('parameters')}")


def fetch_monthly(client: httpx.Client, param: str) -> None:
    end = dt.date.today().year
    while end >= POWER_FIRST_YEAR + 10:
        path = RAW_POWER / f"{param}_monthly_{POWER_FIRST_YEAR}_{end}.json"
        if is_fresh(path, end):
            print(f"{param}: cached {path.name}")
            return
        t = time.time()
        r = _get(client, MONTHLY, {**COMMON, "parameters": param, "start": POWER_FIRST_YEAR, "end": end})
        if r.status_code == 422:      # that year is not published as a complete year yet
            print(f"{param}: monthly not available to {end} (422), trying {end - 1}")
            end -= 1
            continue
        r.raise_for_status()
        path.write_text(r.text, encoding="utf-8")
        print(f"{param}: monthly {POWER_FIRST_YEAR}–{end} saved ({len(r.content)/1e6:.1f} MB, {time.time()-t:.0f}s)", flush=True)
        return


def fetch_current_year_daily(client: httpx.Client, param: str, year: int) -> None:
    path = RAW_POWER / f"{param}_daily_{year}.json"
    if is_fresh(path, year):
        print(f"{param}: cached {path.name}")
        return
    end = min(dt.date.today() - dt.timedelta(days=1), dt.date(year, 12, 31))
    t = time.time()
    r = _get(client, DAILY, {**COMMON, "parameters": param, "start": f"{year}0101", "end": end.strftime("%Y%m%d")})
    if r.status_code != 200:
        print(f"{param}: daily {year} not available ({r.status_code}): {r.text[:200]}")
        return
    path.write_text(r.text, encoding="utf-8")
    print(f"{param}: daily {year}-01-01 → {end} saved ({len(r.content)/1e6:.1f} MB, {time.time()-t:.0f}s)", flush=True)


def main() -> None:
    year = dt.date.today().year
    with httpx.Client(timeout=600) as client:
        for param in POWER_PARAMS:
            fetch_monthly(client, param)
        # The monthly files end at the last complete year; the current year comes from daily data.
        last_monthly = max(int(p.stem.rsplit("_", 1)[1]) for p in RAW_POWER.glob("T2M_monthly_*.json"))
        for y in range(last_monthly + 1, year + 1):
            for param in POWER_PARAMS:
                fetch_current_year_daily(client, param, y)
    print("done")


if __name__ == "__main__":
    main()
