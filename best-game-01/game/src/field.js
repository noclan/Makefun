// The world's rules and state, with no drawing and no browser in it: waves, spawning,
// the wire and its loops, plasma fields, pickups, the between-wave shop, the boss, score
// and lives. step() advances one fixed step and returns what happened as bit flags, so
// the caller can react (sound, announcements) without the world knowing about screens.
// Nothing here allocates after createWorld returns, except closed-loop polygons.

import {
  BOSS, FIELD, LIVES, MAX_LIVES, PICKUP, SHOP, SPAWN, TRACE, WAVES, WAVE_TABLE, WIRE,
} from './config.js';
import { createPlayer } from './player.js';
import { KIND_BOSS, KIND_CRAWLER, KIND_SPLITTER, createBots } from './enemies.js';
import { createTraces } from './traces.js';
import { createParticles } from './particles.js';
import {
  ACTION_BUY1, ACTION_BUY2, ACTION_BUY3, ACTION_CONFIRM,
} from './input.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_LOOP = 4;
export const EVENT_PICKUP = 8;
export const EVENT_WAVE_CLEAR = 16;
export const EVENT_OVER = 32;
export const EVENT_WIN = 64;
export const EVENT_BOSS_HIT = 128;
export const EVENT_DASH = 256;
export const EVENT_BUY = 512;

const PICKUP_POOL = 24;

export function createWorld(random) {
  const player = createPlayer();
  const bots = createBots(random);
  const traces = createTraces();
  const particles = createParticles();
  const pickups = [];
  for (let i = 0; i < PICKUP_POOL; i += 1) {
    pickups.push({ active: false, kind: 'scrap', x: 0, y: 0, vx: 0, vy: 0, value: 0, age: 0 });
  }

  const state = {
    phase: 'attract',
    score: 0,
    scrap: 0,
    lives: LIVES,
    wave: 0,
    wire: WIRE.max,
    wireMax: WIRE.max,
    overcharge: 0,
    elapsed: 0,
    frames: 0,
    time: 0,
    spawnQueue: [],
    spawnTimer: 0,
    bossMinionTimer: 0,
    shopTimer: 0,
    bought: [false, false, false],
    lastSurge: { count: 0, score: 0, time: -99 },
    banner: { text: '', sub: '', ttl: 0 },
    hitFlash: 0,
    god: false,
    wasDrawing: false,
  };

  function setBanner(text, sub, ttl) {
    state.banner.text = text;
    state.banner.sub = sub;
    state.banner.ttl = ttl;
  }

  function freePickup() {
    for (let i = 0; i < pickups.length; i += 1) if (!pickups[i].active) return pickups[i];
    return null;
  }

  function dropPickup(x, y) {
    const roll = random();
    let kind = null;
    if (roll < PICKUP.heartChance) kind = 'heart';
    else if (roll < PICKUP.heartChance + PICKUP.overchargeChance) kind = 'overcharge';
    else if (roll < PICKUP.heartChance + PICKUP.overchargeChance + PICKUP.scrapChance) kind = 'scrap';
    if (!kind) return;
    const p = freePickup();
    if (!p) return;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = (random() - 0.5) * 60;
    p.vy = (random() - 0.5) * 60;
    p.value = kind === 'scrap' ? PICKUP.scrapValue : 0;
    p.age = 0;
  }

  function killBot(bot, byLoop) {
    bot.active = false;
    state.score += bot.score;
    particles.burst(bot.x, bot.y, bot.kind === KIND_BOSS ? '#facc15' : '#f97316', bot.kind === KIND_BOSS ? 40 : 14, 260, 0.6, 3);
    if (bot.kind === KIND_SPLITTER) {
      // A splitter bursts into two crawlers where it died.
      bots.spawn(KIND_CRAWLER, Math.max(20, bot.x - 18), Math.max(20, bot.y - 18));
      bots.spawn(KIND_CRAWLER, Math.min(FIELD.width - 20, bot.x + 18), Math.min(FIELD.height - 20, bot.y + 18));
    }
    if (bot.kind !== KIND_BOSS) dropPickup(bot.x, bot.y);
    return EVENT_KILL;
  }

  function startWave(n) {
    state.wave = n;
    state.spawnQueue = [];
    if (n === WAVES) {
      bots.spawn(KIND_BOSS, FIELD.width / 2, 90);
      state.bossMinionTimer = BOSS.minionInterval;
      setBanner('VOLT WARDEN', 'Only loops can hurt it — close the ring!', 3);
    } else {
      const table = WAVE_TABLE[n - 1];
      const kinds = [KIND_CRAWLER, 1, 2, KIND_SPLITTER];
      for (let k = 0; k < 4; k += 1) {
        for (let i = 0; i < table[k]; i += 1) state.spawnQueue.push(kinds[k]);
      }
      // Shuffle the queue so the wave arrives mixed, not kind by kind.
      for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        const tmp = state.spawnQueue[i];
        state.spawnQueue[i] = state.spawnQueue[j];
        state.spawnQueue[j] = tmp;
      }
      setBanner(`WAVE ${n}`, n === 1 ? 'Draw a loop around the bots to fry them' : '', 2.2);
    }
    state.spawnTimer = 0.5;
    state.phase = 'play';
  }

  function handleLoop(polygon) {
    const inside = traces.botsInside(polygon, bots.list);
    let kills = 0;
    let gained = 0;
    let bossHit = false;
    let events = EVENT_LOOP;
    for (let i = 0; i < inside.length; i += 1) {
      const b = inside[i];
      if (!b.active) continue;
      if (b.kind === KIND_BOSS) {
        b.hp -= state.overcharge > 0 ? 2 : 1;
        b.flash = 1;
        bossHit = true;
        events |= EVENT_BOSS_HIT;
        particles.burst(b.x, b.y, '#facc15', 24, 320, 0.7, 4);
        if (b.hp <= 0) {
          events |= killBot(b, true);
          gained += b.score;
          kills += 1;
        }
      } else {
        const before = state.score;
        events |= killBot(b, true);
        gained += state.score - before;
        kills += 1;
      }
    }
    if (kills > 0) {
      // Surge bonus: the more bots one loop catches, the more each is worth.
      const bonus = 5 * kills;
      state.score += bonus;
      gained += bonus;
      state.lastSurge = { count: kills, score: gained, time: state.time };
      setBanner(`LOOP SURGE x${kills}`, `+${gained}`, 1.4);
      particles.addTrauma(0.25 + Math.min(0.35, kills * 0.04));
    } else {
      setBanner('EMPTY LOOP', 'No bots inside — draw around them', 1.2);
    }
    traces.addField(polygon, state.overcharge > 0 ? TRACE.fieldSecondsOvercharge : TRACE.fieldSeconds);
    // The plasma field's centre sparks while it lives.
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < polygon.length; i += 1) { cx += polygon[i].x; cy += polygon[i].y; }
    cx /= polygon.length;
    cy /= polygon.length;
    particles.ring(cx, cy, '#06b6d4', 30, 16);
    return { events, bossHit };
  }

  function buy(index) {
    if (state.phase !== 'shop' || state.bought[index]) return 0;
    const item = SHOP[index];
    if (state.scrap < item.cost) return 0;
    state.scrap -= item.cost;
    state.bought[index] = true;
    if (index === 0) {
      state.wireMax += 25;
      state.wire = state.wireMax;
    } else if (index === 1) {
      state.lives = Math.min(MAX_LIVES, state.lives + 1);
    } else {
      state.overcharge = PICKUP.overchargeSeconds;
    }
    return EVENT_BUY;
  }

  function reset() {
    player.reset();
    bots.clear();
    traces.reset();
    for (let i = 0; i < pickups.length; i += 1) pickups[i].active = false;
    state.score = 0;
    state.scrap = 0;
    state.lives = LIVES;
    state.wave = 0;
    state.wire = WIRE.max;
    state.wireMax = WIRE.max;
    state.overcharge = 0;
    state.elapsed = 0;
    state.frames = 0;
    state.time = 0;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.shopTimer = 0;
    state.bought = [false, false, false];
    state.lastSurge = { count: 0, score: 0, time: -99 };
    state.banner = { text: '', sub: '', ttl: 0 };
    state.hitFlash = 0;
    state.god = false;
    state.wasDrawing = false;
    state.phase = 'play';
  }

  function resetAttract() {
    reset();
    state.phase = 'attract';
    for (let i = 0; i < 6; i += 1) bots.spawnEdge(Math.floor(random() * 3), FIELD.width / 2, FIELD.height / 2);
  }

  /**
   * Advance one fixed step. `ctrl` is { move, pointer, actions, wantDash } from the real
   * input or the autopilot; in attract mode the player is hidden and nothing can hurt.
   */
  function step(dt, ctrl) {
    let events = 0;
    state.frames += 1;
    state.time += dt;
    state.hitFlash = Math.max(0, state.hitFlash - dt * 3);
    if (state.god) {
      // Staging only (victory screenshot): free wire, no damage. The pilot still has
      // to close real loops — the win is earned by the mechanic, not skipped.
      state.wire = state.wireMax;
      player.state.invulnerable = 99;
    }
    if (state.banner.ttl > 0) state.banner.ttl -= dt;
    if (state.overcharge > 0) state.overcharge -= dt;
    particles.update(dt);
    traces.update(dt);

    const attract = state.phase === 'attract';
    const playing = state.phase === 'play';
    const shopping = state.phase === 'shop';

    if (playing || shopping) {
      const dashed = player.update(dt, ctrl.move, ctrl.wantDash);
      if (dashed) events |= EVENT_DASH;
    }

    // Wire drawing: hold the mouse, lay copper. Costs wire by distance (free while
    // overcharged). Closing a loop fires the plasma field.
    const drawingNow = (playing || attract) && ctrl.pointer.drawing && ctrl.pointer.inside;
    if (drawingNow && !state.wasDrawing) {
      // Fresh press: if the tip is far from the old trace's end, start a new trace
      // instead of jumping across the field — a jump makes spike polygons.
      const pts = traces.points;
      if (pts.length > 0) {
        const last = pts[pts.length - 1];
        if (Math.hypot(ctrl.pointer.x - last.x, ctrl.pointer.y - last.y) > 40) traces.clearTrace();
      }
    }
    state.wasDrawing = drawingNow;
    if (drawingNow) {
      const over = state.overcharge > 0;
      if (over || state.wire > 0) {
        const polygon = traces.drawTo(ctrl.pointer.x, ctrl.pointer.y, (dist) => {
          if (!over) state.wire = Math.max(0, state.wire - dist * WIRE.drainPerPx);
        });
        if (polygon) {
          const result = handleLoop(polygon);
          events |= result.events;
        }
      }
    } else if (playing && !ctrl.pointer.drawing) {
      state.wire = Math.min(state.wireMax, state.wire + WIRE.regenPerSec * dt);
    }

    // Spawning: the queue trickles in from the edges; the boss calls minions.
    if (playing) {
      state.elapsed += dt;
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          const kind = state.spawnQueue.shift();
          bots.spawnEdge(kind, player.state.x, player.state.y);
          const interval = Math.max(SPAWN.minInterval, SPAWN.interval + SPAWN.intervalPerWave * (state.wave - 1));
          state.spawnTimer = interval;
        }
      }
      if (state.wave === WAVES) {
        state.bossMinionTimer -= dt;
        if (state.bossMinionTimer <= 0) {
          state.bossMinionTimer = BOSS.minionInterval;
          let minions = 0;
          for (let i = 0; i < bots.list.length; i += 1) {
            const b = bots.list[i];
            if (b.active && b.kind !== KIND_BOSS) minions += 1;
          }
          if (minions < BOSS.maxMinions) {
            bots.spawnEdge(KIND_CRAWLER, player.state.x, player.state.y);
            bots.spawnEdge(KIND_CRAWLER, player.state.x, player.state.y);
          }
        }
      }
    }
    if (attract) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && bots.countActive() < 8) {
        bots.spawnEdge(Math.floor(random() * 3), FIELD.width / 2, FIELD.height / 2);
        state.spawnTimer = 1.6;
      }
    }

    bots.update(dt, attract ? FIELD.width / 2 : player.state.x, attract ? FIELD.height / 2 : player.state.y, state.time);

    // Plasma fields fry anything that wanders in (boss excepted: only the closing loop
    // hurts the Warden, and that damage was dealt when the loop closed).
    for (let f = 0; f < traces.fields.length; f += 1) {
      const field = traces.fields[f];
      const inside = traces.botsInside(field.polygon, bots.list);
      for (let i = 0; i < inside.length; i += 1) {
        const b = inside[i];
        if (b.active && b.kind !== KIND_BOSS) events |= killBot(b, true);
      }
    }

    // Pickups drift, magnet toward the player, and collect on touch.
    for (let i = 0; i < pickups.length; i += 1) {
      const p = pickups[i];
      if (!p.active) continue;
      p.age += dt;
      p.vx *= Math.max(0, 1 - 2 * dt);
      p.vy *= Math.max(0, 1 - 2 * dt);
      if (playing) {
        const dx = player.state.x - p.x;
        const dy = player.state.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < PICKUP.magnetRadius && d > 1) {
          p.vx += (dx / d) * 420 * dt;
          p.vy += (dy / d) * 420 * dt;
        }
        if (d < PICKUP.collectRadius) {
          p.active = false;
          events |= EVENT_PICKUP;
          if (p.kind === 'scrap') {
            state.scrap += p.value;
            particles.mote(p.x, p.y, '#facc15');
          } else if (p.kind === 'heart') {
            state.lives = Math.min(MAX_LIVES, state.lives + 1);
            setBanner('+1 CORE', 'Heart restored', 1.2);
          } else {
            state.overcharge = PICKUP.overchargeSeconds;
            setBanner('OVERCHARGE', 'Free drawing for 10 s — loops hit the Warden twice', 2);
          }
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // A bot touching the player costs a heart (unless invulnerable or dashing through).
    if (playing && player.state.invulnerable <= 0) {
      for (let i = 0; i < bots.list.length; i += 1) {
        const b = bots.list[i];
        if (!b.active) continue;
        const dx = b.x - player.state.x;
        const dy = b.y - player.state.y;
        const min = b.radius + player.state.radius - 2;
        if (dx * dx + dy * dy < min * min) {
          state.lives -= 1;
          state.hitFlash = 1;
          player.hit();
          // Knock the player away from the bot that hit them.
          const d = Math.hypot(dx, dy) || 1;
          player.state.x = Math.max(20, Math.min(FIELD.width - 20, player.state.x - (dx / d) * 46));
          player.state.y = Math.max(20, Math.min(FIELD.height - 20, player.state.y - (dy / d) * 46));
          particles.burst(player.state.x, player.state.y, '#ef4444', 18, 300, 0.6, 3);
          particles.addTrauma(0.4);
          events |= EVENT_HIT;
          if (state.lives <= 0) {
            state.phase = 'over';
            events |= EVENT_OVER;
          }
          break;
        }
      }
    }

    // Shop: buys, then the timer (or confirm) opens the next wave.
    if (shopping) {
      state.shopTimer -= dt;
      if (ctrl.actions & ACTION_BUY1) events |= buy(0);
      if (ctrl.actions & ACTION_BUY2) events |= buy(1);
      if (ctrl.actions & ACTION_BUY3) events |= buy(2);
      if (state.shopTimer <= 0 || (ctrl.actions & ACTION_CONFIRM)) {
        if (state.wave >= WAVES) {
          state.phase = 'win';
          events |= EVENT_WIN;
        } else {
          startWave(state.wave + 1);
        }
      }
    }

    // Wave clear: queue empty and nothing alive (boss wave: boss dead).
    if (playing && state.spawnQueue.length === 0 && bots.countActive() === 0) {
      if (state.wave >= WAVES) {
        state.phase = 'win';
        events |= EVENT_WIN;
      } else {
        const bonus = 50 * state.wave;
        state.score += bonus;
        state.phase = 'shop';
        state.shopTimer = 5;
        state.bought = [false, false, false];
        setBanner(`WAVE ${state.wave} CLEAR`, `Bonus +${bonus} — spend scrap, then continue`, 3);
        events |= EVENT_WAVE_CLEAR;
      }
    }

    return events;
  }

  return {
    state,
    player: player.state,
    bots: bots.list,
    traces,
    particles,
    pickups,
    reset,
    resetAttract,
    startWave,
    buy,
    step,
    drawPlayer: player.draw,
    drawBots: bots.draw,
  };
}
