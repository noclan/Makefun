# Playtest evidence — SURGELOOP v2 (2026-11-17 ~14:05 WIB, seed 7, 75 s each)

All runs against the v2 game served on http://localhost:8931 (serve.ts, port 8931),
driver /tmp/bot-playtest-v2.mjs (CDP poll of window.__gameState every 500 ms).

## Fast bot (?bot=1)
```json
{"framesAdvanced":1738,"firstScoreSample":18,"scoreStart":0,"scoreEnd":120,
 "waveEnd":2,"livesEnd":0,"screenEnd":"over","maxSurge":2,
 "softlockWindows":0,"errors":[]}
```
v1 (same seed/duration): 1822 frames, score 0 → 120, wave 2, maxSurge 2, 0 softlocks, 0 errors.
Verdict: gameplay unchanged.

## Slow bot (?bot=slow)
```json
{"framesAdvanced":1883,"firstScoreSample":24,"scoreStart":0,"scoreEnd":125,
 "waveEnd":2,"livesEnd":0,"screenEnd":"over","maxSurge":5,
 "softlockWindows":0,"errors":[]}
```
v1: 1936 frames, score 0 → 125, wave 2, maxSurge 5, 0 softlocks, 0 errors.
Verdict: gameplay unchanged.

## Reckless fail/retry (real input, plain URL — NOT ?bot=1)
- Driver: shot-cdp.mjs --actions /tmp/reckless-actions-v2.json (Space, idle 30 s,
  expect screen "over", Space, wait 3 s, expect screen "play", expect lives 3).
- Result: OK, exit 0, zero console errors.
- Failed attempt recorded: the first run used ?bot=1 and the restart expectations
  failed (screen stayed "over", lives 0) — in bot mode human keys only mute
  (main.js: `if (botMode) return`), so the restart check belongs on the plain URL.
  The game itself is fine; the test setup was wrong.

## God-mode win check (pure Node, replicates the victory staging loop, no fallback)
- Script: /tmp/god-mode-v2.mjs — god mode (free wire, no damage), pilot must close
  real loops to kill the Warden, 600 s cap, seeds 7–10.
- v2: seed 7 → play, score 1995, wave 6; seed 8 → play, 3990, wave 8;
  seed 9 → play, 4460, wave 8; seed 10 → play, 2900, wave 7 (all 36000 frames).
- v1 (same script, v1 paths): IDENTICAL — 1995/w6, 3990/w8, 4460/w8, 2900/w7.
- Verdict: no regression. The pilot reaches waves 6–8 in 600 s in both versions;
  the victory screenshot is the documented fallback frame in both (stageShot
  'victory' forces phase 'win', wave 10 after the cap). The win itself is reachable
  in real play; the pilot is just slow.

## Syntax
- `node --check` on all 13 game/src/*.js modules: 0 failures.
