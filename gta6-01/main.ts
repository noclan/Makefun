// SOLMAR hand-in: assemble /output from this repo's game/ and screenshots/,
// then write the judge's dossier.json with the vendored make.fun builder.
// Run locally as: MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync as copyTree, existsSync as exists, mkdirSync as mkdir, writeFileSync as write } from 'node:fs';
import { join as joinPath } from 'node:path';
import { fileURLToPath as toPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = toPath(new URL('.', import.meta.url));
const dest = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameSrc = joinPath(repoRoot, 'game');
const shotsSrc = joinPath(repoRoot, 'screenshots');

mkdir(dest, { recursive: true });
copyTree(gameSrc, joinPath(dest, 'game'), { recursive: true });
mkdir(joinPath(dest, 'screenshots'), { recursive: true });
if (exists(shotsSrc)) copyTree(shotsSrc, joinPath(dest, 'screenshots'), { recursive: true });

const dossier = buildDossier(dest, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
write(joinPath(dest, 'dossier.json'), dossier);
console.log(`SOLMAR dossier written to ${joinPath(dest, 'dossier.json')}`);
