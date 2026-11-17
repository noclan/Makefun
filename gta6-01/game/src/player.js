// Rico Vega on foot: WASD movement with a run key, punching, and getting
// in and out of cars. Stealing a car is a crime — the wanted system hears
// about it — and a cop car is only ever obtained by stealing one.

import { PLAYER, WANTED } from './config.js';
import { clampToWorld, collideBuildings, inSea } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2, // facing up the street
    radius: PLAYER.radius,
    health: PLAYER.health,
    armor: PLAYER.armor,
    cash: 0,
    respect: 0,
    ammo: 12,
    car: null, // the car record Rico is driving, or null on foot
    punchTimer: 0,
    fireTimer: 0,
    hurtTimer: 0,
    invulnerable: 0,
    speed: 0,
  };
}

// One fixed step on foot. Returns a small event object the game loop
// reacts to (a punch landing, a car stolen, a shell picked up).
export function stepPlayerOnFoot(g, dt, input) {
  const p = g.player;
  const events = { punched: null, stole: null, shell: false };
  const mx = input.steerX();
  const my = input.steerY();
  const moving = mx !== 0 || my !== 0;
  const run = input.running();
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;

  if (moving) {
    const len = Math.hypot(mx, my) || 1;
    const dx = (mx / len) * speed * dt;
    const dy = (my / len) * speed * dt;
    p.x += dx;
    p.y += dy;
    p.angle = Math.atan2(dy, dx);
    p.speed = speed;
  } else {
    p.speed = 0;
  }

  if (collideBuildings(g.city, p)) {
    // Bumped a wall: nothing to do, the push-out already happened.
  }
  clampToWorld(p);
  if (inSea(p.x, p.y)) {
    // The sea pushes back: Rico is a driver, not a swimmer.
    p.y = p.y > 3040 ? 3030 : p.y;
    if (p.x > 2960 && p.y > 1320 && p.y < 2240) p.x = 2950;
  }

  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.fireTimer > 0) p.fireTimer -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  if (p.invulnerable > 0) p.invulnerable -= dt;

  // Punching and interacting are read by the game loop from the same
  // action flags, so this step never consumes them itself.
  return events;
}

export function tryPunch(g) {
  const p = g.player;
  if (p.punchTimer > 0 || p.car) return null;
  p.punchTimer = PLAYER.punchCooldown;
  const reach = PLAYER.punchRange + p.radius;
  let best = null;
  let bestD = Infinity;
  for (const ped of g.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d < reach && d < bestD) { best = ped; bestD = d; }
  }
  for (const cop of g.cops) {
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    if (d < reach && d < bestD) { best = cop; bestD = d; }
  }
  if (!best) return { hit: false };
  best.health -= PLAYER.punchDamage;
  g.effects.blood(best.x, best.y);
  if (best.kind === 'ped') {
    best.flee = true;
    best.fleeTimer = 3;
    g.wanted.heat += WANTED.hitPed;
    g.wanted.lastCrime = g.time;
  } else {
    g.wanted.heat += WANTED.hitCop;
    g.wanted.lastCrime = g.time;
  }
  if (best.health <= 0) {
    best.down = true;
    best.downTimer = 4;
  }
  return { hit: true, target: best };
}

// Find the closest car Rico can get into (parked, traffic or a cop car).
export function nearestCar(g, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of g.cars) {
    if (car.driver === 'player') continue;
    const d = Math.hypot(car.x - g.player.x, car.y - g.player.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

export function enterCar(g, car) {
  const p = g.player;
  const wasParked = car.driver === null;
  const wasCop = car.type === 'cop';
  if (car.driver === 'traffic') {
    // Yank the driver out: they flee on foot, the car is yours now.
    const driver = { x: car.x, y: car.y, angle: 0, speed: 0, health: 100, down: false, flee: true, fleeTimer: 5, kind: 'ped', color: '#e8a34c' };
    g.peds.push(driver);
  }
  car.driver = 'player';
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  if (wasParked || wasCop) {
    g.wanted.heat += WANTED.stealCar;
    g.wanted.lastCrime = g.time;
    g.hudMessage = wasCop ? 'Stolen police cruiser! The whole force is coming.' : 'Car stolen — keep it smooth, Rico.';
  }
  return car;
}

export function exitCar(g) {
  const p = g.player;
  if (!p.car) return;
  const car = p.car;
  car.driver = null;
  car.speed *= 0.3;
  // Step out to the side of the car, clear of the door.
  const side = Math.PI / 2;
  p.x = car.x + Math.cos(car.angle + side) * 26;
  p.y = car.y + Math.sin(car.angle + side) * 26;
  p.angle = car.angle;
  p.car = null;
  clampToWorld(p);
  collideBuildings(g.city, p);
}
