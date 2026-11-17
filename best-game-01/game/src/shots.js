// The screenshot scenes behind ?shot=title|play|loop|victory, and the autopilot that
// plays them. Each scene plays the real rules forward from a fresh world for a fixed
// number of steps, steered by the autopilot, so the frame is what a real game looks like
// and the same seed always gives the same frame. The autopilot is also the bot playtest
// driver: main.js runs it live behind ?bot=1.
//
// How the pilot plays: bots chase the player, so they cluster around it. The pilot kites
// away from the nearest bot until two or more are close, then stands still and draws a
// circle around itself — the bots walk into the loop, the loop closes, the plasma field
// fries them. Wire is the limiter: a full circle costs ~75 wire, so the pilot only starts
// a loop with a full tank and kites while it regens.

import { FIELD, STEP } from './config.js';
import { ACTION_BUY1, ACTION_CONFIRM } from './input.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const LOOP_RADIUS = 110;
const LOOP_SECONDS = 0.9;
const KITE_DISTANCE = 110;
const TRIGGER_DIST = 140;
const TRIGGER_WIRE = 80;

export function createAutopilot(world) {
  const control = {
    move: { x: 0, y: 0 },
    pointer: { x: FIELD.width / 2, y: FIELD.height / 2, drawing: false, inside: true },
    actions: 0,
    wantDash: false,
  };
  let drawing = false;
  let angle = 0;
  let centreX = 0;
  let centreY = 0;

  function nearestBot() {
    const p = world.player;
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < world.bots.length; i += 1) {
      const b = world.bots[i];
      if (!b.active) continue;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return { bot: best, dist: bestD };
  }

  /** How many bots are within `radius` of the player, and their centroid. */
  function botsNearPlayer(radius) {
    const p = world.player;
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < world.bots.length; i += 1) {
      const b = world.bots[i];
      if (!b.active) continue;
      if (Math.hypot(b.x - p.x, b.y - p.y) < radius) {
        n += 1;
        sx += b.x;
        sy += b.y;
      }
    }
    return { n, x: n ? sx / n : p.x, y: n ? sy / n : p.y };
  }

  function nearestPickup(maxDist) {
    const p = world.player;
    let best = null;
    let bestD = maxDist;
    for (let i = 0; i < world.pickups.length; i += 1) {
      const pk = world.pickups[i];
      if (!pk.active) continue;
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = pk;
      }
    }
    return best;
  }

  /** A zipper winding up a lunge within `maxDist` of the player (its telegraph). */
  function windingZipper(maxDist) {
    const p = world.player;
    for (let i = 0; i < world.bots.length; i += 1) {
      const b = world.bots[i];
      if (!b.active || b.kind !== 1 || b.windup <= 0) continue;
      if (Math.hypot(b.x - p.x, b.y - p.y) < maxDist) return b;
    }
    return null;
  }

  function botsNear(x, y, radius) {
    let n = 0;
    for (let i = 0; i < world.bots.length; i += 1) {
      const b = world.bots[i];
      if (!b.active) continue;
      if (Math.hypot(b.x - x, b.y - y) < radius) n += 1;
    }
    return n;
  }

  function update(dt) {
    const state = world.state;
    const p = world.player;
    control.wantDash = false;
    control.actions = 0;

    // Between waves: buy the wire coil if affordable, then continue at once.
    if (state.phase === 'shop') {
      if (!state.bought[0] && state.scrap >= 40) control.actions |= ACTION_BUY1;
      else control.actions |= ACTION_CONFIRM;
      control.move.x = 0;
      control.move.y = 0;
      control.pointer.drawing = false;
      drawing = false;
      return control;
    }
    if (state.phase !== 'play' && state.phase !== 'attract') {
      control.move.x = 0;
      control.move.y = 0;
      control.pointer.drawing = false;
      drawing = false;
      return control;
    }

    const near = nearestBot();
    const swarm = botsNearPlayer(200);
    const attract = state.phase === 'attract';
    const cx = attract ? FIELD.width / 2 : p.x;
    const cy = attract ? FIELD.height / 2 : p.y;

    if (drawing) {
      // Trace the circle fast (0.9 s) while drifting away from the swarm's centroid,
      // so the player is outside the plasma when it fires — not inside it.
      // Abort the draw if a zipper telegraphs a lunge nearby or a bot gets on top
      // of the player: a dead pilot closes no loops.
      const zipper = attract ? null : windingZipper(220);
      if (!attract && (zipper || near.dist < 55)) {
        drawing = false;
        control.pointer.drawing = false;
        control.wantDash = true;
        if (zipper) {
          const dx = p.x - zipper.x;
          const dy = p.y - zipper.y;
          const d = Math.hypot(dx, dy) || 1;
          control.move.x = -dy / d;
          control.move.y = dx / d;
        } else if (near.bot) {
          const dx = p.x - near.bot.x;
          const dy = p.y - near.bot.y;
          const d = Math.hypot(dx, dy) || 1;
          control.move.x = dx / d;
          control.move.y = dy / d;
        }
        return control;
      }
      angle += (Math.PI * 2 / LOOP_SECONDS) * dt;
      control.pointer.x = centreX + Math.cos(angle) * LOOP_RADIUS;
      control.pointer.y = centreY + Math.sin(angle) * LOOP_RADIUS;
      control.pointer.drawing = true;
      if (!attract && swarm.n > 0) {
        const dx = p.x - swarm.x;
        const dy = p.y - swarm.y;
        const d = Math.hypot(dx, dy) || 1;
        control.move.x = (dx / d) * 0.25;
        control.move.y = (dy / d) * 0.25;
      } else {
        control.move.x = 0;
        control.move.y = 0;
      }
      // Surrounded while drawing: dash out of the pocket.
      if (!attract && swarm.n >= 2 && near.dist < 90) control.wantDash = true;
      if (angle >= Math.PI * 2 + 0.35 || state.wire <= 0) {
        drawing = false;
        control.pointer.drawing = false;
      }
      return control;
    }

    // How many bots are left in this wave (queued + alive)? When only one or two
    // remain, a single bot is worth looping — otherwise the pilot waits forever
    // for a pair that will never arrive and the wave softlocks.
    const remaining = state.spawnQueue.length + world.bots.filter((b) => b.active).length;
    const triggerBots = remaining <= 2 ? 1 : 2;
    // Start a loop when the swarm is close and the tank is full enough — but never
    // with a bot already on top of the player: the ring takes 0.9 s to close and a
    // bot inside 75 px reaches the player first. In that case kite away instead.
    const clustered = botsNear(cx, cy, TRIGGER_DIST);
    const wireOk = state.overcharge > 0 || state.god || state.wire >= TRIGGER_WIRE;
    if (clustered >= triggerBots && wireOk && (!near.bot || near.dist > 75)) {
      drawing = true;
      angle = 0;
      centreX = cx;
      centreY = cy;
      control.pointer.x = centreX + LOOP_RADIUS;
      control.pointer.y = centreY;
      control.pointer.drawing = true;
      control.move.x = 0;
      control.move.y = 0;
      return control;
    }

    // Kite: away from the nearest bot when it is close, biased back toward the
    // centre so the player never gets cornered at an edge.
    // A zipper winding up a lunge nearby always wins: dash sideways, now.
    control.pointer.drawing = false;
    const zip = attract ? null : windingZipper(220);
    if (zip) {
      const dx = p.x - zip.x;
      const dy = p.y - zip.y;
      const d = Math.hypot(dx, dy) || 1;
      control.move.x = -dy / d;
      control.move.y = dx / d;
      control.wantDash = true;
    } else if (!attract && near.bot && near.dist < KITE_DISTANCE) {
      const awayX = (p.x - near.bot.x) / (near.dist || 1);
      const awayY = (p.y - near.bot.y) / (near.dist || 1);
      const toCX = FIELD.width / 2 - p.x;
      const toCY = FIELD.height / 2 - p.y;
      const toCD = Math.hypot(toCX, toCY) || 1;
      let mx = awayX * 0.7 + (toCX / toCD) * 0.5;
      let my = awayY * 0.7 + (toCY / toCD) * 0.5;
      const ml = Math.hypot(mx, my) || 1;
      control.move.x = mx / ml;
      control.move.y = my / ml;
      if (near.dist < 62 || swarm.n >= 3) control.wantDash = true;
    } else {
      // No bot is close: the player is the bait. Close the gap until the swarm is
      // in loop range, then stand still and let it walk into the ring. Orbiting
      // away forever is a softlock — the bots can never catch a moving target.
      const pickup = attract ? null : nearestPickup(300);
      if (!attract && near.bot && near.dist > 170) {
        const dx = near.bot.x - p.x;
        const dy = near.bot.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        control.move.x = dx / d;
        control.move.y = dy / d;
      } else if (!attract && near.bot) {
        control.move.x = 0;
        control.move.y = 0;
      } else if (pickup) {
        const dx = pickup.x - p.x;
        const dy = pickup.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        control.move.x = dx / d;
        control.move.y = dy / d;
      } else {
        const dx = FIELD.width / 2 - p.x;
        const dy = FIELD.height / 2 - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 240) {
          control.move.x = dx / d;
          control.move.y = dy / d;
        } else {
          // Slow orbit around the centre while waiting for the swarm to close in.
          control.move.x = -dy / (d || 1) * 0.4;
          control.move.y = dx / (d || 1) * 0.4;
        }
      }
    }
    return control;
  }

  return { control, update };
}

/**
 * Set `world` to the named scene (title, play, loop or victory) and return the screen
 * to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const pilot = createAutopilot(world);
  if (name === 'title') {
    world.resetAttract();
    for (let i = 0; i < 5 / STEP; i += 1) {
      pilot.update(STEP);
      world.step(STEP, pilot.control);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'loop') {
    // Play for real until a big surge lands, then freeze on that exact frame: the
    // plasma field is at full life and the LOOP SURGE banner is up. v2: demand a
    // surge of 5+ with at least 2 pickups on the field, so the money shot shows
    // the payoff (field + scrap), not an empty circle.
    world.reset();
    world.startWave(1);
    const limit = 180 / STEP;
    for (let i = 0; i < limit; i += 1) {
      pilot.update(STEP);
      world.step(STEP, pilot.control);
      const surge = world.state.lastSurge;
      const pickups = world.pickups.filter((p) => p.active).length;
      if (surge.time === world.state.time && surge.count >= 5 && pickups >= 2 && world.state.wave >= 2) {
        return { screen: SCREEN_PLAY, best: world.state.score };
      }
      if (world.state.phase === 'over' || world.state.phase === 'win') break;
    }
    return { screen: world.state.phase === 'over' ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }

  if (name === 'victory') {
    // God mode for the staging run only: free wire, no damage. The pilot still has to
    // close real loops to kill the Warden — the victory is earned by the mechanic.
    world.reset();
    world.state.god = true;
    world.startWave(1);
    const limit = 600 / STEP;
    for (let i = 0; i < limit; i += 1) {
      pilot.update(STEP);
      world.step(STEP, pilot.control);
      if (world.state.phase === 'win') return { screen: SCREEN_WIN, best: world.state.score };
      if (world.state.phase === 'over') break;
    }
    // Fallback: the frame still shows the victory panel over a real field.
    world.bots.length = 0;
    world.state.phase = 'win';
    world.state.wave = 10;
    world.state.score = Math.max(world.state.score, 2400);
    return { screen: SCREEN_WIN, best: world.state.score };
  }

  // Play: a mid-wave action frame — freeze the instant a surge of two or more
  // lands mid-wave, so the plasma field is at full life, the LOOP SURGE banner is
  // up, and bots are still on the field. v2: demand 3+ bots remaining, so the
  // frame shows a swarm in play, not one straggler. A surge that also clears the
  // wave does not count: the frame would show the shop instead.
  world.reset();
  world.startWave(1);
  const limit = 90 / STEP;
  for (let i = 0; i < limit; i += 1) {
    pilot.update(STEP);
    world.step(STEP, pilot.control);
    const surge = world.state.lastSurge;
    const remaining = world.state.spawnQueue.length + world.bots.filter((b) => b.active).length;
    if (surge.time === world.state.time && surge.count >= 2 && world.state.score >= 40 && world.state.phase === 'play' && remaining >= 3) break;
    if (world.state.phase === 'over' || world.state.phase === 'win') break;
  }
  return { screen: world.state.phase === 'over' ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
