# Screenshot evidence — SURGELOOP v2 (2026-11-17 ~14:00 WIB)

Captured with shot-cdp.mjs (two rAFs + 600 ms settle, fromSurface) from the v2 game
on http://localhost:8931. All 4 shots viewed by the builder; all under 256 KiB.

## 1-title.jpg (84,302 B)
SURGELOOP title panel ("The only weapon is wire…", controls, "No score yet — set the
first one.", "Press Space or click to start") over the attract field. v2 floor is
richer: extra copper traces, pulsing cyan floor nodes, a brute hex visible top-right.

## 2-play.jpg (82,282 B)
Mid-wave surge frame, seed 7: LOOP SURGE x2, +30, cyan plasma field, SCORE 145,
WAVE 2/10, BOTS 7, player outside the field. HUD now carries the objective line
("WIN: CLEAR WAVE 10 • LOSE: ALL HEARTS GONE") and the next-wave preview
("NEXT W3: 10 crawlers + 4 zippers"), OVERCHARGE 4s badge, glowing crawler boxes
and a zipper dart with glow. v1 play shot was the same scene but sparser.

## 3-loop.jpg (72,254 B)
Money shot, seed 16: LOOP SURGE x5, +75, plasma field with 3 scrap diamonds inside,
SCORE 260, WAVE 2/10, BOTS 1, player outside the field at the bottom. Objective and
NEXT lines visible. v1 loop shot was x5 with the same score but a flatter frame.

## 4-victory.jpg (87,902 B)
GRID SAVED panel ("Score 5165 • All 10 waves cleared", "VOLT WARDEN is scrap. The
loop held. You win.", "Press Space or click to play again"), WAVE 10/10, BOTS 0,
5 hearts, SCRAP 185. v2 adds celebration sparks around the panel and the boss
objective line ("BOSS: VOLT WARDEN — ONLY LOOPS HURT IT").

## Failed capture round (recorded)
First v2 capture (strict staging thresholds: play surge ≥3 + ≥4 bots remaining;
loop surge ≥6 + ≥3 pickups) produced GAME OVER frames for both play and loop — the
pilot dies before a surge that big lands. Thresholds relaxed to the shipped values
(play ≥2 + ≥3 bots; loop ≥5 + ≥2 pickups) and re-captured: both frames are real
surge frames. Lesson: staging thresholds must sit inside what the pilot reaches.
