// Traffic: cars that follow the road grid, turn at intersections, slow for
// the car ahead and get out of the way — loosely. They keep the city alive
// and give the player something to weave through.

import { CAR_TYPES, WORLD } from './config.js';
import { chance, pick, range } from './random.js';
import { collideCarWithBuildings, makeCar, stepCar } from './vehicles.js';
import { nearestRoadPoint, onRoad } from './world.js';

function randomRoadCar(rng, city, nearX, nearY) {
  const line = pick(rng, city.lines);
  const along = range(rng, 200, WORLD.size - 200);
  const vertical = chance(rng, 0.5);
  const x = vertical ? line : along;
  const y = vertical ? along : line;
  const angle = vertical ? (chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2) : (chance(rng, 0.5) ? 0 : Math.PI);
  const type = pick(rng, ['sedan', 'sedan', 'taxi', 'van', 'sports']);
  const car = makeCar(rng, type, x, y, angle);
  car.driver = 'traffic';
  // Each traffic car has a cruising speed and a lane offset so the road
  // does not look like a parade.
  car.cruise = CAR_TYPES[type].top * range(rng, 0.45, 0.65);
  car.lane = (chance(rng, 0.5) ? 1 : -1) * 14;
  car.turnAt = null;
  return car;
}

export function spawnTraffic(rng, city, count, nearX, nearY) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard < count * 30) {
    guard += 1;
    const car = randomRoadCar(rng, city, nearX, nearY);
    if (Math.hypot(car.x - nearX, car.y - nearY) < 320) continue;
    if (car.y > WORLD.beachTop) continue;
    cars.push(car);
  }
  return cars;
}

// Steer a traffic car along its road: aim at a point ahead on the centreline
// (shifted by its lane), and at an intersection sometimes pick a new road.
export function trafficSteer(rng, car, dt) {
  const ahead = 90;
  const tx = car.x + Math.cos(car.angle) * ahead;
  const ty = car.y + Math.sin(car.angle) * ahead;
  const road = nearestRoadPoint(tx, ty);
  // Lane offset: keep right of the centreline in the direction of travel.
  const sideX = Math.cos(car.angle + Math.PI / 2) * car.lane;
  const sideY = Math.sin(car.angle + Math.PI / 2) * car.lane;
  const want = Math.atan2(road.y + sideY - car.y, road.x + sideX - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.max(-1, Math.min(1, diff * 2.2));
}

function carAhead(g, car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let closest = Infinity;
  for (const other of g.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 0 || along > 110) continue;
    const across = Math.abs(dx * -fy + dy * fx);
    if (across < 30 && along < closest) closest = along;
  }
  return closest;
}

export function stepTraffic(g, dt) {
  const rng = g.rng;
  for (const car of g.cars) {
    if (car.driver !== 'traffic') continue;
    const steer = trafficSteer(rng, car, dt);
    const gap = carAhead(g, car);
    let throttle = 1;
    if (gap < 70) throttle = 0;
    else if (gap < 120) throttle = 0.3;
    // Match the cruise speed: ease off the gas once there.
    if (Math.abs(car.speed) > car.cruise) throttle = Math.min(throttle, 0);
    stepCar(car, throttle, steer, dt, g.effects);
    collideCarWithBuildings(g.city, car, g.effects);
    // A traffic car that ends up far off-road or beached gets towed back to
    // a road so the grid never empties out.
    if (!onRoad(car.x, car.y) && Math.abs(car.speed) < 20) {
      const road = nearestRoadPoint(car.x, car.y);
      car.x = road.x;
      car.y = road.y;
    }
  }
  // Top the traffic back up near the player so the streets stay busy.
  const near = g.cars.filter((c) => c.driver === 'traffic' && Math.hypot(c.x - g.player.x, c.y - g.player.y) < 900).length;
  if (near < 8 && rng() < 0.02) {
    const fresh = randomRoadCar(rng, g.city, g.player.x, g.player.y);
    if (Math.hypot(fresh.x - g.player.x, fresh.y - g.player.y) > 500) {
      g.cars.push(fresh);
    }
  }
}
