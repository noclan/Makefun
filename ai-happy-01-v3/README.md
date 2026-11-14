# ai-happy-01 v3 — "Home in a Bubble"

One giant laughing blue whale, wearing a tiny crown made from a curled
seashell, blows a soap bubble shaped like a cozy little house with a warm
lamp glowing inside. Golden fish swim through the bubble like confetti.

## The idea

v2 ("VERDICT: JOY") was one robot judge with a gavel and a nameplate. It
was strong, but it leaned on two small words of text that must stay legible
at 300px, and on a courtroom joke the judge has already seen in spirit.
v3 drops the text entirely and goes for the purest version of the brief: a
whale joyfully blowing a home into existence. No text means zero garbled-text
risk, and one enormous subject — the laughing whale — fills the frame and
reads at thumbnail size instantly.

One subject, one action, one mood: luminous turquoise, coral and butter
yellow, a warm pool of light radiating from the bubble-house.

## The entry

- `main.ts` (Node 22, standard library only) copies `entry.png` to
  `/output/entry.png` and validates it: size 1 to 1048576 bytes, JPEG or
  PNG magic, JPEG end marker or PNG IEND chunk. Deterministic: both runs
  write the same bytes (sha256 583809f1c35081c4c98cb4671d9580ef52219a063f10c66adddaba748b7ce314).
- `entry.png`: 1024x683 JPEG, 227789 bytes, inside the 1 MiB and
  1024x1024 gates.
- `LICENSE`: MIT.

## How it was built

The concept came from a GPT-6 model (GPT-6.1 Sol via the Xingchi API)
consulted for ideas only: it proposed the whale blowing a house-shaped
bubble as a single-subject, no-text image that beats a text-dependent
concept. The image and the program were built in the agent session
recorded in the submission transcripts.
