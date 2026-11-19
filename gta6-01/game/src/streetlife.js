// Ambient street life: the bay keeps happening around Rico. Every so
// often a small scene pops up nearby — a street performer, a lost
// tourist, a stray dog, a shouting argument. Stop and play along for
// a few seconds and it pays (or costs) a little, and the locals talk.

const BARKS = [
  'Beautiful day in Solmar Bay!',
  'You see the race last night? Wild!',
  'The Varelas are finished, everyone says so.',
  'Rico Vega! The man himself!',
  'Fish are biting down at the pier.',
  'My cousin swears the island has buried gold.',
  'Traffic\'s worse than ever today.',
  'Did you hear the radio? New station!',
];
const KINDS = [
  { kind: 'performer', label: 'Street performer', pay: 50, text: 'A guitarist plays your song. Toss a coin and enjoy it a while.' },
  { kind: 'tourist', label: 'Lost tourist', pay: -30, text: 'A tourist is lost and asking the way. Help them out for a moment?' },
  { kind: 'dog', label: 'Stray dog', pay: 200, text: 'A stray dog keeps looking at you, then down the alley. Follow it?' },
  { kind: 'argument', label: 'Street argument', pay: -20, text: 'Two drivers are shouting at each other. Stick around and calm it down?' },
];

export function ensureStreetlife(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.streetlife) {
    state.depth.streetlife = { event: null, timer: 18, nextBark: 8, barkIdx: 0 };
  }
  return state.depth.streetlife;
}

export function stepStreetlife(state, dt) {
  const sl = ensureStreetlife(state);
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  sl.nextBark -= dt;
  if (sl.nextBark <= 0) {
    sl.nextBark = 9 + state.rng() * 8;
    const line = BARKS[sl.barkIdx % BARKS.length];
    sl.barkIdx += 1;
    state.dialogue = { who: 'Local', text: line, t: 3 };
  }
  if (sl.event) {
    const ev = sl.event;
    const dx = px - ev.x, dy = py - ev.y;
    if (dx * dx + dy * dy < 80 * 80) {
      ev.dwell += dt;
      if (ev.dwell >= 3) {
        if (ev.pay >= 0) {
          state.player.cash += ev.pay;
          state.respect = (state.respect || 0) + 1;
          state.dialogue = { who: ev.label, text: `That was worth stopping for. +$${ev.pay}, +1 respect.`, t: 3 };
        } else {
          state.player.cash = Math.max(0, state.player.cash + ev.pay);
          state.respect = (state.respect || 0) + 1;
          state.dialogue = { who: ev.label, text: `Cost you $${-ev.pay}, but the street remembers kindness. +1 respect.`, t: 3 };
        }
        state.events.push({ kind: 'street-event', what: ev.kind, pay: ev.pay });
        sl.event = null;
        sl.timer = 20 + state.rng() * 10;
      }
    } else {
      ev.dwell = Math.max(0, ev.dwell - dt);
      ev.t -= dt;
      if (ev.t <= 0) { sl.event = null; sl.timer = 15 + state.rng() * 10; }
    }
    return;
  }
  sl.timer -= dt;
  if (sl.timer <= 0) {
    const kind = KINDS[Math.floor(state.rng() * KINDS.length)];
    const a = state.rng() * Math.PI * 2;
    const d = 180 + state.rng() * 120;
    sl.event = {
      kind: kind.kind, label: kind.label, pay: kind.pay,
      x: Math.max(420, Math.min(3300, px + Math.cos(a) * d)),
      y: Math.max(120, Math.min(3300, py + Math.sin(a) * d)),
      t: 25, dwell: 0,
    };
    state.dialogue = { who: kind.label, text: kind.text, t: 4 };
    state.events.push({ kind: 'street-event-spawn', what: kind.kind });
  }
}

export function streetlifeTarget(state) {
  const sl = ensureStreetlife(state);
  return sl.event ? { x: sl.event.x, y: sl.event.y } : null;
}

export function drawStreetlife(ctx, state) {
  const sl = ensureStreetlife(state);
  if (!sl.event) return;
  const ev = sl.event;
  const cam = state.camera;
  if (Math.abs(ev.x - cam.x) > 720 || Math.abs(ev.y - cam.y) > 440) return;
  const bob = Math.sin(state.elapsed * 4) * 4;
  ctx.fillStyle = '#37c8b0';
  ctx.beginPath();
  ctx.arc(ev.x, ev.y - 20 + bob, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('?', ev.x - 4, ev.y - 16 + bob);
  ctx.fillStyle = '#37c8b0';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(ev.label, ev.x - 30, ev.y + 30);
}
