// The Solmar ferry: a scheduled boat running the canal between the
// mainland marina dock and the island dock. It docks, sails, docks,
// sails back. Walk aboard while it is docked (or catch it mid-sail)
// and it carries you across; every crossing you ride pays a small
// sightseeing tip.

export const FERRY_A = { x: 320, y: 2600, label: 'Marina dock' };
export const FERRY_B = { x: 3150, y: 1750, label: 'Island dock' };
const SAIL_T = 40, DOCK_T = 12;

export function ensureFerry(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.ferry) state.depth.ferry = { leg: 0, t: 0, x: FERRY_A.x, y: FERRY_A.y, aboard: false, trips: 0 };
  return state.depth.ferry;
}

function ferryPos(f) {
  if (f.leg === 0) return { x: FERRY_A.x, y: FERRY_A.y };
  if (f.leg === 2) return { x: FERRY_B.x, y: FERRY_B.y };
  const k = Math.min(1, f.t / SAIL_T);
  const e = k * k * (3 - 2 * k);
  if (f.leg === 1) return { x: FERRY_A.x + (FERRY_B.x - FERRY_A.x) * e, y: FERRY_A.y + (FERRY_B.y - FERRY_A.y) * e };
  return { x: FERRY_B.x + (FERRY_A.x - FERRY_B.x) * e, y: FERRY_B.y + (FERRY_A.y - FERRY_B.y) * e };
}

export function stepFerry(state, dt) {
  const f = ensureFerry(state);
  const p = state.player;
  f.t += dt;
  const limit = (f.leg === 0 || f.leg === 2) ? DOCK_T : SAIL_T;
  if (f.t >= limit) {
    f.t = 0;
    const wasLeg = f.leg;
    f.leg = (f.leg + 1) % 4;
    if (f.aboard && (wasLeg === 1 || wasLeg === 3)) {
      f.trips += 1;
      state.player.cash += 40;
      state.dialogue = { who: 'Rico', text: `Ferry crossing complete — tourists loved the ride. +$40 (trip ${f.trips}).`, t: 3 };
      state.events.push({ kind: 'ferry-trip', n: f.trips });
    }
  }
  const pos = ferryPos(f);
  f.x = pos.x; f.y = pos.y;
  const dx = p.x - f.x, dy = p.y - f.y;
  const near = dx * dx + dy * dy < 70 * 70;
  const edge = state.depth && state.depth.actionEdge;
  if (!p.inCar && near && edge) {
    if (!f.aboard) {
      f.aboard = true;
      state.dialogue = { who: 'Rico', text: 'Aboard the ferry. Sit back — the canal does the driving.', t: 3 };
      state.events.push({ kind: 'ferry-board' });
    } else {
      f.aboard = false;
      state.dialogue = { who: 'Rico', text: 'Off the ferry. Mind the gap.', t: 3 };
    }
    state.depth.actionEdge = false;
  }
  if (f.aboard && !p.inCar) {
    p.x = f.x; p.y = f.y; p.speed = 0;
  }
}

export function drawFerry(ctx, state) {
  const f = ensureFerry(state);
  const cam = state.camera;
  // The canal the ferry runs: a pale blue band under its route.
  ctx.strokeStyle = 'rgba(80,180,210,0.5)';
  ctx.lineWidth = 46;
  ctx.beginPath();
  ctx.moveTo(FERRY_A.x, FERRY_A.y);
  ctx.lineTo(FERRY_B.x, FERRY_B.y);
  ctx.stroke();
  if (Math.abs(f.x - cam.x) > 780 || Math.abs(f.y - cam.y) > 500) return;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(-52, -20, 104, 40);
  ctx.fillStyle = '#2f8fa8';
  ctx.fillRect(-40, -13, 80, 26);
  ctx.fillStyle = '#ffd23e';
  ctx.fillRect(-52, -20, 104, 6);
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('FERRY', f.x - 24, f.y - 30);
  ctx.fillText(f.leg === 0 ? 'docked: Marina' : f.leg === 2 ? 'docked: Island' : 'sailing…', f.x - 34, f.y + 38);
}
