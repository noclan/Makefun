# BOUNTY-STATE — gta6-01 "Make GTA 6"

- Competition: gta6-01, $1,666, top 100 (1st $500). Opens 17 Nov 2026 22:00 WIB,
  deadline 24 Nov 2026 22:00 WIB. Result due ~10 Dec 2026.
- Concept: "SOLMAR — Streets of Gold", original 2D top-down open world.
- Status: **SUBMITTED** 17 Nov 2026 23:29:47 WIB.
  - Submission: 01a1ea57-d58c-70fd-a25c-5cf967c50dc8, stage "submitted"
  - Title: "SOLMAR — Streets of Gold"
  - Entry commit: 20ebe7a5b88649f1e525018332ba434d13daa32f
    (repo ~/workspace/makefun/gta6-01-entry-r2, anchor round 34042532)
  - Recording: 01a1ea39-21de-719f-914f-1a00695880c2, sealed 2026-11-17T16:27:54Z
  - Source bundle sha256 01cdf05b8fc93df4b1abec55fad7710843da6270c2f5b5a7bd61faf4d5ed78a8
  - Claim code: saved in ~/workspace/makefun/claim-code-gta6-01.txt (chmod 600)
  - Status checks at submit: account_wallet / competition_open / quota / form /
    entry_signature / source_bundle all pass; rest skip (snapshot stage).
  - `makefun check`: 5 passed, 0 failed, 17 skipped, 3 at submission.
- Validation (round-2 build): 19 .js modules parse; main.ts run twice
  byte-identical; dossier text 120,653 bytes; no network refs; 60 s headless
  playtest 0 console errors; mission 1 + mission 2 played end-to-end;
  4 screenshots 1280x720, each ≤256 KiB, rendered twice byte-identically.
- Round 1: complete build (commit efeb3ce) but its recording
  (01a1ea0b-8d4e-759d-a3c4-d947a2010964) could NOT be sealed — the recorder
  watches all Muse app sessions and the long-lived main-chat session log was
  rewritten (compaction) mid-recording, breaking the seal chain. Round 2
  re-authored the game from DESIGN.md only (old repo never read) under a fresh
  recording; sealed cleanly. Lesson: keep recordings short; a main-chat
  compaction during a recording kills the seal.
- Submit needed extra run-record facts: --harness muse --harness-version 1.3
  --provider Meta --model "Muse Spark 1.3" --effort default (workspace
  convention from prior bundles).
- Leaderboard at submit: 0 entries made/kept at build time (builder check);
  field was empty at prep (~18:10 WIB). Observe as entries appear; a later
  observe+improve+resubmit round (new recording, fresh builder) is possible
  before 23 Nov evening WIB if a clearly stronger version emerges.
  Quota: 1/10 used (Force_Last, max 5/day).
