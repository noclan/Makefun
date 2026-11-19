// Bounty hunting: wanted posters go up around town, and Rico collects
// the reward. One mark is live at a time — a runner drifting through
// the streets. Get close on foot and bring them in for the cash.

export const BOUNTY_BOARD = { x: 1360, y: 1360, label: 'Bounty board' };
const MARKS = [
  { name: 'Slick Eddie', reward: 800, x: 1700, y: 1020 },
  { name: 'Marina Mary', reward: 1000, x: 1020, y: 2380 },
  { name: 'Two-Tone Tony', reward: 1200, x: 2380, y: 1700 },
  { name: 'The Ghost', reward: 1500, x: 680, y: 1020 },
  { name: 'Big Sal', reward: 1800, x: 2720, y: 2380 },
  { name: 'Varela\'s Last Man', reward: 2500, x: 3050, y: 1650 },
];

export function ensureBounty(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.bounty) {
    state.depth.bounty = { active: null, cooldown: 0, count: 0, nextIdx: 0 };
  }
  return state.depth.bounty;
}

export function stepBounty(state, dt) {
  const bo = ensureBounty(state);
  const p = state.player;
  const edge = state.depth && state.depth.actionEdge;
  if (!bo.active) {
    bo.cooldown = Math.max(0, bo.cooldown - dt);
    if (bo.cooldown <= 0 && bo.nextIdx < MARKS.length) {
      const px = p.inCar ? p.inCar.x : p.x;
      const py = p.inCar ? p.inCar.y : p.y;
      const dx = px - BOUNTY_BOARD.x, dy = py - BOUNTY_BOARD.y;
      if (dx * dx + dy * dy < 95 * 95 && edge) {
        const def = MARKS[bo.nextIdx];
        bo.active = { idx: bo.nextIdx, name: def.name, reward: def.reward, x: def.x, y: def.y, angle: 0 };
        state.dialogue = { who: 'Bounty board', text: `New mark: ${def.name} — $${def.reward} alive. Find them in the streets.`, t: 4 };
        state.events.push({ kind: 'bounty-start', name: def.name });
        state.depth.actionEdge = false;
      }
    }
    return;
  }
  const m = bo.active;
  // The mark drifts along the roads, never too fast to catch.
  m.angle += dt * 0.3;
  m.x += Math.cos(m.angle) * 60 * dt;
  m.y += Math.sin(m.angle) * 60 * dt;
  if (m.x < 600) m.x = 600;
  if (m.x > 2900) m.x = 2900;
  if (m.y < 300) m.y = 300;
  if (m.y > 2900) m.y = 2900;
  if (!p.inCar) {
    const dx = p.x - m.x, dy = p.y - m.y;
    if (dx * dx + dy * dy < 60 * 60) {
      state.player.cash += m.reward;
      state.respect = (state.respect || 0) + 4;
      bo.count += 1;
      state.dialogue = { who: 'Rico', text: `${m.name} brought in! +$${m.reward}, +4 respect. (${bo.count}/${MARKS.length} bounties)`, t: 4 };
      state.events.push({ kind: 'bounty-done', name: m.name, reward: m.reward });
      bo.nextIdx += 1;
      bo.active = null;
      bo.cooldown = 20;
    }
  }
}

export function bountyTarget(state) {
  const bo = ensureBounty(state);
  if (bo.active) return { x: bo.active.x, y: bo.active.y };
  if (bo.nextIdx < MARKS.length) return BOUNTY_BOARD;
  return null;
}

export function drawBounty(ctx, state) {
  const bo = ensureBounty(state);
  const cam = state.camera;
  const b = BOUNTY_BOARD;
  if (Math.abs(b.x - cam.x) <= 720 && Math.abs(b.y - cam.y) <= 440) {
    ctx.fillStyle = '#e8d9b0';
    ctx.fillRect(b.x - 30, b.y - 20, 60, 40);
    ctx.fillStyle = '#8a2a2a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('WANTED', b.x - 26, b.y + 4);
  }
  if (bo.active) {
    const m = bo.active;
    if (Math.abs(m.x - cam.x) > 720 || Math.abs(m.y - cam.y) > 440) return;
    const bob = Math.sin(state.elapsed * 5) * 4;
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(m.x, m.y - 26 + bob, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('!', m.x - 3, m.y - 22 + bob);
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(m.name, m.x - 30, m.y + 34);
  }
}
