// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on screen size.
// SURGELOOP: top-down arena survival. The only weapon is wire: hold the mouse to draw a
// copper trace, close a loop and the enclosed area becomes a plasma field that fries
// everything inside. No projectiles, no shooting — geometry is the weapon.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  speed: 360,
  dashSpeed: 720,
  dashTime: 0.22,
  dashCooldown: 1.2,
  invulnerable: 1.5,
};

export const LIVES = 3;
export const MAX_LIVES = 5;
export const WAVES = 10;

/** Wire is the ammo for drawing. Drains by distance while drawing, regens when idle. */
export const WIRE = {
  max: 100,
  drainPerPx: 0.09,
  regenPerSec: 14,
  minToStart: 10,
};

export const TRACE = {
  minPointGap: 6,
  closeDistance: 20,
  skipRecent: 12,
  minLoopLength: 80,
  minLoopArea: 1200,
  maxPoints: 400,
  fadeSeconds: 4,
  fieldSeconds: 1.0,
  fieldSecondsOvercharge: 2.0,
};

/** Bot kinds: crawler, zipper, brute, splitter. Boss is wave 10, loops only. */
export const BOT = {
  crawler: { radius: 14, speed: 65, hp: 1, score: 10, scrap: 5, color: '#f97316' },
  zipper: { radius: 11, speed: 165, hp: 1, score: 20, scrap: 5, color: '#facc15' },
  brute: { radius: 22, speed: 46, hp: 3, score: 40, scrap: 10, color: '#ef4444' },
  splitter: { radius: 16, speed: 82, hp: 2, score: 30, scrap: 10, color: '#a78bfa' },
};

export const BOSS = {
  radius: 40, speed: 56, hp: 12, score: 500, minionInterval: 6, maxMinions: 6,
};

/** Wave compositions: [crawlers, zippers, brutes, splitters]. Wave 10 is the boss. */
export const WAVE_TABLE = [
  [5, 0, 0, 0],
  [7, 2, 0, 0],
  [10, 4, 0, 0],
  [8, 4, 2, 0],
  [10, 6, 2, 2],
  [12, 6, 3, 3],
  [10, 8, 4, 4],
  [12, 8, 5, 5],
  [14, 10, 6, 6],
  [0, 0, 0, 0],
];

export const SPAWN = { interval: 0.9, intervalPerWave: -0.04, minInterval: 0.35 };

export const PICKUP = {
  radius: 12,
  magnetRadius: 90,
  collectRadius: 26,
  scrapChance: 0.45,
  heartChance: 0.04,
  overchargeChance: 0.06,
  scrapValue: 5,
  overchargeSeconds: 10,
};

/** Between-wave shop. Bought at most once each per intermission; auto-continues after 5 s. */
export const SHOP = [
  { key: '1', name: 'WIRE COIL +25', desc: 'Bigger wire tank', cost: 40 },
  { key: '2', name: 'SPARE CORE +1', desc: 'One extra heart (max 5)', cost: 60 },
  { key: '3', name: 'OVERCHARGE', desc: '10 s of free drawing', cost: 30 },
];

export const PALETTE = {
  backdrop: '#0b1120',
  deep: '#0f172a',
  grid: '#1e293b',
  copper: '#f97316',
  cyan: '#06b6d4',
  volt: '#facc15',
  white: '#f8fafc',
  red: '#ef4444',
  muted: '#94a3b8',
  panel: '#16213a',
  violet: '#a78bfa',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'surgeloop.best';
