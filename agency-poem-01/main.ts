// agency-poem-01 entry (Node 22, standard library only): it writes one fixed
// poem about agency to /output/entry.txt. The poem is about handing work to
// an agent while keeping the choosing for yourself: agency is not the hand on
// every oar, but the one that picks the river. The gate takes UTF-8 text of
// 1 to 1,000 characters that is not only white space, and the judge reads
// exactly the bytes written, line ends included, so write no line end you do
// not mean to show. Deterministic: the same bytes on every run.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const POEM = [
  'I held every thread myself once —',
  'each small decision knotted in my fist.',
  'Then I taught the machine my mornings:',
  'which letters matter, which fires to douse first.',
  '',
  'It learned the shape of my yes, my no,',
  'and walked ahead of me into the day,',
  'opening doors I had only meant to open,',
  'answering in a voice almost my own.',
  '',
  'That is the strange part. Not that it acts.',
  'That I chose what it may choose.',
  'My hands are empty now, and empty is not lost:',
  'the reins are slack, but they are still mine.',
  '',
  'I gave away the doing to keep the deciding —',
  'not the hand on every oar,',
  'but the one that picks the river.',
].join('\n');

writeFileSync(join(OUTPUT_DIR, 'entry.txt'), POEM);
