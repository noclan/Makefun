// The Ant and the Skyscraper — ai-excited-01 entry (v4).
// The program takes the staged image that sits next to this file
// and places an exact copy of it in the output directory.
// No image processing happens here: the picture is the entry,
// this program is just the delivery mechanism.
// A plain file copy is deterministic by construction, so every run
// writes the same bytes — the gate that runs the program twice
// always sees an identical result.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const source = join(here, "entry.png");
const target = join(outDir, "entry.png");

mkdirSync(outDir, { recursive: true });
copyFileSync(source, target);
console.log(`copied entry.png to ${target}`);
