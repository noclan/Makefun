// Rico Vega on foot: move, run, punch, enter/exit cars.
import { CFG } from './config.js';
import { collideCircle } from './world.js';
import { nearestCar } from './vehicles.js';
import { clamp } from './random.js';

export function makePlayer(x, y) {
  return { x, y, angle: -Math.PI / 2, speed: 0, health: CFG.startHealth, armor: CFG.startArmor, ammo: CFG.startAmmo, cash: CFG.startCash, inCar: null, punchCd: 0, hurtCd: 0, facing: -Math.PI / 2 };
}
export function stepPlayer(state, input, dt) {
  const p = state.player;
  p.punchCd = Math.max(0, p.punchCd - dt); p.hurtCd = Math.max(0, p.hurtCd - dt);
  if (p.inCar) return;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len; my /= len;
    const sp = input.run ? CFG.runSpeed : CFG.walkSpeed;
    const pos = collideCircle(state.world, p.x + mx * sp * dt, p.y + my * sp * dt, CFG.playerRadius);
    p.x = pos.x; p.y = pos.y; p.facing = Math.atan2(my, mx); p.speed = sp;
  } else p.speed = 0;
  if (input.punch && p.punchCd <= 0) {
    p.punchCd = 0.45; state.events.push({ kind: 'punch', x: p.x, y: p.y });
    // Punch the nearest pedestrian or cop within reach.
    for (const ped of state.peds) {
      if (Math.hypot(ped.x - p.x, ped.y - p.y) < CFG.punchRange) { ped.flee = 3; ped.hp -= 20; state.events.push({ kind: 'hit', x: ped.x, y: ped.y }); }
    }
    for (const cop of state.cops) {
      if (Math.hypot(cop.x - p.x, cop.y - p.y) < CFG.punchRange) { cop.hp -= 25; state.wanted = clamp(state.wanted + 1, 0, 5); }
    }
  }
}
export function tryEnterCar(state, input) {
  const p = state.player;
  if (p.inCar) {
    // Exit: step out to the side of the car.
    const c = p.inCar; p.inCar = null;
    p.x = c.x - Math.sin(c.angle) * 34; p.y = c.y + Math.cos(c.angle) * 34;
    c.parked = true; c.speed = 0;
    return 'exit';
  }
  const car = nearestCar(state.cars, p.x, p.y, 72);
  if (!car) return null;
  if (car.driver === 'cop') state.wanted = clamp(state.wanted + 1, 0, 5);
  else if (car.parked === false || car.type !== 'sedan') { /* stealing a driven car */ }
  if (car.parked) state.wanted = clamp(state.wanted + (car.type === 'cop' ? 2 : 1), 0, 5);
  car.parked = false; car.driver = 'player'; p.inCar = car;
  p.x = car.x; p.y = car.y;
  state.events.push({ kind: 'enter-car', type: car.type });
  return car.type;
}
export function hurtPlayer(state, dmg) {
  const p = state.player;
  if (p.hurtCd > 0) return;
  p.hurtCd = 0.5;
  const absorbed = Math.min(p.armor, dmg);
  p.armor -= absorbed; p.health -= (dmg - absorbed);
  if (p.health <= 0) { p.health = 0; state.screen = 'wasted'; state.events.push({ kind: 'wasted' }); }
}
