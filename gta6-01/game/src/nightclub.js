// Club Neon: the nightclub on the marina. Come in after dark for the
// dance floor, the DJ booth, cheap drinks, and the VIP room.
// Dancing builds a groove score while the player stays on the floor;
// a full groove pays out in respect. Drinks cost a little cash and top
// up health. High respect opens the VIP hook, where a fixer leaves work.

export const CLUB_SPOT = { x: 1020, y: 2380, w: 170, h: 120, label: 'CLUB NEON' };

export function ensureClub(state) {
  const d = state.depth;
  if (!d.club) d.club = { inside: false, groove: 0, bestGroove: 0, drinks: 0, vipSeen: false, neon: 0, dances: 0 };
  return d.club;
}

export function nearClub(state) {
  const p = state.player;
  const dx = p.x - (CLUB_SPOT.x + CLUB_SPOT.w / 2);
  const dy = p.y - (CLUB_SPOT.y + CLUB_SPOT.h / 2);
  return dx * dx + dy * dy < 130 * 130;
}

function isNight(state) {
  return state.phase && (state.phase.name === 'Dusk' || state.phase.name === 'Night' || state.phase.name === 'Dawn');
}

export function stepClub(state, dt) {
  const c = ensureClub(state);
  c.inside = nearClub(state);
  c.neon = (c.neon + dt * 2) % (Math.PI * 2);
  if (!c.inside) return;
  // Groove only builds on the dance floor at night, while moving.
  if (isNight(state) && state.player.speed > 40 && !state.player.inCar) {
    c.groove += dt * 10;
    if (c.groove >= 100) {
      c.groove = 0;
      c.dances += 1;
      state.respect = (state.respect || 0) + 2;
      state.player.cash += 40;
      if (c.bestGroove < 100) c.bestGroove = 100;
      state.dialogue = { who: 'DJ Marisol', text: 'Rico owns the floor! The crowd throws cash. +2 respect, +$40.', t: 4 };
      state.events.push({ kind: 'dance-payout', amount: 40 });
    }
  }
}

export function buyDrink(state) {
  const c = ensureClub(state);
  c.inside = nearClub(state);
  if (!c.inside) return { ok: false, reason: 'step inside Club Neon first' };
  const p = state.player;
  if (p.cash < 25) return { ok: false, reason: 'a drink costs $25' };
  p.cash -= 25;
  p.health = Math.min(100, p.health + 15);
  c.drinks += 1;
  return { ok: true, line: 'A cold Solmar Spritz. +15 health.' };
}

// The VIP hook: with enough respect, the fixer in the back room has a
// job. It pays well and it is the only way the hook opens.
export function vipHook(state) {
  const c = ensureClub(state);
  c.inside = nearClub(state);
  if (!c.inside) return { ok: false, reason: 'step inside Club Neon first' };
  if ((state.respect || 0) < 30) return { ok: false, reason: 'VIP needs 30 respect — the bouncer waves you off' };
  if (c.vipSeen) return { ok: false, reason: 'the fixer already gave you tonight\'s job' };
  c.vipSeen = true;
  state.player.cash += 300;
  state.respect = (state.respect || 0) + 3;
  state.dialogue = { who: 'The Fixer', text: 'A little errand for a friend of the club. $300 now, more later.', t: 5 };
  state.events.push({ kind: 'vip-job', amount: 300 });
  return { ok: true, line: 'VIP job done: +$300, +3 respect.' };
}

export function clubSummary(state) {
  const c = ensureClub(state);
  return `Club Neon: ${c.dances} dance payouts, ${c.drinks} drinks, groove ${Math.round(c.groove)}/100`;
}
