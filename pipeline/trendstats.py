"""Copied from rea/backend/app/stats.py (same project, R.E.A. trend engine) so the tiger app is self-contained.

Trend detection for R.E.A. (numpy only, so it fits in a serverless function).

Method (kept simple enough to explain to a high-school student):
1. Monthly values -> one value per year (annual mean, or annual total for rain/frost).
   Averaging over whole years removes the seasonal cycle, so summer vs winter
   cannot fake a trend.
2. Mann-Kendall test on the yearly values: is there a consistent upward or
   downward direction? Non-parametric, robust to outliers.
   For records of 20+ years we apply the Hamed & Rao (1998) correction, which
   accounts for year-to-year persistence (autocorrelation) so p-values are not
   over-confident. Implementation mirrors pymannkendall 1.4.3 and is checked
   against it in tests/test_stats.py.
3. Sen's slope: the median of all pairwise slopes -> "how much per year".
"""
from __future__ import annotations

import calendar
import math
from dataclasses import asdict, dataclass
from datetime import date

import numpy as np

# A monthly series is a list of (year, month, value-or-None)
Monthly = list[tuple[int, int, "float | None"]]
# A daily series is a list of (year, month, day, value-or-None)
Daily = list[tuple[int, int, int, "float | None"]]

ALPHA = 0.05
Z_CRIT = 1.959963984540054  # standard normal quantile for 1 - ALPHA/2
MIN_YEARS = 8
SHORT_RECORD_YEARS = 15
AUTOCORR_MIN_YEARS = 20
MIN_MONTHS_PER_YEAR = 10
MIN_DAYS_PER_YEAR = 360        # a year of daily data must be nearly complete to count days
BASELINE = (1991, 2020)        # the WMO "climate normal" used for anomalies
SEASON_MONTHS = {"DJF": (12, 1, 2), "MAM": (3, 4, 5), "JJA": (6, 7, 8), "SON": (9, 10, 11)}


@dataclass
class TrendResult:
    n_years: int
    first_year: int
    last_year: int
    method: str
    slope_per_year: float
    slope_per_decade: float
    intercept: float           # Sen line value at first_year
    total_change: float        # slope * (last_year - first_year)
    mean: float
    percent_change: float | None
    p_value: float
    tau: float
    ci_decade_low: float       # 95% confidence interval for the slope, per decade
    ci_decade_high: float
    ci_method: str             # "gilbert" | "gilbert_hr" | "wald_z" | "clamped"
    direction: str             # "increasing" | "decreasing" | "no trend"
    significant: bool
    evidence: str              # "strong" | "moderate" | "weak" | "none"
    warnings: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------- aggregation

SUM_AGGREGATES = ("sum", "sum_daily_rate", "sum_hourly_rate")
MIN_MONTHS_ANOMALY = 7  # deseasonalized means stay unbiased with fewer months (GRACE gaps)


def _monthly_climatology(monthly: Monthly) -> dict[int, float]:
    """Mean value per calendar month over the whole record. Subtracting it removes
    the seasonal cycle, so an incomplete year's mean is not biased by WHICH months
    are missing (GRACE's battery-era gaps would otherwise fake a trend)."""
    sums: dict[int, float] = {}
    counts: dict[int, int] = {}
    for _year, month, value in monthly:
        if value is None or not math.isfinite(value):
            continue
        sums[month] = sums.get(month, 0.0) + value
        counts[month] = counts.get(month, 0) + 1
    return {m: sums[m] / counts[m] for m in sums}


def _monthly_total(value: float, year: int, month: int, aggregate: str) -> float:
    """Rate aggregates arrive as mm/day or mm/hour (GPM IMERG): turn one month's
    rate into that month's total before summing."""
    if aggregate == "sum_daily_rate":
        return value * calendar.monthrange(year, month)[1]
    if aggregate == "sum_hourly_rate":
        return value * 24 * calendar.monthrange(year, month)[1]
    return value


def to_annual(monthly: Monthly, aggregate: str) -> tuple[np.ndarray, np.ndarray]:
    """Collapse monthly values to one value per year.

    aggregate:
      "mean"            -> annual mean of monthly values (needs >= 10 valid months)
      "sum"             -> annual total of monthly values (needs all 12 months)
      "sum_daily_rate"  -> monthly values are daily rates (mm/day): convert each to a
                           monthly total, then sum per year (needs all 12 months)
      "sum_hourly_rate" -> monthly values are hourly rates (mm/hour): same, with the
                           extra x24
      "mean_anomaly"    -> subtract each calendar month's climatology first, then
                           average (needs >= 7 months: with the seasonal cycle gone,
                           a gappy year's mean is no longer biased by WHICH months
                           are missing — made for GRACE)
    """
    clim = _monthly_climatology(monthly) if aggregate == "mean_anomaly" else None
    by_year: dict[int, list[float]] = {}
    for year, month, value in monthly:
        if value is None or not math.isfinite(value):
            continue
        value = (value - clim[month]) if clim is not None else _monthly_total(
            value, year, month, aggregate)
        by_year.setdefault(year, []).append(value)

    this_year = date.today().year
    min_months = MIN_MONTHS_ANOMALY if aggregate == "mean_anomaly" else MIN_MONTHS_PER_YEAR
    years, values = [], []
    for year in sorted(by_year):
        if year >= this_year:  # year still in progress: not a full seasonal cycle
            continue
        vals = by_year[year]
        if aggregate in SUM_AGGREGATES:
            if len(vals) == 12:
                years.append(year)
                values.append(float(np.sum(vals)))
        elif len(vals) >= min_months:
            years.append(year)
            values.append(float(np.mean(vals)))
    return np.array(years, dtype=int), np.array(values, dtype=float)


# ------------------------------------------------------------ core statistics

def _norm_cdf(z: float) -> float:
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def _norm_ppf(q: float) -> float:
    """Inverse of _norm_cdf by bisection: plenty of precision for confidence bounds."""
    lo, hi = -10.0, 10.0
    for _ in range(80):
        mid = (lo + hi) / 2.0
        if _norm_cdf(mid) < q:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2.0


def _mk_score(x: np.ndarray) -> float:
    i, j = np.triu_indices(len(x), k=1)
    return float(np.sign(x[j] - x[i]).sum())


def _variance_s(x: np.ndarray) -> float:
    n = len(x)
    _, counts = np.unique(x, return_counts=True)
    ties = counts[counts > 1]
    return (n * (n - 1) * (2 * n + 5) - np.sum(ties * (ties - 1) * (2 * ties + 5))) / 18.0


def _z_score(s: float, var_s: float) -> float:
    if var_s <= 0:
        return 0.0
    if s > 0:
        return (s - 1) / math.sqrt(var_s)
    if s < 0:
        return (s + 1) / math.sqrt(var_s)
    return 0.0


def _rankdata(x: np.ndarray) -> np.ndarray:
    """Average ranks (1-based) with ties, like scipy.stats.rankdata."""
    order = np.argsort(x, kind="mergesort")
    ranks = np.empty(len(x), dtype=float)
    sorted_x = x[order]
    i = 0
    while i < len(x):
        j = i
        while j + 1 < len(x) and sorted_x[j + 1] == sorted_x[i]:
            j += 1
        ranks[order[i:j + 1]] = (i + j) / 2.0 + 1
        i = j + 1
    return ranks


def _acf(x: np.ndarray) -> np.ndarray:
    y = x - x.mean()
    n = len(x)
    acov = np.correlate(y, y, "full")[n - 1:] / n
    return acov / acov[0]


def sens_slope(years: np.ndarray, values: np.ndarray) -> float:
    i, j = np.triu_indices(len(values), k=1)
    return float(np.median((values[j] - values[i]) / (years[j] - years[i])))


def _mk_stats(values: np.ndarray, hamed_rao: bool) -> tuple[float, float, float, float, float]:
    """S, Var(S) (Hamed-Rao-inflated when asked), z, p, tau — shared by the significance
    test and the Sen-slope confidence interval, so the two can never use different variances."""
    x = np.asarray(values, dtype=float)
    n = len(x)
    s = _mk_score(x)
    var_s = _variance_s(x)
    tau = s / (0.5 * n * (n - 1))

    if hamed_rao:
        slope = sens_slope(np.arange(n, dtype=float), x)
        detrended = x - np.arange(1, n + 1) * slope
        ranks = _rankdata(detrended)
        if np.ptp(ranks) > 0:
            acf = _acf(ranks)[1:]
            bound = Z_CRIT / math.sqrt(n)
            sni = sum(
                (n - k) * (n - k - 1) * (n - k - 2) * acf[k - 1]
                for k in range(1, n - 1)
                if not (-bound <= acf[k - 1] <= bound)
            )
            n_ns = 1 + (2 / (n * (n - 1) * (n - 2))) * sni
            if n_ns > 0:  # correction can go non-physical on odd series -> keep plain MK
                var_s *= n_ns

    z = _z_score(s, var_s)
    p = 2 * (1 - _norm_cdf(abs(z)))
    return s, var_s, z, p, tau


def mann_kendall(values: np.ndarray, hamed_rao: bool) -> tuple[float, float]:
    """Returns (p_value, tau). With hamed_rao=True the variance of S is inflated
    for significant autocorrelation in the detrended ranks."""
    _, _, _, p, tau = _mk_stats(values, hamed_rao)
    return p, tau


def sens_ci(
    years: np.ndarray, values: np.ndarray, hamed_rao: bool, alpha: float = ALPHA
) -> tuple[float, float, str]:
    """95% confidence interval for the Sen slope (per year), by Gilbert's (1987) rank
    method — but using the SAME Var(S) as the significance test (Hamed-Rao-corrected
    when the test corrects it). Using the uncorrected variance here is what makes the
    classic interval disagree with the corrected test on autocorrelated series.
    Invariant (checked in tests): 0 outside the interval  <=>  the trend is significant.
    The rare edge cases where rank bounds still disagree (continuity correction, heavy
    ties) fall back to an interval scaled from the test's own z, which agrees by
    construction. Returns (low, high, method)."""
    yrs = np.asarray(years, dtype=float)
    x = np.asarray(values, dtype=float)
    i, j = np.triu_indices(len(x), k=1)
    slopes = np.sort((x[j] - x[i]) / (yrs[j] - yrs[i]))
    nt = slopes.size
    if nt == 0:
        return 0.0, 0.0, "none"
    _, var_s, z, p, _ = _mk_stats(x, hamed_rao)
    c = _norm_ppf(1 - alpha / 2) * math.sqrt(var_s)
    # Rank indices per Gilbert (1987) as scipy.stats.theilslopes implements them
    # (0-indexed: lower = round((N-C)/2) - 1, upper = round((N+C)/2); verified
    # empirically against scipy 1.18 in test_gilbert_matches_scipy...).
    rl = max(int(round((nt - c) / 2.0)) - 1, 0)
    ru = min(int(round((nt + c) / 2.0)), nt - 1)
    lo, hi = float(slopes[rl]), float(slopes[ru])
    method = "gilbert_hr" if hamed_rao else "gilbert"

    sen = float(np.median(slopes))
    significant = p < alpha and sen != 0
    if significant != (lo > 0 or hi < 0):
        if z != 0 and sen != 0:
            d = _norm_ppf(1 - alpha / 2) / abs(z)
            lo, hi, method = sen - abs(sen) * d, sen + abs(sen) * d, "wald_z"
        else:
            lo, hi, method = min(lo, 0.0), max(hi, 0.0), "clamped"
    return lo, hi, method


def _evidence(p: float) -> str:
    if p < 0.01:
        return "strong"
    if p < ALPHA:
        return "moderate"
    if p < 0.10:
        return "weak"
    return "none"


class RecordTooShort(ValueError):
    """Fewer than MIN_YEARS complete years. Not an error for the user: a verdict of its own
    ("too short to tell"), so the API returns the data with an explanation instead of failing."""

    def __init__(self, n_years: int, first_year: int, last_year: int):
        self.n_years, self.first_year, self.last_year = n_years, first_year, last_year
        super().__init__(
            f"Only {n_years} complete years of data. At least {MIN_YEARS} are needed to test for a trend."
        )


def analyze_annual(years: np.ndarray, values: np.ndarray) -> TrendResult:
    years = np.asarray(years, dtype=int)
    values = np.asarray(values, dtype=float)
    n = len(values)
    warnings: list[str] = []

    if n == 0:
        raise ValueError("There is no usable data at this point (for example, a land variable over the sea).")
    if n < MIN_YEARS:
        raise RecordTooShort(n, int(years[0]), int(years[-1]))
    if np.ptp(values) == 0 or np.count_nonzero(values) < max(3, n // 5):
        raise ValueError(
            "This variable barely varies here (for example, it never snows), so there is nothing to test. "
            "Try another variable."
        )
    gaps = int((years[-1] - years[0] + 1) - n)
    if gaps:
        warnings.append(f"{gaps} year(s) are missing or incomplete and were skipped.")
    if n < SHORT_RECORD_YEARS:
        warnings.append(
            f"Short record ({n} years). Trends over short periods can be driven by a few unusual years."
        )

    use_hr = n >= AUTOCORR_MIN_YEARS
    p, tau = mann_kendall(values, hamed_rao=use_hr)
    ci_lo, ci_hi, ci_method = sens_ci(years, values, hamed_rao=use_hr)
    method = (
        "Mann-Kendall (Hamed-Rao autocorrelation correction) + Sen's slope"
        if use_hr else "Mann-Kendall + Sen's slope"
    )

    slope = sens_slope(years.astype(float), values)
    intercept_at_first = float(np.median(values - slope * (years - years[0])))
    mean = float(np.mean(values))
    span = int(years[-1] - years[0])
    total = slope * span
    pct = (total / abs(mean) * 100.0) if abs(mean) > 1e-9 else None

    significant = p < ALPHA and slope != 0
    direction = ("increasing" if slope > 0 else "decreasing") if significant else "no trend"

    return TrendResult(
        n_years=n,
        first_year=int(years[0]),
        last_year=int(years[-1]),
        method=method,
        slope_per_year=slope,
        slope_per_decade=slope * 10,
        intercept=intercept_at_first,
        total_change=total,
        mean=mean,
        percent_change=pct,
        p_value=float(p),
        tau=float(tau),
        ci_decade_low=ci_lo * 10,
        ci_decade_high=ci_hi * 10,
        ci_method=ci_method,
        direction=direction,
        significant=bool(significant),
        evidence=_evidence(p),
        warnings=warnings,
    )


def benjamini_hochberg(p_values: np.ndarray, alpha: float = ALPHA) -> np.ndarray:
    """False-discovery-rate control for trend maps (many pixels tested at once).
    Returns a boolean mask of tests that stay significant."""
    p = np.asarray(p_values, dtype=float)
    m = p.size
    order = np.argsort(p)
    thresholds = alpha * (np.arange(1, m + 1) / m)
    passed = p[order] <= thresholds
    mask = np.zeros(m, dtype=bool)
    if passed.any():
        k = np.max(np.nonzero(passed)[0])
        mask[order[: k + 1]] = True
    return mask


# --------------------------------------------- seasonal / daily / context views

def to_seasonal(monthly: Monthly, aggregate: str) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """One value per (season, year): the mean of the 3 months, or their total for sum
    variables. All 3 months must be present. December belongs to the NEXT year's winter,
    so "DJF 2001" is Dec 2000 + Jan 2001 + Feb 2001."""
    this_year = date.today().year
    clim = _monthly_climatology(monthly) if aggregate == "mean_anomaly" else None
    out: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    for season, months in SEASON_MONTHS.items():
        by_year: dict[int, list[float]] = {}
        for year, month, value in monthly:
            if value is None or not math.isfinite(value) or month not in months:
                continue
            y = year + 1 if (season == "DJF" and month == 12) else year
            value = (value - clim[month]) if clim is not None else _monthly_total(
                value, year, month, aggregate)
            by_year.setdefault(y, []).append(value)
        years, values = [], []
        for y in sorted(by_year):
            vals = by_year[y]
            if y < this_year and len(vals) == 3:
                years.append(y)
                values.append(float(np.sum(vals) if aggregate in SUM_AGGREGATES else np.mean(vals)))
        out[season] = (np.array(years, dtype=int), np.array(values, dtype=float))
    return out


def to_annual_count(daily: Daily, threshold: float, above: bool = True) -> tuple[np.ndarray, np.ndarray]:
    """Count the days per year beyond a threshold (e.g. days with a high above 35 °C).
    A year counts only when nearly complete (>= MIN_DAYS_PER_YEAR valid days), and the
    year in progress is always dropped."""
    hits: dict[int, int] = {}
    valid: dict[int, int] = {}
    for year, _month, _day, value in daily:
        if value is None or not math.isfinite(value):
            continue
        valid[year] = valid.get(year, 0) + 1
        if (value > threshold) if above else (value < threshold):
            hits[year] = hits.get(year, 0) + 1
    this_year = date.today().year
    years = [y for y in sorted(valid) if y < this_year and valid[y] >= MIN_DAYS_PER_YEAR]
    return np.array(years, dtype=int), np.array([float(hits.get(y, 0)) for y in years], dtype=float)


def last_year_context(years: np.ndarray, values: np.ndarray) -> dict | None:
    """How unusual was the last complete year? Anomaly against the 1991-2020 climate
    normal (or the whole record when the normal is not covered); rank 1 = highest on
    record (hottest / wettest), with ties sharing the better rank."""
    years = np.asarray(years, dtype=int)
    values = np.asarray(values, dtype=float)
    if years.size == 0:
        return None
    in_base = (years >= BASELINE[0]) & (years <= BASELINE[1])
    if int(in_base.sum()) >= 20:
        base_mean, base_period = float(values[in_base].mean()), list(BASELINE)
    else:
        base_mean, base_period = float(values.mean()), [int(years[0]), int(years[-1])]
    last_value = float(values[-1])
    rank = int(1 + np.sum(values > last_value))
    # A record must BEAT every earlier year: ties (or an all-equal series, e.g. a
    # town that never sees a day above 35 °C) are rank 1 but not a record.
    is_record = bool(values.size > 1 and np.all(values[:-1] < last_value))
    return {
        "year": int(years[-1]),
        "value": round(last_value, 4),
        "anomaly": round(last_value - base_mean, 4),
        "baseline": base_period,
        "baseline_mean": round(base_mean, 4),
        "rank": rank,
        "n_years": int(years.size),
        "is_record": is_record,
    }


def card(result: TrendResult) -> dict:
    """The compact trend fields of the UI contract (state/significant/p/slope_decade/
    total/ci_decade). On precomputed multi-region files the build script then adds
    significant_fdr and re-derives state from it, so map and panel always agree."""
    state = (
        ("up" if result.slope_per_decade > 0 else "down")
        if (result.significant and result.slope_per_decade != 0) else "none"
    )
    return {
        "state": state,
        "significant": result.significant,
        "p": round(result.p_value, 6),
        "slope_decade": round(result.slope_per_decade, 10),
        "total": round(result.total_change, 6),
        "ci_decade": [round(result.ci_decade_low, 10), round(result.ci_decade_high, 10)],
        "ci_method": result.ci_method,
        "n_years": result.n_years,
        "method": result.method,
        "evidence": result.evidence,
        "warnings": result.warnings,
    }


# ------------------------------------------------------------- plain language

def plain_language(result: TrendResult, var_name: str, units: str) -> str:
    period = f"{result.first_year}–{result.last_year}"
    per_dec = _fmt(abs(result.slope_per_decade))
    if result.significant:
        verb = "risen" if result.direction == "increasing" else "fallen"
        conf = "very unlikely" if result.evidence == "strong" else "unlikely"
        return (
            f"{var_name} has {verb} by about {per_dec} {units} per decade over {period}. "
            f"A trend this consistent would be {conf} to appear by chance "
            f"({format_p(result.p_value)})."
        )
    hint = " There is a hint of a trend, but not enough evidence yet." if result.evidence == "weak" else ""
    return (
        f"We cannot say that {var_name[:1].lower() + var_name[1:]} has changed over {period}: "
        f"the ups and downs look like natural year-to-year variation ({format_p(result.p_value)}).{hint}"
    )


def is_young_record(e: RecordTooShort, record_start: int) -> bool:
    """Short because the record itself is new (waiting helps), not because of gaps at this point."""
    return record_start >= e.first_year - 1


def too_short_language(e: RecordTooShort, var_name: str, record_start: int) -> str:
    young = is_young_record(e, record_start)
    why = (f"because this record is young (its first complete year is {record_start})" if young
           else "because the other years are missing or incomplete at this point")
    wait = MIN_YEARS - e.n_years
    then = (f"The honest verdict is: too early to tell. Check again in {wait} more year{'s' if wait > 1 else ''}." if young
            else "The honest verdict is: not enough evidence here. Try a nearby point or another variable.")
    return (
        f"There are only {e.n_years} complete years of {var_name} here ({e.first_year}–{e.last_year}), {why}. "
        f"With so few years, one or two unusual years can look like a trend, "
        f"so we need at least {MIN_YEARS} before testing anything. {then}"
    )


def format_p(p: float) -> str:
    if p < 0.001:
        return "p < 0.001"
    return f"p = {p:.3f}" if p < 0.1 else f"p = {p:.2f}"


def _fmt(x: float) -> str:
    if x == 0:
        return "0"
    if abs(x) >= 10:
        return f"{x:.0f}"
    if abs(x) >= 1:
        return f"{x:.1f}"
    return f"{x:.2g}"
