# DECISIONS.md — btc-race-24h-20261117-0603 v2

## D1 — Resubmit v2 (HOLD2 300 → 360) instead of keeping v1

- **Decision:** submit the v2 bot as the final entry, replacing v1.
- **Why:** v2 beats v1 by +$6.13 on the dev window (+$12.757499 vs
  +$6.624202) and is byte-identical on the other three windows
  (0828 +$11.26, 2314 −$4.70, 1439 $0.00). The acceptance gate
  (0603 > +$6.62 AND worst window ≥ −$4.70) passes with margin.
- **Evidence:** exact simulator, two deterministic runs
  (EVIDENCE/sim-four-windows.txt); kit grade-local (EVIDENCE/
  grade-local-0603.txt) must reproduce +$12.757499 before submit.
- **Risk accepted:** last submission is final — v1 cannot be restored.
  Justified because v2 is strictly better on every measured window.

## D2 — Change exactly one parameter

- **Why:** v1's diagnosis is a single mechanical fault — the 300-bar
  max-hold cap cut a winning leg-2 trade at bar 902 (64,987), five
  bars before the 65,466 peak. Every other sweep dimension either did
  nothing (TP2, HOLD1, TP1, TRAIL1), hurt the worst window (TRAIL2,
  LOW_AGE, RANGE_MIN), or re-opened the losing bounce (R240_MAX1).
  One-parameter change keeps the v1 evidence base intact.
- **Why 360, not the sweep peak 365 (+$14.14):** 360 is a round number
  in the middle of the 320–410 plateau (all pass, +$9.48 to +$14.14);
  365's extra +$1.38 is single-bar fill noise, not signal.

## D3 — REJECTED: relaxing the leg-1 r240 gate

- **What:** R240_MAX1 0 → +100/+120 lets leg 1 fire on the first
  0603 dip's recovery. Result: 0603 falls to +$2.78 (4 trades) —
  it fires the same losing bounce the 0828 bot lost −$9.51 on.
  The D2 gate from v1 is load-bearing. +50/+80 changes nothing.

## D4 — REJECTED: looser range-dip entry (RANGE_MIN, LOW_AGE, TRAIL2)

- **What:** RANGE_MIN 200 → 120–160, LOW_AGE 30 → 15/20,
  TRAIL2 80 → 100. Each either leaves 0603 unchanged or slightly
  better but collapses 2314/1439 (down to −$15.92 / −$15.31) —
  the range filter is a real downtrend guard, not a free parameter.

## D5 — Submit by ~17:00 WIB, never last-minute

- **Why:** user order 2026-11-17 ~13:37 WIB ("kalo entry jangan
  mepet2"). Submit as soon as the build is verified and passes
  checks. If no v2 passes the gate by ~16:30 WIB, stop and keep v1.
- **Authorization:** standing order (work/submit maximally without
  asking) + this task's explicit resubmit instruction; gate satisfied.
