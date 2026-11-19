// More car variety: six extra models parked around the districts —
// a convertible on the beachfront, a muscle car downtown, a limo by
// the casino, a hatchback in Old Town, a pickup by the marina and a
// heavy truck at the port. Each has its own colour and handling, and
// the traffic fleet gets a fresh coat of paint too.

export const EXTRA_MODELS = [
  { type: 'convertible', name: 'Sol Convertible', color: '#ff9a3c', top: 540, accel: 400, grip: 3.0, hp: 80, x: 700, y: 680 },
  { type: 'muscle', name: 'Bay Muscle', color: '#3c2a4d', top: 580, accel: 480, grip: 2.4, hp: 110, x: 2040, y: 1020 },
  { type: 'limo', name: 'Gold Limo', color: '#222222', top: 380, accel: 240, grip: 2.2, hp: 160, x: 1700, y: 1700 },
  { type: 'hatchback', name: 'Palm Hatch', color: '#37c8b0', top: 450, accel: 330, grip: 3.2, hp: 85, x: 1700, y: 2380 },
  { type: 'pickup2', name: 'Dune Runner', color: '#c9a13a', top: 470, accel: 330, grip: 2.7, hp: 120, x: 1020, y: 2720 },
  { type: 'truck', name: 'Port Hauler', color: '#5a6a7a', top: 320, accel: 200, grip: 1.9, hp: 200, x: 2720, y: 3050 },
];
const TRAFFIC_PAINT = ['#ff9a3c', '#37c8b0', '#c9a13a', '#7a5cff', '#e8b48a', '#4db2ff'];

export function ensureCarVariety(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.carvariety) {
    state.depth.carvariety = { added: true };
    for (const m of EXTRA_MODELS) {
      state.cars.push({
        type: m.type, name: m.name, color: m.color,
        x: m.x, y: m.y, angle: 0, speed: 0,
        hp: m.hp, maxHp: m.hp, top: m.top, accel: m.accel, grip: m.grip,
        smoke: 0, parked: true, driver: null, skid: 0,
      });
    }
    for (let i = 0; i < state.traffic.length; i++) {
      state.traffic[i].color = TRAFFIC_PAINT[i % TRAFFIC_PAINT.length];
    }
  }
  return state.depth.carvariety;
}

export function stepCarVariety(state, dt) {
  ensureCarVariety(state);
  void dt;
}
