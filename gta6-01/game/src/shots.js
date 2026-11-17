// The staged screenshot scenes behind ?shot=chase|downtown|mission|dusk.
// Each one plays the real rules forward from a fresh seeded game for a fixed
// number of steps, steered by a small autopilot that drives along the road
// grid, so the frame is what a short game really looks like and the same
// seed always gives the same frame.

import { START_CLOCK, STEP } from './config.js';
import { makeCar } from './vehicles.js';
import { trafficSteer } from './traffic.js';
import { spawnPeds } from './pedestrians.js';
import { spawnTraffic } from './traffic.js';
import { stepGame } from './game.js';

function scriptedInput() {
  const held = new Set();
  return {
    steerX() {
      return (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
    },
    steerY() {
      return (held.has('KeyS') ? 1 : 0) - (held.has('KeyW') ? 1 : 0);
    },
    running() {
      return false;
    },
    isHeld(code) {
      return held.has(code);
    },
    takeActions() {
      return 0;
    },
    press(code) {
      held.add(code);
    },
    release(code) {
      held.delete(code);
    },
    mouse: { x: 0, y: 0, down: false, moved: false },
  };
}

// Drive the player's car along the road for `steps` fixed steps: hold the
// gas, steer toward the road ahead like the traffic does.
function driveFor(g, input, steps) {
  input.press('KeyW');
  for (let i = 0; i < steps; i += 1) {
    const car = g.player.car;
    if (car) {
      const steer = trafficSteer(g.rng, car, STEP);
      if (steer > 0.25) input.press('KeyD');
      else input.release('KeyD');
      if (steer < -0.25) input.press('KeyA');
      else input.release('KeyA');
    }
    stepGame(g, STEP, input);
  }
  input.release('KeyW');
  input.release('KeyA');
  input.release('KeyD');
}

// Walk on foot toward a point for `steps` fixed steps.
function walkToward(g, input, tx, ty, steps) {
  for (let i = 0; i < steps; i += 1) {
    const dx = tx - g.player.x;
    const dy = ty - g.player.y;
    if (dx > 10) input.press('KeyD');
    else input.release('KeyD');
    if (dx < -10) input.press('KeyA');
    else input.release('KeyA');
    if (dy > 10) input.press('KeyS');
    else input.release('KeyS');
    if (dy < -10) input.press('KeyW');
    else input.release('KeyW');
    stepGame(g, STEP, input);
  }
  input.release('KeyW');
  input.release('KeyA');
  input.release('KeyS');
  input.release('KeyD');
}

function putPlayerInCar(g, type, x, y, angle) {
  const car = makeCar(g.rng, type, x, y, angle);
  car.driver = 'player';
  g.cars.push(car);
  g.player.car = car;
  g.player.x = x;
  g.player.y = y;
  g.player.angle = angle;
  g.camera.x = x;
  g.camera.y = y;
  return car;
}

function addCopCar(g, x, y, angle) {
  const car = makeCar(g.rng, 'cop', x, y, angle);
  car.driver = 'cop';
  car.cruise = 640;
  car.lane = 0;
  g.cars.push(car);
  g.cops.push({ kind: 'copcar', car, x, y });
  return car;
}

function livenStreet(g, x, y) {
  for (const car of spawnTraffic(g.rng, g.city, 6, x, y)) g.cars.push(car);
  for (const ped of spawnPeds(g.rng, g.city, 8, x, y)) g.peds.push(ped);
}

export function stageShot(name, g) {
  const input = scriptedInput();
  if (name === 'chase') {
    // Sunset police chase: Rico in the Veloce GT, three stars, two cruisers
    // on his tail, traffic ahead, mission 4 on the banner.
    g.clockOffset = 18.2 - START_CLOCK;
    g.mission.index = 3;
    g.mission.stage = 0;
    g.wanted.heat = 65;
    putPlayerInCar(g, 'sports', 1120, 480, 0);
    addCopCar(g, 1030, 480, 0);
    addCopCar(g, 980, 502, 0);
    livenStreet(g, 1120, 480);
    driveFor(g, input, 150);
    return g;
  }
  if (name === 'downtown') {
    // Golden-hour cruise through downtown: sedan, traffic, pedestrians,
    // towers, mission 1 pointing at Café Luna.
    g.clockOffset = 17.6 - START_CLOCK;
    g.mission.index = 0;
    g.mission.stage = 0;
    g.wanted.heat = 0;
    putPlayerInCar(g, 'sedan', 1120, 800, 0);
    livenStreet(g, 1120, 800);
    driveFor(g, input, 100);
    return g;
  }
  if (name === 'mission') {
    // On foot at the marina: Rico walking to the crate, pistol ready, a
    // cruiser closing in, mission 2 on the banner.
    g.clockOffset = 16.9 - START_CLOCK;
    g.mission.index = 1;
    g.mission.stage = 0;
    g.wanted.heat = 15;
    g.player.x = 2600;
    g.player.y = 1760;
    g.player.angle = 0;
    g.camera.x = 2600;
    g.camera.y = 1760;
    addCopCar(g, 2400, 1400, 0);
    livenStreet(g, 2600, 1760);
    walkToward(g, input, 2880, 1760, 40);
    return g;
  }
  if (name === 'dusk') {
    // Night on the beachfront: taxi headlights, neon, one star, mission 5.
    g.clockOffset = 20.4 - START_CLOCK;
    g.mission.index = 4;
    g.mission.stage = 0;
    g.wanted.heat = 15;
    putPlayerInCar(g, 'taxi', 1120, 2720, 0);
    livenStreet(g, 1120, 2720);
    driveFor(g, input, 150);
    return g;
  }
  // Any other name is the downtown cruise.
  g.clockOffset = 17.6 - START_CLOCK;
  putPlayerInCar(g, 'sedan', 1120, 800, 0);
  livenStreet(g, 1120, 800);
  driveFor(g, input, 100);
  return g;
}
