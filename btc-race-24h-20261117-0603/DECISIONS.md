# DECISIONS.md — btc-race-24h-20261117-0603

## D1 — Ship the range-dip bot (v5), not the 0828 baseline

- **Decision:** submit the new bot (legs 1+2+3) instead of re-submitting
  the previous race's bot.
- **Why:** the baseline fails THIS race's dev gate (−$9.51 < $0) and
  cannot race at all. The new bot passes it (+$6.62). A bot that cannot
  race scores $0 regardless of how good it was on another window.
- **Evidence:** exact simulator + kit grade-local, both windows
  (EVIDENCE/grade-local-0603.txt, EVIDENCE/baseline-0603.txt).

## D2 — Gate leg 1 (confirmed bounce) on r240 ≤ 0

- **Why:** entry-context trace showed the winning bounce on 0828 entered
  at r240 = −120 bps while the losing bounce on 0603 entered at
  r240 = +120 bps (price already +145 bps in the last 60 min). Same
  recovery band (150–250 bps), opposite context.
- **Effect:** blocks the 0603 loss; keeps the 0828 winner (r240 −120).

## D3 — Range-dip leg with a wide-range requirement (≥ 200 bps)

- **Why:** the first range-leg variants (momentum confirmation only)
  lost money on every window — they bought while the low was still being
  made. Adding "low established ≥ 30 bars + 30-min return ≥ +20 bps +
  rolling 240-min range ≥ 200 bps" fixed 1439 to $0.00 (0 trades) and
  0603 to +$6.62.
- **Trade-off:** the leg is tuned on one flat window; see BOUNTY-STATE.md
  risks. Parameters are round numbers at the centre of a flat plateau
  (180–220 bps range all give identical results), not a sharp optimum.

## D4 — REJECTED: re-adding the old slow-bounce leg (v6)

- **What:** adding back the 0828 bot's leg 2 (rec ≤ 60 bps + 5-min
  return ≥ 50 bps) recovered 2314 to +$5.22 but destroyed 0828:
  −$37.56 (8 trades, maxDD 4.34%). The extra leg interacted with the
  dip leg's entries (trades at bars 798/1005 into a falling market).
- **Decision:** do NOT ship v6. Keep v5. 2314 stays −$4.70.

## D5 — Submit early (target 15:30–16:00 WIB, deadline 19:03 WIB)

- **Why:** user order 2026-11-17 ~13:37 WIB ("kalo entry jangan
  mepet2"). Submit as soon as the build is verified and passes checks;
  do not chase perfection to the deadline.
- **Authorization:** standing order (work/submit maximally without
  asking) + this task's explicit submit instruction; gate satisfied.

## D6 — No resubmission after this one unless clearly stronger

- **Why:** last submission is final; a weaker resubmission would
  downgrade the entry. Only a bot that beats +$6.62 on the dev window
  AND does not worsen the worst window (−$4.70) would qualify.
