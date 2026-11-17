// SOLMAR — every tuning number, colour and car spec in one place.
// The world is a fixed 3200x3200 coastal city; the camera shows a 1280x720
// window of it, so nothing below depends on the screen size.

export const STEP = 1 / 60;

export const WORLD = {
  size: 3200,
  roadGap: 320, // distance between road centrelines
  roadWidth: 64,
  firstRoad: 160, // centreline of the first road
  beachTop: 2880, // sand starts here
  seaTop: 3040, // water starts here
  marina: { x0: 2960, y0: 1320, x1: 3200, y1: 2240 }, // bay on the east edge
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  runSpeed: 265,
  health: 100,
  armor: 50,
  punchDamage: 25,
  punchRange: 34,
  punchCooldown: 0.45,
};

// Car handling, one row per type. Cop cars are only obtainable by stealing
// one from the police, which is exactly the point.
export const CAR_TYPES = {
  sedan: { name: 'Solmar Sedan', color: '#c94f43', roof: '#8e2f26', accel: 420, top: 520, reverse: 190, turn: 2.5, length: 46, width: 22, grip: 0.86 },
  taxi: { name: 'Bay Taxi', color: '#f2b705', roof: '#f2b705', accel: 400, top: 500, reverse: 180, turn: 2.5, length: 46, width: 22, grip: 0.86, taxi: true },
  sports: { name: 'Veloce GT', color: '#e8316b', roof: '#7d1038', accel: 620, top: 760, reverse: 220, turn: 3.1, length: 48, width: 22, grip: 0.93 },
  van: { name: 'Surf Van', color: '#3f8f7b', roof: '#e8e0c8', accel: 300, top: 400, reverse: 150, turn: 2.0, length: 54, width: 24, grip: 0.8 },
  cop: { name: 'Solmar PD Cruiser', color: '#e8e8e8', roof: '#1d3557', accel: 560, top: 680, reverse: 210, turn: 2.9, length: 48, width: 22, grip: 0.9, cop: true },
};

export const TRAFFIC_COUNT = 16;
export const PED_COUNT = 26;

export const WANTED = {
  stealCar: 18,
  hitPed: 22,
  shoot: 12,
  hitCop: 30,
  crash: 6,
  decayPerSecond: 5,
  decayDelay: 4, // seconds with no cop near before heat starts falling
};

export const PISTOL = {
  ammoStart: 12,
  ammoMax: 48,
  bulletSpeed: 760,
  bulletRange: 460,
  damage: 34,
  fireCooldown: 0.28,
};

export const PALETTE = {
  grass: '#7fae62',
  grassDark: '#6d9c52',
  sand: '#e8cf9a',
  sea: '#2a7f9e',
  seaDeep: '#1d5f7a',
  road: '#3a3a42',
  roadEdge: '#2c2c33',
  sidewalk: '#b8ab8d',
  lane: '#d8c95a',
  crosswalk: '#e8e4d8',
  park: '#5d8f4e',
  text: '#f5efe0',
  muted: '#c9bfa8',
  gold: '#f2c94c',
  coral: '#e86a5a',
  teal: '#2ec4b6',
  panel: 'rgba(20, 18, 28, 0.88)',
  panelEdge: '#f2c94c',
};

export const DISTRICTS = {
  downtown: { name: 'Downtown', palette: ['#c96f4a', '#8a6fb8', '#4a7fb8', '#b84a6e'], tall: true },
  oldtown: { name: 'Old Town', palette: ['#e8a34c', '#d97b5f', '#e8c96a', '#b85c48'], tall: false },
  beachfront: { name: 'Beachfront', palette: ['#f2b8a0', '#f28ba0', '#ffd166', '#7fd1c0'], tall: false },
  marina: { name: 'Marina', palette: ['#7a8a99', '#5f7a8a', '#8a9aa8', '#6a7a99'], tall: false },
  hills: { name: 'Palm Hills', palette: ['#a8c686', '#8fb573', '#c9d6a0', '#7fae62'], tall: false },
  midtown: { name: 'Midtown', palette: ['#c9a06a', '#a87fb8', '#6a9ab8', '#d98a5f'], tall: false },
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const SAVE_KEY = 'solmar.save.v1';
export const START_CLOCK = 17.5; // 17:30 — golden hour at game start
export const CLOCK_RATE = 1 / 60; // one game hour per 60 real seconds
