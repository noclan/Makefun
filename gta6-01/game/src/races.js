// Street races: checkpoint circuits against rival drivers.
// Pay the entry fee, hit every checkpoint in order, and beat the
// rivals to the line. Rivals are simulated as a pace clock — the
// player's checkpoints and time decide the result. Winning pays the
// prize, adds respect, and after three wins unlocks the Vela GT-R,
// a faster sports car that appears at the garage.

export const RACE_DEFS = [
  { id: 'beach', name: 'Beachfront Sprint', fee: 100, prize: 500, checkpoints: [{ x: 680, y: 680 }, { x: 680, y: 2040 }, { x: 1360, y: 2720 }, { x: 2040, y: 2380 }], rivalPace: 95 },
  { id: 'downtown', name: 'Downtown Loop', fee: 250, prize: 1200, checkpoints: [{ x: 1700, y: 680 }, { x: 2720, y: 1020 }, { x: 2380, y: 2040 }, { x: 1360, y: 1360 }], rivalPace: 120 },
  { id: 'grand', name: 'Solmar Grand Tour', fee: 500, prize: 3000, checkpoints: [{ x: 1020, y: 680 }, { x: 2720, y: 680 }, { x: 2720, y: 2380 }, { x: 680, y: 2720 }, { x: 1020, y: 1360 }], rivalPace: 150 },
];

export function ensureRaces(state) {
  const d = state.depth;
  if (!d.races) d.races = { active: null, wins: 0, runs: 0, unlockedGtr: false };
  return d.races;
}

export function startRace(state, id) {
  const r = ensureRaces(state);
  if (r.active) return { ok: false, reason: 'a race is already running' };
  const def = RACE_DEFS.find((x) => x.id === id);
  if (!def) return { ok: false, reason: 'no such race' };
  if (state.player.cash < def.fee) return { ok: false, reason: `${def.name} entry is $${def.fee}` };
  state.player.cash -= def.fee;
  r.active = { def, stage: 0, t: 0, rival: 0 };
  r.runs += 1;
  state.dialogue = { who: 'Race Marshal', text: `${def.name}! Hit every checkpoint in order — beat the rivals to the line.`, t: 4 };
  return { ok: true, line: `${def.name} started. Entry $${def.fee}.` };
}

export function raceTarget(state) {
  const r = ensureRaces(state);
  if (!r.active) return null;
  return r.active.def.checkpoints[r.active.stage];
}

export function stepRaces(state, dt) {
  const r = ensureRaces(state);
  if (!r.active) return;
  const a = r.active;
  a.t += dt;
  // Rivals cruise the circuit at their pace; their progress is a clock.
  a.rival += dt * (340 / a.def.rivalPace) * a.def.checkpoints.length;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const cp = a.def.checkpoints[a.stage];
  if (Math.hypot(px - cp.x, py - cp.y) < 95) {
    a.stage += 1;
    if (a.stage >= a.def.checkpoints.length) finishRace(state);
    else state.dialogue = { who: 'Race Marshal', text: `Checkpoint ${a.stage}/${a.def.checkpoints.length} — keep pushing!`, t: 3 };
  }
}

function finishRace(state) {
  const r = ensureRaces(state);
  const a = r.active;
  r.active = null;
  // Rivals finish when their pace clock passes the full circuit.
  const rivalTime = a.def.rivalPace;
  const won = a.t <= rivalTime;
  if (won) {
    state.player.cash += a.def.prize;
    state.respect = (state.respect || 0) + 5;
    r.wins += 1;
    state.dialogue = { who: 'Race Marshal', text: `You win the ${a.def.name} in ${a.t.toFixed(1)}s! Prize $${a.def.prize}.`, t: 5 };
    state.events.push({ kind: 'race-win', id: a.def.id, amount: a.def.prize });
    if (r.wins >= 3 && !r.unlockedGtr) {
      r.unlockedGtr = true;
      // A faster car rolls up at the garage.
      state.cars.push({ type: 'sports', name: 'Vela GT-R', color: '#ffd23e', x: 2380, y: 1980, angle: 0, speed: 0, hp: 100, maxHp: 100, top: 720, accel: 540, grip: 3.8, smoke: 0, parked: true, driver: null, skid: 0 });
      state.dialogue = { who: 'Race Marshal', text: 'Three wins! The Vela GT-R is waiting for you at the garage.', t: 5 };
    }
  } else {
    state.dialogue = { who: 'Race Marshal', text: `Rivals took it in ${rivalTime.toFixed(1)}s — you ran ${a.t.toFixed(1)}s. Run it back!`, t: 4 };
    state.events.push({ kind: 'race-lose', id: a.def.id });
  }
}

export function racesSummary(state) {
  const r = ensureRaces(state);
  return `Races: ${r.wins} wins in ${r.runs} runs${r.unlockedGtr ? ', GT-R unlocked' : ''}`;
}
