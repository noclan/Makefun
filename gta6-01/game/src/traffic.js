// Traffic AI: cars cruise the road grid, slow at junctions, avoid the player loosely.
import { CFG } from './config.js';
import { makeRng, rngPick, rngRange, clamp } from './random.js';
import { makeCar } from './vehicles.js';
import { randomRoadSpot } from './world.js';

export function spawnTraffic(world, seed, count = 14) {
  const rng = makeRng(seed + 31);
  const list = [];
  for (let i = 0; i < count; i++) {
    const s = randomRoadSpot(rng, world);
    const c = makeCar(rngPick(rng, ['sedan', 'taxi', 'van', 'pickup']), s.x, s.y, rng() < 0.5 ? 0 : Math.PI / 2);
    c.parked = false; c.driver = 'traffic'; c.cruise = rngRange(rng, 130, 210); c.dir = rng() < 0.5 ? 1 : -1;
    list.push(c);
  }
  return list;
}
export function stepTraffic(state, dt) {
  const { world, player } = state;
  for (const c of state.traffic) {
    // Pick a new heading at intersections.
    const rnd = state.rng || Math.random;
    const onX = Math.abs((c.x % CFG.roadGap) - CFG.roadW / 2) < 26;
    const onY = Math.abs((c.y % CFG.roadGap) - CFG.roadW / 2) < 26;
    if (onX && onY && rnd() < 0.01) c.angle = Math.floor(rnd() * 4) * Math.PI / 2;
    // Slow for the player car ahead.
    const px = player.inCar ? player.inCar.x : player.x, py = player.inCar ? player.inCar.y : player.y;
    const d = Math.hypot(px - c.x, py - c.y);
    const target = d < 130 ? c.cruise * 0.25 : c.cruise;
    c.speed += clamp(target - c.speed, -260 * dt, 180 * dt);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt, ny = c.y + Math.sin(c.angle) * c.speed * dt;
    const blocked = state.cars.some(o => o !== c && Math.hypot(o.x - nx, o.y - ny) < 52);
    if (!blocked && nx > CFG.beachX && nx < CFG.world - 40 && ny > 40 && ny < CFG.world - 40) { c.x = nx; c.y = ny; }
    else c.angle += Math.PI / 2;
    // Wrap around the city edge so traffic never runs out.
    if (c.x < CFG.beachX) c.x = CFG.world - 100; if (c.x > CFG.world - 60) c.x = CFG.beachX + 60;
    if (c.y < 60) c.y = CFG.world - 100; if (c.y > CFG.world - 60) c.y = 60;
  }
}
