# btc-race-24h-20261117-0603 — Range-dip + confirmed-bounce bot

A selective long-only bot for CBBTC 1-minute bars (Orca Whirlpool, cbBTC/USDC),
$1,000 paper, stdlib only (Node 22, no dependencies beyond the vendored SDK).

## The problem

The dev window for this race (2026-11-16 06:03 UTC → 2026-11-17 06:03 UTC)
is a **flat day** (+53 bps, range 63,874–65,610). The previous race's
confirmed-bounce bot loses **−$9.51** on it: it buys the top of a spike that
has already run +215 bps off the low, in a market that is +120 bps over the
last 240 minutes — not a capitulation. It fails the dev gate (PnL > $0) and
cannot race at all.

## The bot

Three legs, one position at a time, full cash per entry, 60-bar cooldown
after any exit, no trade in the first 240 bars:

1. **Confirmed bounce** (max 2/day): close recovered 150–250 bps off the
   rolling 240-min low, 10-min return ≥ +80 bps, 60-min high ≥ 200 bps
   above the low — **and** the 240-min return ≤ 0 (down context only).
   The r240 gate is the discriminator the flat day exposed: the winning
   bounce on the 20261115 window entered at r240 = −120 bps; the losing
   one on this window at r240 = +120 bps. Exits: TP +250 / stop −150 /
   trail 80 / hold 180.
2. **Range dip** (max 2/day): close within 80 bps of the rolling 240-min
   low, low made ≥ 30 bars ago, 30-min return ≥ +20 bps, 240-min return
   in [−200, +100] bps, rolling 240-min range ≥ 200 bps wide. Patient
   exits (TP +180 / stop −80 / trail 80 / hold 300) because a flat-day
   grind takes hours to reach the top of the range.
3. **Strict breakout** (max 1/day, up-day insurance): 240-min return
   ≥ +150 bps and close breaks the rolling 240-min high by 20 bps with
   10-min return ≥ +40 bps. Fires on none of the four published dev
   windows; exists so an up-trending race day still produces ≥ 1 trade.

No shorts, no leverage, no clock, no network, no randomness — two runs on
the same data produce the same orders.

## Validation (kit's own grade-local, driver process, L1 regrade byte for byte)

| Window | Net PnL | Trades | Max DD | Guardrails |
|---|---|---|---|---|
| 0603 (this race) | **+$6.624202** | 2 | 0.62% | met |
| 0828 (20261115) | +$11.260776 | 6 | 2.14% | met |
| 2314 (20261113) | −$4.703780 | 2 | 0.99% | met |
| 1439 (20261112) | $0.000000 | 0 | 0.00% | trades < 1 (by design) |

Exact-simulator cross-check reproduces every figure to the micro-USDC.
Previous bot on the same four windows: −$9.51 / +$22.79 / +$10.00 / $0.00 —
it is better on down days, but it **fails this race's dev gate**, so it
cannot race. This bot passes the gate; worst historical window is −$4.70.

## Files

- `main.ts` — the bot (entrypoint)
- `vendor/makefun-bars.ts` — kit SDK, vendored verbatim (sha256 `9677370b…`)
- `BOUNTY-STATE.md`, `DECISIONS.md`, `EVIDENCE/` — build state, decisions,
  and the evidence behind them (makefun-superpower workflow)
- `LICENSE` — MIT
