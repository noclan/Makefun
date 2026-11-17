# Bounty State

## Identity
- Competition: best-game-01 — "Make the best game"
- Competition ID: best-game-01
- Official URL: https://make.fun/bounty/best-game-01
- Project/repository: ~/workspace/makefun/best-game-01-entry/ (git; GitHub noclan/Makefun folder best-game-01/)
- Owner/operator: nftop (make.fun) / noclan (GitHub)
- Last updated: 2026-11-17 ~14:20 WIB (07:20 UTC)
- Current phase: submitted (v2)

## Rules and economics
- Deadline (local): 19 Nov 2026 01:00 WIB
- Deadline (UTC): 2026-11-18T18:00:00Z
- Prize pool: $1,000 (1st $400, 2nd $200, 3rd $120, 4th–10th $40)
- Paid positions: top 10
- Judging stages: AI judge on dossier + screenshots; final heat screens at place 40, Swiss 3 rounds, race, playoff top 12
- Rubric (in order): (1) complete game shown in screenshots (goal, rules, controls, win/lose/score, start+restart, HUD), (2) fun and depth, (3) feel and polish, (4) look and originality, (5) structure (source split by job, named for what it does)
- Eligibility constraints: offline browser game, static files, keyboard+mouse; game/ ≤993 files, ≤48 MiB, index.html ≤1 MiB; every reference a data: URI or a file inside game/; 3–4 screenshots ≤256 KiB, long side ≤1280, short side ≥480; dossier text ≤163,840 bytes
- Submission/resubmission rules: max 5 submissions/day, 10 total; LAST submission is final — only resubmit if clearly stronger

## Active submission
- Submission ID: 01a1e85d-4851-74f8-8ad0-a7b9f6729e14
- Title: SURGELOOP — draw a loop, fry the swarm
- Commit: 104ca1a7230a373cecca7d871aed4d5b1d3d6bdd
- Bundle SHA-256: eb9355723f04c9f203a2b318af15c47f0734802f8887d4f7f62146f0683ff3d1
- Submitted at: 2026-11-17 07:16:29 UTC (14:16 WIB — well before deadline, per "jangan mepet2")
- Status: submitted (server stage "submitted", round 1 being taken in; result due 2026-12-03T06:10:00Z)
- Validity: makefun check 15 passed / 0 failed (local); server status 6 pass / 8 skip / 0 fail, problem null
- Numerical score: n/a (judge-scored, no dev score)
- Rank / population: 8,472 entries at observe time (2026-11-17 13:53 WIB); top-10 judge scores 937,226–944,244; median 695,247; rank 100 = 838,310
- Current paid cutoff: rank 10

## Quota and blockers
- `can_submit`: yes
- Daily quota: 5/day (0 used before this submit)
- Hard quota: 10 total (1 used by this submit)
- Account-level restrictions: none
- Other blockers: none

## Current product
- Main capabilities: SURGELOOP — top-down arena survival; the ONLY weapon is drawing wire with the mouse (hold to lay a copper trace, close a loop, enclosed area becomes a plasma field that fries everything inside). No projectiles. 10 waves (crawler, zipper, brute, splitter; wave-10 boss VOLT WARDEN only damaged by loops). 3 hearts; wire meter + scrap economy + between-wave shop; pickups (scrap, heart, overcharge); WebAudio synth sound, no files; particles, trauma shake, hit-stop.
- Known strengths: loop-as-weapon hook is distinct from every top-10 entry (light/lantern/moth cluster + FPS + ember survival); nearest ancestor Qix (1981) differs — there the closed region IS the goal, here it is a WEAPON inside swarm survival; dossier text 89,703 bytes (v1; v2 slightly larger, still far under cap); 4 screenshots all verified visually.
- Known weaknesses: judge scores are opaque (no per-criterion breakdown); the victory screenshot is the documented fallback frame (god-mode pilot reaches waves 6–8 in 600 s, identical in v1 and v2 — the win itself is reachable, the pilot is just slow); playtest bots die in wave 2 (same as v1 — difficulty pressure is real).
- Latest tests: v2 bot playtests 2026-11-17 ~14:05 WIB — fast bot seed 7, 75 s: 1738 frames, score 120, wave 2, maxSurge 2, 0 softlocks, 0 errors; slow bot: 1883 frames, score 125, wave 2, maxSurge 5, 0 softlocks, 0 errors (v1: 1822/120 and 1936/125 — gameplay unchanged); reckless fail/retry PASS (idle 30 s → over, Space → play, 3 lives, 0 errors); god-mode 600 s seeds 7–10: waves 6–8, byte-identical to v1.
- Latest official validation: makefun check (v2) — to be recorded at submit time.
- Current branch/worktree: canonical repo ~/workspace/makefun/best-game-01-entry/; v1 preserved as commit f849a00f; v2 work snapshot in ~/workspace/best-game-01-entry-v2/ (uncommitted copy).

## Decisions
- Current recommendation: SUBMITTED (v2)
- Rationale: v2 is a targeted visual-density + HUD-completeness upgrade over the staged v1, verified in all 4 screenshots, with zero gameplay regression (identical playtest numbers). The top-10 dossiers are source_withheld, so the upgrade targets the judge-visible surface the skill's Phase 9 calls for: richer frames, explicit win/lose, next-wave preview.
- Evidence: EVIDENCE/ (leaderboard snapshot, screenshot log, playtest JSON, check output).
- Risks: judge scores are opaque; a resubmission would only help if clearly stronger than this v2.
- What would change the decision: a later build that beats v2 on the same evidence bar (denser frames + clean playtests) before the deadline, with quota to spare (9 left).
