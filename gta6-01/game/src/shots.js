// The staged screenshot scenes behind ?shot=chase|downtown|mission|dusk.
// Each one plays the real rules forward from a fresh seeded game for a
// fixed number of steps, steered by a small autopilot that drives along
// the road grid, so the frame is what a short game really looks like and
// the same seed always gives the same frame.
//
// v2 staging: the cover is a beachfront sunset chase (sand, sea, palms
// and a lifeguard tower in frame, three stars, two cruisers, the police
// helicopter overhead); the mission shot shows Mama Rosa's dialogue bar;
// the dusk shot shows neon signs and headlight cones.

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

// Drive east along one road for `steps` fixed steps: hold the gas and
// steer back toward the road centreline, never turning at intersections,
// so a beachfront chase stays on the beachfront.
function driveEast(g, input, steps, roadY) {
  input.press('KeyW');
  for (let i = 0; i < steps; i += 1) {
    const car = g.player.car;
    if (car) {
      const want = Math.atan2(roadY - car.y, 240);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.5));
      if (steer > 0.2) input.press('KeyD');
      else input.release('KeyD');
      if (steer < -0.2) input.press('KeyA');
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
  // A busy street for the camera: ten extra cars, fourteen extra walkers.
  for (const car of spawnTraffic(g.rng, g.city, 10, x, y)) g.cars.push(car);
  for (const ped of spawnPeds(g.rng, g.city, 14, x, y)) g.peds.push(ped);
}

export function stageShot(name, g) {
  const input = scriptedInput();
  if (name === 'chase') {
    // Cover: sunset police chase down the beachfront road. Rico in the
    // Veloce GT, three stars, two cruisers on his tail, the police
    // helicopter overhead, sand and sea along the bottom of the frame.
    g.clockOffset = 18.2 - START_CLOCK;
    g.mission.index = 3;
    g.mission.stage = 0;
    g.wanted.heat = 65;
    g.player.cash = 18450;
    g.player.respect = 55;
    putPlayerInCar(g, 'sports', 1120, 2720, 0);
    addCopCar(g, 1030, 2720, 0);
    addCopCar(g, 980, 2742, 0);
    livenStreet(g, 1120, 2720);
    driveEast(g, input, 130, 2720);
    g.dialogue = { speaker: 'Mama Rosa', text: 'Three stars, Rico! Lose them on the beach road — the helicopter cannot follow you into the old town alleys.', timer: 999 };
    return g;
  }
  if (name === 'downtown') {
    // Golden-hour cruise through downtown: sedan, traffic, pedestrians,
    // towers with shop signs, mission 1 pointing at the Old Town drop.
    g.clockOffset = 17.6 - START_CLOCK;
    g.mission.index = 0;
    g.mission.stage = 1;
    g.wanted.heat = 0;
    g.player.cash = 1250;
    g.player.respect = 12;
    putPlayerInCar(g, 'sedan', 1120, 800, 0);
    livenStreet(g, 1120, 800);
    driveFor(g, input, 100);
    g.dialogue = { speaker: 'Mama Rosa', text: 'Good — you are mobile again. The drop is in Old Town, across the whole city. Drive like you mean it, and do not stop for the Varelas.', timer: 999 };
    return g;
  }
  if (name === 'mission') {
    // On foot at the marina: Rico walking to the crate, pistol ready, a
    // cruiser closing in, Mama Rosa talking him through it. The camera
    // sits close to the bay so the water reads on the right of the frame.
    g.clockOffset = 16.9 - START_CLOCK;
    g.mission.index = 1;
    g.mission.stage = 0;
    g.wanted.heat = 15;
    g.player.cash = 3400;
    g.player.respect = 22;
    g.player.x = 2700;
    g.player.y = 1760;
    g.player.angle = 0;
    g.camera.x = 2700;
    g.camera.y = 1760;
    livenStreet(g, 2700, 1760);
    // Stop a good hundred metres short of the crate: the camera clamps
    // at the east edge, so Rico must not end up underneath the marker.
    walkToward(g, input, 2880, 1760, 25);
    // The cruiser arrives after the walk, so it reads as closing in
    // instead of piling on top of Rico.
    addCopCar(g, 2550, 1760, 0);
    g.dialogue = { speaker: 'Mama Rosa', text: 'The crate is at the end of the pier, Rico. Quiet feet. If a cruiser spots you, run for the alleys, not the water.', timer: 999 };
    return g;
  }
  if (name === 'dusk') {
    // Night on the beachfront: taxi headlights, neon signs, one star,
    // mission 5 on the banner, the sea black beyond the sand.
    g.clockOffset = 20.4 - START_CLOCK;
    g.mission.index = 4;
    g.mission.stage = 0;
    g.wanted.heat = 15;
    g.player.cash = 7200;
    g.player.respect = 48;
    putPlayerInCar(g, 'taxi', 1120, 2720, 0);
    livenStreet(g, 1120, 2720);
    driveEast(g, input, 130, 2720);
    g.dialogue = { speaker: 'Mama Rosa', text: 'The package is at the bank, Rico. Seventy-five seconds to the safehouse once you grab it — and the whole PD is awake tonight.', timer: 999 };
    return g;
  }
  // Any other name is the downtown cruise.
  g.clockOffset = 17.6 - START_CLOCK;
  putPlayerInCar(g, 'sedan', 1120, 800, 0);
  livenStreet(g, 1120, 800);
  driveFor(g, input, 100);
  return g;
}
