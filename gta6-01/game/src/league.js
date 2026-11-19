// Racing league championship: a five-race ladder that builds on the
// street races. Start each round at the league HQ, beat the clock
// through the checkpoints, and bank season points — gold pace earns
// 25, silver 18, bronze 15. Reach 100 points and you are crowned
// Solmar Champion: $10,000 and a pile of respect.

export const LEAGUE_SPOT = { x: 2380, y: 1020, label: 'League HQ' };
export const LEAGUE_RACES = [
  { id: 1, name: 'Beachfront Sprint', par: 55, points: 25, checkpoints: [{ x: 680, y: 1020 }, { x: 1020, y: 680 }, { x: 1360, y: 1020 }] },
  { id: 2, name: 'Downtown Dash', par: 70, points: 25, checkpoints: [{ x: 1700, y: 680 }, { x: 2380, y: 1020 }, { x: 2040, y: 1360 }, { x: 1700, y: 1020 }] },
  { id: 3, name: 'Marina Loop', par: 75, points: 25, checkpoints: [{ x: 680, y: 2380 }, { x: 1360, y: 2720 }, { x: 2040, y: 2380 }, { x: 1020, y: 2720 }] },
  { id: 4, name: 'Old Town Trial', par: 80, points: 25, checkpoints: [{ x: 1700, y: 1700 }, { x: 2380, y: 2040 }, { x: 1360, y: 2380 }, { x: 1700, y: 2040 }] },
  { id: 5, name: 'Grand Bay Finale', par: 110, points: 25, checkpoints: [{ x: 1020, y: 680 }, { x: 2720, y: 1360 }, { x: 680, y: 2380 }, { x: 3050, y: 1650 }] },
];
export const CHAMPION_POINTS = 100;

export function ensureLeague(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.league) {
    state.depth.league = { points: 0, raceIdx: 0, active: null, won: false, best: null, results: [] };
  }
  return state.depth.league;
}

export function stepLeague(state, dt) {
  const lg = ensureLeague(state);
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const edge = state.depth && state.depth.actionEdge;
  if (lg.active) {
    const race = LEAGUE_RACES.find((r) => r.id === lg.active.raceId);
    if (!race) { lg.active = null; return; }
    lg.active.t += dt;
    const cp = race.checkpoints[lg.active.stage];
    const dx = px - cp.x, dy = py - cp.y;
    if (dx * dx + dy * dy < 95 * 95) {
      lg.active.stage += 1;
      if (lg.active.stage >= race.checkpoints.length) {
        const t = lg.active.t;
        let pts = 15;
        let medal = 'bronze';
        if (t <= race.par) { pts = 25; medal = 'gold'; }
        else if (t <= race.par * 1.25) { pts = 18; medal = 'silver'; }
        lg.points += pts;
        lg.results.push({ raceId: race.id, t: Math.round(t * 10) / 10, medal });
        if (!lg.best || t < lg.best.t) lg.best = { raceId: race.id, t: Math.round(t * 10) / 10 };
        state.player.cash += pts * 20;
        state.respect = (state.respect || 0) + 3;
        state.dialogue = { who: 'League', text: `${race.name}: ${medal} pace in ${t.toFixed(1)}s! +${pts} pts, +$${pts * 20}. Season: ${lg.points} pts.`, t: 4 };
        state.events.push({ kind: 'league-race-done', raceId: race.id, points: pts });
        lg.raceIdx += 1;
        lg.active = null;
        if (lg.points >= CHAMPION_POINTS && !lg.won) {
          lg.won = true;
          state.player.cash += 10000;
          state.respect = (state.respect || 0) + 25;
          state.dialogue = { who: 'League', text: 'CHAMPION OF SOLMAR! The trophy is yours. +$10000, +25 respect.', t: 6 };
          state.events.push({ kind: 'league-champion' });
        }
      } else {
        state.dialogue = { who: 'League', text: `Checkpoint ${lg.active.stage + 1}/${race.checkpoints.length} — keep pushing!`, t: 2 };
      }
    }
    return;
  }
  if (lg.raceIdx >= LEAGUE_RACES.length) return;
  const dx = px - LEAGUE_SPOT.x, dy = py - LEAGUE_SPOT.y;
  if (dx * dx + dy * dy < 95 * 95 && edge) {
    const race = LEAGUE_RACES[lg.raceIdx];
    lg.active = { raceId: race.id, stage: 0, t: 0 };
    state.dialogue = { who: 'League', text: `${race.name} — race ${lg.raceIdx + 1}/5! Gold pace: ${race.par}s. Go!`, t: 4 };
    state.events.push({ kind: 'league-race-start', raceId: race.id });
    state.depth.actionEdge = false;
  }
}

export function leagueTarget(state) {
  const lg = ensureLeague(state);
  if (lg.active) {
    const race = LEAGUE_RACES.find((r) => r.id === lg.active.raceId);
    if (race) return race.checkpoints[Math.min(lg.active.stage, race.checkpoints.length - 1)];
  }
  if (lg.raceIdx < LEAGUE_RACES.length) return LEAGUE_SPOT;
  return null;
}

export function drawLeague(ctx, state) {
  const lg = ensureLeague(state);
  const cam = state.camera;
  const s = LEAGUE_SPOT;
  if (Math.abs(s.x - cam.x) > 720 || Math.abs(s.y - cam.y) > 440) return;
  ctx.fillStyle = '#ffd23e';
  ctx.fillRect(s.x - 40, s.y - 8, 80, 16);
  ctx.fillStyle = '#222';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(lg.raceIdx >= LEAGUE_RACES.length ? 'CHAMPION' : 'LEAGUE HQ', s.x - 34, s.y + 4);
  if (lg.active) {
    const race = LEAGUE_RACES.find((r) => r.id === lg.active.raceId);
    if (race) {
      const cp = race.checkpoints[lg.active.stage];
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${lg.active.stage + 1}`, cp.x - 4, cp.y + 5);
    }
  }
}
