"""Rolling-midnight shape + log-size regression forecaster.

Forecasts GTA VI launch-day Twitch viewers hour by hour (hours 2..24)
from the case's own comparables at runtime. Launch curves are driven by
rolling-midnight unlocks (NZ first, US East 05:00Z, US West 08:00Z), so the
median curve dips at hours 3-5 and peaks ~2.4x at hours 19-22; and the
log-ratio ln(v_h/v_1) correlates strongly (about -0.94 at late hours) with
ln(hour-1 viewers): big launches are already flat in hour 1, small ones
grow. So per hour we regress the log-ratio on ln(h1) over a pool of
rolling-midnight-like past launches and widen the quantiles by the
residual spread.

Pool (from the case's own `comparables`): complete 24h curves only,
tier "comparable" parsed from the unlock text, data-rolling-like
(0.5 <= v2/v1 <= 1.5 and max(v)/v1 < 6), excluding the case game itself
and any launch on the same day. Fallbacks if the pool has < 5: drop the
data rule (tier only), then all complete curves, then starter
persistence. Per hour h: OLS of ln(v_h/v_1) on ln(h1); forecast
log-ratio = a_h + b_h * ln(p1) with ln(p1) clamped to the pool's
ln(h1) range; spread = residual sample std, floored 0.05, capped 3.0.

Validation (LOO over the p00.in comparables, rolling-like pool, n=15):
mean pinball 0.161089 vs starter 0.289823 on the same set (official
practice baseline 0.387). See EVIDENCE/loo.txt.
Python 3.13 stdlib only, no network, deterministic, ~0.1 s/case.
"""

import json
import math
import os
import re
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

INPUT_DIR = Path(os.environ.get("MAKEFUN_INPUT_DIR", "/input"))
OUTPUT_DIR = Path(os.environ.get("MAKEFUN_OUTPUT_DIR", "/output"))

LEVELS = [0.05, 0.25, 0.5, 0.75, 0.95]
Z = [-1.645, -0.674, 0, 0.674, 1.645]
TIER_RE = re.compile(r"Tier: ([a-z\-]+)")


def round2(x: float) -> float | int:
    """x rounded to 2 decimals, half up, as the starter rounds it."""
    scaled = x * 100
    whole = math.floor(scaled)
    if scaled - whole >= 0.5:
        whole += 1
    value = whole / 100
    return int(value) if value.is_integer() else value


def _parse_time(text: str) -> datetime:
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def extract_curves(case: dict) -> list[dict]:
    """Complete 24h launch-day curves from the case's comparables."""
    curves = []
    for comp in case.get("comparables") or []:
        try:
            day_start = _parse_time(comp["day_start"])
        except (KeyError, TypeError, ValueError):
            continue
        hours: dict[int, float] = {}
        for pt in comp.get("hourly") or []:
            try:
                idx = int((_parse_time(pt["from"]) - day_start).total_seconds() // 3600) + 1
                viewers = pt["viewers"]
            except (KeyError, TypeError, ValueError):
                continue
            if 1 <= idx <= 24:
                hours[idx] = viewers
        if len(hours) != 24:
            continue
        v = [hours[h] for h in range(1, 25)]
        if not v[0] or v[0] <= 0:
            continue
        match = TIER_RE.search(comp.get("unlock") or "")
        tier = match.group(1) if match else "unknown"
        curves.append({
            "name": comp.get("name") or "",
            "day_start": comp.get("day_start") or "",
            "tier": tier,
            "h1": v[0],
            "v": v,
        })
    return curves


def _rolling_like(curve: dict) -> bool:
    v1 = curve["v"][0]
    return 0.5 <= curve["v"][1] / v1 <= 1.5 and max(curve["v"]) / v1 < 6


def select_pool(case: dict) -> list[dict]:
    """The comparable pool, with the spec's fallbacks for a small pool."""
    game_name = (case.get("game") or {}).get("name") or ""
    day_start = case.get("day_start") or ""
    complete = []
    for curve in extract_curves(case):
        if game_name and curve["name"].lower() == game_name.lower():
            continue
        if day_start and curve["day_start"] == day_start:
            continue
        complete.append(curve)
    rolling = [c for c in complete if c["tier"] == "comparable" and _rolling_like(c)]
    if len(rolling) >= 5:
        return rolling
    tier_only = [c for c in complete if c["tier"] == "comparable"]
    if len(tier_only) >= 5:
        return tier_only
    if len(complete) >= 5:
        return complete
    return []


def _ols(xs: list[float], ys: list[float]) -> tuple[float, float, float]:
    """OLS of ys on xs; returns (intercept, slope, residual sample std)."""
    n = len(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx > 0:
        b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx
    else:
        b = 0.0
    a = my - b * mx
    resid = [y - (a + b * x) for x, y in zip(xs, ys)]
    if n > 1:
        s = math.sqrt(sum(r * r for r in resid) / (n - 1))
    else:
        s = 0.3
    return a, b, s


def forecast_from_pool(p1: float, pool: list[dict]) -> list[list[float | int]]:
    """Quantile rows for hours 2..24 from an already-selected pool."""
    p1 = max(1, p1)
    log_p1 = math.log(p1)
    log_h1 = [math.log(c["h1"]) for c in pool]
    lo, hi = min(log_h1), max(log_h1)
    clamped = max(lo, min(hi, log_p1))
    rows: list[list[float | int]] = []
    for h in range(2, 25):
        xs = log_h1
        ys = [math.log(max(1, c["v"][h - 1]) / c["h1"]) for c in pool]
        a, b, s = _ols(xs, ys)
        pred = a + b * clamped
        spread = max(0.05, min(3.0, s))
        row: list[float | int] = []
        prev = 0.0
        for z in Z:
            q = round2(p1 * math.exp(pred + z * spread))
            q = max(q, prev)  # non-decreasing per hour
            q = min(q, 1_000_000_000)
            if q <= 0:
                q = prev if prev > 0 else 1
            row.append(q)
            prev = float(q)
        rows.append(row)
    return rows


def starter_rows(p1: float) -> list[list[float | int]]:
    """Starter persistence forecast (fallback when the pool is < 5)."""
    p1 = max(1, p1)
    rows: list[list[float | int]] = []
    for h in range(2, 25):
        row: list[float | int] = []
        prev = 0.0
        for z in Z:
            q = round2(p1 * math.exp(z * 0.15 * math.sqrt(h - 1)))
            q = max(q, prev)
            q = min(q, 1_000_000_000)
            row.append(q)
            prev = float(q)
        rows.append(row)
    return rows


def forecast_case(case: dict, name: str) -> dict:
    if case["levels"] != LEVELS:
        raise ValueError(f"{name} asks for levels {case['levels']}, not {LEVELS}")
    first = next((k for k in case["known"] if k["hour"] == 1), None)
    if first is None:
        raise ValueError(f"{name} has no hour-1 print")
    p1 = max(1, first["viewers"])
    pool = select_pool(case)
    if len(pool) >= 5:
        rows = forecast_from_pool(p1, pool)
    else:
        rows = starter_rows(p1)
    return {"hours": [{"hour": row["hour"], "q": q}
                      for row, q in zip(case["forecast"], rows)]}


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for path in sorted(INPUT_DIR.glob("*.in")):
        case = json.loads(path.read_text(encoding="utf-8"))
        try:
            forecast = forecast_case(case, path.name)
        except Exception:
            # Never leave a case invalid on a malformed field: fall back
            # to persistence around hour 1 (or 1 viewer if that is missing).
            p1 = 1
            try:
                first = next(k for k in case["known"] if k["hour"] == 1)
                p1 = max(1, first["viewers"])
            except Exception:
                pass
            forecast = {"hours": [{"hour": h, "q": q}
                                  for h, q in zip(range(2, 25), starter_rows(p1))]}
        (OUTPUT_DIR / f"{path.stem}.out").write_text(
            json.dumps(forecast, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
