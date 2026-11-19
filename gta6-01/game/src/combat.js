// Pistol combat: bullets, muzzle flash, pickups, health/armor.
import { CFG } from './config.js';
import { makeRng, rngRange, clamp } from './random.js';
import { hurtPlayer } from './player.js';

export function spawnPickups(world, seed) {
  const rng = makeRng(seed + 91);
  const list = [];
  const kinds = ['health', 'armor', 'ammo', 'cash'];
  for (let i = 0; i < 12; i++) {
    list.push({ x: 500 + rng() * 2600, y: 200 + rng() * 2900, kind: kinds[i % 4], taken: false, bob: rngRange(rng, 0, 6) });
  }
  return list;
}
export function stepCombat(state, input, dt) {
  const p = state.player;
  state.shootCd = Math.max(0, (state.shootCd || 0) - dt);
  // Aim with the mouse in the browser; in headless play the facing direction.
  const aim = state.aimAngle != null ? state.aimAngle : p.facing;
  if ((input.shoot || input.punch) && !p.inCar && p.ammo > 0 && state.shootCd <= 0 && (input.shoot || state.aimAngle != null)) {
    if (!input.shoot) return;
    p.ammo -= 1; state.shootCd = 0.22;
    state.bullets.push({ x: p.x + Math.cos(aim) * 22, y: p.y + Math.sin(aim) * 22, vx: Math.cos(aim) * 780, vy: Math.sin(aim) * 780, life: 0.7 });
    state.events.push({ kind: 'shot', x: p.x, y: p.y });
    state.wanted = clamp(state.wanted + 0, 0, 5);
    if (state.wanted < 1) state.wanted = 1;
    state.muzzle = 0.06;
  }
  state.muzzle = Math.max(0, (state.muzzle || 0) - dt);
  for (const b of state.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const cop of state.cops) {
      if (Math.hypot(cop.x - b.x, cop.y - b.y) < 20) { cop.hp -= 34; b.life = 0; state.events.push({ kind: 'hit', x: b.x, y: b.y }); if (cop.hp <= 0) state.wanted = clamp(state.wanted + 1, 0, 5); }
    }
    for (const ped of state.peds) {
      if (ped.hp > 0 && Math.hypot(ped.x - b.x, ped.y - b.y) < 16) { ped.hp -= 34; ped.flee = 3; b.life = 0; }
    }
  }
  state.bullets = state.bullets.filter(b => b.life > 0);
  state.cops = state.cops.filter(c => c.hp > 0);
  // Pickups.
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      pk.taken = true; state.events.push({ kind: 'pickup', what: pk.kind });
      if (pk.kind === 'health') p.health = Math.min(100, p.health + 40);
      if (pk.kind === 'armor') p.armor = Math.min(100, p.armor + 50);
      if (pk.kind === 'ammo') p.ammo += 24;
      if (pk.kind === 'cash') p.cash += 75;
    }
  }
  // Cops shoot back when close and the player is on foot — slow, survivable fire.
  state.copShootCd = Math.max(0, (state.copShootCd || 0) - dt);
  if (state.cops.length && !p.inCar && state.wanted >= 2 && state.copShootCd <= 0) {
    const near = state.cops.find(c => Math.hypot(c.x - p.x, c.y - p.y) < 260);
    if (near) { state.copShootCd = 1.4; hurtPlayer(state, 5); state.events.push({ kind: 'cop-shot' }); }
  }
}
