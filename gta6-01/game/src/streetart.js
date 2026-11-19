// Street-art murals: 12 painted walls across the districts. Stand in
// front of one for a couple of seconds and Rico tags it with his own
// mark — small cash + respect each, and a set bonus for all twelve.

export const MURAL_TOTAL = 12;
export const MURAL_SPOTS = [
  { x: 1020, y: 1020, label: 'Sun mural' },
  { x: 1700, y: 1020, label: 'Wave wall' },
  { x: 2380, y: 1360, label: 'Golden fish' },
  { x: 680, y: 1700, label: 'Sailor queen' },
  { x: 1360, y: 2380, label: 'Neon palm' },
  { x: 2040, y: 2380, label: 'Bay birds' },
  { x: 2720, y: 680, label: 'Tower tiger' },
  { x: 1020, y: 2720, label: 'Marina moon' },
  { x: 2040, y: 680, label: 'Chrome rose' },
  { x: 680, y: 2380, label: 'Pier poet' },
  { x: 3200, y: 1650, label: 'Island sun' },
  { x: 2380, y: 2720, label: 'Crane king' },
];

export function ensureMurals(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.murals) state.depth.murals = { tagged: {}, count: 0, dwell: 0, bonusPaid: false };
  return state.depth.murals;
}

export function stepMurals(state, dt) {
  const mu = ensureMurals(state);
  if (mu.count >= MURAL_TOTAL) return;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  let near = -1;
  for (let i = 0; i < MURAL_TOTAL; i++) {
    if (mu.tagged[i]) continue;
    const s = MURAL_SPOTS[i];
    const dx = px - s.x, dy = py - s.y;
    if (dx * dx + dy * dy < 80 * 80) { near = i; break; }
  }
  if (near < 0) { mu.dwell = 0; return; }
  mu.dwell += dt;
  if (mu.dwell >= 2) {
    mu.dwell = 0;
    mu.tagged[near] = true;
    mu.count += 1;
    state.player.cash += 120;
    state.respect = (state.respect || 0) + 1;
    const s = MURAL_SPOTS[near];
    state.dialogue = { who: 'Rico', text: `Tagged: ${s.label}! ${mu.count}/12 — +$120, +1 respect.`, t: 3 };
    state.events.push({ kind: 'pickup', what: 'mural', count: mu.count });
    if (mu.count >= MURAL_TOTAL && !mu.bonusPaid) {
      mu.bonusPaid = true;
      state.player.cash += 2000;
      state.respect = (state.respect || 0) + 12;
      state.dialogue = { who: 'Mama Rosa', text: 'Every wall in the bay wears your mark now. +$2000, +12 respect.', t: 5 };
    }
  }
}

export function nearestMural(state) {
  const mu = ensureMurals(state);
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  let best = null, bd = Infinity;
  for (let i = 0; i < MURAL_TOTAL; i++) {
    if (mu.tagged[i]) continue;
    const s = MURAL_SPOTS[i];
    const d = (px - s.x) ** 2 + (py - s.y) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export function drawMurals(ctx, state) {
  const mu = ensureMurals(state);
  const cam = state.camera;
  const x0 = cam.x - 720, y0 = cam.y - 440, x1 = cam.x + 720, y1 = cam.y + 440;
  const cols = ['#ff5a8a', '#37c8b0', '#ffd23e', '#7a5cff', '#ff7a5c', '#4db2ff'];
  for (let i = 0; i < MURAL_TOTAL; i++) {
    if (mu.tagged[i]) continue;
    const s = MURAL_SPOTS[i];
    if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(s.x - 26, s.y - 14, 52, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('ART', s.x - 12, s.y + 4);
  }
}
