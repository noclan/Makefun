// The game itself: one state object, one fixed step. createGame builds a
// fresh Solmar Bay from a seed; stepGame advances it by 1/60 s from the
// player's input. Every system — driving, traffic, pedestrians, police,
// missions, combat — is called from here, in an order that keeps cause and
// effect straight (the player acts, the world reacts, the effects follow).

import { CLOCK_RATE, PLAYER, START_CLOCK, WORLD } from './config.js';
import { makeRng } from './random.js';
import { buildCity, clampToWorld, districtAt } from './world.js';
import { createEffects } from './particles.js';
import { createPlayer, enterCar, exitCar, nearestCar, stepPlayerOnFoot, tryPunch } from './player.js';
import { collideCarWithBuildings, spawnParkedCars, stepCar, resetCarIds } from './vehicles.js';
import { spawnTraffic, stepTraffic, trafficSteer } from './traffic.js';
import { spawnPeds, stepPeds } from './pedestrians.js';
import { payRespray, starsFromHeat, stepPolice } from './police.js';
import { firePistol, spawnPickups, stepBullets, stepPickups } from './combat.js';
import { MISSIONS, markerFor, retryMission, startMissionStage, stepMissions, stepRace, stepShells, stepTaxi } from './missions.js';
import { writeSave } from './ui.js';
import { ACT_INTERACT, ACT_MUTE, ACT_PUNCH, ACT_SHOOT } from './input.js';

export function createGame(seed) {
  resetCarIds();
  const rng = makeRng(seed);
  const city = buildCity(rng);
  const g = {
    seed,
    rng,
    city,
    time: 0,
    clock: START_CLOCK,
    clockOffset: 0, // staged scenes shift the clock without touching time
    effects: createEffects(rng),
    audio: null,
    player: createPlayer(480, 800),
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    pickups: [],
    wanted: { heat: 0, stars: 0, quietTimer: 0, lastCrime: -99 },
    mission: { index: 0, stage: 0, timer: 0, outOfRange: 0, failed: false, failReason: '', hint: '' },
    dialogue: null,
    hudMessage: '',
    hudMessageTimer: 0,
    lastBark: null,
    hint: '',
    camera: { x: 480, y: 800 },
    districtName: 'Downtown',
    shellsFound: 0,
    fare: null,
    race: null,
    racePrompt: false,
    tailCar: null,
    marker: null,
    over: null,
    busted: false,
    attract: false,
    aimWorld: null,
  };
  g.cars = spawnParkedCars(rng, city, 10);
  g.cars.push(...spawnTraffic(rng, city, 16, g.player.x, g.player.y));
  g.peds = spawnPeds(rng, city, 26, g.player.x, g.player.y);
  g.pickups = spawnPickups(rng, city, 10);
  g.save = () => writeSave(g);
  startMissionStage(g);
  return g;
}

function updateDistrict(g) {
  const bx = Math.floor((g.player.x - WORLD.firstRoad) / WORLD.roadGap);
  const by = Math.floor((g.player.y - WORLD.firstRoad) / WORLD.roadGap);
  const key = districtAt(bx, by);
  const names = { downtown: 'Downtown', oldtown: 'Old Town', beachfront: 'Beachfront', marina: 'Marina', hills: 'Palm Hills', midtown: 'Midtown' };
  g.districtName = names[key] || 'Solmar Bay';
}

function interact(g) {
  const p = g.player;
  if (p.car) {
    const shop = g.city.landmarks.respray;
    if (Math.hypot(p.x - shop.x, p.y - shop.y) < 90 && p.cash >= 150 && g.wanted.stars >= 1) {
      payRespray(g);
      return;
    }
    const start = g.city.landmarks.raceStart;
    if (Math.hypot(p.x - start.x, p.y - start.y) < 80) {
      g.racePrompt = true;
      return;
    }
    exitCar(g);
    return;
  }
  const car = nearestCar(g, 58);
  if (car) enterCar(g, car);
}

function hurtPlayer(g, amount, fromX, fromY) {
  const p = g.player;
  if (p.invulnerable > 0) return;
  p.invulnerable = 0.5;
  p.hurtTimer = 0.4;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.health -= left;
  g.effects.blood(p.x, p.y);
  g.effects.shake(0.3);
  const away = Math.atan2(p.y - fromY, p.x - fromX);
  p.x += Math.cos(away) * 14;
  p.y += Math.sin(away) * 14;
  clampToWorld(p);
  if (p.health <= 0) {
    p.health = 0;
    resolveWasted(g);
  }
}

function resolveBusted(g) {
  const p = g.player;
  const lost = Math.min(p.cash, Math.max(50, Math.floor(p.cash * 0.1)));
  p.cash -= lost;
  g.wanted.heat = 0;
  g.wanted.stars = 0;
  // The force stands down and the cruisers drive away.
  for (const cop of g.cops) {
    if (cop.kind === 'copcar') {
      const at = g.cars.indexOf(cop.car);
      if (at >= 0) g.cars.splice(at, 1);
    }
  }
  g.cops = [];
  if (p.car) {
    p.car.driver = null;
    p.car = null;
  }
  p.health = PLAYER.health;
  p.x = g.city.landmarks.policeStation.x + 40;
  p.y = g.city.landmarks.policeStation.y;
  p.angle = 0;
  g.busted = false;
  g.over = { type: 'busted', lost };
}

function resolveWasted(g) {
  const p = g.player;
  const lost = Math.min(p.cash, 300);
  p.cash -= lost;
  g.wanted.heat = Math.max(0, g.wanted.heat / 2);
  g.wanted.stars = starsFromHeat(g.wanted.heat);
  if (p.car) {
    p.car.driver = null;
    p.car = null;
  }
  p.health = PLAYER.health;
  p.armor = 0;
  p.x = g.city.landmarks.hospital.x + 40;
  p.y = g.city.landmarks.hospital.y;
  p.angle = 0;
  g.over = { type: 'wasted', lost };
}

// Cars are solid: two of them can never share the same patch of road. A
// light push-apart each step keeps fender-benders looking like fender-benders
// instead of one car swallowing the other.
function separateCars(g) {
  const cars = g.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 30;
      if (d < 0.01 || d >= min) continue;
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      a.speed *= 0.96;
      b.speed *= 0.96;
    }
  }
  if (g.player.car) {
    g.player.x = g.player.car.x;
    g.player.y = g.player.car.y;
  }
}

function stepDriving(g, dt, input) {
  const p = g.player;
  const car = p.car;
  const throttle = -input.steerY();
  const steer = input.steerX();
  const wrecked = car.damage >= 100;
  stepCar(car, wrecked ? 0 : throttle, steer, dt, g.effects);
  if (input.isHeld('Space') && Math.abs(car.speed) > 60) {
    car.speed *= 1 - 2.4 * dt;
    g.effects.skidMark(car.x, car.y, car.angle, 12);
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);
  const hitWall = collideCarWithBuildings(g.city, car, g.effects);
  if (hitWall && Math.abs(car.speed) > 200 && g.audio) g.audio.crash();
  // Running over a pedestrian is a crime, and it shows.
  for (const ped of g.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 26 && Math.abs(car.speed) > 90) {
      ped.health -= 60;
      ped.down = true;
      ped.downTimer = 5;
      g.effects.blood(ped.x, ped.y);
      g.wanted.heat += 22;
      g.wanted.lastCrime = g.time;
      car.damage += 3;
      if (g.audio) g.audio.crash();
    }
  }
}

function stepOnFootHazards(g, dt) {
  const p = g.player;
  if (p.car) return;
  // Cars that hit Rico on foot hurt him; traffic slows, the player flies.
  for (const car of g.cars) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < 26 && Math.abs(car.speed) > 90) {
      hurtPlayer(g, 14, car.x, car.y);
      car.speed *= 0.4;
      car.damage += 4;
      if (g.audio) g.audio.crash();
    }
  }
  // A foot cop leaning on Rico wears his health down; if Rico stops running,
  // the busted check in the police step ends the chase.
  for (const cop of g.cops) {
    if (cop.kind !== 'cop' || cop.down) continue;
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    if (d < 30 && p.speed >= 80) hurtPlayer(g, 6 * dt * 10, cop.x, cop.y);
  }
}

export function stepGame(g, dt, input) {
  g.time += dt;
  g.clock = (START_CLOCK + g.time * CLOCK_RATE + g.clockOffset) % 24;
  // A fresh message gets three seconds on screen; then it clears itself.
  if (g.hudMessage && g.hudMessage !== g._hudShown) {
    g._hudShown = g.hudMessage;
    g.hudMessageTimer = 3;
  }
  if (g.hudMessageTimer > 0) g.hudMessageTimer -= dt;
  else g.hudMessage = '';
  if (g.dialogue && g.dialogue.timer > 0) g.dialogue.timer -= dt;
  if (g.lastBark && g.lastBark.timer > 0) g.lastBark.timer -= dt;
  if (g.over) return;

  if (g.attract) {
    // Title-screen backdrop: the camera drifts over downtown while the city
    // lives its life behind the menu.
    g.camera.x = 1120 + Math.cos(g.time * 0.05) * 500;
    g.camera.y = 1120 + Math.sin(g.time * 0.05) * 500;
    stepTraffic(g, dt);
    stepPeds(g, dt);
    g.effects.step(dt);
    return;
  }

  const actions = input ? input.takeActions(ACT_INTERACT | ACT_MUTE | ACT_PUNCH | ACT_SHOOT) : 0;
  if (actions & ACT_MUTE) {
    if (g.audio) {
      const muted = g.audio.toggleMute();
      g.hudMessage = muted ? 'Sound muted' : 'Sound on';
      g.hudMessageTimer = 2;
    }
  }
  if (actions & ACT_INTERACT) interact(g);
  if (actions & ACT_PUNCH) tryPunch(g);
  if (actions & ACT_SHOOT) {
    const p = g.player;
    let angle = p.angle;
    if (g.aimWorld) angle = Math.atan2(g.aimWorld.y - p.y, g.aimWorld.x - p.x);
    firePistol(g, angle);
  }

  const p = g.player;
  if (p.car) stepDriving(g, dt, input);
  else stepPlayerOnFoot(g, dt, input);
  stepOnFootHazards(g, dt);

  // The tail car cruises its loop like traffic with a destination.
  if (g.tailCar) {
    const car = g.tailCar;
    const steer = trafficSteer(g.rng, car, dt);
    stepCar(car, 1, steer, dt, g.effects);
    collideCarWithBuildings(g.city, car, g.effects);
  }

  stepTraffic(g, dt);
  separateCars(g);
  stepPeds(g, dt);
  stepPolice(g, dt);
  stepBullets(g, dt);
  stepPickups(g, dt);
  stepMissions(g, dt);
  stepTaxi(g, dt);
  stepRace(g, dt);
  stepShells(g);
  g.effects.step(dt);
  if (g.audio) g.audio.update(g, dt);

  // Context hint: the one useful thing E does right now.
  g.hint = '';
  if (!p.car) {
    if (nearestCar(g, 58)) g.hint = 'Press E to enter the car';
  } else {
    const shop = g.city.landmarks.respray;
    const start = g.city.landmarks.raceStart;
    if (Math.hypot(p.x - shop.x, p.y - shop.y) < 90 && p.cash >= 150 && g.wanted.stars >= 1) {
      g.hint = 'Press E for a respray — $150, clears 2 stars';
    } else if (Math.hypot(p.x - start.x, p.y - start.y) < 80) {
      g.hint = 'Press E to start the beach race';
    } else if (p.car.damage >= 100) {
      g.hint = 'Wrecked! Press E to get out and find another car';
    }
  }

  // Health trickles back once the heat is off.
  if (g.wanted.stars === 0 && p.health > 0 && p.health < PLAYER.health) {
    p.health = Math.min(PLAYER.health, p.health + 2 * dt);
  }

  g.marker = markerFor(g);
  updateDistrict(g);

  // Camera: follow Rico with a look-ahead in the direction of travel.
  let lookX = 0;
  let lookY = 0;
  if (p.car) {
    lookX = Math.cos(p.car.angle) * Math.min(120, Math.abs(p.car.speed) * 0.25);
    lookY = Math.sin(p.car.angle) * Math.min(120, Math.abs(p.car.speed) * 0.25);
  } else {
    lookX = Math.cos(p.angle) * 26;
    lookY = Math.sin(p.angle) * 26;
  }
  const kx = 1 - Math.exp(-5 * dt);
  g.camera.x += (p.x + lookX - g.camera.x) * kx;
  g.camera.y += (p.y + lookY - g.camera.y) * kx;
  g.camera.x = Math.max(640, Math.min(WORLD.size - 640, g.camera.x));
  g.camera.y = Math.max(360, Math.min(WORLD.size - 360, g.camera.y));

  if (g.busted) resolveBusted(g);
}
