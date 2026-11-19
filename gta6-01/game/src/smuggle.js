// Smuggling runs: high-risk timed deliveries from the dockside.
// The moment you take the package your wanted level jumps and keeps
// climbing while you run — but a clean delivery pays far more than
// any honest job in the bay.

export const SMUGGLE_SPOT = { x: 2720, y: 3050, label: 'Smuggler\'s dock' };
const DROPS = [
  { x: 680, y: 680, label: 'Beachfront drop' },
  { x: 2380, y: 680, label: 'Downtown drop' },
  { x: 1020, y: 2720, label: 'Marina drop' },
  { x: 3050, y: 1650, label: 'Bridge drop' },
];

export function ensureSmuggle(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.smuggle) state.depth.smuggle = { run: null, cooldown: 0, done: 0, dropIdx: 0 };
  return state.depth.smuggle;
}

export function stepSmuggle(state, dt) {
  const sm = ensureSmuggle(state);
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const edge = state.depth && state.depth.actionEdge;
  if (sm.run) {
    sm.run.timer -= dt;
    sm.run.heat += dt;
    if (sm.run.heat >= 20) {
      sm.run.heat = 0;
      state.wanted = Math.min(5, state.wanted + 1);
    }
    const dest = DROPS[sm.run.dropIdx];
    const dx = px - dest.x, dy = py - dest.y;
    if (dx * dx + dy * dy < 95 * 95) {
      const pay = 2500 + sm.done * 250;
      state.player.cash += pay;
      state.respect = (state.respect || 0) + 5;
      sm.done += 1;
      state.dialogue = { who: 'Smuggler', text: `Package delivered, no questions asked. +$${pay}, +5 respect.`, t: 4 };
      state.events.push({ kind: 'smuggle-done', pay });
      sm.run = null;
      sm.cooldown = 30;
    } else if (sm.run.timer <= 0) {
      state.dialogue = { who: 'Smuggler', text: 'Too slow — the buyer walked. The package is worthless now.', t: 4 };
      sm.run = null;
      sm.cooldown = 30;
    }
    return;
  }
  sm.cooldown = Math.max(0, sm.cooldown - dt);
  if (sm.cooldown > 0) return;
  const dx = px - SMUGGLE_SPOT.x, dy = py - SMUGGLE_SPOT.y;
  if (dx * dx + dy * dy < 95 * 95 && edge) {
    sm.run = { dropIdx: sm.dropIdx % DROPS.length, timer: 90, heat: 0 };
    sm.dropIdx += 1;
    state.wanted = Math.min(5, state.wanted + 2);
    const dest = DROPS[sm.run.dropIdx];
    state.dialogue = { who: 'Smuggler', text: `Package is hot — ${dest.label}, 90 seconds, and the cops already know. Go!`, t: 4 };
    state.events.push({ kind: 'smuggle-start', to: dest.label });
    state.depth.actionEdge = false;
  }
}

export function smuggleTarget(state) {
  const sm = ensureSmuggle(state);
  if (sm.run) return DROPS[sm.run.dropIdx];
  if (sm.cooldown <= 0) return SMUGGLE_SPOT;
  return null;
}

export function drawSmuggle(ctx, state) {
  const sm = ensureSmuggle(state);
  const cam = state.camera;
  const s = SMUGGLE_SPOT;
  if (Math.abs(s.x - cam.x) <= 720 && Math.abs(s.y - cam.y) <= 440) {
    ctx.fillStyle = '#3a2a4d';
    ctx.fillRect(s.x - 30, s.y - 20, 60, 40);
    ctx.fillStyle = '#c77dff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('SMUGGLE', s.x - 28, s.y + 4);
  }
  if (sm.run) {
    const d = DROPS[sm.run.dropIdx];
    if (Math.abs(d.x - cam.x) > 720 || Math.abs(d.y - cam.y) > 440) return;
    const blink = Math.sin(state.elapsed * 8) > 0;
    if (blink) {
      ctx.fillStyle = '#c77dff';
      ctx.beginPath();
      ctx.arc(d.x, d.y, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${Math.ceil(sm.run.timer)}s`, d.x - 12, d.y + 4);
    }
  }
}
