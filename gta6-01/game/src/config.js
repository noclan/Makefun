// SOLMAR tuning: one place for every number the game balances on.
export const CFG = {
  world: 3400, seaX: 260, beachX: 360, roadGap: 340, roadW: 64,
  step: 1 / 60, walkSpeed: 205, runSpeed: 320, punchRange: 34,
  playerRadius: 13, pedRadius: 11, carW: 30, carL: 56,
  maxWanted: 5, resprayCost: 150, resprayClear: 2,
  startCash: 120, startHealth: 100, startArmor: 0, startAmmo: 24,
  dayLength: 420, // seconds for a full golden-hour -> dawn cycle
  colors: {
    sand: '#e8c98f', sea: '#2f8fa8', seaDeep: '#1d6d84', grass: '#7fae5a',
    road: '#3a3a42', roadLine: '#e8d27a', sidewalk: '#b9ac93',
    downtown: '#c98f4e', beachfront: '#e8b48a', oldtown: '#d9a05b', marina: '#8fc3c9',
    hudBg: 'rgba(12,14,22,0.62)', gold: '#ffc94d', coral: '#ff7a5c', teal: '#37c8b0',
  },
  keys: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] },
};
export const CAR_TYPES = {
  sedan:  { name: 'Solmar Sedan',  color: '#c94f43', top: 430, accel: 300, grip: 2.6, hp: 100, price: 0 },
  taxi:   { name: 'Bay Taxi',      color: '#f2c230', top: 400, accel: 280, grip: 2.5, hp: 90,  price: 0 },
  sports: { name: 'Vela GT',       color: '#e83e8c', top: 620, accel: 460, grip: 3.4, hp: 80,  price: 0 },
  van:    { name: 'Luna Van',      color: '#5b8fd6', top: 340, accel: 220, grip: 2.0, hp: 140, price: 0 },
  cop:    { name: 'Solmar Patrol', color: '#2b3a55', top: 520, accel: 380, grip: 3.1, hp: 120, price: 0 },
  pickup: { name: 'Duna Pickup',   color: '#7a9a4d', top: 460, accel: 320, grip: 2.7, hp: 110, price: 0 },
};
export const DISTRICTS = [
  { name: 'Downtown', x0: 1300, y0: 300, x1: 2500, y1: 1500, tint: '#c98f4e', tall: true },
  { name: 'Beachfront', x0: 360, y0: 300, x1: 1300, y1: 1700, tint: '#e8b48a', tall: false },
  { name: 'Old Town', x0: 1300, y0: 1500, x1: 2500, y1: 2600, tint: '#d9a05b', tall: false },
  { name: 'Marina', x0: 360, y0: 1700, x1: 2500, y1: 3100, tint: '#8fc3c9', tall: false },
];
export const MISSION_DEFS = [
  { id: 1, title: 'Welcome Home, Rico', kind: 'drive', reward: 200, text: 'Mama Rosa needs flour from the market. Drive to the gold marker.' },
  { id: 2, title: 'The Pickup', kind: 'pickup', reward: 350, text: 'Pick up Cousin Leo at the marina and bring him to Café Luna.' },
  { id: 3, title: 'Keep Your Distance', kind: 'tail', reward: 450, text: 'Tail the Varela courier. Stay close, but do not get spotted.' },
  { id: 4, title: 'Hot Wheels', kind: 'escape', reward: 600, text: 'The cops are on you. Lose 3 stars, then reach the respray shop.' },
  { id: 5, title: 'The Delivery', kind: 'deliver', reward: 750, text: 'Deliver Rosa\'s package across town before the clock runs out.' },
  { id: 6, title: 'Streets of Gold', kind: 'heist', reward: 1500, text: 'Final job: outrun the whole Varela crew to the bridge. Make Mama Rosa proud.' },
];
