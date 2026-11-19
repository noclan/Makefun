// Hidden packages: 50 gold parcels stashed across Solmar Bay —
// rooftops, alleys, the beach, the island. Walk over one to grab it:
// cash + respect each, and a big completion bonus at 50.

export const PACKAGE_TOTAL = 50;
export const PACKAGE_SPOTS = [];
for (let i = 0; i < PACKAGE_TOTAL; i++) {
  PACKAGE_SPOTS.push({
    x: 420 + ((i * 557) % 2900),
    y: 320 + ((i * 911) % 2700),
  });
}

export function ensurePackages(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.packages) state.depth.packages = { found: {}, count: 0, bonusPaid: false };
  return state.depth.packages;
}

export function stepPackages(state, dt) {
  const pk = ensurePackages(state);
  if (pk.count >= PACKAGE_TOTAL) return;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (let i = 0; i < PACKAGE_TOTAL; i++) {
    if (pk.found[i]) continue;
    const s = PACKAGE_SPOTS[i];
    const dx = px - s.x, dy = py - s.y;
    if (dx * dx + dy * dy < 70 * 70) {
      pk.found[i] = true;
      pk.count += 1;
      state.player.cash += 150;
      state.respect = (state.respect || 0) + 1;
      state.dialogue = { who: 'Rico', text: `Hidden package ${pk.count}/50! +$150, +1 respect.`, t: 3 };
      state.events.push({ kind: 'pickup', what: 'package', count: pk.count });
      if (pk.count >= PACKAGE_TOTAL && !pk.bonusPaid) {
        pk.bonusPaid = true;
        state.player.cash += 5000;
        state.respect = (state.respect || 0) + 20;
        state.dialogue = { who: 'Mama Rosa', text: 'All fifty packages, Rico! The whole bay talks about you. +$5000, +20 respect.', t: 5 };
      }
      break;
    }
  }
  void dt;
}

export function nearestPackage(state) {
  const pk = ensurePackages(state);
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  let best = null, bd = Infinity;
  for (let i = 0; i < PACKAGE_TOTAL; i++) {
    if (pk.found[i]) continue;
    const s = PACKAGE_SPOTS[i];
    const d = (px - s.x) ** 2 + (py - s.y) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export function drawPackages(ctx, state) {
  const pk = ensurePackages(state);
  const cam = state.camera;
  const x0 = cam.x - 720, y0 = cam.y - 440, x1 = cam.x + 720, y1 = cam.y + 440;
  for (let i = 0; i < PACKAGE_TOTAL; i++) {
    if (pk.found[i]) continue;
    const s = PACKAGE_SPOTS[i];
    if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
    const bob = Math.sin(state.elapsed * 3 + i) * 3;
    ctx.fillStyle = '#ffd23e';
    ctx.save();
    ctx.translate(s.x, s.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
    ctx.fillStyle = '#8a6d00';
    ctx.fillRect(s.x - 2, s.y + bob - 2, 4, 4);
  }
}

// One HUD status line for all of round 9's collectibles and activities.
export function r9HudLines(state) {
  if (!state.depth) return [];
  const lines = [];
  const pk = state.depth.packages;
  const ph = state.depth.photos;
  const mu = state.depth.murals;
  const fi = state.depth.fish;
  const lg = state.depth.league;
  const bo = state.depth.bounty;
  const st = state.depth.stations;
  const bits = [];
  if (pk) bits.push(`PACKAGES ${pk.count}/50`);
  if (ph) bits.push(`PHOTOS ${ph.count}/20`);
  if (mu) bits.push(`MURALS ${mu.count}/12`);
  if (fi) bits.push(`FISH $${fi.earned}`);
  if (lg) bits.push(`LEAGUE ${lg.points} PTS`);
  if (bo) bits.push(`BOUNTIES ${bo.count}`);
  if (bits.length) lines.push(bits.join('  •  '));
  if (st) lines.push(`RADIO: ${stationNameOf(st)}`);
  return lines;
}

export function stationNameOf(st) {
  const names = ['SOLMAR FM', 'NEON NIGHTS', 'BAY COUNTRY', 'GOLDEN HOUR', 'ISLAND BEATS'];
  return names[st.idx % names.length];
}
