// Vega Auto Garage: car customization. Drive in and spend cash on
// paint, wheels, engine work, and armor plating. Upgrades live on the
// player's garage record and apply to whatever car Rico is driving —
// a tuned engine means a higher top speed, better wheels mean more
// grip in the corners, plating means the car takes more punishment.
// Paint is pure Solmar style, and style counts for something here.

export const GARAGE_SPOT = { x: 2380, y: 2040, w: 170, h: 120, label: 'VEGA AUTO' };

export const PAINTS = [
  { id: 'gold', name: 'Streets Gold', color: '#ffd23e', price: 200 },
  { id: 'coral', name: 'Sunset Coral', color: '#ff7a5c', price: 200 },
  { id: 'teal', name: 'Marina Teal', color: '#37c8b0', price: 200 },
  { id: 'midnight', name: 'Midnight Violet', color: '#7a2a8a', price: 350 },
];

export const UPGRADES = [
  { id: 'engine1', name: 'Engine tune I', price: 600, kind: 'engine', level: 1 },
  { id: 'engine2', name: 'Engine tune II', price: 1400, kind: 'engine', level: 2 },
  { id: 'engine3', name: 'Engine tune III', price: 2600, kind: 'engine', level: 3 },
  { id: 'wheels1', name: 'Sport wheels I', price: 500, kind: 'wheels', level: 1 },
  { id: 'wheels2', name: 'Sport wheels II', price: 1100, kind: 'wheels', level: 2 },
  { id: 'armor1', name: 'Plating I', price: 700, kind: 'armor', level: 1 },
  { id: 'armor2', name: 'Plating II', price: 1500, kind: 'armor', level: 2 },
];

export function ensureCustoms(state) {
  const d = state.depth;
  if (!d.customs) d.customs = { paint: null, engine: 0, wheels: 0, armor: 0, spent: 0 };
  return d.customs;
}

export function nearGarage(state) {
  const p = state.player;
  const dx = p.x - (GARAGE_SPOT.x + GARAGE_SPOT.w / 2);
  const dy = p.y - (GARAGE_SPOT.y + GARAGE_SPOT.h / 2);
  return dx * dx + dy * dy < 140 * 140;
}

export function paintCar(state, paintId) {
  const c = ensureCustoms(state);
  const paint = PAINTS.find((x) => x.id === paintId);
  if (!paint) return { ok: false, reason: 'no such paint' };
  if (state.player.cash < paint.price) return { ok: false, reason: `${paint.name} costs $${paint.price}` };
  state.player.cash -= paint.price;
  c.paint = paint.id;
  c.spent += paint.price;
  const car = state.player.inCar;
  if (car) car.color = paint.color;
  state.events.push({ kind: 'paint', id: paint.id });
  return { ok: true, line: `Painted ${paint.name}. Looking sharp, Rico.` };
}

export function buyUpgrade(state, upgradeId) {
  const c = ensureCustoms(state);
  const up = UPGRADES.find((x) => x.id === upgradeId);
  if (!up) return { ok: false, reason: 'no such upgrade' };
  if (c[up.kind] >= up.level) return { ok: false, reason: `already at ${up.kind} level ${c[up.kind]}` };
  if (c[up.kind] !== up.level - 1) return { ok: false, reason: `buy ${up.kind} level ${up.level - 1} first` };
  if (state.player.cash < up.price) return { ok: false, reason: `${up.name} costs $${up.price}` };
  state.player.cash -= up.price;
  c[up.kind] = up.level;
  c.spent += up.price;
  applyCustomsToCar(state, state.player.inCar);
  state.events.push({ kind: 'upgrade', id: up.id });
  return { ok: true, line: `${up.name} fitted.` };
}

// Re-apply the garage record to a car: engine raises top speed and
// acceleration, wheels raise grip, plating raises max health.
export function applyCustomsToCar(state, car) {
  if (!car) return;
  const c = ensureCustoms(state);
  const base = { top: car.top, accel: car.accel, grip: car.grip };
  if (car._baseTop === undefined) { car._baseTop = car.top; car._baseAccel = car.accel; car._baseGrip = car.grip; car._baseHp = car.maxHp; }
  car.top = Math.round(car._baseTop * (1 + 0.12 * c.engine));
  car.accel = Math.round(car._baseAccel * (1 + 0.12 * c.engine));
  car.grip = Math.round(car._baseGrip * (1 + 0.1 * c.wheels) * 10) / 10;
  car.maxHp = Math.round(car._baseHp * (1 + 0.25 * c.armor));
  car.hp = Math.min(car.maxHp, car.hp + Math.round(car._baseHp * 0.25 * c.armor));
  void base;
}

export function stepCustoms(state, dt) {
  void dt;
  const car = state.player.inCar;
  if (car && car._customsApplied !== true) {
    applyCustomsToCar(state, car);
    car._customsApplied = true;
  }
}

export function customsSummary(state) {
  const c = ensureCustoms(state);
  return `Garage: paint ${c.paint || 'stock'}, engine ${c.engine}, wheels ${c.wheels}, armor ${c.armor}, $${c.spent} spent`;
}
