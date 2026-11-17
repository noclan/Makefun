# BOUNTY-STATE — gta6-twitch-ccu-forecast-01

- **Competition:** Forecast GTA VI's launch-day Twitch viewers hour by hour
- **Prize:** $250, top 20 (1st $50). Deadline 2026-11-19T01:00:00Z (08:00 WIB 19 Nov).
- **Entry fee:** $0. Field at 08:12 UTC 17 Nov: API submissionCount 17.
- **Entrypoint:** `main.py` (Python 3.13 stdlib only, no network, deterministic).
- **Model:** rolling-midnight shape + log-size regression. From the case's own
  `comparables` at runtime: complete 24h curves, tier "comparable", data
  rolling-like (0.5 <= v2/v1 <= 1.5, max(v)/v1 < 6), excluding the case game
  and same-day launches. Per hour h=2..24, OLS of ln(v_h/v_1) on ln(h1);
  forecast log-ratio = a_h + b_h*ln(p1) with ln(p1) clamped to the pool's
  ln(h1) range; spread = residual sample std floored 0.05, capped 3.0.
  Fallbacks if pool < 5: drop data rule, then all complete curves, then
  starter persistence.
- **LOO validation (exact main.py code, p00.in comparables, rolling-like
  pool):** mean pinball **0.161089 (n=15)** vs starter **0.289823** on the
  same set — improvement 0.1287. Official practice baseline 0.387.
  (EVIDENCE/loo.txt). Gate was > 0.20 = stop; 0.161 passes.
- **Practice runs (each case alone, as the grader does):** p00 0.11 s /
  1,446 bytes, p01 0.12 s / 1,523 bytes, p02 0.10 s / 1,547 bytes,
  p03 0.10 s / 1,525 bytes — all 23 rows, hours 2..24, valid quantiles,
  deterministic (byte-identical second run), well under 8 s and 65,536
  bytes. Practice answers are server-side; no practice score is claimed.
  (EVIDENCE/practice-runs.txt).
- **Pool sizes:** 15 comparables for every practice case (37 complete curves).
- **Submission:** transcript UPLOADS (makefun bundle), NOT recorded
  transcripts — `makefun record` refuses this competition server-side.
- **Status:** built, validated, submitted (see claim-code file in
  ~/workspace/makefun/claim-code-gta6-twitch-ccu-forecast-01.txt).
- **GitHub push:** PENDING for the parent agent (this builder has no
  GitHub access).
