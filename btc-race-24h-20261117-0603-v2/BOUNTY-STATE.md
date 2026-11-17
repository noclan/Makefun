# BOUNTY-STATE.md — btc-race-24h-20261117-0603 (v2 resubmission attempt)

## Verified

- **Competition:** btc-race-24h-20261117-0603, "Race a BTC trading bot live
  for 24 hours", $250 (top 10, 1st $60). Entry deadline
  2026-11-17T12:03:00Z = 19:03 WIB. Race starts 19:18 WIB 17 Nov.
- **v1 (submitted):** "Range-dip + confirmed-bounce bot", submission
  `01a1e842-6c4c-7358-a937-6341f0ca23ee`, stage `checked`, commit
  `487740d35847a2cd39ceea0ec799633965ec56d6`, bundle `b4234a5b`.
  Dev gate +$6.624202 / 2 trades / maxDD 0.62%. Worst window −$4.70.
- **v2 (this repo):** identical to v1 except leg-2 max hold 300 → 360 bars
  (`MAX_HOLD2_BARS`). Exact simulator, two deterministic runs:
  - 0603: **+$12.757499**, 2 trades, maxDD 0.62%
  - 0828: +$11.260776, 6 trades, maxDD 2.14%
  - 2314: −$4.703780, 2 trades, maxDD 0.99%
  - 1439: $0.000000, 0 trades, maxDD 0.00%
- **Gate check:** 0603 +$12.76 > v1 +$6.62 ✓; worst window −$4.70,
  identical to v1, not worse ✓; dev gate passes ✓; maxDD ≤ 2.14%
  everywhere (limit 25%) ✓; ≥1 trade on 0603 ✓.
- **Diagnosis (traced):** on 0603 v1 bought the second dip at bar 602
  (close 64,335.83) and the 300-bar cap forced the exit at bar 902
  (close 64,987) — five bars before the day's 65,466 peak (bar 967).
  The 360-bar cap lets the same trade exit at bar 962 (close 65,378.83).
  No other trade on any window changes.
- **Robustness:** HOLD2 swept 310–410 — every value from 320 to 410
  passes the gate (0603 +$9.48 to +$14.14, worst window unchanged).
  360 sits in the middle of the plateau, not on a spike. HOLD2=310
  fails the gate (+$6.28), so the improvement is real but the plateau
  is broad.
- **Kit grade-local:** net PnL 12.757499 USDC, 2 trades, win rate 1.0,
  max drawdown 0.6184505%, guardrails met, L1 regrade reproduced byte
  for byte, result_sha256
  52dbd65bad8d247576c43ed234ffc69b3d3db264bd5288989e476b4e4eeedbdf
  (EVIDENCE/grade-local-0603.txt).

## Derived

- v2 beats v1 by +$6.13 on the dev window and is identical on the
  other three windows. Expected race value is higher, but the race
  window is future data — no guarantee.

## Hypothesis

- The race window (from 19:18 WIB, right after a flat day following a
  multi-day crash) is most likely flat-to-bouncy or a further leg down —
  the regimes this bot is built for. Unconfirmed.

## Unknown

- Competitor bots (not visible before the race); final rank/prize
  (decided only by the live 24h race).

## Rejected (measured, recorded)

- Relaxing leg-1's r240 gate to +100/+120: fires the losing bounce on
  0603 (4 trades, +$2.78) — the D2 gate is load-bearing. +50/+80:
  no change.
- TRAIL2=100 or LOW_AGE=15/20 with HOLD2=360: 2314 worsens to
  −$7.02 / −$5.56 — fails the worst-window guard.
- RANGE_MIN 120–160: 0603 barely moves, 2314/1439 collapse to −$15
  (the range filter is a real downtrend guard).
- TP2 120–250, HOLD1, TP1, TRAIL1: no effect on 0603.
- MAX2=3: no extra trade fires on 0603 (third dip blocked by the
  range rule); 0828 drops to +$8.55. Not shipped.

## Risks

- Single-parameter change tuned on one flat window; the plateau check
  (320–410 all pass) mitigates but does not eliminate overfit risk.
- Last submission is final: if v2 is submitted, v1 cannot be restored.
  v2 is strictly better on every measured window, so the swap is
  justified by the gate.
