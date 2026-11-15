# btc-race-24h-20261115-0828 — Confirmed-bounce BTC bot

Long-only cbBTC/USDC trading bot for make.fun's 24-hour BTC race
(1-minute on-chain bars, $1,000 paper). Three selective legs, one open
position, full-size entries:

- **Leg 1 — confirmed capitulation bounce** (max 2/day): enters only after
  the close has already recovered 150–250 bps off the rolling 240-minute
  low, with a 10-minute return of +80 bps and a real selloff (60-min high
  ≥ 200 bps above the low) before it. Wide exits (trail 80, TP +250,
  stop −150, hold 180).
- **Leg 2 — slow bounce** (max 1/day): close within 60 bps of the
  240-minute low with a 5-minute return ≥ +50 bps. Tight exits
  (trail 40, TP +120, stop −75, hold 90).
- **Leg 3 — strict breakout** (max 1/day, up-day insurance): 240-minute
  return ≥ +150 bps and the close breaks the 240-minute high by 20 bps.

Local grade (kit grader, driver process, L1 regrade byte-identical):
dev window **+$22.79** (4 trades, max drawdown 0.93%); the two earlier
published dev windows give +$10.00 and $0.00 (no setup, no trade).
The previous race's bot lost −$21.71 on this dev window.

Entry: `main.ts` (Node 22, stdlib + vendored `vendor/makefun-bars.ts`
byte-for-byte from the kit SDK). Deterministic: no clock, no randomness,
no network.
