// Restricted military base in the north-east corner: fenced, patrolled,
// and very much off limits. Step inside and the wanted level jumps —
// but four supply crates inside are worth real money, if you can grab
// one and get out before the patrol catches you.

export const BASE_RECT = { x: 2950, y: 220, w: 380, h: 380, label: 'RESTRICTED — Military Base' };
const CRATE_SPOTS = [
  { x: 3050, y: 320 }, { x: 3250, y: 320 }, { x: 3050, y: 500 }, { x: 3250, y: 500 },
];

export function ensureMilitary(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.military) {
    state.depth.military = {
      crates: CRATE_SPOTS.map((c) => ({ x: c.x, y: c.y, got: false })),
      found: 0, inside: false, dwell: 0,
      patrol: { x: 3140, y: 410, angle: 0 },
    };
  }
  return state.depth.military;
}

function inBase(x, y) {
  return x >= BASE_RECT.x && x < BASE_RECT.x + BASE_RECT.w && y >= BASE_RECT.y && y < BASE_RECT.y + BASE_RECT.h;
}

export function stepMilitary(state, dt) {
  const mi = ensureMilitary(state);
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const now = inBase(px, py);
  if (now && !mi.inside) {
    mi.inside = true;
    state.wanted = Math.max(state.wanted, 4);
    state.dialogue = { who: 'Base PA', text: 'RESTRICTED AREA! Leave now or be detained!', t: 4 };
    state.events.push({ kind: 'military-trespass' });
  } else if (!now && mi.inside) {
    mi.inside = false;
  }
  if (mi.inside) {
    // Heat keeps climbing while you linger, and the patrol closes in.
    mi.dwell += dt;
    if (mi.dwell > 6) { state.wanted = 5; mi.dwell = 0; }
    const pt = mi.patrol;
    pt.angle += dt * 0.9;
    pt.x += Math.cos(pt.angle) * 150 * dt;
    pt.y += Math.sin(pt.angle) * 150 * dt;
    if (pt.x < BASE_RECT.x + 40) pt.x = BASE_RECT.x + 40;
    if (pt.x > BASE_RECT.x + BASE_RECT.w - 40) pt.x = BASE_RECT.x + BASE_RECT.w - 40;
    if (pt.y < BASE_RECT.y + 40) pt.y = BASE_RECT.y + 40;
    if (pt.y > BASE_RECT.y + BASE_RECT.h - 40) pt.y = BASE_RECT.y + BASE_RECT.h - 40;
    const dx = px - pt.x, dy = py - pt.y;
    if (dx * dx + dy * dy < 55 * 55 && !p.inCar) {
      state.wanted = 5;
      state.dialogue = { who: 'Patrol', text: 'Hands where I can see them! You are detained — run!', t: 3 };
    }
  }
  for (const c of mi.crates) {
    if (c.got) continue;
    const dx = px - c.x, dy = py - c.y;
    if (dx * dx + dy * dy < 70 * 70) {
      c.got = true;
      mi.found += 1;
      state.player.cash += 800;
      state.wanted = Math.min(5, state.wanted + 1);
      state.dialogue = { who: 'Rico', text: `Military crate grabbed! +$800 (${mi.found}/4) — the alarm is going off!`, t: 3 };
      state.events.push({ kind: 'pickup', what: 'military-crate' });
    }
  }
}

export function drawMilitary(ctx, state) {
  const mi = ensureMilitary(state);
  const cam = state.camera;
  const r = BASE_RECT;
  if (r.x > cam.x + 720 || r.x + r.w < cam.x - 720 || r.y > cam.y + 440 || r.y + r.h < cam.y - 440) return;
  ctx.fillStyle = '#5a6a55';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 4;
  ctx.setLineDash([18, 12]);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.setLineDash([]);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(r.label, r.x + 14, r.y + 26);
  ctx.fillStyle = '#2b3a55';
  ctx.fillRect(r.x + 40, r.y + 120, 90, 60);
  ctx.fillRect(r.x + 220, r.y + 220, 90, 60);
  for (const c of mi.crates) {
    if (c.got) continue;
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(c.x - 11, c.y - 11, 22, 22);
    ctx.fillStyle = '#8a6d00';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('$', c.x - 4, c.y + 5);
  }
  const pt = mi.patrol;
  ctx.fillStyle = '#2b3a55';
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('PATROL', pt.x - 22, pt.y - 20);
}
