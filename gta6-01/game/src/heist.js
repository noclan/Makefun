// The big one: a multi-stage heist chain with a crew and a getaway.
// Stage 0 — Plan: scout the target vault (needs 40 respect).
// Stage 1 — Crew: recruit two crew members, $500 each, from the fixer.
// Stage 2 — Grab: reach the vault, hold the spot while the crew works.
// Stage 3 — Getaway: outrun a 4-star wanted level to the bridge.
// The payout is the biggest single payday in Solmar. Failing the
// getaway keeps the crew but burns the plan — plan again and go once more.

export const HEIST_SPOTS = {
  vault: { x: 2040, y: 1360 },
  bridge: { x: 3050, y: 1650 },
  fixer: { x: 1020, y: 2380 },
};

export function ensureHeist(state) {
  const d = state.depth;
  if (!d.heist) d.heist = { stage: 0, crew: 0, hold: 0, timer: 0, done: 0, payout: 0 };
  return d.heist;
}

// 0 idle, 1 planned, 2 crew ready, 3 grabbing, 4 getaway, 5 cooling down
export function planHeist(state) {
  const h = ensureHeist(state);
  if (h.stage !== 0) return { ok: false, reason: 'a heist is already in motion' };
  if ((state.respect || 0) < 40) return { ok: false, reason: 'the fixer only plans heists for 40+ respect' };
  h.stage = 1;
  h.crew = 0;
  state.dialogue = { who: 'The Fixer', text: 'The downtown vault. Two crew, $500 each, and we go tonight.', t: 5 };
  return { ok: true, line: 'Heist planned. Recruit 2 crew members.' };
}

export function recruitCrew(state) {
  const h = ensureHeist(state);
  if (h.stage !== 1) return { ok: false, reason: 'plan the heist first' };
  if (h.crew >= 2) return { ok: false, reason: 'crew is already full' };
  if (state.player.cash < 500) return { ok: false, reason: 'a crew member costs $500' };
  state.player.cash -= 500;
  h.crew += 1;
  const names = ['Mara the wheel', 'Silas the quiet'];
  state.dialogue = { who: 'The Fixer', text: `${names[h.crew - 1]} is in. ${2 - h.crew} more to go.`, t: 4 };
  if (h.crew >= 2) {
    h.stage = 2;
    state.dialogue = { who: 'The Fixer', text: 'Crew is set. Hit the downtown vault and hold the spot while Silas cracks it.', t: 5 };
  }
  return { ok: true, line: `Crew ${h.crew}/2 recruited.` };
}

export function stepHeist(state, dt) {
  const h = ensureHeist(state);
  if (h.stage === 0 || h.stage === 1) return;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  if (h.stage === 2) {
    const d = Math.hypot(px - HEIST_SPOTS.vault.x, py - HEIST_SPOTS.vault.y);
    if (d < 110) {
      h.hold += dt;
      if (h.hold >= 15) {
        h.stage = 3;
        h.hold = 0;
        h.timer = 150;
        state.wanted = 4;
        state.dialogue = { who: 'Silas', text: 'Vault is open — grab the gold and RUN. Cops everywhere. Bridge, now!', t: 5 };
        state.events.push({ kind: 'heist-grab' });
      }
    } else if (h.hold > 0) h.hold = Math.max(0, h.hold - dt);
    return;
  }
  if (h.stage === 3) {
    h.timer -= dt;
    if (h.timer <= 0) {
      h.stage = 0; h.crew = 0; h.hold = 0;
      state.dialogue = { who: 'The Fixer', text: 'Too slow — the crew scattered and the plan is burned.', t: 4 };
      return;
    }
    if (Math.hypot(px - HEIST_SPOTS.bridge.x, py - HEIST_SPOTS.bridge.y) < 110) {
      const payout = 8000;
      state.player.cash += payout;
      state.respect = (state.respect || 0) + 10;
      h.done += 1;
      h.payout += payout;
      h.stage = 0; h.crew = 0; h.hold = 0;
      state.dialogue = { who: 'Mama Rosa', text: `The whole city saw that getaway. +$${payout}, +10 respect!`, t: 5 };
      state.events.push({ kind: 'heist-done', amount: payout });
    }
  }
}

export function heistTarget(state) {
  const h = ensureHeist(state);
  if (h.stage === 2) return HEIST_SPOTS.vault;
  if (h.stage === 3) return HEIST_SPOTS.bridge;
  return null;
}

export function heistSummary(state) {
  const h = ensureHeist(state);
  return `Heist: stage ${h.stage}, crew ${h.crew}/2, completed ${h.done}, total $${h.payout}`;
}
