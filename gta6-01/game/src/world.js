// The city itself: a seeded procedural Solmar Bay. A grid of roads carves
// the map into blocks; each block holds buildings, trees or a park; the
// south edge is beach and sea, the east edge a marina bay. Everything is
// plain data — roads, buildings, signs, trees, lifeguard towers — so the
// renderer and the collision queries both read from one source of truth.
//
// v2: the city has NAMES. Named businesses carry drawn sign boards
// (Motel Palmera, Tacos 24H, Casino Royale...) so the world reads as a
// place, not a grid of rectangles. The beach has lifeguard towers,
// umbrellas and a visible shoreline; beachfront blocks get pools and
// awnings; streetlights line the main roads for the night shots.

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

// The shopfronts of Solmar: name, sub-line, board colours, and whether the
// sign glows neon after dark. Assigned to buildings by the city builder.
const SHOPFRONTS = [
  { name: 'MOTEL PALMERA', sub: 'VACANCY • COLD DRINKS', bg: '#e86a5a', fg: '#fff3e0', neon: false },
  { name: 'TACOS 24H', sub: 'OPEN ALL NIGHT', bg: '#f2b705', fg: '#3a2200', neon: true },
  { name: 'CAFÉ LUNA', sub: 'COFFEE • MAMA ROSA', bg: '#7d4a8a', fg: '#ffe9a0', neon: true },
  { name: 'CASINO ROYALE', sub: 'SLOTS • GOLD • LUCK', bg: '#1d3557', fg: '#ffd166', neon: true },
  { name: 'SOL GAS', sub: 'FUEL • 24H • SNACKS', bg: '#2ec4b6', fg: '#083038', neon: true },
  { name: 'HOTEL MIRAMAR', sub: 'SEA VIEW ROOMS', bg: '#e8316b', fg: '#ffffff', neon: false },
  { name: 'PIZZA SOL', sub: 'SLICES TILL 2AM', bg: '#c94f43', fg: '#ffe9a0', neon: false },
  { name: 'BAR LA OLA', sub: 'LIVE MUSIC FRIDAY', bg: '#3f8f7b', fg: '#e8e0c8', neon: true },
  { name: 'DONUT 24', sub: 'FRESH EVERY HOUR', bg: '#f28ba0', fg: '#4a1030', neon: false },
  { name: 'SOLMAR BANK', sub: 'GOLD • SAFE • QUIET', bg: '#f2c94c', fg: '#3a2a00', neon: false },
  { name: 'PHARMACY SOL', sub: 'OPEN LATE', bg: '#7fb8d8', fg: '#0a2a3a', neon: false },
  { name: 'SURF SHOP', sub: 'BOARDS • WAX • SUN', bg: '#2a7f9e', fg: '#e8f8ff', neon: false },
  { name: 'PAY-N-SPRAY', sub: 'NEW PAINT, NEW YOU', bg: '#8a6fb8', fg: '#ffffff', neon: true },
  { name: 'HOTEL DEL SOL', sub: 'POOL • ROOFTOP BAR', bg: '#e8a34c', fg: '#3a2200', neon: false },
];

function makeBuilding(rng, x0, y0, x1, y1, district) {
  const palette = DISTRICTS[district].palette;
  return {
    x0, y0, x1, y1,
    height: DISTRICTS[district].tall ? range(rng, 26, 60) : range(rng, 8, 22),
    color: pick(rng, palette),
    roof: chance(rng, 0.5) ? '#3a3a42' : pick(rng, palette),
    windows: chance(rng, 0.7),
    awning: chance(rng, 0.45) ? pick(rng, ['#e8316b', '#f2b705', '#2ec4b6', '#e8e0c8']) : null,
    sign: null, // filled in by buildCity for shopfront buildings
  };
}

export function buildCity(rng) {
  const lines = roadLines();
  const half = WORLD.roadWidth / 2;
  const blocks = [];
  const buildings = [];
  const trees = [];
  const palms = [];
  const signs = [];
  const pools = [];
  const lifeguards = [];
  const streetlights = [];

  // Streetlights along every road, every other intersection — they glow
  // at dusk and make the night shots read.
  for (const line of lines) {
    for (const other of lines) {
      if (((line + other) / WORLD.roadGap) % 2 === 0) {
        streetlights.push({ x: line + half + 6, y: other - half - 6 });
      }
    }
  }

  // Lifeguard towers stand on the sand, spaced along the whole beach.
  for (let i = 0; i < 4; i += 1) {
    lifeguards.push({ x: 420 + i * 760, y: WORLD.beachTop + 62, color: ['#e8316b', '#f2b705', '#2ec4b6', '#e86a5a'][i] });
  }

  let shopIndex = 0;
  function giveShopfront(building) {
    const shop = SHOPFRONTS[shopIndex % SHOPFRONTS.length];
    shopIndex += 1;
    building.sign = shop;
    signs.push({
      x: (building.x0 + building.x1) / 2,
      y: building.y1 + 6,
      w: Math.min(150, (building.x1 - building.x0) * 0.85),
      text: shop.name,
      sub: shop.sub,
      bg: shop.bg,
      fg: shop.fg,
      neon: shop.neon,
    });
  }

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
      // Beachfront blocks: hotels with palm rows facing the sand, a pool
      // in every second block, and a shopfront sign on the street side.
      if (district === 'beachfront') {
        const w = (x1 - x0) / 2 - 16;
        const left = makeBuilding(rng, x0, y0, x0 + w, y1 - 30, district);
        const right = makeBuilding(rng, x1 - w, y0, x1, y1 - 30, district);
        buildings.push(left, right);
        giveShopfront(bx % 2 === 0 ? left : right);
        if (bx % 2 === 0) {
          pools.push({ x: x0 + (x1 - x0) / 2 - 42, y: y0 + 14, w: 84, h: 34 });
        }
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
          const b = makeBuilding(rng, px, py, px + bw, py + bh, district);
          buildings.push(b);
          // The street-facing building of most downtown/oldtown blocks is
          // a named shop, so the streets read as a high street.
          if (r === rows - 1 && (district === 'downtown' || district === 'oldtown' || chance(rng, 0.4))) {
            giveShopfront(b);
          }
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

  return { lines, blocks, buildings, trees, palms, landmarks, shells, signs, pools, lifeguards, streetlights };
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
