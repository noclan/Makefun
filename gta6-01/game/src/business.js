// Turf and businesses: buy a storefront, and it pays rent into the
// player's pocket every minute. Rival crews notice success, though —
// every so often a rival crew shows up to smash a business. Get there
// and throw punches near the door to chase them off; a smashed shop
// stops paying until it is repaired for half its price.

export const BUSINESS_DEFS = [
  { id: 'laundry', name: 'Solmar Laundromat', price: 800, income: 45, x: 680, y: 1700 },
  { id: 'tacos', name: 'Taco Luna Stand', price: 1200, income: 70, x: 1700, y: 2040 },
  { id: 'bar', name: 'Bar Marea', price: 2000, income: 110, x: 1020, y: 680 },
  { id: 'hotel', name: 'Hotel Miramar', price: 3500, income: 190, x: 2720, y: 1360 },
  { id: 'garage', name: 'Vega Auto Garage', price: 5000, income: 260, x: 2720, y: 2380 },
];

export function ensureBusiness(state) {
  const d = state.depth;
  if (!d.business) d.business = { owned: {}, attack: null, attackT: 45, earned: 0, defended: 0, lost: 0 };
  return d.business;
}

export function buyBusiness(state, id) {
  const b = ensureBusiness(state);
  const def = BUSINESS_DEFS.find((x) => x.id === id);
  if (!def) return { ok: false, reason: 'no such business' };
  if (b.owned[id]) return { ok: false, reason: 'you already own it' };
  if (state.player.cash < def.price) return { ok: false, reason: `${def.name} costs $${def.price}` };
  state.player.cash -= def.price;
  b.owned[id] = { smashed: false, earned: 0 };
  state.events.push({ kind: 'business-bought', id });
  return { ok: true, line: `${def.name} is yours — $${def.income} a minute.` };
}

export function repairBusiness(state, id) {
  const b = ensureBusiness(state);
  const def = BUSINESS_DEFS.find((x) => x.id === id);
  if (!def || !b.owned[id] || !b.owned[id].smashed) return { ok: false, reason: 'nothing to repair there' };
  const cost = Math.floor(def.price / 2);
  if (state.player.cash < cost) return { ok: false, reason: `repairs cost $${cost}` };
  state.player.cash -= cost;
  b.owned[id].smashed = false;
  return { ok: true, line: `${def.name} repaired and back in business.` };
}

// Punching near an attacked shop drives the rivals off.
export function defendBusiness(state) {
  const b = ensureBusiness(state);
  if (!b.attack) return false;
  const def = BUSINESS_DEFS.find((x) => x.id === b.attack);
  const p = state.player;
  if (Math.hypot(p.x - def.x, p.y - def.y) < 150) {
    b.attack = null;
    b.attackT = 50 + state.rng() * 60;
    b.defended += 1;
    state.respect = (state.respect || 0) + 4;
    state.dialogue = { who: 'Mama Rosa', text: `You saved ${def.name}! The street saw it. +4 respect.`, t: 4 };
    state.events.push({ kind: 'business-defended', id: def.id });
    return true;
  }
  return false;
}

export function stepBusiness(state, dt) {
  const b = ensureBusiness(state);
  const ownedIds = Object.keys(b.owned);
  if (ownedIds.length === 0) return;
  // Passive income: each open shop pays its per-minute rate, pro-rated.
  for (const id of ownedIds) {
    const def = BUSINESS_DEFS.find((x) => x.id === id);
    const shop = b.owned[id];
    if (shop.smashed) continue;
    const pay = (def.income / 60) * dt;
    state.player.cash += pay;
    shop.earned += pay;
    b.earned += pay;
  }
  // Rival attack clock.
  if (b.attack) {
    b.attackT -= dt;
    if (b.attackT <= 0) {
      const def = BUSINESS_DEFS.find((x) => x.id === b.attack);
      b.owned[b.attack].smashed = true;
      b.attack = null;
      b.attackT = 50 + state.rng() * 60;
      b.lost += 1;
      state.dialogue = { who: 'Mama Rosa', text: `Rivals smashed ${def.name}! Repair it for half price.`, t: 5 };
      state.events.push({ kind: 'business-smashed', id: def.id });
    }
    return;
  }
  b.attackT -= dt;
  if (b.attackT <= 0) {
    const open = ownedIds.filter((id) => !b.owned[id].smashed);
    if (open.length === 0) { b.attackT = 30; return; }
    b.attack = open[Math.floor(state.rng() * open.length)];
    b.attackT = 25; // seconds to get there before it is smashed
    const def = BUSINESS_DEFS.find((x) => x.id === b.attack);
    state.dialogue = { who: 'Mama Rosa', text: `Rivals are hitting ${def.name}! Get there and chase them off!`, t: 5 };
    state.events.push({ kind: 'business-attack', id: def.id });
  }
}

export function businessSummary(state) {
  const b = ensureBusiness(state);
  const n = Object.keys(b.owned).length;
  return `Businesses: ${n} owned, $${Math.floor(b.earned)} earned, ${b.defended} defended`;
}
