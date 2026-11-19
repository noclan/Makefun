// Staged screenshot scenes: autopilot plays real gameplay from a fixed seed.
import { createGame, stepGame, startNewGame } from './game.js';
import { startMission } from './missions.js';
import { makeCar } from './vehicles.js';
import { createInput } from './input.js';

const SHOTS = {
  chase: { seed: 11, clock: 17.6, mission: 4, wanted: 3 },
  downtown: { seed: 21, clock: 17.0, mission: 1, wanted: 0 },
  mission: { seed: 31, clock: 16.4, mission: 2, wanted: 1 },
  dusk: { seed: 41, clock: 19.4, mission: 5, wanted: 2 },
};
export function isShotScene(name) { return name in SHOTS; }
export function buildShot(name) {
  const cfg = SHOTS[name] || SHOTS.chase;
  const state = createGame(cfg.seed);
  state.screen = 'shot'; state.clock = cfg.clock;
  startMission(state, cfg.mission);
  state.wanted = cfg.wanted;
  const input = createInput();
  // Put Rico in a sports car for the chase / downtown / dusk shots, on foot for mission.
  if (name !== 'mission') {
    // Spawn on a real road (intersection at 1392,1052), driving east, so the car
    // never sits on a building.
    const car = makeCar(name === 'chase' ? 'sports' : 'sedan', 1392, 1052, 0);
    car.parked = false; car.driver = 'player'; state.cars.push(car);
    state.player.inCar = car; state.player.x = car.x; state.player.y = car.y;
    car.speed = name === 'chase' ? 420 : 260;
    // Cop cars in pursuit behind, on the same road.
    for (let i = 0; i < (name === 'chase' ? 2 : 1); i++) {
      const cop = makeCar('cop', 1392 - 190 - i * 120, 1052, 0);
      cop.parked = false; cop.driver = 'cop'; state.cars.push(cop);
      state.cops.push({ x: cop.x, y: cop.y, angle: 0, hp: 60, car: cop, speed: 380 });
    }
  } else {
    state.player.x = 700; state.player.y = 2500; state.player.facing = -Math.PI / 2;
    const cop = makeCar('cop', 860, 2380, Math.PI); cop.parked = false; cop.driver = 'cop';
    state.cars.push(cop); state.cops.push({ x: cop.x, y: cop.y, angle: Math.PI, hp: 60, car: cop, speed: 0 });
  }
  // Drive the scene forward a fixed number of steps so traffic/peds/cops are mid-action.
  input.up = true;
  for (let i = 0; i < 90; i++) stepGame(state, input, 1 / 60);
  input.up = false;
  // Park the pursuit right behind the player so the chase reads in-frame:
  // cop cars 190px and 320px back along the player's heading, matching speed.
  const pa = state.player.inCar ? state.player.inCar.angle : 0;
  let ci = 0;
  for (const cop of state.cops) {
    if (!cop.car) continue;
    const back = 190 + ci * 130; ci++;
    cop.car.x = state.player.x - Math.cos(pa) * back;
    cop.car.y = state.player.y - Math.sin(pa) * back;
    cop.car.angle = pa; cop.car.speed = 380;
    cop.x = cop.car.x; cop.y = cop.car.y; cop.angle = pa;
  }
  // Re-centre on the player exactly (the autopilot may have drifted off-road).
  state.camera.x = state.player.x; state.camera.y = state.player.y;
  state.screen = 'shot';
  return state;
}
export function shotNames() { return Object.keys(SHOTS); }
