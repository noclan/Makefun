# Range-dip + confirmed-bounce bot — v2

A selective long-only BTC trading bot for CBBTC 1-minute bars, for
make.fun competition `btc-race-24h-20261117-0603` ("Race a BTC trading
bot live for 24 hours", $250, top 10, 1st $60).

## What changed vs v1

v1 (submission `01a1e842-6c4c-7358-a937-6341f0ca23ee`) made +$6.624202
on the dev window. This v2 is identical except the leg-2 max hold:
**300 → 360 bars** (`MAX_HOLD2_BARS` in `main.ts`).

v1's 300-bar cap forced the leg-2 trade's exit at bar 902 (close
64,987) — five bars before the day's 65,466 peak (bar 967). The
360-bar cap lets the same trade ride to 65,378.83 at bar 962.

## Results (exact simulator, deterministic, two runs identical)

| Window | PnL | Trades | Max DD |
|--------|-----|--------|--------|
| 0603 (this race, dev) | **+$12.757499** | 2 | 0.62% |
| 0828 | +$11.260776 | 6 | 2.14% |
| 2314 | −$4.703780 | 2 | 0.99% |
| 1439 | $0.000000 | 0 | 0.00% |

v2 beats v1 by +$6.13 on the dev window and is identical on the other
three windows. Worst window −$4.70, unchanged.

## Strategy (3 legs, long-only, full-size, 60-bar cooldown)

- **Leg 1** — confirmed bounce off a capitulation low, gated on a down
  context (240-min return ≤ 0), recovery 150–250 bps off the rolling
  240-min low, 10-min momentum ≥ +80 bps.
- **Leg 2** — patient range dip: close within 80 bps of an established
  (≥30 bars) rolling 240-min low, 30-min return ≥ +20 bps, 240-min
  range ≥ 200 bps. Exits: take-profit +180, trail 80, stop −80,
  max hold 360 bars.
- **Leg 3** — strict breakout insurance for an up-trending race day
  (240-min return ≥ +150 bps and break of the rolling 240-min high).

No trade in the first 240 bars, no orders while warming up, no shorts,
no leverage, no clock, no randomness.

## Files

- `main.ts` — the bot (TypeScript, stdlib-only via `vendor/`)
- `BOUNTY-STATE.md` — verified state, evidence, rejected variants
- `DECISIONS.md` — decisions and why
- `EVIDENCE/` — simulator runs and grade-local output
