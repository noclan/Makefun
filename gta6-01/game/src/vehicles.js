// Cars: their types, arcade driving physics, damage and smoke, and the
// parked cars scattered around the city waiting to be stolen. A car is a
// small record — type, position, heading, speed — and stepCar advances one
// fixed step from driver input (throttle -1..1, steer -1..1).

import { CAR_TYPES, WORLD } from './config.js';
import { chance, pick, range } from './random.js';
import { collideBuildings, onRoad } from './world.js';

let nextCarId = 1;

export function makeCar(rng, type, x, y, angle) {
  const spec = CAR_TYPES[type];
  return {
    id: nextCarId,
    type,
    name: spec.name,
    color: type === 'sedan' || type === 'van' ? pick(rng, ['#c94f43', '#4a7fb8', '#e8e0c8', '#3f8f7b', '#8a6fb8']) : spec.color,
    roof: spec.roof,
    x, y,
    angle,
    speed: 0,
    damage: 0,
    smoke: 0,
    driver: null, // 'player' | 'traffic' | 'cop' | null (parked)
    wanted: false,
  };
}

export function resetCarIds() {
  nextCarId = 1;
}

// Arcade driving: accelerate along the heading, steer harder the faster
// the car goes (up to a point), bleed speed sideways with grip, and slow
// down off-road and on sand. Returns nothing; the car record is mutated.
export function stepCar(car, throttle, steer, dt, effects) {
  const spec = CAR_TYPES[car.type];
  const forward = car.speed >= 0 ? 1 : -1;
  const top = car.speed >= 0 ? spec.top : spec.reverse;

  car.speed += throttle * spec.accel * dt;
  if (car.speed > spec.top) car.speed = spec.top;
  if (car.speed < -spec.reverse) car.speed = -spec.reverse;
  // Rolling resistance + a little brake drag when nobody touches the pedals.
  car.speed -= car.speed * 0.35 * dt;
  if (throttle === 0 && Math.abs(car.speed) < 12) car.speed = 0;

  const steerPower = spec.turn * Math.min(1, Math.abs(car.speed) / 160) * (1.15 - 0.45 * Math.min(1, Math.abs(car.speed) / spec.top)) * forward;
  car.angle += steer * steerPower * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx;
  car.y = ny;

  // The city ends at the sea and the hills: a car cannot leave the world.
  if (car.x < 24 || car.x > WORLD.size - 24 || car.y < 24 || car.y > WORLD.size - 24) {
    car.x = Math.max(24, Math.min(WORLD.size - 24, car.x));
    car.y = Math.max(24, Math.min(WORLD.size - 24, car.y));
    car.speed *= 0.3;
  }

  // Off-road and sand drag: a getaway through the park is possible, just slow.
  if (!onRoad(car.x, car.y)) car.speed *= 1 - 0.5 * dt;
  if (car.y > WORLD.beachTop && car.y < WORLD.seaTop) car.speed *= 1 - 0.8 * dt;

  // Skid marks when the car is turning hard at speed.
  if (effects && Math.abs(steer) > 0.6 && Math.abs(car.speed) > 260) {
    effects.skidMark(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, car.angle, 14);
  }
  // A battered car smokes; a wrecked one crawls.
  if (car.damage > 60 && effects && Math.abs(car.speed) > 40) {
    car.smoke += dt;
    if (car.smoke > 0.25) {
      car.smoke = 0;
      effects.smoke(car.x, car.y - 6);
    }
  }
  if (car.damage >= 100) car.speed *= 1 - 2 * dt;
}

export function collideCarWithBuildings(city, car, effects) {
  const body = { x: car.x, y: car.y, radius: 17 };
  if (!collideBuildings(city, body)) return false;
  const hitSpeed = Math.abs(car.speed);
  car.x = body.x;
  car.y = body.y;
  if (hitSpeed > 120) {
    car.speed *= -0.3;
    car.damage += hitSpeed / 22;
    if (effects) {
      effects.sparks(car.x, car.y);
      effects.shake(Math.min(0.5, hitSpeed / 1400));
    }
    return true;
  }
  car.speed *= 0.4;
  return true;
}

// Scatter parked cars along the roads, close to the kerb, for the player
// to steal. Never on the beach, never in the sea, never inside a building.
export function spawnParkedCars(rng, city, count) {
  const cars = [];
  const types = ['sedan', 'sedan', 'taxi', 'van', 'sports'];
  let guard = 0;
  while (cars.length < count && guard < count * 40) {
    guard += 1;
    const vertical = chance(rng, 0.5);
    const line = city.lines[Math.floor(rng() * city.lines.length)];
    const along = range(rng, 240, WORLD.size - 240);
    const off = (chance(rng, 0.5) ? 1 : -1) * 22;
    const x = vertical ? line + off : along;
    const y = vertical ? along : line + off;
    const angle = vertical ? (off > 0 ? Math.PI / 2 : -Math.PI / 2) : (off > 0 ? 0 : Math.PI);
    if (y > WORLD.beachTop) continue;
    if (x > WORLD.marina.x0 && y > WORLD.marina.y0 && y < WORLD.marina.y1) continue;
    const body = { x, y, radius: 20 };
    if (collideBuildings(city, body)) continue;
    cars.push(makeCar(rng, pick(rng, types), x, y, angle));
  }
  return cars;
}
