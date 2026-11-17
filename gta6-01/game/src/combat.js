// Combat: Rico's pistol, bullets, and the pickups scattered around
// Solmar Bay — health kits, armour vests and ammo boxes. Shooting is
// loud: it raises the heat and sends nearby pedestrians running.

import { PISTOL, WANTED } from './config.js';
import { chance, pick, range } from './random.js';
import { scareNearby } from './pedestrians.js';

export function spawnPickups(rng, city, count) {
  const pickups = [];
  const kinds = ['health', 'armor', 'ammo'];
  let guard = 0;
  while (pickups.length < count && guard < count * 30) {
    guard += 1;
    const line = pick(rng, city.lines);
    const along = range(rng, 240, 2960);
    const vertical = chance(rng, 0.5);
    const side = chance(rng, 0.5) ? 1 : -1;
    const x = vertical ? line + side * 44 : along;
    const y = vertical ? along : line + side * 44;
    if (y > 2880) continue;
    pickups.push({ kind: pick(rng, kinds), x, y, bob: rng() * Math.PI * 2 });
  }
  return pickups;
}

export function firePistol(g, angle) {
  const p = g.player;
  if (p.car || p.ammo <= 0 || p.fireTimer > 0) return false;
  p.fireTimer = PISTOL.fireCooldown;
  p.ammo -= 1;
  const mx = p.x + Math.cos(angle) * (p.radius + 10);
  const my = p.y + Math.sin(angle) * (p.radius + 10);
  g.bullets.push({
    x: mx, y: my,
    vx: Math.cos(angle) * PISTOL.bulletSpeed,
    vy: Math.sin(angle) * PISTOL.bulletSpeed,
    travelled: 0,
    fromPlayer: true,
  });
  g.effects.muzzle(mx, my, angle);
  if (g.audio) g.audio.shot();
  g.wanted.heat += WANTED.shoot;
  g.wanted.lastCrime = g.time;
  scareNearby(g, p.x, p.y, 320);
  return true;
}

function bulletHits(g, b) {
  const targets = [];
  for (const ped of g.peds) if (!ped.down) targets.push(ped);
  for (const cop of g.cops) if (cop.kind === 'cop' && !cop.down) targets.push(cop);
  for (const t of targets) {
    const d = Math.hypot(t.x - b.x, t.y - b.y);
    if (d < 16) return t;
  }
  return null;
}

export function stepBullets(g, dt) {
  for (let i = g.bullets.length - 1; i >= 0; i -= 1) {
    const b = g.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += PISTOL.bulletSpeed * dt;
    let dead = b.travelled > PISTOL.bulletRange;
    if (!dead) {
      const hit = bulletHits(g, b);
      if (hit) {
        hit.health -= PISTOL.damage;
        g.effects.blood(hit.x, hit.y);
        if (hit.kind === 'ped') {
          hit.flee = true;
          hit.fleeTimer = 4;
          g.wanted.heat += WANTED.hitPed;
          g.wanted.lastCrime = g.time;
        } else {
          g.wanted.heat += WANTED.hitCop;
          g.wanted.lastCrime = g.time;
        }
        if (hit.health <= 0) {
          hit.down = true;
          hit.downTimer = 5;
        }
        dead = true;
      }
    }
    if (dead) g.bullets.splice(i, 1);
  }
}

export function stepPickups(g, dt) {
  const p = g.player;
  for (let i = g.pickups.length - 1; i >= 0; i -= 1) {
    const item = g.pickups[i];
    item.bob += dt * 3;
    if (p.car) continue;
    const d = Math.hypot(item.x - p.x, item.y - p.y);
    if (d > 30) continue;
    if (item.kind === 'health' && p.health < 100) {
      p.health = Math.min(100, p.health + 40);
      g.hudMessage = 'Health +40';
    } else if (item.kind === 'armor' && p.armor < 50) {
      p.armor = Math.min(50, p.armor + 25);
      g.hudMessage = 'Armour +25';
    } else if (item.kind === 'ammo' && p.ammo < PISTOL.ammoMax) {
      p.ammo = Math.min(PISTOL.ammoMax, p.ammo + 12);
      g.hudMessage = 'Ammo +12';
    } else {
      continue;
    }
    g.effects.burst(item.x, item.y, '#f2c94c', 10, 90, 0.5, 3);
    if (g.audio) g.audio.pickup();
    g.pickups.splice(i, 1);
  }
  // Pickups slowly restock so the map never runs dry.
  if (g.pickups.length < 6 && g.rng() < 0.004) {
    const fresh = spawnPickups(g.rng, g.city, 1);
    for (const item of fresh) g.pickups.push(item);
  }
}
