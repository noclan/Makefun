// Photo spots: 20 scenic viewpoints across the bay. Stand in the
// golden circle for a moment and Rico snaps the shot — cash + respect
// each, and a bonus for the full album.

export const PHOTO_TOTAL = 20;
export const PHOTO_SPOTS = [
  { x: 300, y: 2400, label: 'Marina sunset' },
  { x: 1900, y: 900, label: 'Downtown towers' },
  { x: 500, y: 600, label: 'Beach sunrise' },
  { x: 3100, y: 1650, label: 'Island bridge' },
  { x: 1020, y: 2380, label: 'Club Neon glow' },
  { x: 1700, y: 1360, label: 'Casino lights' },
  { x: 700, y: 2650, label: 'Old pier' },
  { x: 2380, y: 680, label: 'Skyline north' },
  { x: 1360, y: 2720, label: 'Old Town rooftops' },
  { x: 3050, y: 1200, label: 'Island lookout' },
  { x: 900, y: 2900, label: 'South beach' },
  { x: 2720, y: 1020, label: 'Downtown plaza' },
  { x: 680, y: 1020, label: 'Arcade row' },
  { x: 2100, y: 2040, label: 'Canal bend' },
  { x: 1495, y: 755, label: 'Respray alley' },
  { x: 3200, y: 2000, label: 'Island café' },
  { x: 2380, y: 2380, label: 'Harbour cranes' },
  { x: 1020, y: 1360, label: 'Palm avenue' },
  { x: 1700, y: 2040, label: 'Market square' },
  { x: 2720, y: 2720, label: 'Portside dusk' },
];

export function ensurePhotos(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.photos) state.depth.photos = { taken: {}, count: 0, dwell: 0, bonusPaid: false };
  return state.depth.photos;
}

export function stepPhotos(state, dt) {
  const ph = ensurePhotos(state);
  if (ph.count >= PHOTO_TOTAL) return;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  let near = -1;
  for (let i = 0; i < PHOTO_TOTAL; i++) {
    if (ph.taken[i]) continue;
    const s = PHOTO_SPOTS[i];
    const dx = px - s.x, dy = py - s.y;
    if (dx * dx + dy * dy < 80 * 80) { near = i; break; }
  }
  if (near < 0) { ph.dwell = 0; return; }
  ph.dwell += dt;
  if (ph.dwell >= 1.5) {
    ph.dwell = 0;
    ph.taken[near] = true;
    ph.count += 1;
    state.player.cash += 200;
    state.respect = (state.respect || 0) + 1;
    const s = PHOTO_SPOTS[near];
    state.dialogue = { who: 'Rico', text: `Photo: ${s.label}! ${ph.count}/20 — +$200, +1 respect.`, t: 3 };
    state.events.push({ kind: 'pickup', what: 'photo', count: ph.count });
    if (ph.count >= PHOTO_TOTAL && !ph.bonusPaid) {
      ph.bonusPaid = true;
      state.player.cash += 3000;
      state.respect = (state.respect || 0) + 15;
      state.dialogue = { who: 'Mama Rosa', text: 'The whole album, Rico! The tourist board wants your shots. +$3000, +15 respect.', t: 5 };
    }
  }
}

export function nearestPhoto(state) {
  const ph = ensurePhotos(state);
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  let best = null, bd = Infinity;
  for (let i = 0; i < PHOTO_TOTAL; i++) {
    if (ph.taken[i]) continue;
    const s = PHOTO_SPOTS[i];
    const d = (px - s.x) ** 2 + (py - s.y) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export function drawPhotos(ctx, state) {
  const ph = ensurePhotos(state);
  const cam = state.camera;
  const x0 = cam.x - 720, y0 = cam.y - 440, x1 = cam.x + 720, y1 = cam.y + 440;
  for (let i = 0; i < PHOTO_TOTAL; i++) {
    if (ph.taken[i]) continue;
    const s = PHOTO_SPOTS[i];
    if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
    const pulse = 0.6 + 0.4 * Math.sin(state.elapsed * 3 + i);
    ctx.strokeStyle = `rgba(255,210,62,${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('◉ ' + s.label, s.x - 40, s.y - 54);
  }
}
