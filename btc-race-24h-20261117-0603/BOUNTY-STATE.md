# BOUNTY-STATE.md — btc-race-24h-20261117-0603

## Verified (official sources, reproduced runs)

- Competition: `btc-race-24h-20261117-0603`, "Race a BTC trading bot live
  for 24 hours". Source: kit `competition.yaml` (bundle
  `71ab12f0…`) + live leaderboard API, checked 2026-11-17 06:40 UTC.
- Status: open, phase `dev` (2026-11-17T06:03:00Z → 2026-11-17T12:03:00Z).
  Deadline 2026-11-17T12:03:00Z = **19:03 WIB**. Race runs 24h from
  15 min after the deadline.
- Prize: **$250, top 10 paid, 1st $60** (escrow USDC). Max 10 submissions
  total; last submission before the deadline is final.
- Judging: net PnL on the live 24h race window, highest first; entries
  need ≥ 1 trade and max drawdown ≤ 25% on the race window, or they rank
  below every entry that meets the bar. Dev gate: latest dev grade must
  make net PnL **above $0** after all fees, or the entry does not race.
- Leaderboard at 06:40 UTC: **62 entries** already listed (dev-phase
  grades visible). Competitor bots are not visible before the race.
- Dev window: 1,440 1-min bars, 2026-11-16 06:03 UTC → 2026-11-17 06:03 UTC,
  open 64,433.84, close 64,775.95 (+53 bps), high 65,609.83, low 63,874.36.
- This entry's dev grade (kit's own `grade-local`, driver process,
  2026-11-17 06:44 UTC): **net PnL +6.624202 USDC, 2 trades, win rate
  1.000, max drawdown 0.006185, fees 0.802811, guardrails met, L1 regrade
  reproduced byte for byte.** Gate PASSED.
- Same grade-local on the three older published windows: 0828 +11.260776
  (6 trades, maxDD 2.14%), 2314 −4.703780 (2 trades, maxDD 0.99%),
  1439 0.000000 (0 trades). L1 regrade byte-identical on all four.
- Exact local simulator (`~/workspace/makefun/btc_sim.py`, previously
  validated bit-identical to the kit grader) reproduces all four figures
  to the micro-USDC; two consecutive runs are identical (deterministic).
- Baseline (previous race's bot, submission 01a1de6f…, +$22.79 on its own
  window): on THIS dev window **−$9.51, 2 trades, maxDD 1.11%** — fails
  the dev gate. On the four windows: −9.51 / +22.79 / +10.00 / 0.00.
- Entry repo: `~/workspace/btc-race-0603-entry/`, commit
  `d8176ba0d53e3881943138010b63431951494d85` (main.ts + vendor). Anchor:
  `makefun anchor b4234a5b9fdf95bb240b0898ef58c66a3da39682 round 34031486`.
- Submission: PENDING (to be filed in this session; target 15:30–16:00 WIB,
  user order: never last-minute).

## Derived

- This bot beats the baseline on the only window that gates entry
  (+6.62 vs −9.51, +$16.13) and is worse than it in total across the
  four historical windows (+13.18 vs +23.28). The gate is binary: the
  baseline cannot race at all on this window, so the comparison that
  decides submission is the dev window, not the four-window total.
- Worst historical window for this bot is −$4.70 (sharp down day); max
  drawdown across all four windows ≤ 2.14%, far inside the 25% race bar.

## Hypothesis

- The race window (starting ~12:18 UTC 17 Nov, right after a flat day
  that followed a multi-day crash) is most likely to be flat-to-bouncy
  or a further leg down; this bot is built for exactly those two regimes
  (range dip + confirmed bounce) and carries breakout insurance for an
  up day. Unconfirmed — the race window is future data.

## Unknown

- Competitor bots: not visible before the race (leaderboard shows only
  dev grades / entry counts). No competitor feature claims are made.
- Final rank / prize: decided only by the live 24h race after the deadline.
- Whether the race-day regime matches any historical window.

## Risks

- Leg 2 (range dip) is tuned on one flat window; a race day that drifts
  down slowly all day could cost up to ~$5–11 (its historical worst
  single-window loss is −$4.70; the rejected leg-2a variant lost −$37.56
  on 0828 — see DECISIONS.md — and was NOT shipped).
- A race day with zero setups yields $0.00 and 0 trades, failing the
  1-trade race guardrail (same exposure the previous bot had on 1439).

## Next action

Submit now (quota 1/10 used after this submission), then monitor the
live race; no resubmission unless a clearly stronger bot is validated
before the deadline.
