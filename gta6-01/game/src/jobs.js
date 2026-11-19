// Side jobs: taxi fares and courier deliveries.
// Taxi: hail a fare, pick the passenger up at the gold dot, drop them
// at their destination. Fast, smooth drops earn a tip. Courier: grab
// the package, deliver before the clock runs out. Both pay cash and a
// little respect, and both can run while a story mission waits.

function roadSpot(rng) {
  const gx = (1 + Math.floor(rng() * 9)) * 340 + 32;
  const gy = (1 + Math.floor(rng() * 9)) * 340 + 32;
  return { x: gx, y: gy };
}

export function ensureJobs(state) {
  const d = state.depth;
  if (!d.jobs) d.jobs = { taxi: null, courier: null, fares: 0, deliveries: 0, tips: 0 };
  return d.jobs;
}

export function startTaxi(state) {
  const j = ensureJobs(state);
  if (j.taxi) return { ok: false, reason: 'a fare is already waiting' };
  const pickup = roadSpot(state.rng);
  j.taxi = { stage: 'pickup', pickup, drop: null, fare: 0, t: 0 };
  state.dialogue = { who: 'Dispatch', text: 'Fare waiting. Pick them up at the gold dot.', t: 4 };
  return { ok: true, line: 'Taxi fare started.' };
}

export function startCourier(state) {
  const j = ensureJobs(state);
  if (j.courier) return { ok: false, reason: 'a delivery is already running' };
  const pickup = roadSpot(state.rng);
  j.courier = { stage: 'pickup', pickup, drop: null, timer: 75, pay: 220 };
  state.dialogue = { who: 'Dispatch', text: 'Package waiting. Grab it, then deliver fast — 75 seconds.', t: 4 };
  return { ok: true, line: 'Courier run started.' };
}

export function jobTarget(state) {
  const j = ensureJobs(state);
  if (j.taxi) return j.taxi.stage === 'pickup' ? j.taxi.pickup : j.taxi.drop;
  if (j.courier) return j.courier.stage === 'pickup' ? j.courier.pickup : j.courier.drop;
  return null;
}

export function stepJobs(state, dt) {
  const j = ensureJobs(state);
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  if (j.taxi) {
    const t = j.taxi;
    if (t.stage === 'pickup') {
      if (Math.hypot(px - t.pickup.x, py - t.pickup.y) < 80) {
        t.stage = 'drop';
        t.drop = roadSpot(state.rng);
        t.fare = 90 + Math.floor(state.rng() * 90);
        t.t = 0;
        state.dialogue = { who: 'Passenger', text: 'Thanks! Take me across town — and step on it.', t: 4 };
      }
    } else {
      t.t += dt;
      if (Math.hypot(px - t.drop.x, py - t.drop.y) < 80) {
        const tip = t.t < 45 ? 40 : t.t < 70 ? 15 : 0;
        const total = t.fare + tip;
        state.player.cash += total;
        state.respect = (state.respect || 0) + 2;
        j.fares += 1;
        j.tips += tip;
        state.dialogue = { who: 'Passenger', text: `Great drive! Fare $${t.fare}${tip ? ` plus a $${tip} tip` : ''}.`, t: 4 };
        state.events.push({ kind: 'taxi-done', amount: total });
        j.taxi = null;
      }
    }
  }
  if (j.courier) {
    const c = j.courier;
    c.timer -= dt;
    if (c.timer <= 0) {
      j.courier = null;
      state.dialogue = { who: 'Dispatch', text: 'Too slow — the package went to another driver.', t: 4 };
      return;
    }
    if (c.stage === 'pickup') {
      if (Math.hypot(px - c.pickup.x, py - c.pickup.y) < 80) {
        c.stage = 'drop';
        c.drop = roadSpot(state.rng);
        state.dialogue = { who: 'Dispatch', text: 'Package secured. Deliver it to the gold dot!', t: 4 };
      }
    } else if (Math.hypot(px - c.drop.x, py - c.drop.y) < 80) {
      const bonus = c.timer > 30 ? 80 : 0;
      const total = c.pay + bonus;
      state.player.cash += total;
      state.respect = (state.respect || 0) + 2;
      j.deliveries += 1;
      state.dialogue = { who: 'Dispatch', text: `Delivered! $${c.pay}${bonus ? ` plus $${bonus} speed bonus` : ''}.`, t: 4 };
      state.events.push({ kind: 'courier-done', amount: total });
      j.courier = null;
    }
  }
}

export function jobsSummary(state) {
  const j = ensureJobs(state);
  return `Jobs: ${j.fares} fares, ${j.deliveries} deliveries, $${j.tips} in tips`;
}
