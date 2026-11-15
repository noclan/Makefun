// Confirmed-bounce bot: a selective long-only bot for CBBTC 1-minute bars.
//
// The three published dev windows are all down days (-228 to -491 bps) in
// which every house baseline loses money (buy-and-hold -$26 to -$53,
// ema-cross -$96 to -$135, rsi-bollinger -$47 to -$66). The only real
// money is the one sharp V-bounce per day, so this bot trades almost
// nothing and waits for it:
//
//   - Leg 1 (flat only, at most 2 a day): a CONFIRMED bounce off a
//     capitulation low. The close has already recovered 150-250 bps off
//     the rolling 240-minute low, the 10-minute return is at least +80
//     bps, and the 60-minute high sits at least 200 bps above that low
//     (a real selloff preceded it). Entering after the bounce has started
//     is the whole point: the previous race's bot bought the first tick up
//     at the low and its -75 bps stop was run over 9 bars before a
//     +471 bps bounce. On the new dev window this leg alone makes +$26.77.
//   - Leg 2 (flat only, at most 1 a day): a SLOW bounce off the rolling
//     240-minute low: the close is within 60 bps above the low AND the
//     5-minute return is at least +50 bps. This is the previous bot's
//     entry, kept for slow-bounce days where leg 1 never confirms: on the
//     20261113 dev window it makes +$10.00. One a day only, because its
//     second signal on a choppy day is a whipsaw.
//   - Leg 3 (flat only, at most 1 a day): a STRICT breakout, up-day
//     insurance. The 240-minute return is at least +150 bps AND the
//     close breaks the rolling 240-minute high by 20 bps with a 10-minute
//     return of at least +40 bps. It fires on none of the three published
//     dev windows (their best 240-minute returns stay under +150 bps), so
//     it costs nothing there; it exists for a race day that trends up
//     from the open, where legs 1 and 2 would otherwise never trade and
//     the entry would fail the 1-trade guardrail.
//   - Exits (holding only, per leg): trailing stop, take-profit, hard
//     stop, max hold. Leg 1 rides wide (trail 80, TP +250, stop -150,
//     hold 180 bars); leg 2 exits tight (trail 40, TP +120, stop -75,
//     hold 90 bars). A 60-bar cooldown after any exit keeps the bot from
//     re-entering the top of the move it just sold.
//   - No trade in the first 240 bars (lows still seeding), no orders
//     while warming up, no shorts, no leverage, no clock, no randomness.
//
// Validated on the three published dev windows with an exact local
// simulator (bit-identical to the kit's grader: the old bot reproduces
// -$21.705334 / +$9.951266 / +$3.926956 to the micro-USDC) and confirmed
// with the kit's own grade-local (driver process, L1 regrade byte for
// byte): this bot makes +$22.786309 / +$10.00 / $0.00 with max drawdown
// under 1% on each. The $0.00 on the quiet window is by design: no
// setup, no trade, no loss — every baseline loses $23-$96 there. Leg 3
// fires on none of the three windows.

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOW_WINDOW = 240;
const REC_MIN_BPS = 150;
const REC_MAX_BPS = 250;
const MOM_LOOKBACK = 10;
const MOM_MIN_BPS = 80;
const SELLOFF_MIN_BPS = 200;
const TRAIL1_BPS = 80;
const TAKE_PROFIT1_BPS = 250;
const STOP_LOSS1_BPS = 150;
const MAX_HOLD1_BARS = 180;
const MAX_TRADES1 = 2;
const LOW2_MAX_ABOVE_BPS = 60;
const REC2_LOOKBACK = 5;
const REC2_MIN_BPS = 50;
const TRAIL2_BPS = 40;
const TAKE_PROFIT2_BPS = 120;
const STOP_LOSS2_BPS = 75;
const MAX_HOLD2_BARS = 90;
const MAX_TRADES2 = 1;
const BRK_RET240_MIN_BPS = 150;
const BRK_MIN_BPS = 20;
const MOM3_MIN_BPS = 40;
const TRAIL3_BPS = 80;
const TAKE_PROFIT3_BPS = 250;
const STOP_LOSS3_BPS = 100;
const MAX_HOLD3_BARS = 180;
const MAX_TRADES3 = 1;
const COOLDOWN_BARS = 60;
const MAX_SLIPPAGE_BPS = 100;

const closes: number[] = []; // non-null closes, in order
let peak: bigint | null = null; // running peak held value since entry
let entryIdx: number | null = null; // closes-index of the buy decision
let entryLeg = 0; // which leg entered (1, 2 or 3)
let lastExitIdx = -1000000; // closes-index of the last sell decision
let trades1 = 0; // leg-1 entries taken
let trades2 = 0; // leg-2 entries taken
let trades3 = 0; // leg-3 entries taken

await runBars({
  onBatch(state: BarsState): OrderInput[] {
    const closeBig = state.close(SYMBOL);
    if (closeBig === null) return []; // gap bar: no new information
    const close = Number(closeBig);
    const idx = closes.length;
    closes.push(close);
    if (state.warmingUp) return [];

    const pos = state.positions.get(SYMBOL);
    if (pos === undefined) {
      if (idx - lastExitIdx < COOLDOWN_BARS) return [];
      if (idx < LOW_WINDOW) return [];
      const lo = Math.min(...closes.slice(idx - LOW_WINDOW + 1, idx + 1));
      const hi60 = Math.max(...closes.slice(idx - 60 + 1, idx + 1));
      const hi240 = Math.max(...closes.slice(idx - LOW_WINDOW + 1, idx));
      // Leg 1: confirmed bounce off a capitulation low.
      if (
        trades1 < MAX_TRADES1 &&
        (hi60 / lo - 1) * 10000 >= SELLOFF_MIN_BPS &&
        close >= lo * (1 + REC_MIN_BPS / 10000) &&
        close <= lo * (1 + REC_MAX_BPS / 10000) &&
        idx >= MOM_LOOKBACK &&
        (close / closes[idx - MOM_LOOKBACK] - 1) * 10000 >= MOM_MIN_BPS
      ) {
        const notional = state.cash;
        if (notional >= BigInt(state.hello.fees.min_notional_quote_units)) {
          peak = null;
          entryIdx = idx;
          entryLeg = 1;
          trades1 += 1;
          return [{
            side: 'buy',
            symbol: SYMBOL,
            notional_quote_units: notional,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          }];
        }
      }
      // Leg 2: slow bounce off the rolling low.
      if (
        trades2 < MAX_TRADES2 &&
        idx >= REC2_LOOKBACK &&
        close <= lo * (1 + LOW2_MAX_ABOVE_BPS / 10000) &&
        (close / closes[idx - REC2_LOOKBACK] - 1) * 10000 >= REC2_MIN_BPS
      ) {
        const notional = state.cash;
        if (notional >= BigInt(state.hello.fees.min_notional_quote_units)) {
          peak = null;
          entryIdx = idx;
          entryLeg = 2;
          trades2 += 1;
          return [{
            side: 'buy',
            symbol: SYMBOL,
            notional_quote_units: notional,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          }];
        }
      }
      // Leg 3: strict breakout (up-day insurance).
      if (
        trades3 < MAX_TRADES3 &&
        idx >= MOM_LOOKBACK &&
        (close / closes[idx - LOW_WINDOW] - 1) * 10000 >= BRK_RET240_MIN_BPS &&
        close >= hi240 * (1 + BRK_MIN_BPS / 10000) &&
        (close / closes[idx - MOM_LOOKBACK] - 1) * 10000 >= MOM3_MIN_BPS
      ) {
        const notional = state.cash;
        if (notional >= BigInt(state.hello.fees.min_notional_quote_units)) {
          peak = null;
          entryIdx = idx;
          entryLeg = 3;
          trades3 += 1;
          return [{
            side: 'buy',
            symbol: SYMBOL,
            notional_quote_units: notional,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          }];
        }
      }
      return [];
    }

    // Holding: leg-specific trailing stop / take-profit / hard stop / max hold.
    const trail = entryLeg === 1 ? TRAIL1_BPS : entryLeg === 2 ? TRAIL2_BPS : TRAIL3_BPS;
    const takeProfit = entryLeg === 1 ? TAKE_PROFIT1_BPS : entryLeg === 2 ? TAKE_PROFIT2_BPS : TAKE_PROFIT3_BPS;
    const stopLoss = entryLeg === 1 ? STOP_LOSS1_BPS : entryLeg === 2 ? STOP_LOSS2_BPS : STOP_LOSS3_BPS;
    const maxHold = entryLeg === 1 ? MAX_HOLD1_BARS : entryLeg === 2 ? MAX_HOLD2_BARS : MAX_HOLD3_BARS;
    const heldValue = state.value(SYMBOL, pos.qty);
    if (peak === null || heldValue > peak) peak = heldValue;
    const cost = pos.cost;
    const sell: OrderInput = {
      side: 'sell',
      symbol: SYMBOL,
      qty: pos.qty,
      max_slippage_bps: MAX_SLIPPAGE_BPS,
    };
    if (heldValue < (cost * BigInt(10000 - stopLoss)) / 10000n) {
      lastExitIdx = idx;
      return [sell];
    }
    if (heldValue > (cost * BigInt(10000 + takeProfit)) / 10000n) {
      lastExitIdx = idx;
      return [sell];
    }
    if (entryIdx !== null && idx - entryIdx >= maxHold) {
      lastExitIdx = idx;
      return [sell];
    }
    if (peak !== null && heldValue <= (peak * BigInt(10000 - trail)) / 10000n) {
      lastExitIdx = idx;
      return [sell];
    }
    return [];
  },
});
