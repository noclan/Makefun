# Decisions — best-game-01 (SURGeloop)

## 2026-11-17 ~13:53 WIB — Observe: leaderboard is 8,472 entries, top dossiers withheld
- Fetched current leaderboard (GET /api/competitions/best-game-01/leaderboard, 13:53 WIB):
  8,472 entries (was 187 at build), phase dev. Top-10 judge scores 937,226–944,244,
  median 695,247, rank 100 = 838,310, rank 500 = 781,845.
- Top 10: #1 Lanternkeep 944244, #2 SUNDERING LOOM 944244, #3 Lamplight Tide 942180,
  #4 LANTERNWAKE 940081, #5 VOLCANO HAVEN 940081, #6 HEFT 939373, #7 GALEWARD 938662,
  #8 Verdigrove 938662, #9 MARGINALIA v5 938662, #10 SUNWRIGHT 937226.
- #9 MARGINALIA v5 ("draw ink loops to illuminate the beasts of a medieval manuscript")
  is the direct loop-drawing mechanic neighbour. The light/lantern/moth cluster still
  dominates (#1, #3, #4, #6, #8, #10).
- Top dossiers are NOT visible: `source_withheld: true` for all top entries. Recorded as
  Unknown — no competitor features invented.
- Artifact screenshots fetched for ranks 1, 2, 9: all dense, rich HUDs (win/lose bars,
  threat queues, relic/blessing lists, ability slots, combo/grade, feedback text).

## 2026-11-17 ~13:56 WIB — Decision: TARGETED UPGRADE (Phase 9), visual density + HUD only
- Our 4 v1 screenshots viewed: clean and readable but VISUALLY SPARSE — mostly empty dark
  grid, few enemies visible, flat shapes; title/victory are text boxes on empty grid.
- Gap (judge-visible): v1 frames don't show the win/lose objective on the play frame, don't
  preview the next wave, enemies are small and quiet at screenshot size, the floor reads as
  blank space between the two copper traces.
- Scope locked: visual density + HUD completeness ONLY. No gameplay-rule changes, no
  rebalancing, no rebuild. The loop-drawing weapon identity is the entry's edge — it stays.
- Changes (v2, in ~/workspace/best-game-01-entry-v2/, v1 repo untouched as fallback):
  1. ui.js: objective line under the wave badge ("WIN: CLEAR WAVE 10 • LOSE: ALL HEARTS
     GONE"; boss variant on wave 10) + NEXT-wave preview from WAVE_TABLE ("NEXT W3:
     10 crawlers + 4 zippers").
  2. enemies.js: bigger drawn silhouettes (crawler 26→32 px, zipper ~1.25x, brute hex
     r22→26, splitter orbs r9→11) + soft radial glow under every bot (kind colour,
     alpha 0.30). Drawn size only — hitboxes/radii untouched, so gameplay is unchanged.
  3. render.js: 2 extra copper trace runs + 7 vias, 12 pulsing cyan floor nodes,
     plasma fill alpha 0.22→0.30, celebration sparks on the win screen.
  4. shots.js: denser staged frames — play freezes on surge ≥2 with ≥3 bots remaining
     (was ≥2, any), loop freezes on surge ≥5 with ≥2 pickups on the field (was ≥5 only),
     limits 60→90 s / 150→180 s.

## 2026-11-17 ~14:00 WIB — Failed attempt recorded: strict thresholds first, then relaxed
- First v2 attempt used stricter staging thresholds (play: surge ≥3 + ≥4 bots remaining;
  loop: surge ≥6 + ≥3 pickups). Both shots came out GAME OVER — the pilot dies before a
  surge that big lands. Relaxed to the shipped thresholds (play ≥2 + ≥3 bots; loop ≥5 +
  ≥2 pickups) and re-captured: both frames are real surge frames.
- Lesson: staging thresholds must sit inside what the pilot actually reaches; a threshold
  the pilot never meets degrades the shot to a game-over frame instead of improving it.

## 2026-11-17 ~14:05 WIB — Decision: SUBMIT v2 (clearly stronger than v1)
- All 4 v2 screenshots viewed and verified: play shows LOOP SURGE x2 + plasma + 7 bots
  + objective/NEXT lines + glowing enemies; loop shows LOOP SURGE x5 + 3 scrap diamonds
  in the field; title shows the richer floor; victory shows GRID SAVED + celebration
  sparks + boss objective line.
- Playtests (75 s, seed 7): fast bot 1738 frames / score 120 / wave 2 / maxSurge 2 /
  0 softlocks / 0 errors; slow bot 1883 frames / score 125 / wave 2 / maxSurge 5 /
  0 softlocks / 0 errors. v1: 1822/120 and 1936/125 — gameplay unchanged, no regression.
- Reckless fail/retry PASS (idle 30 s → over, Space → play, 3 lives, 0 errors).
  Note: the first attempt ran it under ?bot=1 and failed — in bot mode human keys only
  mute (main.js: `if (botMode) return`), so the restart check belongs on the plain URL.
- God-mode 600 s, seeds 7–10: pilot reaches waves 6–8, byte-identical scores to v1
  (1995/w6, 3990/w8, 4460/w8, 2900/w7). The victory screenshot is the documented
  fallback frame in BOTH versions — no regression, no change to win-ability.
- v2 is submitted; v1 (commit f849a00f) stays as the fallback. No further resubmit
  unless a build beats v2 on the same evidence bar before the 19 Nov 01:00 WIB deadline.
