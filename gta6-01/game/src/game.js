// createGame / stepGame: the state API the browser loop and the playtest import.
import { CFG } from './config.js';
import { generateWorld } from './world.js';
import { makePlayer, stepPlayer, tryEnterCar } from './player.js';
import { spawnParkedCars, driveCar } from './vehicles.js';
import { spawnTraffic, stepTraffic } from './traffic.js';
import { spawnPeds, stepPeds } from './pedestrians.js';
import { stepPolice } from './police.js';
import { spawnPickups, stepCombat } from './combat.js';
import { stepMissions, startMission } from './missions.js';
import { initDepth, stepDepth, saveDepth, loadDepth } from './depth.js';
import { stepParticles, burst, addSkid, makeParticles } from './particles.js';
import { stepClock, phaseAt } from './dayphase.js';
import { createInput, wasPressed } from './input.js';
import { makeRng } from './random.js';

export function createGame(seed = 7) {
  const world = generateWorld(seed);
  const state = {
    seed, world, screen: 'title', elapsed: 0, clock: 17.2, phase: phaseAt(17.2),
    player: makePlayer(765, 1980), cars: [], traffic: [], peds: [], cops: [],
    bullets: [], pickups: [], events: [], particles: makeParticles(),
    wanted: 0, wantedTimer: 10, shake: 0, muzzle: 0, shootCd: 0, copShootCd: 0,
    mission: null, completed: [], nextMission: 1, dialogue: null, aimAngle: null,
    camera: { x: 765, y: 1980 }, score: 0, respect: 0, rng: makeRng(seed * 1000 + 13),
  };
  state.cars = spawnParkedCars(world, seed, 26);
  state.traffic = spawnTraffic(world, seed, 14);
  state.peds = spawnPeds(world, seed, 22);
  state.pickups = spawnPickups(world, seed);
  initDepth(state);
  // Rico starts beside a sedan at Café Luna.
  const starter = state.cars[0]; starter.x = 820; starter.y = 1980; starter.angle = 0;
  return state;
}
export function stepGame(state, input, dt = CFG.step) {
  state.events.length = 0;
  if (state.screen !== 'play' && state.screen !== 'shot') return state;
  stepClock(state, dt);
  if (state.dialogue) { state.dialogue.t -= dt; if (state.dialogue.t <= 0) state.dialogue = null; }
  if (wasPressed(input, 'action')) {
    const got = tryEnterCar(state, input);
    if (got) state.events.push({ kind: 'enter', what: got });
  }
  stepPlayer(state, input, dt);
  const p = state.player;
  if (p.inCar) {
    driveCar(p.inCar, input, dt, state.world, (sp) => {
      state.events.push({ kind: 'crash', speed: sp }); burst(state, p.inCar.x, p.inCar.y, '#ffb347', 12, 220); state.shake = Math.max(state.shake, 6);
    });
    p.x = p.inCar.x; p.y = p.inCar.y; p.facing = p.inCar.angle;
    if (p.inCar.skid > 0) addSkid(state, p.inCar.x, p.inCar.y, p.inCar.angle);
    if (p.inCar.hp <= 0) { p.inCar.hp = 0; burst(state, p.x, p.y, '#ff5a3c', 26, 300); p.inCar = null; state.wanted = Math.min(5, state.wanted + 1); }
  }
  stepTraffic(state, dt);
  stepPeds(state, dt);
  stepPolice(state, dt);
  stepCombat(state, input, dt);
  stepMissions(state, dt);
  stepDepth(state, input, dt);
  stepParticles(state, dt);
  if (state.mission && state.mission.failed) { state.mission = null; }
  // Camera follows the player with a look-ahead in the direction of travel.
  const lx = p.inCar ? Math.cos(p.inCar.angle) * Math.min(90, Math.abs(p.inCar.speed) * 0.22) : Math.cos(p.facing) * 26;
  const ly = p.inCar ? Math.sin(p.inCar.angle) * Math.min(90, Math.abs(p.inCar.speed) * 0.22) : Math.sin(p.facing) * 26;
  state.camera.x += ((p.x + lx) - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += ((p.y + ly) - state.camera.y) * Math.min(1, dt * 5);
  return state;
}
export function startNewGame(state) {
  state.screen = 'play';
  if (!state.mission && state.nextMission) startMission(state, state.nextMission);
  return state;
}
export function saveState(state) {
  try {
    const data = { cash: state.player.cash, completed: state.completed, nextMission: state.nextMission, clock: state.clock, health: state.player.health, respect: state.respect, depth: saveDepth(state) };
    if (typeof localStorage !== 'undefined') localStorage.setItem('solmar-save', JSON.stringify(data));
    return JSON.stringify(data);
  } catch { return null; }
}
export function loadState(state) {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('solmar-save') : null;
    if (!raw) return false;
    const d = JSON.parse(raw);
    state.player.cash = d.cash; state.completed = d.completed || []; state.nextMission = d.nextMission || 1; state.clock = d.clock || 17.2; state.player.health = d.health || 100;
    if (d.respect !== undefined) state.respect = d.respect;
    if (d.depth) loadDepth(state, d.depth);
    return true;
  } catch { return false; }
}
export { createInput };
