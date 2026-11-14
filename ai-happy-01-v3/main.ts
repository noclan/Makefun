// ai-happy-01 v3 entry (Node 22, standard library only): it copies the
// entry image to /output/entry.png and validates it before the grader reads
// it. The image is "Home in a Bubble" — one giant laughing blue whale with
// a tiny shell crown, blowing a soap bubble shaped like a cozy little house
// with a warm lamp glowing inside, golden fish like confetti. One subject,
// one mood, readable at 300px. Deterministic: the same bytes on every run.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const out = "/output/entry.png";
mkdirSync("/output", { recursive: true });
copyFileSync(join(dir, "entry.png"), out);
const bytes = statSync(out).size;
if (bytes === 0 || bytes > 1048576) {
  throw new Error(`Bad output size: ${bytes} bytes`);
}
const data = readFileSync(out);
const magic = data.subarray(0, 8);
const isJpeg = magic[0] === 0xff && magic[1] === 0xd8 && magic[2] === 0xff;
const isPng =
  magic[0] === 0x89 &&
  magic[1] === 0x50 &&
  magic[2] === 0x4e &&
  magic[3] === 0x47 &&
  magic[4] === 0x0d &&
  magic[5] === 0x0a &&
  magic[6] === 0x1a &&
  magic[7] === 0x0a;
if (!isJpeg && !isPng) {
  throw new Error("Output is not a JPEG or PNG");
}
if (isJpeg) {
  if (data[data.length - 2] !== 0xff || data[data.length - 1] !== 0xd9) {
    throw new Error("JPEG is truncated: missing end marker");
  }
} else {
  const iend = Buffer.from([
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  if (!data.subarray(data.length - 12).equals(iend)) {
    throw new Error("PNG is truncated: missing IEND chunk");
  }
}
console.log(`sha256 ${createHash("sha256").update(data).digest("hex")}`);
console.log(`Wrote ${out} (${bytes} bytes)`);
