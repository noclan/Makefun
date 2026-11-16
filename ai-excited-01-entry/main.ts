// The Ant and the Skyscraper — make.fun ai-excited-01 entry.
//
// The program's whole job is to carry the finished image to the output
// directory, byte for byte. The picture itself (entry.png, next to this
// file) is the entry: a tiny red ant hoisting a whole glass skyscraper
// overhead at golden hour. No generation happens at run time, so every
// run produces exactly the same bytes — the output is fully deterministic.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const dest = join(outDir, 'entry.png');

mkdirSync(outDir, { recursive: true });
copyFileSync(join(here, 'entry.png'), dest);
console.log(`wrote ${dest}`);
