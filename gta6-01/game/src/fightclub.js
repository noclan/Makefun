// The Basement: an underground fight club under a downtown warehouse.
// Walk in, put up your fists, and work through the rounds. Each round
// brings a tougher opponent; every round won pays cash and respect.
// The opponent swings on a timer — keep moving and punch back.
// Losing a round costs health and ends the night.

export const FIGHT_SPOT = { x: 2380, y: 1020, w: 170, h: 120, label: 'THE BASEMENT' };

const OPPONENTS = [
  { name: 'Little Eddie', hp: 60, dmg: 6, swing: 1.6 },
  { name: 'Big Marla', hp: 90, dmg: 9, swing: 1.4 },
  { name: 'Knuckles', hp: 130, dmg: 12, swing: 1.2 },
  { name: 'The Professor', hp: 170, dmg: 15, swing: 1.0 },
  { name: 'El Toro', hp: 230, dmg: 18, swing: 0.9 },
];

export function ensureFight(state) {
  const d = state.depth;
  if (!d.fight) d.fight = { inside: false, active: false, round: 0, foeHp: 0, foeMax: 0, swingT: 0, wins: 0, best: 0, earnings: 0 };
  return d.fight;
}

export function nearFight(state) {
  const p = state.player;
  const dx = p.x - (FIGHT_SPOT.x + FIGHT_SPOT.w / 2);
  const dy = p.y - (FIGHT_SPOT.y + FIGHT_SPOT.h / 2);
  return dx * dx + dy * dy < 130 * 130;
}

export function startFight(state) {
  const f = ensureFight(state);
  f.inside = nearFight(state);
  if (!f.inside) return { ok: false, reason: 'step inside The Basement first' };
  if (f.active) return { ok: false, reason: 'a fight is already on' };
  if (state.player.health <= 20) return { ok: false, reason: 'too hurt to fight — heal up first' };
  f.active = true;
  f.round = 1;
  const foe = OPPONENTS[0];
  f.foeHp = foe.hp;
  f.foeMax = foe.hp;
  f.swingT = foe.swing;
  state.dialogue = { who: 'The Announcer', text: `Round 1: Rico Vega versus ${foe.name}!`, t: 4 };
  return { ok: true, line: `Round 1 against ${foe.name}.` };
}

function foeOf(f) {
  return OPPONENTS[Math.min(f.round - 1, OPPONENTS.length - 1)];
}

// A punch thrown by the player while a fight is on lands on the foe.
export function fightPunch(state) {
  const f = ensureFight(state);
  if (!f.active) return false;
  f.foeHp -= 20;
  state.events.push({ kind: 'fight-hit', round: f.round });
  if (f.foeHp <= 0) winRound(state);
  return true;
}

function winRound(state) {
  const f = ensureFight(state);
  const prize = 120 + f.round * 60;
  state.player.cash += prize;
  state.respect = (state.respect || 0) + 3;
  f.wins += 1;
  f.earnings += prize;
  if (f.round > f.best) f.best = f.round;
  state.events.push({ kind: 'fight-win', round: f.round, amount: prize });
  if (f.round >= OPPONENTS.length) {
    f.active = false;
    state.dialogue = { who: 'The Announcer', text: `Rico Vega beats them all! Champion of the night — $${prize} for the final round.`, t: 5 };
    return;
  }
  f.round += 1;
  const foe = foeOf(f);
  f.foeHp = foe.hp;
  f.foeMax = foe.hp;
  f.swingT = foe.swing;
  state.dialogue = { who: 'The Announcer', text: `Round ${f.round}: ${foe.name} steps in. Prize $${120 + f.round * 60}.`, t: 4 };
}

function loseFight(state) {
  const f = ensureFight(state);
  f.active = false;
  state.player.health = Math.max(5, state.player.health - 10);
  state.dialogue = { who: 'The Announcer', text: 'Rico goes down! The crowd groans. Come back stronger.', t: 4 };
  state.events.push({ kind: 'fight-lose', round: f.round });
}

export function stepFight(state, dt) {
  const f = ensureFight(state);
  f.inside = nearFight(state);
  if (!f.active) return;
  if (!f.inside) { // walking out forfeits the fight
    f.active = false;
    state.dialogue = { who: 'The Announcer', text: 'Rico leaves the ring — the fight is forfeited.', t: 4 };
    return;
  }
  const foe = foeOf(f);
  f.swingT -= dt;
  if (f.swingT <= 0) {
    f.swingT = foe.swing;
    // The foe only lands the swing if Rico is standing close to the ring.
    state.player.health = Math.max(1, state.player.health - foe.dmg);
    state.events.push({ kind: 'fight-hurt', amount: foe.dmg });
    if (state.player.health <= 5) loseFight(state);
  }
}

export function fightSummary(state) {
  const f = ensureFight(state);
  return `Fight club: ${f.wins} rounds won, best round ${f.best}, $${f.earnings} earned`;
}
