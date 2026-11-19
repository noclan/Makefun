// Progression: cash plus respect. Respect is the city's memory of
// Rico — it opens new missions, the VIP room, the heist, and better
// gear. Every system in the game feeds it: missions, jobs, races,
// fights, dancing, defending turf. Levels are named so the HUD can
// show Rico climbing from a nobody to a legend of Solmar Bay.

export const RESPECT_LEVELS = [
  { at: 0, name: 'Nobody' },
  { at: 10, name: 'Known Face' },
  { at: 25, name: 'Street Regular' },
  { at: 45, name: 'Night Owl' },
  { at: 65, name: 'Big Shot' },
  { at: 90, name: 'King of Solmar' },
  { at: 120, name: 'Legend of the Bay' },
];

export function respectLevel(state) {
  const r = state.respect || 0;
  let level = RESPECT_LEVELS[0];
  for (const l of RESPECT_LEVELS) if (r >= l.at) level = l;
  return level;
}

export function nextRespectLevel(state) {
  const r = state.respect || 0;
  for (const l of RESPECT_LEVELS) if (r < l.at) return l;
  return null;
}

export function earnRespect(state, amount, why) {
  const before = respectLevel(state);
  state.respect = (state.respect || 0) + amount;
  const after = respectLevel(state);
  if (after.at > before.at) {
    state.dialogue = { who: 'Solmar Bay', text: `Respect up! Rico is now a ${after.name}. New doors open across the city.`, t: 5 };
    state.events.push({ kind: 'respect-up', level: after.name });
  } else if (why) {
    state.events.push({ kind: 'respect', amount, why });
  }
  return state.respect;
}

// What the next story mission needs, if anything is still locked.
export function nextUnlock(state) {
  const next = state.nextMission;
  if (!next) return null;
  if (next <= 6) return { mission: next, need: 0 };
  const reqs = { 7: 10, 8: 15, 9: 20, 10: 25, 11: 30, 12: 40, 13: 45, 14: 50, 15: 55, 16: 60, 17: 70, 18: 80 };
  return { mission: next, need: reqs[next] || 0 };
}

export function progressionSummary(state) {
  const r = state.respect || 0;
  const level = respectLevel(state);
  const next = nextRespectLevel(state);
  return `Respect ${r} — ${level.name}${next ? ` (next: ${next.name} at ${next.at})` : ' (maxed)'}`;
}
