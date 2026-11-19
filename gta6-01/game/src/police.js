// Wanted 0-5 stars: cop spawning, chase AI, busted/wasted, decay, respray.
import { CFG } from './config.js';
import { makeCar } from './vehicles.js';
import { clamp, angleDiff } from './random.js';

export function addWanted(state, n) { state.wanted = clamp(state.wanted + n, 0, CFG.maxWanted); }
export function stepPolice(state, dt) {
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
  // Decay when the player is far from every cop and out of a car chase.
  state.wantedTimer -= dt;
  if (state.wanted > 0 && state.cops.length === 0 && state.wantedTimer <= 0) {
    state.wanted = Math.max(0, state.wanted - 1); state.wantedTimer = 14;
  }
  // Spawn cops up to the wanted level (cars at 2+, on foot below).
  const wantCars = state.wanted >= 2 ? Math.min(3, state.wanted - 1) : 0;
  const wantFoot = state.wanted >= 1 ? Math.min(2, state.wanted) : 0;
  while (state.cops.length < wantFoot + wantCars) {
    const inCar = state.cops.filter(c => c.car).length < wantCars;
    const ang = (state.rng || Math.random)() * Math.PI * 2;
    const cx = px + Math.cos(ang) * 420, cy = py + Math.sin(ang) * 420;
    if (inCar) {
      const car = makeCar('cop', cx, cy, 0); car.parked = false; car.driver = 'cop';
      state.cars.push(car);
      state.cops.push({ x: cx, y: cy, angle: 0, hp: 60, car, speed: 0 });
    } else {
      state.cops.push({ x: cx, y: cy, angle: 0, hp: 60, car: null, speed: 0 });
    }
  }
  while (state.cops.length > wantFoot + wantCars) state.cops.pop();
  for (const cop of state.cops) {
    const d = Math.hypot(px - cop.x, py - cop.y);
    if (cop.car) {
      const target = Math.atan2(py - cop.y, px - cop.x);
      cop.car.angle += clamp(angleDiff(cop.car.angle, target), -2.4 * dt, 2.4 * dt);
      const sp = d > 90 ? 470 : 300;
      cop.car.speed += clamp(sp - cop.car.speed, -400 * dt, 320 * dt);
      cop.car.x += Math.cos(cop.car.angle) * cop.car.speed * dt;
      cop.car.y += Math.sin(cop.car.angle) * cop.car.speed * dt;
      cop.x = cop.car.x; cop.y = cop.car.y; cop.angle = cop.car.angle;
      cop.ramCd = Math.max(0, (cop.ramCd || 0) - dt);
      if (d < 46 && p.inCar && cop.ramCd <= 0) { cop.ramCd = 0.8; p.inCar.speed *= 0.6; p.inCar.hp -= 2; state.shake = Math.max(state.shake, 5); }
    } else {
      cop.angle = Math.atan2(py - cop.y, px - cop.x);
      const sp = d > 60 ? 190 : 120;
      cop.x += Math.cos(cop.angle) * sp * dt; cop.y += Math.sin(cop.angle) * sp * dt;
      if (d < 26 && !p.inCar && p.speed < 60) {
        state.screen = 'busted'; state.events.push({ kind: 'busted' });
      }
      cop.bangCd = Math.max(0, (cop.bangCd || 0) - dt);
      if (d < 30 && p.inCar && cop.bangCd <= 0) { cop.bangCd = 0.8; p.inCar.hp -= 1; }
    }
  }
  // Respray shop: clears stars for cash when the player drives through it.
  const r = state.world.respray;
  if (p.inCar && p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h && state.wanted > 0 && p.cash >= CFG.resprayCost) {
    p.cash -= CFG.resprayCost; state.wanted = Math.max(0, state.wanted - CFG.resprayClear);
    state.cops.length = 0; state.events.push({ kind: 'respray' });
  }
}
