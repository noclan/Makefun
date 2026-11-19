// Island district content: the bridge, the island café, the lookout
// and the beach bar. Island jobs are a short delivery chain that pays
// better the further you get; island stashes hide cash in the sand.

export const ISLAND_SPOTS = {
  bridge: { x: 3050, y: 1650, label: 'The bridge' },
  cafe: { x: 3200, y: 2000, label: 'Island café' },
  lookout: { x: 3250, y: 1200, label: 'Island lookout' },
  bar: { x: 3180, y: 2600, label: 'Beach bar' },
};
const ISLAND_JOBS = [
  { from: 'cafe', to: 'lookout', pay: 400, timer: 60, text: 'Take this parcel to the lookout — the view is worth the drive.' },
  { from: 'lookout', to: 'bar', pay: 500, timer: 60, text: 'Cold drinks for the beach bar, quick — the ice is melting.' },
  { from: 'bar', to: 'bridge', pay: 600, timer: 75, text: 'Last one: a package for the bridge keeper. Then the chain is done.' },
];
const STASH_SPOTS = [
  { x: 3150, y: 1500 }, { x: 3280, y: 2300 }, { x: 3120, y: 2900 }, { x: 3300, y: 900 },
];

export function ensureIsland(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.island) {
    state.depth.island = {
      jobIdx: 0, job: null,
      stashes: STASH_SPOTS.map((s) => ({ x: s.x, y: s.y, got: false })),
      found: 0, done: 0,
    };
  }
  return state.depth.island;
}

export function stepIsland(state, dt) {
  const il = ensureIsland(state);
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const edge = state.depth && state.depth.actionEdge;
  if (il.job) {
    il.job.timer -= dt;
    const dest = ISLAND_SPOTS[il.job.to];
    const dx = px - dest.x, dy = py - dest.y;
    if (dx * dx + dy * dy < 95 * 95) {
      state.player.cash += il.job.pay;
      state.respect = (state.respect || 0) + 2;
      il.done += 1;
      state.dialogue = { who: 'Island café', text: `Delivered! +$${il.job.pay}, +2 respect.`, t: 3 };
      state.events.push({ kind: 'island-job-done', pay: il.job.pay });
      il.jobIdx += 1;
      il.job = null;
    } else if (il.job.timer <= 0) {
      state.dialogue = { who: 'Island café', text: 'Too slow — the islanders gave the job to someone else.', t: 3 };
      il.job = null;
    }
    return;
  }
  if (il.jobIdx >= ISLAND_JOBS.length) return;
  const def = ISLAND_JOBS[il.jobIdx];
  const from = ISLAND_SPOTS[def.from];
  const dx = px - from.x, dy = py - from.y;
  if (dx * dx + dy * dy < 95 * 95 && edge) {
    il.job = { to: def.to, pay: def.pay, timer: def.timer };
    state.dialogue = { who: 'Island café', text: def.text, t: 4 };
    state.events.push({ kind: 'island-job-start', to: def.to });
    state.depth.actionEdge = false;
  }
  for (const s of il.stashes) {
    if (s.got) continue;
    const sx = px - s.x, sy = py - s.y;
    if (sx * sx + sy * sy < 70 * 70) {
      s.got = true;
      il.found += 1;
      state.player.cash += 250;
      state.dialogue = { who: 'Rico', text: `Island stash dug up! +$250 (${il.found}/4).`, t: 3 };
      state.events.push({ kind: 'pickup', what: 'island-stash' });
    }
  }
}

export function islandTarget(state) {
  const il = ensureIsland(state);
  if (il.job) return ISLAND_SPOTS[il.job.to];
  if (il.jobIdx < ISLAND_JOBS.length) return ISLAND_SPOTS[ISLAND_JOBS[il.jobIdx].from];
  return null;
}

export function drawIsland(ctx, state) {
  const il = ensureIsland(state);
  const cam = state.camera;
  const x0 = cam.x - 720, y0 = cam.y - 440, x1 = cam.x + 720, y1 = cam.y + 440;
  for (const key of Object.keys(ISLAND_SPOTS)) {
    const s = ISLAND_SPOTS[key];
    if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
    ctx.fillStyle = '#e8b48a';
    ctx.fillRect(s.x - 34, s.y - 24, 68, 48);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(s.label, s.x - 32, s.y - 30);
  }
  for (const s of il.stashes) {
    if (s.got) continue;
    if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}
