// Driveable boats in the marina and the open sea strip. Step up to a
// moored boat and board it, then sail with the same driving keys —
// boats are faster than cars but turn wide. Floating supply crates
// in the sea pay cash when you sail over them.

export const BOAT_DOCKS = [
  { x: 300, y: 2160, name: 'Wave Runner' },
  { x: 300, y: 2680, name: 'Bay Cruiser' },
  { x: 200, y: 1900, name: 'Sun Chaser' },
];
const CRATE_SPOTS = [
  { x: 120, y: 900 }, { x: 180, y: 1500 }, { x: 90, y: 2300 },
  { x: 220, y: 3000 }, { x: 150, y: 3200 },
];

export function ensureBoats(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.boats) {
    state.depth.boats = {
      aboard: -1,
      list: BOAT_DOCKS.map((d) => ({ x: d.x, y: d.y, angle: Math.PI, speed: 0, name: d.name })),
      crates: CRATE_SPOTS.map((c) => ({ x: c.x, y: c.y, got: false })),
      found: 0,
    };
  }
  return state.depth.boats;
}

export function stepBoats(state, input, dt) {
  const bo = ensureBoats(state);
  const p = state.player;
  const edge = state.depth && state.depth.actionEdge;
  if (bo.aboard < 0) {
    if (!p.inCar && edge) {
      for (let i = 0; i < bo.list.length; i++) {
        const b = bo.list[i];
        const dx = p.x - b.x, dy = p.y - b.y;
        if (dx * dx + dy * dy < 60 * 60) {
          bo.aboard = i;
          state.dialogue = { who: 'Rico', text: `Aboard the ${b.name}. The bay is yours — drive with W/S and steer with A/D.`, t: 4 };
          state.events.push({ kind: 'board-boat', name: b.name });
          state.depth.actionEdge = false;
          break;
        }
      }
    }
    return;
  }
  const b = bo.list[bo.aboard];
  if (edge) {
    bo.aboard = -1;
    p.x = 360; p.y = b.y;
    b.speed = 0;
    state.dialogue = { who: 'Rico', text: 'Back on dry land. The boat stays moored here.', t: 3 };
    state.depth.actionEdge = false;
    return;
  }
  const fwd = input.up ? 1 : input.down ? -0.5 : 0;
  b.speed += fwd * 340 * dt;
  b.speed -= b.speed * 0.5 * dt;
  if (!input.up && !input.down) b.speed -= b.speed * 1.2 * dt;
  if (b.speed > 560) b.speed = 560;
  if (b.speed < -220) b.speed = -220;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const dir = b.speed >= 0 ? 1 : -1;
  b.angle += steer * 1.6 * dt * Math.min(1, Math.abs(b.speed) / 160) * dir;
  b.x += Math.cos(b.angle) * b.speed * dt;
  b.y += Math.sin(b.angle) * b.speed * dt;
  if (b.x < 30) { b.x = 30; b.speed *= -0.3; }
  if (b.x > 350) { b.x = 350; b.speed *= -0.3; }
  if (b.y < 40) { b.y = 40; b.speed *= -0.3; }
  if (b.y > 3360) { b.y = 3360; b.speed *= -0.3; }
  p.x = b.x; p.y = b.y; p.facing = b.angle; p.speed = Math.abs(b.speed);
  for (const c of bo.crates) {
    if (c.got) continue;
    const dx = b.x - c.x, dy = b.y - c.y;
    if (dx * dx + dy * dy < 50 * 50) {
      c.got = true;
      bo.found += 1;
      state.player.cash += 300;
      state.dialogue = { who: 'Rico', text: `Supply crate fished out of the sea! +$300 (${bo.found}/5).`, t: 3 };
      state.events.push({ kind: 'pickup', what: 'boat-crate' });
    }
  }
}

export function drawBoats(ctx, state) {
  const bo = ensureBoats(state);
  const cam = state.camera;
  const x0 = cam.x - 720, y0 = cam.y - 440, x1 = cam.x + 720, y1 = cam.y + 440;
  for (const c of bo.crates) {
    if (c.got) continue;
    if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
    ctx.fillStyle = '#c98f4e';
    ctx.fillRect(c.x - 10, c.y - 10, 20, 20);
    ctx.fillStyle = '#7a4a22';
    ctx.fillRect(c.x - 10, c.y - 2, 20, 4);
  }
  for (let i = 0; i < bo.list.length; i++) {
    const b = bo.list[i];
    if (b.x < x0 || b.x > x1 || b.y < y0 || b.y > y1) continue;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = bo.aboard === i ? '#ffd23e' : '#e8e8e8';
    ctx.beginPath();
    ctx.moveTo(34, 0); ctx.lineTo(-26, -13); ctx.lineTo(-30, 0); ctx.lineTo(-26, 13);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b6a7a';
    ctx.fillRect(-12, -7, 18, 14);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(b.name, b.x - 26, b.y - 26);
  }
}
