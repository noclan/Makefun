// The Ant and the Skyscraper — make.fun ai-excited-01 entry.
//
// This program does one thing: it places the finished picture where the
// grader expects it. The picture (entry.png, in this same folder) shows a
// tiny red ant lifting a whole glass skyscraper above its head at golden
// hour. The image is fixed — nothing is drawn or generated when the
// program runs — so the output is the same on every run, byte for byte.
// Running it twice writes the same file twice.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = dirname(fileURLToPath(import.meta.url));
const target = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const dest = join(target, 'entry.png');
const image = readFileSync(join(folder, 'entry.png'));

mkdirSync(target, { recursive: true });
writeFileSync(dest, image);
console.log(`wrote ${dest}`);
