// Seeded procedural city: road grid, blocks, buildings, beach, sea, marina, parks.
import { CFG, DISTRICTS } from './config.js';
import { makeRng, rngRange, rngInt, rngPick, rngChance } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  return DISTRICTS[1];
}
export function isRoad(x, y) {
  if (x < CFG.beachX || x > CFG.world - 40 || y < 40 || y > CFG.world - 40) return false;
  const rx = x % CFG.roadGap, ry = y % CFG.roadGap;
  return rx < CFG.roadW || ry < CFG.roadW || rx > CFG.roadGap - 8 || ry > CFG.roadGap - 8;
}
export function generateWorld(seed) {
  const rng = makeRng(seed);
  const buildings = [], trees = [], parks = [], piers = [];
  const roadLines = [];
  for (let x = CFG.roadGap; x < CFG.world; x += CFG.roadGap) roadLines.push(x);
  for (let y = CFG.roadGap; y < CFG.world; y += CFG.roadGap) roadLines.push(y);
  for (let bx = CFG.beachX + CFG.roadW; bx < CFG.world - 200; bx += CFG.roadGap) {
    for (let by = CFG.roadW; by < CFG.world - 200; by += CFG.roadGap) {
      const d = districtAt(bx + 120, by + 120);
      if (rngChance(rng, 0.14)) { parks.push({ x: bx + 60, y: by + 60, w: 200, h: 200 }); continue; }
      const n = rngInt(rng, 1, 3);
      for (let i = 0; i < n; i++) {
        const w = rngRange(rng, 70, 150), h = rngRange(rng, 70, 150);
        const x = bx + rngRange(rng, 10, 250 - w), y = by + rngRange(rng, 10, 250 - h);
        const tall = d.tall && rngChance(rng, 0.55);
        buildings.push({
          x, y, w, h, height: tall ? rngRange(rng, 90, 190) : rngRange(rng, 26, 70),
          color: rngPick(rng, ['#e8d9b0', '#d9a05b', '#c98f6e', '#b7c4c9', '#e8b48a', '#a8b8a0']),
          roof: rngPick(rng, ['#8a5a3a', '#5a6a7a', '#7a4a3a', '#4a7a6a']),
          tall, district: d.name, windows: rngInt(rng, 4, 12),
        });
      }
      if (rngChance(rng, 0.5)) trees.push({ x: bx + rngRange(rng, 20, 240), y: by + rngRange(rng, 20, 240) });
      if (rngChance(rng, 0.3)) trees.push({ x: bx + rngRange(rng, 20, 240), y: by + rngRange(rng, 20, 240) });
    }
  }
  // Marina piers jutting into the sea on the west edge.
  for (let i = 0; i < 4; i++) piers.push({ x: 60, y: 1900 + i * 260, w: 260, h: 26 });
  // Respray shop + Café Luna landmarks.
  const respray = { x: 1420, y: 700, w: 150, h: 110 };
  const cafe = { x: 700, y: 1850, w: 130, h: 100 };
  return { seed, buildings, trees, parks, piers, roadLines, respray, cafe, size: CFG.world };
}
export function buildingAt(world, x, y) {
  for (const b of world.buildings) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
  return null;
}
export function solidAt(world, x, y) {
  if (x < CFG.seaX || x > CFG.world - 20 || y < 20 || y > CFG.world - 20) return true;
  return !!buildingAt(world, x, y);
}
// Slide a circle out of solid geometry; returns corrected position.
export function collideCircle(world, x, y, r) {
  let nx = x, ny = y;
  const b = buildingAt(world, x, y);
  if (b) {
    const dl = x - b.x, dr = b.x + b.w - x, dt = y - b.y, db = b.y + b.h - y;
    const m = Math.min(dl, dr, dt, db);
    if (m === dl) nx = b.x - r; else if (m === dr) nx = b.x + b.w + r;
    else if (m === dt) ny = b.y - r; else ny = b.y + b.h + r;
  }
  if (nx < CFG.seaX + r) nx = CFG.seaX + r;
  if (nx > CFG.world - 20 - r) nx = CFG.world - 20 - r;
  if (ny < 20 + r) ny = 20 + r;
  if (ny > CFG.world - 20 - r) ny = CFG.world - 20 - r;
  return { x: nx, y: ny };
}
export function nearestRoadPoint(x, y) {
  const gx = Math.round(x / CFG.roadGap) * CFG.roadGap + CFG.roadW / 2;
  const gy = Math.round(y / CFG.roadGap) * CFG.roadGap + CFG.roadW / 2;
  return Math.abs(x - gx) < Math.abs(y - gy) ? { x: gx, y } : { x, y: gy };
}
export function randomRoadSpot(rng, world) {
  const gx = rngInt(rng, 1, 9) * CFG.roadGap + CFG.roadW / 2;
  const gy = rngInt(rng, 1, 9) * CFG.roadGap + CFG.roadW / 2;
  return { x: gx, y: gy };
}
