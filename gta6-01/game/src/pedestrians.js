// Pedestrians: sidewalk strollers who cross at junctions and flee from danger.
import { CFG } from './config.js';
import { makeRng, rngPick, rngRange, clamp } from './random.js';
import { randomRoadSpot, isRoad } from './world.js';

const SHIRTS = ['#e85d75', '#4d9de0', '#f2c230', '#7bc950', '#a06cd5', '#ff8c42', '#37c8b0'];
const BARKS = ['Beautiful day in Solmar!', 'Did you see the sunset?', 'Mama Rosa\'s café is the best.', 'I love this city.', 'The Varela crew? No comment.', 'Watch where you\'re driving!'];
export function spawnPeds(world, seed, count = 22) {
  const rng = makeRng(seed + 55);
  const list = [];
  for (let i = 0; i < count; i++) {
    const s = randomRoadSpot(rng, world);
    list.push({ x: s.x + rngRange(rng, -90, 90), y: s.y + rngRange(rng, -90, 90), angle: rngRange(rng, 0, Math.PI * 2), speed: rngRange(rng, 45, 85), color: rngPick(rng, SHIRTS), hp: 50, flee: 0, bark: rngPick(rng, BARKS), wander: rngRange(rng, 2, 6) });
  }
  return list;
}
export function stepPeds(state, dt) {
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;
  const danger = state.bullets.length > 0 || (state.player.inCar && Math.abs(state.player.inCar.speed) > 300);
  for (const ped of state.peds) {
    if (ped.hp <= 0) continue;
    const d = Math.hypot(px - ped.x, py - ped.y);
    if (danger && d < 260) ped.flee = 2.5;
    if (ped.flee > 0) {
      ped.flee -= dt;
      ped.angle = Math.atan2(ped.y - py, ped.x - px);
      ped.x += Math.cos(ped.angle) * 150 * dt; ped.y += Math.sin(ped.angle) * 150 * dt;
    } else {
      ped.wander -= dt;
      if (ped.wander <= 0) { ped.wander = rngRange(state.rng || Math.random, 2, 6); ped.angle = Math.floor((state.rng || Math.random)() * 4) * Math.PI / 2; }
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt, ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (nx > CFG.beachX && nx < CFG.world - 40 && ny > 40 && ny < CFG.world - 40) { ped.x = nx; ped.y = ny; }
      else ped.angle += Math.PI;
    }
    // Hit by the player's car: knock down, raise wanted.
    if (state.player.inCar && Math.abs(state.player.inCar.speed) > 120 && d < 34 && ped.hp > 0) {
      ped.hp = 0; ped.flee = 0; state.wanted = clamp(state.wanted + 1, 0, 5);
      state.events.push({ kind: 'ped-hit', x: ped.x, y: ped.y });
      state.player.inCar.speed *= 0.7;
    }
  }
  // Respawn fallen peds far from the player so the streets stay alive.
  for (const ped of state.peds) {
    if (ped.hp <= 0 && Math.hypot(px - ped.x, py - ped.y) > 700) {
      const s = randomRoadSpot(state.rng || Math.random, state.world);
      ped.x = s.x; ped.y = s.y; ped.hp = 50;
    }
  }
}
