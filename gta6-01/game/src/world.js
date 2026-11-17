// The city itself: a seeded procedural Solmar Bay. A grid of roads carves the
// map into blocks; each block holds buildings, trees or a park; the south edge
// is beach and sea, the east edge a marina bay. Everything is plain data —
// roads, buildings, trees, landmarks — so the renderer and the collision
// queries both read from the same source of truth.

import { WORLD, DISTRICTS } from './config.js';
import { chance, int, pick, range } from './random.js';

export function roadLines() {
  const lines = [];
  for (let x = WORLD.firstRoad; x < WORLD.size; x += WORLD.roadGap) lines.push(x);
  return lines;
}

export function districtAt(bx, by) {
  // bx, by are block coordinates (0..9). Districts are quadrants with flavour.
  if (by >= 8) return 'beachfront';
  if (bx >= 9 && by >= 4 && by <= 6) return 'marina';
  if (bx <= 2 && by >= 5 && by <= 7) return 'hills';
  if (bx <= 4 && by <= 4) return 'downtown';
  if (bx >= 5 && by <= 4) return 'oldtown';
  return 'midtown';
}

function makeBuilding(rng, x0, y0, x1, y1, district) {
  const palette = DISTRICTS[district].palette;
  return {
    x0, y0, x1, y1,
    height: DISTRICTS[district].tall ? range(rng, 26, 60) : range(rng, 8, 22),
    color: pick(rng, palette),
    roof: chance(rng, 0.5) ? '#3a3a42' : pick(rng, palette),
    windows: chance(rng, 0.7),
  };
}

export function buildCity(rng) {
  const lines = roadLines();
  const half = WORLD.roadWidth / 2;
  const blocks = [];
  const buildings = [];
  const trees = [];
  const palms = [];

  for (let bx = 0; bx < 9; bx += 1) {
    for (let by = 0; by < 9; by += 1) {
      const x0 = lines[bx] + half + 14;
      const y0 = lines[by] + half + 14;
      const x1 = lines[bx + 1] - half - 14;
      const y1 = lines[by + 1] - half - 14;
      const district = districtAt(bx, by);
      const block = { x0, y0, x1, y1, district };
      blocks.push(block);

      // The marina bay swallows the far-east blocks: water, docks, no buildings.
      if (district === 'marina' && bx === 9) {
        for (let i = 0; i < 5; i += 1) {
          palms.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), r: range(rng, 7, 10) });
        }
        continue;
      }
      // Palm Hills blocks are parks: trees and paths, rarely a building.
      if (district === 'hills' && chance(rng, 0.6)) {
        for (let i = 0; i < int(rng, 6, 12); i += 1) {
          trees.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), r: range(rng, 9, 15) });
        }
        continue;
      }
      // Beachfront blocks: hotels with palm rows facing the sand.
      if (district === 'beachfront') {
        const w = (x1 - x0) / 2 - 16;
        buildings.push(makeBuilding(rng, x0, y0, x0 + w, y1 - 30, district));
        buildings.push(makeBuilding(rng, x1 - w, y0, x1, y1 - 30, district));
        for (let i = 0; i < 4; i += 1) {
          palms.push({ x: x0 + 20 + i * ((x1 - x0 - 40) / 3), y: y1 - 14, r: 8 });
        }
        continue;
      }
      // Ordinary blocks: one to four buildings with a little breathing room.
      const cols = chance(rng, 0.5) ? 1 : 2;
      const rows = chance(rng, 0.5) ? 1 : 2;
      const bw = (x1 - x0 - 12 * (cols + 1)) / cols;
      const bh = (y1 - y0 - 12 * (rows + 1)) / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const px = x0 + 12 + c * (bw + 12);
          const py = y0 + 12 + r * (bh + 12);
          buildings.push(makeBuilding(rng, px, py, px + bw, py + bh, district));
        }
      }
      if (chance(rng, 0.35)) {
        trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 8, 12) });
      }
    }
  }

  // Landmarks the missions and the minimap point at.
  const landmarks = {
    cafeLuna: { x: 480, y: 480, label: 'Café Luna', color: '#e86a5a' },
    bank: { x: 1120, y: 800, label: 'Solmar Bank', color: '#f2c94c' },
    marinaCrate: { x: 2880, y: 1760, label: 'Marina Crate', color: '#2ec4b6' },
    oldTownDrop: { x: 2080, y: 800, label: 'Old Town Drop', color: '#2ec4b6' },
    respray: { x: 800, y: 2080, label: 'Pay-n-Spray', color: '#8a6fb8' },
    safehouse: { x: 2400, y: 2560, label: 'Safehouse', color: '#7fae62' },
    hospital: { x: 1600, y: 1440, label: 'Hospital', color: '#e8e8e8' },
    policeStation: { x: 480, y: 1440, label: 'Solmar PD', color: '#1d3557' },
    raceStart: { x: 1120, y: 2720, label: 'Beach Race', color: '#e8316b' },
  };

  // Seashell collectibles scattered along the sand.
  const shells = [];
  for (let i = 0; i < 12; i += 1) {
    shells.push({ x: range(rng, 220, 2980), y: range(rng, WORLD.beachTop + 20, WORLD.seaTop - 30), taken: false });
  }

  return { lines, blocks, buildings, trees, palms, landmarks, shells };
}

// --- Collision and road queries (shared by player, cars, peds, cops) ---

export function onRoad(x, y) {
  const half = WORLD.roadWidth / 2;
  for (let c = WORLD.firstRoad; c < WORLD.size; c += WORLD.roadGap) {
    if (Math.abs(x - c) <= half || Math.abs(y - c) <= half) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  let bestX = x;
  let bestY = y;
  let bestD = Infinity;
  for (let c = WORLD.firstRoad; c < WORLD.size; c += WORLD.roadGap) {
    const dx = Math.abs(x - c);
    if (dx < bestD) { bestD = dx; bestX = c; bestY = y; }
    const dy = Math.abs(y - c);
    if (dy < bestD) { bestD = dy; bestX = x; bestY = c; }
  }
  return { x: bestX, y: bestY };
}

export function inSea(x, y) {
  if (y > WORLD.seaTop) return true;
  const m = WORLD.marina;
  return x > m.x0 && x < m.x1 && y > m.y0 && y < m.y1;
}

export function onSand(x, y) {
  return y >= WORLD.beachTop && y <= WORLD.seaTop && !inSea(x, y);
}

// Push a circle (x, y, radius) out of every building it overlaps. Returns
// true when anything was hit, so callers can react (damage, sound, wanted).
export function collideBuildings(city, body) {
  let hit = false;
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    const cx = Math.max(b.x0, Math.min(body.x, b.x1));
    const cy = Math.max(b.y0, Math.min(body.y, b.y1));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= body.radius * body.radius) continue;
    hit = true;
    if (d2 === 0) {
      body.y = b.y1 + body.radius;
      continue;
    }
    const d = Math.sqrt(d2);
    body.x = cx + (dx / d) * body.radius;
    body.y = cy + (dy / d) * body.radius;
  }
  return hit;
}

export function clampToWorld(body) {
  body.x = Math.max(24, Math.min(WORLD.size - 24, body.x));
  body.y = Math.max(24, Math.min(WORLD.size - 24, body.y));
}
