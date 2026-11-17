// The wanted system: heat from crimes, stars on the HUD, and the Solmar
// PD answering in proportion. Foot cops run the player down; at three
// stars and up they bring cruisers — and a helicopter that circles above
// Rico with a searchlight, so the heat is visible from anywhere on the
// map. Get busted (a cop reaches Rico on foot while he is slow) or wasted
// (health hits zero) and the day costs money.

import { HELI, WANTED } from './config.js';
import { chance, pick, range } from './random.js';
import { collideBuildings, nearestRoadPoint, onRoad } from './world.js';
import { makeCar, stepCar, collideCarWithBuildings } from './vehicles.js';

export function starsFromHeat(heat) {
  if (heat < 10) return 0;
  if (heat < 30) return 1;
  if (heat < 55) return 2;
  if (heat < 80) return 3;
  if (heat < 105) return 4;
  return 5;
}

function spawnCop(g, inCar) {
  const rng = g.rng;
  const p = g.player;
  // Cops arrive from just off-screen, in the direction the player is not
  // looking — the classic ambush.
  const angle = rng() * Math.PI * 2;
  const dist = range(rng, 520, 640);
  let x = p.x + Math.cos(angle) * dist;
  let y = p.y + Math.sin(angle) * dist;
  x = Math.max(60, Math.min(3140, x));
  y = Math.max(60, Math.min(3140, y));
  if (inCar) {
    const road = nearestRoadPoint(x, y);
    const car = makeCar(rng, 'cop', road.x, road.y, angle);
    car.driver = 'cop';
    car.cruise = 640;
    car.lane = 0;
    g.cars.push(car);
    return { kind: 'copcar', car, x: road.x, y: road.y };
  }
  return {
    kind: 'cop',
    x, y,
    radius: 13,
    angle: 0,
    speed: 0,
    health: 100,
    down: false,
    downTimer: 0,
    color: '#1d3557',
    siren: 0,
  };
}

function wantedTarget(g) {
  const stars = g.wanted.stars;
  const footWant = Math.min(2, stars);
  const carWant = stars >= 3 ? stars - 2 : 0;
  return { foot: footWant, cars: carWant };
}

// The helicopter orbits the player once the heat hits three stars. It is
// a visible system, not a weapon: it circles, it shines its spotlight on
// Rico, and it leaves when the heat drops.
export function stepHeli(g, dt) {
  const heli = g.heli;
  if (g.wanted.stars >= HELI.minStars) {
    if (!heli.active) {
      heli.active = true;
      // Start the orbit north-west of the player so the aircraft is in
      // frame, clear of the dialogue bar, from the moment it arrives.
      heli.orbit = Math.PI * 1.25;
    }
    heli.orbit += HELI.orbitSpeed * dt;
    heli.x = g.player.x + Math.cos(heli.orbit) * HELI.orbitRadius;
    heli.y = g.player.y + Math.sin(heli.orbit) * HELI.orbitRadius - 40;
    heli.angle = Math.atan2(g.player.y - heli.y, g.player.x - heli.x);
  } else {
    heli.active = false;
  }
}

export function stepPolice(g, dt) {
  const rng = g.rng;
  const w = g.wanted;
  const p = g.player;

  // Heat decays only after a few quiet seconds with no cop nearby.
  const nearestCop = g.cops.reduce((best, c) => Math.min(best, Math.hypot(c.x - p.x, c.y - p.y)), Infinity);
  if (nearestCop > 520) {
    w.quietTimer += dt;
    if (w.quietTimer > WANTED.decayDelay && w.heat > 0) {
      w.heat = Math.max(0, w.heat - WANTED.decayPerSecond * dt);
    }
  } else {
    w.quietTimer = 0;
  }
  w.stars = starsFromHeat(w.heat);
  stepHeli(g, dt);

  // Keep the responding force at the level the stars demand.
  const target = wantedTarget(g);
  const footCops = g.cops.filter((c) => c.kind === 'cop' && !c.down).length;
  const copCars = g.cops.filter((c) => c.kind === 'copcar').length;
  if (w.stars > 0 && footCops < target.foot && rng() < 0.03) {
    g.cops.push(spawnCop(g, false));
  }
  if (w.stars > 0 && copCars < target.cars && rng() < 0.02) {
    g.cops.push(spawnCop(g, true));
  }
  if (w.stars === 0 && g.cops.length > 0 && rng() < 0.01) {
    // Heat gone: the force stands down, one unit at a time.
    const gone = g.cops.pop();
    if (gone && gone.kind === 'copcar') {
      const at = g.cars.indexOf(gone.car);
      if (at >= 0) g.cars.splice(at, 1);
    }
  }

  // Foot cops: run at Rico, and if they catch him slow on foot, he is busted.
  for (const cop of g.cops) {
    if (cop.kind !== 'cop') continue;
    if (cop.down) {
      cop.downTimer -= dt;
      if (cop.downTimer <= 0) { cop.down = false; cop.health = 60; }
      continue;
    }
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    const want = Math.atan2(p.y - cop.y, p.x - cop.x);
    let diff = want - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-5 * dt, Math.min(5 * dt, diff));
    const chaseSpeed = p.car ? 190 : 215; // a little faster than Rico walks
    cop.x += Math.cos(cop.angle) * chaseSpeed * dt;
    cop.y += Math.sin(cop.angle) * chaseSpeed * dt;
    collideBuildings(g.city, cop);
    if (!p.car && d < 26 && p.speed < 80) {
      g.busted = true;
    }
  }

  // Cop cars: drive at the player like traffic with a grudge.
  for (const cop of g.cops) {
    if (cop.kind !== 'copcar') continue;
    const car = cop.car;
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    cop.x = car.x;
    cop.y = car.y;
    const want = Math.atan2(p.y - car.y, p.x - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.4));
    let throttle = 1;
    if (d < 60) throttle = 0.2;
    if (Math.abs(car.speed) > car.cruise) throttle = Math.min(throttle, 0);
    stepCar(car, throttle, steer, dt, g.effects);
    collideCarWithBuildings(g.city, car, g.effects);
    // A cop car ramming the player's car is a crime scene: damage + heat.
    if (p.car && d < 34 && Math.abs(car.speed) > 120) {
      p.car.damage += 4;
      g.effects.sparks(p.car.x, p.car.y);
      g.effects.shake(0.25);
      if (g.audio) g.audio.crash();
    }
    // Cop cars that fall far behind respawn closer — the heat never cools
    // just because one cruiser took a wrong turn.
    if (d > 1100 && rng() < 0.01) {
      const road = nearestRoadPoint(p.x + range(rng, -500, 500), p.y + range(rng, -500, 500));
      car.x = road.x;
      car.y = road.y;
      car.speed = 0;
    }
    if (!onRoad(car.x, car.y) && Math.abs(car.speed) < 20) {
      const road = nearestRoadPoint(car.x, car.y);
      car.x = road.x;
      car.y = road.y;
    }
  }
}

export function payRespray(g) {
  const p = g.player;
  const shop = g.city.landmarks.respray;
  const near = Math.hypot(p.x - shop.x, p.y - shop.y) < 90;
  if (!near || !p.car || p.cash < 150 || g.wanted.stars < 1) return false;
  p.cash -= 150;
  g.wanted.heat = Math.max(0, g.wanted.heat - 40);
  g.wanted.stars = starsFromHeat(g.wanted.heat);
  if (p.car) p.car.color = pick(g.rng, ['#c94f43', '#4a7fb8', '#e8e0c8', '#3f8f7b', '#8a6fb8']);
  g.hudMessage = 'Fresh paint, clean slate. Two stars gone.';
  g.effects.burst(p.x, p.y, '#8a6fb8', 16, 120, 0.7, 4);
  return true;
}
