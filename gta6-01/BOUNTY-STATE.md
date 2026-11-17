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

- Status v2: **RESUBMITTED** 18 Nov 2026 00:24 WIB (Force_Last — last submission is final).
  - Submission: 01a1ea89-81c8-7302-8863-94751d76fc25, stage "submitted" (Round 2 checks pending at submit time)
  - Entry commit: 958608e645c08b42fe30c51bf37ef3331e3ec83a
    (repo ~/workspace/makefun/gta6-01-entry-r2, anchor round 34042532)
  - Recording: 01a1ea71-63e8-7619-b08b-15f2fa8b03e7, sealed via record --finish
  - Source bundle sha256 c69e4e1e058d2ff0b1c863dc1ed3fcf7579699b1d5d629d56367e7516e567548 (902,336 bytes)
  - Claim code: saved in ~/workspace/makefun/claim-code-gta6-01-v2.txt (chmod 600)
  - Status checks at submit: account_wallet / competition_open / quota / form /
    entry_signature / source_bundle all pass; rest skip (snapshot stage).
  - `makefun check`: 5 passed, 0 failed, 17 skipped, 3 at submission.
  - First submit attempt failed (run record missing harness facts); re-run with
    --harness muse --harness-version 1.3 --provider Meta --model "Muse Spark 1.3" --effort default.
  - v2 vs v1: named shop signage, circular minimap + route + speedometer gauge,
    police helicopter at 3+ stars, headlight cones, neon at night, mission 1 now
    requires stealing a car (1,600+ m drive), traffic 28 + pedestrians 48,
    bigger on-foot Rico, Mama Rosa dialogue, radio bar, respect/XP bar.
    Dossier text 142,961 bytes; 4 screenshots 1280x720, each ≤256 KiB,
    rendered twice byte-identically; 60 s live playtest 0 console errors.
  - Caveats: builder's 19 usage rows are honest estimates (not metered); 6 recorded
    sessions carry no usage row; transcript checks (thinking_priced,
    transcripts_witnessed) are decided server-side — poll status for "scored".
  - v1 submission 01a1ea57-d58c-70fd-a25c-5cf967c50dc8 is superseded by v2 (Force_Last).
