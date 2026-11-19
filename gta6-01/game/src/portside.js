// Portside district: the docks and container yard down south. Crate
// jobs pay for quick runs between the cranes, and five stashes are
// tucked between the containers for anyone who looks.

export const PORT_SPOTS = {
  yard: { x: 2720, y: 2720, label: 'Container yard' },
  crane: { x: 2380, y: 2720, label: 'Crane one' },
  dock: { x: 2720, y: 3050, label: 'South dock' },
};
const PORT_JOBS = [
  { from: 'yard', to: 'crane', pay: 350, timer: 55 },
  { from: 'crane', to: 'dock', pay: 450, timer: 60 },
  { from: 'dock', to: 'yard', pay: 550, timer: 65 },
];
const STASH_SPOTS = [
  { x: 2550, y: 2650 }, { x: 2850, y: 2800 }, { x: 2450, y: 2950 },
  { x: 2900, y: 3050 }, { x: 2620, y: 3100 },
];

export function ensurePort(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.port) {
    state.depth.port = {
      jobIdx: 0, job: null,
      stashes: STASH_SPOTS.map((s) => ({ x: s.x, y: s.y, got: false })),
      found: 0, done: 0,
    };
  }
  return state.depth.port;
}

export function stepPort(state, dt) {
  const po = ensurePort(state);
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const edge = state.depth && state.depth.actionEdge;
  if (po.job) {
    po.job.timer -= dt;
    const dest = PORT_SPOTS[po.job.to];
    const dx = px - dest.x, dy = py - dest.y;
    if (dx * dx + dy * dy < 95 * 95) {
      state.player.cash += po.job.pay;
      state.respect = (state.respect || 0) + 2;
      po.done += 1;
      state.dialogue = { who: 'Foreman', text: `Crate delivered! +$${po.job.pay}, +2 respect.`, t: 3 };
      state.events.push({ kind: 'port-job-done', pay: po.job.pay });
      po.jobIdx += 1;
      po.job = null;
    } else if (po.job.timer <= 0) {
      state.dialogue = { who: 'Foreman', text: 'Too slow — the crane crew moved on without you.', t: 3 };
      po.job = null;
    }
    return;
  }
  if (po.jobIdx < PORT_JOBS.length) {
    const def = PORT_JOBS[po.jobIdx];
    const from = PORT_SPOTS[def.from];
    const dx = px - from.x, dy = py - from.y;
    if (dx * dx + dy * dy < 95 * 95 && edge) {
      po.job = { to: def.to, pay: def.pay, timer: def.timer };
      state.dialogue = { who: 'Foreman', text: `Haul this crate to ${PORT_SPOTS[def.to].label} — ${def.timer}s on the clock.`, t: 4 };
      state.events.push({ kind: 'port-job-start', to: def.to });
      state.depth.actionEdge = false;
    }
  }
  for (const s of po.stashes) {
    if (s.got) continue;
    const dx = px - s.x, dy = py - s.y;
    if (dx * dx + dy * dy < 70 * 70) {
      s.got = true;
      po.found += 1;
      state.player.cash += 250;
      state.dialogue = { who: 'Rico', text: `Portside stash found! +$250 (${po.found}/5).`, t: 3 };
      state.events.push({ kind: 'pickup', what: 'port-stash' });
    }
  }
}

export function portTarget(state) {
  const po = ensurePort(state);
  if (po.job) return PORT_SPOTS[po.job.to];
  if (po.jobIdx < PORT_JOBS.length) return PORT_SPOTS[PORT_JOBS[po.jobIdx].from];
  return null;
}

export function drawPort(ctx, state) {
  const po = ensurePort(state);
  const cam = state.camera;
  const x0 = cam.x - 720, y0 = cam.y - 440, x1 = cam.x + 720, y1 = cam.y + 440;
  const cols = ['#c96a3a', '#3a7ac9', '#5a9a4d', '#c9a13a'];
  for (let i = 0; i < 8; i++) {
    const cx = 2400 + (i % 4) * 170, cy = 2620 + Math.floor(i / 4) * 130;
    if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue;
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(cx, cy, 130, 60);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(cx, cy, 130, 10);
  }
  for (const key of Object.keys(PORT_SPOTS)) {
    const s = PORT_SPOTS[key];
    if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(s.label, s.x - 30, s.y - 30);
  }
  for (const s of po.stashes) {
    if (s.got) continue;
    if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}
