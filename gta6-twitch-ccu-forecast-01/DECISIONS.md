# DECISIONS — gta6-twitch-ccu-forecast-01

## D1 — Model: OLS log-ratio regression on a rolling-like pool, exactly as specified
Per-hour OLS of ln(v_h/v_1) on ln(h1) over rolling-midnight-like comparables,
ln(p1) clamped to the pool range, residual-std spread (floor 0.05, cap 3.0).
No redesign: the coordinator-validated shape was implemented as specified.
Channels are NOT used (tested not to help). No randomness, no time, no
network, no file reads outside the case file.

## D2 — Pool rules are data-driven, not unlock-text-driven
Tier parsed from unlock text ("comparable" only) plus the data rule
(0.5 <= v2/v1 <= 1.5, max(v)/v1 < 6). Simultaneous-global and early-access
launches have different shapes and are excluded by these rules. Pool is
15 curves on every practice case (37 complete curves in p00.in).

## D3 — Fallbacks in order: tier-only, then all complete curves, then starter
If the rolling-like pool has < 5, drop the data rule; if still < 5, use all
complete curves; if still < 5, starter persistence. A malformed case field
also falls back to persistence in main() so a case is never left invalid
by a crash.

## D4 — Rounding and monotonicity exactly like the starter
round2 half-up (whole numbers as ints in JSON), quantiles enforced
non-decreasing per hour via cumulative max, capped at 1e9, > 0.

## D5 — Submit early, not last-minute
Field already had 17 submissions at 08:12 UTC 17 Nov. Built and submitted
17 Nov evening WIB, well before the 19 Nov 01:00 UTC deadline, per the
user's "jangan mepet-mepet" rule.

## D6 — Transcript uploads, not recordings
This competition refuses `makefun record` server-side; entry uses the
proven session-export + bundle pattern (btc-race-0603 v1/v2).
