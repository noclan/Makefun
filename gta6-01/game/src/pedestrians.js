// Pedestrians: they walk the sidewalks, cross at intersections, chat in
// barks, and run screaming from gunfire, crashes and stolen cars. A few of
// them are taxi customers, waiting on a kerb with their hand out.

import { WORLD } from './config.js';
import { chance, pick, range } from './random.js';
import { collideBuildings, inSea, nearestRoadPoint, onRoad } from './world.js';

const SHIRTS = ['#e8a34c', '#4a7fb8', '#e86a5a', '#7fae62', '#8a6fb8', '#e8e0c8', '#2ec4b6', '#f28ba0'];
const BARKS = [
  'Beautiful day in Solmar!',
  'The Varela crew runs this town, huh?',
  'Did you see the sunset yesterday?',
  'Café Luna has the best coffee.',
  'I need a taxi, not a lecture.',
  'Watch where you drive!',
  'Golden hour is my favourite hour.',
  'Five years and Rico is back, they say.',
];

export function spawnPeds(rng, city, count, nearX, nearY) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard < count * 30) {
    guard += 1;
    const line = pick(rng, city.lines);
    const along = range(rng, 220, WORLD.size - 220);
    const vertical = chance(rng, 0.5);
    const side = chance(rng, 0.5) ? 1 : -1;
    const x = vertical ? line + side * 44 : along;
    const y = vertical ? along : line + side * 44;
    if (y > WORLD.beachTop || inSea(x, y)) continue;
    if (Math.hypot(x - nearX, y - nearY) < 200) continue;
    peds.push({
      kind: 'ped',
      x, y,
      radius: 12,
      angle: rng() * Math.PI * 2,
      speed: range(rng, 38, 62),
      health: 100,
      down: false,
      downTimer: 0,
      flee: false,
      fleeTimer: 0,
      color: pick(rng, SHIRTS),
      bark: pick(rng, BARKS),
      barkTimer: range(rng, 2, 9),
      target: null,
      taxi: false,
    });
  }
  return peds;
}

function pickStrollTarget(rng, ped) {
  // Stroll along a sidewalk: pick a nearby road, then a point along it.
  const road = nearestRoadPoint(ped.x, ped.y);
  const along = range(rng, -260, 260);
  const vertical = Math.abs(road.x - ped.x) < Math.abs(road.y - ped.y);
  return vertical
    ? { x: road.x + (chance(rng, 0.5) ? 44 : -44), y: ped.y + along }
    : { x: ped.x + along, y: road.y + (chance(rng, 0.5) ? 44 : -44) };
}

export function stepPeds(g, dt) {
  const rng = g.rng;
  for (const ped of g.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.down = false;
        ped.health = 60;
        ped.flee = true;
        ped.fleeTimer = 4;
      }
      continue;
    }
    if (ped.fleeTimer > 0) ped.fleeTimer -= dt;
    if (ped.fleeTimer <= 0) ped.flee = false;

    let speed = ped.speed;
    let tx;
    let ty;
    if (ped.flee) {
      // Run away from the player (or the nearest loud thing).
      const away = Math.atan2(ped.y - g.player.y, ped.x - g.player.x);
      tx = ped.x + Math.cos(away) * 120;
      ty = ped.y + Math.sin(away) * 120;
      speed = 150;
    } else {
      if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 12) {
        ped.target = pickStrollTarget(rng, ped);
      }
      tx = ped.target.x;
      ty = ped.target.y;
    }

    const want = Math.atan2(ty - ped.y, tx - ped.x);
    let diff = want - ped.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.angle += Math.max(-4 * dt, Math.min(4 * dt, diff));
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;

    // Keep peds out of buildings and water; they are not that committed.
    collideBuildings(g.city, ped);
    if (inSea(ped.x, ped.y)) {
      ped.x -= Math.cos(ped.angle) * speed * dt * 2;
      ped.y -= Math.sin(ped.angle) * speed * dt * 2;
      ped.target = pickStrollTarget(rng, ped);
    }
    if (ped.y > WORLD.beachTop + 6) ped.y = WORLD.beachTop + 6;

    ped.barkTimer -= dt;
    if (ped.barkTimer <= 0 && !ped.flee) {
      ped.bark = pick(rng, BARKS);
      ped.barkTimer = range(rng, 6, 14);
      if (Math.hypot(ped.x - g.player.x, ped.y - g.player.y) < 420) {
        g.lastBark = { text: ped.bark, x: ped.x, y: ped.y, timer: 2.5 };
      }
    }
  }
  // A thin trickle of fresh pedestrians keeps the sidewalks populated.
  if (g.peds.length < 22 && rng() < 0.01) {
    const fresh = spawnPeds(rng, g.city, 1, g.player.x, g.player.y);
    for (const ped of fresh) g.peds.push(ped);
  }
}

// Everybody near a gunshot or a hard crash runs. Called by combat/police.
export function scareNearby(g, x, y, radius) {
  for (const ped of g.peds) {
    if (ped.down) continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.flee = true;
      ped.fleeTimer = 3;
    }
  }
}
