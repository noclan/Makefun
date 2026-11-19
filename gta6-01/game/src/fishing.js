// Fishing at the old pier: cast off the end of pier two, wait for a
// bite, then reel in before it gets away. Fish sell automatically —
// common catch pays a little, a rare golden bayfish pays a lot.

export const FISH_SPOT = { x: 300, y: 2420 };
const FISH_NAMES = ['mackerel', 'sea bass', 'red snapper', 'bay squid', 'golden bayfish'];

export function ensureFish(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.fish) state.depth.fish = { stage: 'idle', t: 0, wait: 0, caught: 0, earned: 0, best: null };
  return state.depth.fish;
}

export function stepFish(state, dt) {
  const fi = ensureFish(state);
  const p = state.player;
  if (p.inCar) { if (fi.stage !== 'idle') { fi.stage = 'idle'; fi.t = 0; } return; }
  const dx = p.x - FISH_SPOT.x, dy = p.y - FISH_SPOT.y;
  const near = dx * dx + dy * dy < 90 * 90;
  const edge = state.depth && state.depth.actionEdge;
  if (fi.stage === 'idle') {
    if (near && edge) {
      fi.stage = 'waiting';
      fi.wait = 3 + state.rng() * 5;
      fi.t = 0;
      state.dialogue = { who: 'Rico', text: 'Line\'s in... now we wait.', t: 3 };
      state.depth.actionEdge = false;
    }
    return;
  }
  if (!near) { fi.stage = 'idle'; fi.t = 0; return; }
  fi.t += dt;
  if (fi.stage === 'waiting' && fi.t >= fi.wait) {
    fi.stage = 'bite';
    fi.t = 0;
    state.dialogue = { who: 'Rico', text: 'BITE! Reel it in — press E now!', t: 3 };
    state.events.push({ kind: 'fish-bite' });
    return;
  }
  if (fi.stage === 'bite') {
    if (edge) {
      const roll = state.rng();
      let value, name;
      if (roll < 0.1) { value = 1000; name = 'golden bayfish'; }
      else if (roll < 0.4) { value = 150 + Math.floor(state.rng() * 250); name = FISH_NAMES[1 + Math.floor(state.rng() * 3)]; }
      else { value = 50 + Math.floor(state.rng() * 100); name = FISH_NAMES[Math.floor(state.rng() * 2)]; }
      fi.stage = 'idle';
      fi.t = 0;
      fi.caught += 1;
      fi.earned += value;
      if (!fi.best || value > fi.best.value) fi.best = { name, value };
      state.player.cash += value;
      state.respect = (state.respect || 0) + (value >= 1000 ? 3 : 1);
      state.dialogue = { who: 'Rico', text: `Caught a ${name}! Sold for $${value}.`, t: 3 };
      state.events.push({ kind: 'pickup', what: 'fish', value });
      state.depth.actionEdge = false;
      return;
    }
    if (fi.t > 2.5) {
      fi.stage = 'idle';
      fi.t = 0;
      state.dialogue = { who: 'Rico', text: 'Got away... the big ones always do.', t: 3 };
    }
  }
}

export function drawFish(ctx, state) {
  const fi = ensureFish(state);
  const cam = state.camera;
  if (Math.abs(FISH_SPOT.x - cam.x) > 720 || Math.abs(FISH_SPOT.y - cam.y) > 440) return;
  ctx.fillStyle = '#8a5a3a';
  ctx.fillRect(FISH_SPOT.x - 8, FISH_SPOT.y - 8, 16, 16);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('FISH', FISH_SPOT.x - 16, FISH_SPOT.y - 14);
  if (fi.stage === 'bite') {
    const bob = Math.sin(state.elapsed * 14) * 4;
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(FISH_SPOT.x + 26, FISH_SPOT.y + bob, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('BITE!', FISH_SPOT.x + 8, FISH_SPOT.y - 26);
  } else if (fi.stage === 'waiting') {
    ctx.fillStyle = '#7dd8ff';
    ctx.beginPath();
    ctx.arc(FISH_SPOT.x + 26, FISH_SPOT.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
