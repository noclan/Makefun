// Second story arc for SOLMAR: missions 7-18.
// Arc A "Varela War" (7-12) settles the score with the Varela crew.
// Arc B "Neon Nights" (13-18) runs the night side of Solmar Bay.
// Every mission is a short chain of stops: drive to each stop in order.
// Some stops add a twist: a stakeout (linger near a spot), a tail
// (shadow a moving car without getting too close), a timed run, or a
// heat stage (arrive hot, then only finish once the wanted level cools).
// This file never imports the first arc; the first arc calls into here.

export const MISSION2_DEFS = [
  { id: 7, arc: 'Varela War', title: 'Smoke on the Waterfront', kind: 'route', reward: 900, respect: 6, respectReq: 10, text: 'The Varelas torched Rosa\'s warehouse. Check the marina depot, then report back to the café.', spots: [{ x: 680, y: 2720, label: 'Marina depot' }, { x: 765, y: 1900, label: 'Café Luna' }] },
  { id: 8, arc: 'Varela War', title: 'Eyes on Pier 9', kind: 'stakeout', reward: 1100, respect: 7, respectReq: 15, text: 'Varela lookouts watch the pier. Park nearby and watch them for a while, then slip away to the respray shop.', spots: [{ x: 680, y: 2380, label: 'Pier 9' }, { x: 1495, y: 755, label: 'Respray shop' }], dwell: 12 },
  { id: 9, arc: 'Varela War', title: 'Three Drops, No Mistakes', kind: 'route', reward: 1300, respect: 8, respectReq: 20, text: 'Rosa\'s couriers need cover. Hit all three drop points before the clock runs out.', spots: [{ x: 1020, y: 680, label: 'Drop one' }, { x: 2040, y: 1020, label: 'Drop two' }, { x: 2380, y: 2380, label: 'Drop three' }], timer: 120 },
  { id: 10, arc: 'Varela War', title: 'Shadow the Lieutenant', kind: 'tail', reward: 1500, respect: 9, respectReq: 25, text: 'A Varela lieutenant is driving across town. Follow him, stay in the gold zone, and never get close enough to be seen.', spots: [{ x: 2100, y: 700, label: 'Tail the lieutenant' }], dwell: 10 },
  { id: 11, arc: 'Varela War', title: 'Block by Block', kind: 'route', reward: 1800, respect: 10, respectReq: 30, text: 'Take the streets back one block at a time. Visit each corner and plant Rosa\'s flag.', spots: [{ x: 1020, y: 1360, label: 'Corner one' }, { x: 1700, y: 2040, label: 'Corner two' }, { x: 2720, y: 1020, label: 'Corner three' }] },
  { id: 12, arc: 'Varela War', title: 'The Varela Stronghold', kind: 'heat', reward: 2500, respect: 14, respectReq: 40, text: 'Walk right up to their stronghold and make noise. Then lose the heat and get home to the café.', spots: [{ x: 2720, y: 1700, label: 'Varela stronghold' }, { x: 765, y: 1900, label: 'Café Luna' }] },
  { id: 13, arc: 'Neon Nights', title: 'Neon Sign-Up', kind: 'route', reward: 1200, respect: 8, respectReq: 45, text: 'The night crowd wants a driver. Show your face at the nightclub, then at the casino.', spots: [{ x: 1020, y: 2380, label: 'Club Neon' }, { x: 1700, y: 1360, label: 'Casino Solmar' }] },
  { id: 14, arc: 'Neon Nights', title: 'The High Roller', kind: 'stakeout', reward: 1600, respect: 9, respectReq: 50, text: 'A high roller is counting chips at the casino. Watch the doors until he moves, then meet Rosa at the marina.', spots: [{ x: 1700, y: 1360, label: 'Casino doors' }, { x: 700, y: 2650, label: 'Marina meet' }], dwell: 10 },
  { id: 15, arc: 'Neon Nights', title: 'Midnight Courier', kind: 'route', reward: 1400, respect: 9, respectReq: 55, text: 'Night deliveries pay double. Three stops, one hundred seconds, no excuses.', spots: [{ x: 680, y: 1020, label: 'Arcade pickup' }, { x: 2380, y: 680, label: 'Downtown drop' }, { x: 1360, y: 2720, label: 'Old Town drop' }], timer: 100 },
  { id: 16, arc: 'Neon Nights', title: 'Find the Mole', kind: 'stakeout', reward: 2000, respect: 11, respectReq: 60, text: 'Somebody in Rosa\'s crew talks to the Varelas. Watch the arcade crowd, then bring what you learn to the garage.', spots: [{ x: 680, y: 1020, label: 'Arcade crowd' }, { x: 2380, y: 2040, label: 'Rico\'s garage' }], dwell: 12 },
  { id: 17, arc: 'Neon Nights', title: 'Grand Prix of Solmar', kind: 'route', reward: 2200, respect: 12, respectReq: 70, text: 'An illegal grand prix across the whole city. Four checkpoints, beat the clock, beat them all.', spots: [{ x: 1020, y: 680, label: 'Checkpoint 1' }, { x: 2720, y: 1360, label: 'Checkpoint 2' }, { x: 680, y: 2380, label: 'Checkpoint 3' }, { x: 3050, y: 1650, label: 'Finish line' }], timer: 150 },
  { id: 18, arc: 'Neon Nights', title: 'Gold Rush Finale', kind: 'route', reward: 5000, respect: 20, respectReq: 80, text: 'One last job. Collect the gold from three stashes, then run the bridge like the whole city is watching.', spots: [{ x: 1700, y: 680, label: 'Stash one' }, { x: 2380, y: 1700, label: 'Stash two' }, { x: 1020, y: 2720, label: 'Stash three' }, { x: 3050, y: 1650, label: 'The bridge' }] },
];

export function mission2Def(id) {
  return MISSION2_DEFS.find((d) => d.id === id) || null;
}

export function mission2Target(m, state) {
  if (!m || !m.def) return { x: 765, y: 1900 };
  if (m.def.kind === 'tail' && m.tail) return { x: m.tail.x, y: m.tail.y };
  const spot = m.def.spots[Math.min(m.stage, m.def.spots.length - 1)];
  return spot || { x: 765, y: 1900 };
}

export function startMission2(state, id) {
  const def = mission2Def(id);
  if (!def) return null;
  const respect = state.respect || 0;
  if (respect < def.respectReq) {
    state.dialogue = { who: 'Mama Rosa', text: `Not yet, Rico. You need ${def.respectReq} respect for "${def.title}" — you have ${respect}. Work the streets first.`, t: 5 };
    return null;
  }
  const m = { def, stage: 0, timer: def.timer || 0, dwell: 0, done: false, failed: false, tail: null };
  if (def.kind === 'tail') m.tail = { x: 2100, y: 700, angle: 0.4 };
  if (def.kind === 'heat') state.wanted = 3;
  state.mission = m;
  state.dialogue = { who: 'Mama Rosa', text: def.text, t: 5 };
  state.events.push({ kind: 'mission-start', id });
  return m;
}

function arriveAt(state, m, label) {
  m.stage += 1;
  if (m.stage >= m.def.spots.length) { completeMission2(state); return; }
  const next = m.def.spots[m.stage];
  state.dialogue = { who: 'Mama Rosa', text: `${label} done. Next: ${next.label}.`, t: 4 };
}

export function stepMissions2(state, dt) {
  const m = state.mission;
  if (!m || m.done || m.def.id < 7) return;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.failed = true;
      state.dialogue = { who: 'Mama Rosa', text: 'Out of time, Rico. Try it again.', t: 4 };
      return;
    }
  }
  if (m.def.kind === 'tail' && m.tail) {
    const t = m.tail;
    t.angle += dt * 0.22;
    t.x += Math.cos(t.angle) * 130 * dt;
    t.y += Math.sin(t.angle) * 130 * dt;
    if (t.x < 600) t.x = 600;
    if (t.x > 2900) t.x = 2900;
    if (t.y < 300) t.y = 300;
    if (t.y > 2900) t.y = 2900;
    const d = Math.hypot(px - t.x, py - t.y);
    if (d < 90) {
      m.failed = true;
      state.dialogue = { who: 'Lieutenant', text: 'You\'re tailing me! The crew will hear about this.', t: 4 };
      return;
    }
    if (d < 430) {
      m.dwell += dt;
      if (m.dwell > (m.def.dwell || 10)) completeMission2(state);
    }
    return;
  }
  if (m.def.kind === 'stakeout') {
    const spot = m.def.spots[m.stage];
    const d = Math.hypot(px - spot.x, py - spot.y);
    if (m.stage === 0) {
      if (d < 280) {
        m.dwell += dt;
        if (m.dwell >= (m.def.dwell || 10)) { m.dwell = 0; arriveAt(state, m, spot.label); }
      } else if (m.dwell > 0) m.dwell = Math.max(0, m.dwell - dt);
      return;
    }
    if (d < 95) arriveAt(state, m, spot.label);
    return;
  }
  if (m.def.kind === 'heat') {
    const spot = m.def.spots[m.stage];
    const d = Math.hypot(px - spot.x, py - spot.y);
    if (m.stage === 0) {
      if (d < 95) { m.stage = 1; state.dialogue = { who: 'Mama Rosa', text: 'Now shake them off. Come home only when the heat is down.', t: 4 }; }
      return;
    }
    if (state.wanted > 1) return; // finishing spot only counts once the heat cools
    if (d < 95) completeMission2(state);
    return;
  }
  const spot = m.def.spots[m.stage];
  const d = Math.hypot(px - spot.x, py - spot.y);
  if (d < 95) arriveAt(state, m, spot.label);
}

export function completeMission2(state) {
  const m = state.mission;
  if (!m) return;
  m.done = true;
  state.player.cash += m.def.reward;
  state.respect = (state.respect || 0) + (m.def.respect || 0);
  state.completed = [...(state.completed || []), m.def.id];
  state.dialogue = { who: 'Mama Rosa', text: `Beautiful work, Rico. +$${m.def.reward}, +${m.def.respect || 0} respect.`, t: 5 };
  state.events.push({ kind: 'mission-done', id: m.def.id, reward: m.def.reward });
  state.nextMission = m.def.id < 30 ? m.def.id + 1 : null;
}

export function failMission2(state) {
  if (state.mission && state.mission.def.id >= 7) {
    state.mission.failed = true;
    state.mission = null;
  }
}
