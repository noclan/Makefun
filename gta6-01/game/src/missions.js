// Mama Rosa story arc: 6 missions, objective marker + arrow, dialogue, rewards.
import { MISSION_DEFS } from './config.js';
import { clamp } from './random.js';
import { startMission2, stepMissions2, mission2Target } from './missions2.js';
import { startMission3, stepMissions3, mission3Target } from './missions3.js';

const SPOTS = {
  market: { x: 1650, y: 1050 }, cafe: { x: 765, y: 1900 }, marina: { x: 700, y: 2650 },
  courier: { x: 2100, y: 700 }, respray: { x: 1495, y: 755 }, north: { x: 2300, y: 500 },
  bridge: { x: 3050, y: 1650 }, south: { x: 900, y: 2900 },
};
export function missionTarget(m, state) {
  if (m.def.id >= 19) return mission3Target(m, state);
  if (m.def.id >= 7) return mission2Target(m, state);
  switch (m.def.kind) {
    case 'drive': return SPOTS.market;
    case 'pickup': return m.stage === 0 ? SPOTS.marina : SPOTS.cafe;
    case 'tail': return state.tailTarget || SPOTS.courier;
    case 'escape': return state.wanted >= 3 ? SPOTS.respray : SPOTS.north;
    case 'deliver': return SPOTS.south;
    case 'heist': return SPOTS.bridge;
    default: return SPOTS.cafe;
  }
}
export function startMission(state, id) {
  if (id >= 19) return startMission3(state, id);
  if (id >= 7) return startMission2(state, id);
  const def = MISSION_DEFS.find(d => d.id === id);
  if (!def) return null;
  const m = { def, stage: 0, timer: def.kind === 'deliver' ? 90 : 0, done: false, failed: false, tailDist: 0 };
  state.mission = m;
  state.dialogue = { who: 'Mama Rosa', text: def.text, t: 5 };
  if (def.kind === 'escape') state.wanted = 3;
  if (def.kind === 'tail') state.tailTarget = { x: 2100, y: 700, angle: 0 };
  if (def.kind === 'heist') state.wanted = 4;
  state.events.push({ kind: 'mission-start', id });
  return m;
}
export function stepMissions(state, dt) {
  const m = state.mission;
  if (!m || m.done) return;
  if (m.def.id >= 19) { stepMissions3(state, dt); return; }
  if (m.def.id >= 7) { stepMissions2(state, dt); return; }
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
  if (m.def.kind === 'deliver') { m.timer -= dt; if (m.timer <= 0) { m.failed = true; state.dialogue = { who: 'Mama Rosa', text: 'Too slow, Rico. Try again.', t: 4 }; } }
  if (m.def.kind === 'tail' && state.tailTarget) {
    const t = state.tailTarget;
    t.angle += dt * 0.25; t.x += Math.cos(t.angle) * 120 * dt; t.y += Math.sin(t.angle) * 120 * dt;
    if (t.x < 600) t.x = 600; if (t.x > 2900) t.x = 2900; if (t.y < 300) t.y = 300; if (t.y > 2900) t.y = 2900;
    const d = Math.hypot(px - t.x, py - t.y);
    if (d < 90) { m.failed = true; state.dialogue = { who: 'Courier', text: 'You\'re following me! The Varela crew knows now.', t: 4 }; }
    else if (d < 420) m.tailDist += dt;
    if (m.tailDist > 12) completeMission(state);
    return;
  }
  if (m.def.kind === 'escape' && state.wanted >= 3) {
    // Must lose the heat first: reaching the respray only counts once wanted drops.
    return;
  }
  const tgt = missionTarget(m, state);
  const d = Math.hypot(px - tgt.x, py - tgt.y);
  if (d < 95) {
    if (m.def.kind === 'pickup' && m.stage === 0) {
      m.stage = 1; state.dialogue = { who: 'Cousin Leo', text: 'Rico! Get me to Café Luna, fast.', t: 4 }; return;
    }
    completeMission(state);
  }
}
export function completeMission(state) {
  const m = state.mission; if (!m) return;
  m.done = true;
  state.player.cash += m.def.reward;
  state.respect = (state.respect || 0) + 2;
  state.completed = [...(state.completed || []), m.def.id];
  state.dialogue = { who: 'Mama Rosa', text: `Beautiful work, Rico. +$${m.def.reward}.`, t: 5 };
  state.events.push({ kind: 'mission-done', id: m.def.id, reward: m.def.reward });
  if (m.def.id < 6) state.nextMission = m.def.id + 1; else if (m.def.id === 6) state.nextMission = 7; else state.nextMission = null;
}
export function failMission(state) {
  if (state.mission) { state.mission.failed = true; state.mission = null; }
}
export function nextMissionId(state) {
  if (!state.completed || state.completed.length === 0) return 1;
  return Math.min(6, Math.max(...state.completed) + 1);
}
