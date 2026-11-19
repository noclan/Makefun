// Car types, driving physics, damage, parked-car spawning.
import { CFG, CAR_TYPES } from './config.js';
import { makeRng, rngPick, rngRange, clamp, angleDiff } from './random.js';
import { solidAt, isRoad, randomRoadSpot } from './world.js';

export function makeCar(type, x, y, angle = 0) {
  const t = CAR_TYPES[type] || CAR_TYPES.sedan;
  return { type, name: t.name, color: t.color, x, y, angle, speed: 0, hp: t.hp, maxHp: t.hp, top: t.top, accel: t.accel, grip: t.grip, smoke: 0, parked: true, driver: null, skid: 0 };
}
export function spawnParkedCars(world, seed, count = 26) {
  const rng = makeRng(seed + 77);
  const cars = [];
  const types = ['sedan', 'taxi', 'sports', 'van', 'pickup'];
  for (let i = 0; i < count; i++) {
    const s = randomRoadSpot(rng, world);
    const horiz = rng() < 0.5;
    cars.push(makeCar(rngPick(rng, types), s.x + (horiz ? 0 : rngRange(rng, -14, 14)), s.y + (horiz ? rngRange(rng, -14, 14) : 0), horiz ? 0 : Math.PI / 2));
  }
  return cars;
}
export function driveCar(car, input, dt, world, onCrash) {
  const t = CAR_TYPES[car.type];
  const fwd = input.up ? 1 : input.down ? -0.55 : 0;
  car.speed += fwd * car.accel * dt;
  car.speed -= car.speed * 0.55 * dt; // rolling drag
  if (!input.up && !input.down) car.speed -= car.speed * 1.4 * dt;
  car.speed = clamp(car.speed, -car.top * 0.45, car.top);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * car.grip * dt * clamp(Math.abs(car.speed) / 140, 0, 1) * dir;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (solidAt(world, nx, ny)) {
    // Only a real impact damages the car; nudging a wall at crawl speed just stops it.
    if (Math.abs(car.speed) > 200) {
      if (onCrash) onCrash(Math.abs(car.speed));
      car.hp -= (Math.abs(car.speed) - 200) * 0.02;
      car.speed *= -0.25;
    } else car.speed = 0;
  } else { car.x = nx; car.y = ny; }
  if (Math.abs(steer) > 0 && Math.abs(car.speed) > 260) car.skid = 0.12; else car.skid = Math.max(0, car.skid - dt);
  if (car.hp < 40) car.smoke = Math.min(1, car.smoke + dt * 0.5);
  return car;
}
export function carCorners(car) {
  const c = Math.cos(car.angle), s = Math.sin(car.angle), L = CFG.carL / 2, W = CFG.carW / 2;
  return [
    { x: car.x + c * L - s * W, y: car.y + s * L + c * W },
    { x: car.x + c * L + s * W, y: car.y + s * L - c * W },
    { x: car.x - c * L - s * W, y: car.y - s * L + c * W },
    { x: car.x - c * L + s * W, y: car.y - s * L - c * W },
  ];
}
export function carsOverlap(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy < (CFG.carL * 0.8) * (CFG.carL * 0.8);
}
export function nearestCar(cars, x, y, maxD = 70) {
  let best = null, bd = maxD * maxD;
  for (const c of cars) { const d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; best = c; } }
  return best;
}
