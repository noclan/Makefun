// Pixel Palace arcade: three small games that pay in tickets.
// Tickets pile up in the player's pocket and can be cashed in.
// 1. Reflex Rush — a light flips green; punch (or press action) fast.
// 2. Neon Dash — sprint on foot between the arcade doors and the beach
//    arch before the clock runs out.
// 3. Claw Grab — a lucky dip against the machine's hidden prize slot.

export const ARCADE_SPOT = { x: 680, y: 1020, w: 170, h: 120, label: 'PIXEL PALACE' };

export function ensureArcade(state) {
  const d = state.depth;
  if (!d.arcade) d.arcade = { inside: false, tickets: 0, reflex: null, dash: null, grabs: 0, bestReflex: 0, bestDash: 0 };
  return d.arcade;
}

export function nearArcade(state) {
  const p = state.player;
  const dx = p.x - (ARCADE_SPOT.x + ARCADE_SPOT.w / 2);
  const dy = p.y - (ARCADE_SPOT.y + ARCADE_SPOT.h / 2);
  return dx * dx + dy * dy < 130 * 130;
}

export function stepArcade(state, dt) {
  const a = ensureArcade(state);
  a.inside = nearArcade(state);
  if (a.reflex && a.reflex.state === 'wait') {
    a.reflex.wait -= dt;
    if (a.reflex.wait <= 0) { a.reflex.state = 'go'; a.reflex.goAt = state.elapsed; }
  }
  if (a.reflex && a.reflex.state === 'go') {
    if (state.elapsed - a.reflex.goAt > 2.5) { a.reflex = null; state.dialogue = { who: 'Pixel Palace', text: 'Too slow — the light went out.', t: 3 }; }
  }
  if (a.dash && a.dash.state === 'run') {
    a.dash.left -= dt;
    const p = state.player;
    if (Math.hypot(p.x - 420, p.y - 1020) < 70) finishDash(state);
    else if (a.dash.left <= 0) { a.dash = null; state.dialogue = { who: 'Pixel Palace', text: 'Out of time on the dash.', t: 3 }; }
  }
}

// --- Reflex Rush ---
export function startReflex(state) {
  const a = ensureArcade(state);
  a.inside = nearArcade(state);
  if (!a.inside) return { ok: false, reason: 'step inside Pixel Palace first' };
  if (a.reflex) return { ok: false, reason: 'a reflex game is already running' };
  a.reflex = { state: 'wait', wait: 0.8 + state.rng() * 1.8, goAt: 0 };
  return { ok: true, line: 'Watch the light… punch the moment it turns green!' };
}

export function reflexPunch(state) {
  const a = ensureArcade(state);
  if (!a.reflex) return { ok: false, reason: 'start a reflex game first' };
  if (a.reflex.state === 'wait') {
    a.reflex = null;
    return { ok: false, reason: 'jumped the gun! No tickets.' };
  }
  const ms = Math.round((state.elapsed - a.reflex.goAt) * 1000);
  a.reflex = null;
  let won = 0;
  if (ms < 220) won = 30;
  else if (ms < 350) won = 18;
  else if (ms < 550) won = 8;
  if (won > 0) {
    a.tickets += won;
    if (!a.bestReflex || ms < a.bestReflex) a.bestReflex = ms;
    state.events.push({ kind: 'arcade-win', tickets: won });
    return { ok: true, line: `${ms}ms — ${won} tickets!` };
  }
  return { ok: true, line: `${ms}ms — too slow for tickets.` };
}

// --- Neon Dash ---
export function startDash(state) {
  const a = ensureArcade(state);
  a.inside = nearArcade(state);
  if (!a.inside) return { ok: false, reason: 'step inside Pixel Palace first' };
  if (a.dash) return { ok: false, reason: 'a dash is already running' };
  a.dash = { state: 'run', left: 14 };
  state.dialogue = { who: 'Pixel Palace', text: 'Neon Dash! Sprint to the beach arch at the west end — 14 seconds!', t: 4 };
  return { ok: true, line: 'Dash started — run west to the beach arch!' };
}

function finishDash(state) {
  const a = ensureArcade(state);
  const used = 14 - a.dash.left;
  a.dash = null;
  const won = used < 8 ? 40 : used < 11 ? 25 : 12;
  a.tickets += won;
  if (!a.bestDash || used < a.bestDash) a.bestDash = Math.round(used * 10) / 10;
  state.events.push({ kind: 'arcade-win', tickets: won });
  state.dialogue = { who: 'Pixel Palace', text: `Dash finished in ${used.toFixed(1)}s — ${won} tickets!`, t: 4 };
}

// --- Claw Grab ---
export function clawGrab(state) {
  const a = ensureArcade(state);
  a.inside = nearArcade(state);
  if (!a.inside) return { ok: false, reason: 'step inside Pixel Palace first' };
  if (state.player.cash < 10) return { ok: false, reason: 'a grab costs $10' };
  state.player.cash -= 10;
  a.grabs += 1;
  const roll = state.rng();
  let won = 0;
  let line = 'The claw drops it… nothing.';
  if (roll < 0.12) { won = 100; line = 'JACKPOT GRAB! The claw lifts the golden prize — 100 tickets!'; }
  else if (roll < 0.4) { won = 25; line = 'The claw holds! 25 tickets.'; }
  else if (roll < 0.7) { won = 10; line = 'A small plush — 10 tickets.'; }
  a.tickets += won;
  if (won > 0) state.events.push({ kind: 'arcade-win', tickets: won });
  return { ok: true, line };
}

// 10 tickets trade for $25 at the prize counter.
export function cashTickets(state) {
  const a = ensureArcade(state);
  if (a.tickets < 10) return { ok: false, reason: 'need at least 10 tickets to cash in' };
  const sets = Math.floor(a.tickets / 10);
  const cash = sets * 25;
  a.tickets -= sets * 10;
  state.player.cash += cash;
  return { ok: true, line: `Cashed ${sets * 10} tickets for $${cash}.` };
}

export function arcadeSummary(state) {
  const a = ensureArcade(state);
  return `Arcade: ${a.tickets} tickets, best reflex ${a.bestReflex || '—'}ms, best dash ${a.bestDash || '—'}s`;
}
