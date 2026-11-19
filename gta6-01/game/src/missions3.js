// Final story arc for SOLMAR: missions 19-30.
// Arc C "King of the Bay" (19-24) crowns Rico as the city's new power.
// Arc D "Legacy" (25-30) is the farewell run: one last score, one last
// chase, and the ending. Each mission is a chain of legs; a leg is a
// drive-to stop, a watch (linger nearby), a tail, or a heat leg where
// the finish only counts once the wanted level has cooled off.

export const MISSION3_DEFS = [
  { id: 19, arc: 'King of the Bay', title: 'Crown the Bay', kind: 'route', reward: 2800, respect: 14, respectReq: 85, text: 'The last Varela corner still flies their flag. Take it down, show your face at the marina, then come home to the café.', legs: [{ x: 2720, y: 2380, note: 'Last Varela corner' }, { x: 700, y: 2650, note: 'Marina' }, { x: 765, y: 1900, note: 'Café Luna' }] },
  { id: 20, arc: 'King of the Bay', title: "The Don's Table", kind: 'stakeout', reward: 3200, respect: 15, respectReq: 95, text: 'Old Don Maro eats at the same table every night. Watch the restaurant until he leaves, then report to Rosa.', legs: [{ x: 2040, y: 1700, note: "Don Maro's table", kind: 'watch', dwell: 10 }, { x: 765, y: 1900, note: 'Café Luna' }] },
  { id: 21, arc: 'King of the Bay', title: 'Five Boroughs Run', kind: 'route', reward: 3600, respect: 16, respectReq: 105, text: 'Four districts, one hundred thirty seconds. Show the whole bay you can be everywhere at once.', legs: [{ x: 680, y: 680, note: 'Beachfront' }, { x: 2380, y: 680, note: 'Downtown' }, { x: 2380, y: 2380, note: 'Old Town' }, { x: 1020, y: 2720, note: 'Marina' }], timer: 130 },
  { id: 22, arc: 'King of the Bay', title: 'Shadow the Fixer', kind: 'tail', reward: 4000, respect: 17, respectReq: 115, text: 'The fixer moves the Varelas\' money. Stay in the gold zone behind him and never let him see your face.', legs: [{ x: 2100, y: 700, note: 'Tail the fixer' }], dwell: 10 },
  { id: 23, arc: 'King of the Bay', title: 'The Island Accord', kind: 'route', reward: 4500, respect: 18, respectReq: 125, text: 'The island families want a word. Cross the bridge, meet them at the island café, take in the lookout, then come home.', legs: [{ x: 3050, y: 1650, note: 'The bridge' }, { x: 3200, y: 2000, note: 'Island café' }, { x: 3250, y: 1200, note: 'Island lookout' }, { x: 765, y: 1900, note: 'Café Luna' }] },
  { id: 24, arc: 'King of the Bay', title: 'King of the Bay', kind: 'heat', reward: 6000, respect: 22, respectReq: 135, text: 'Walk up to the last stronghold and announce yourself to the whole city. Then shake the heat and come home a king.', legs: [{ x: 2720, y: 1700, note: 'Last stronghold' }, { x: 765, y: 1900, note: 'Café Luna' }] },
  { id: 25, arc: 'Legacy', title: 'One Last Score', kind: 'route', reward: 5000, respect: 18, respectReq: 145, text: 'Rosa has one last score in her. Casino, port, bridge — one hundred fifty seconds, and it all has to be perfect.', legs: [{ x: 1700, y: 1360, note: 'Casino Solmar' }, { x: 2720, y: 2720, note: 'Portside' }, { x: 3050, y: 1650, note: 'The bridge' }, { x: 765, y: 1900, note: 'Café Luna' }], timer: 150 },
  { id: 26, arc: 'Legacy', title: 'The Farewell Tour', kind: 'route', reward: 4200, respect: 16, respectReq: 155, text: 'Say goodbye to the night side properly. Club, arcade, marina — one last lap past every place that made you.', legs: [{ x: 1020, y: 2380, note: 'Club Neon' }, { x: 680, y: 1020, note: 'Arcade' }, { x: 700, y: 2650, note: 'Marina' }, { x: 765, y: 1900, note: 'Café Luna' }] },
  { id: 27, arc: 'Legacy', title: 'Ghost of the Marina', kind: 'stakeout', reward: 4800, respect: 18, respectReq: 165, text: 'Somebody has been watching Rosa\'s boats from Pier 9. Watch the pier yourself, then lose whoever follows you at the respray.', legs: [{ x: 680, y: 2380, note: 'Pier 9', kind: 'watch', dwell: 12 }, { x: 1495, y: 755, note: 'Respray shop' }] },
  { id: 28, arc: 'Legacy', title: 'The Long Chase', kind: 'tail', reward: 5500, respect: 20, respectReq: 175, text: 'The last Varela driver is running for the bridge. Follow him across the whole city and do not lose him.', legs: [{ x: 2100, y: 700, note: 'Tail the runner' }], dwell: 12 },
  { id: 29, arc: 'Legacy', title: 'Everything on Gold', kind: 'route', reward: 6500, respect: 22, respectReq: 185, text: 'Five stops, one hundred forty seconds, everything you own on the line. This is the run they will tell stories about.', legs: [{ x: 1020, y: 680, note: 'Stop one' }, { x: 2720, y: 1020, note: 'Stop two' }, { x: 680, y: 2380, note: 'Stop three' }, { x: 2380, y: 2720, note: 'Stop four' }, { x: 3050, y: 1650, note: 'Finish line' }], timer: 140 },
  { id: 30, arc: 'Legacy', title: 'Legacy', kind: 'heat', reward: 10000, respect: 30, respectReq: 195, text: 'The final stronghold, the final chase, the final bridge. Finish this and Solmar Bay is yours forever, Rico.', legs: [{ x: 2720, y: 1700, note: 'Final stronghold' }, { x: 3050, y: 1650, note: 'The bridge' }] },
];

export function mission3Def(id) {
  return MISSION3_DEFS.find((d) => d.id === id) || null;
}

export function mission3Target(m, state) {
  if (!m || !m.def) return { x: 765, y: 1900 };
  if (m.def.kind === 'tail' && m.tail) return { x: m.tail.x, y: m.tail.y };
  const leg = m.def.legs[Math.min(m.leg, m.def.legs.length - 1)];
  return leg || { x: 765, y: 1900 };
}

export function startMission3(state, id) {
  const def = mission3Def(id);
  if (!def) return null;
  const respect = state.respect || 0;
  if (respect < def.respectReq) {
    state.dialogue = { who: 'Mama Rosa', text: `Not yet, Rico. "${def.title}" needs ${def.respectReq} respect — you have ${respect}. Earn the city's trust first.`, t: 5 };
    return null;
  }
  const m = { def, leg: 0, timer: def.timer || 0, dwell: 0, done: false, failed: false, tail: null };
  if (def.kind === 'tail') m.tail = { x: 2100, y: 700, angle: 0.4 };
  if (def.kind === 'heat') state.wanted = 3;
  state.mission = m;
  state.dialogue = { who: 'Mama Rosa', text: def.text, t: 5 };
  state.events.push({ kind: 'mission-start', id });
  return m;
}

function advanceLeg(state, m, note) {
  m.leg += 1;
  m.dwell = 0;
  if (m.leg >= m.def.legs.length) { completeMission3(state); return; }
  const next = m.def.legs[m.leg];
  state.dialogue = { who: 'Mama Rosa', text: `${note} done. Next: ${next.note}.`, t: 4 };
}

export function stepMissions3(state, dt) {
  const m = state.mission;
  if (!m || m.done || m.def.id < 19) return;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.failed = true;
      state.dialogue = { who: 'Mama Rosa', text: 'Out of time, Rico. One more try — you know the roads now.', t: 4 };
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
      state.dialogue = { who: 'Driver', text: 'You\'re tailing me! The whole crew will know your face now.', t: 4 };
      return;
    }
    if (d < 430) {
      m.dwell += dt;
      if (m.dwell > (m.def.dwell || 10)) completeMission3(state);
    }
    return;
  }
  const leg = m.def.legs[m.leg];
  if (!leg) { completeMission3(state); return; }
  const d = Math.hypot(px - leg.x, py - leg.y);
  if (leg.kind === 'watch') {
    if (d < 280) {
      m.dwell += dt;
      if (m.dwell >= (leg.dwell || 10)) advanceLeg(state, m, leg.note);
    } else if (m.dwell > 0) m.dwell = Math.max(0, m.dwell - dt);
    return;
  }
  if (m.def.kind === 'heat' && m.leg === 0) {
    if (d < 95) {
      m.leg = 1;
      m.dwell = 0;
      state.dialogue = { who: 'Mama Rosa', text: 'They all heard you. Now cool off — the finish only counts when the heat is down.', t: 4 };
    }
    return;
  }
  if (m.def.kind === 'heat' && m.leg === m.def.legs.length - 1 && state.wanted > 1) return;
  if (d < 95) advanceLeg(state, m, leg.note);
}

export function completeMission3(state) {
  const m = state.mission;
  if (!m) return;
  m.done = true;
  state.player.cash += m.def.reward;
  state.respect = (state.respect || 0) + (m.def.respect || 0);
  state.completed = [...(state.completed || []), m.def.id];
  if (m.def.id === 30) {
    state.ending = 'king';
    state.dialogue = { who: 'Mama Rosa', text: `Solmar Bay is yours now, Rico. +$${m.def.reward}. Legacy complete — King of the Bay.`, t: 6 };
  } else {
    state.dialogue = { who: 'Mama Rosa', text: `Beautiful work, Rico. +$${m.def.reward}, +${m.def.respect || 0} respect.`, t: 5 };
  }
  state.events.push({ kind: 'mission-done', id: m.def.id, reward: m.def.reward });
  state.nextMission = m.def.id < 30 ? m.def.id + 1 : null;
}

export function failMission3(state) {
  if (state.mission && state.mission.def.id >= 19) {
    state.mission.failed = true;
    state.mission = null;
  }
}
