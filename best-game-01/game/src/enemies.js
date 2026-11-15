// The bots. Four kinds, four silhouettes, four behaviours — readable at a glance:
// crawler, a tracked box that shambles at you; zipper, a fast dart that lunges; brute,
// a heavy hex plate that soaks loops; splitter, a twin orb that bursts into two crawlers.
// The boss, VOLT WARDEN, is a crowned ring: loops are the only thing that hurts it.
// Bots chase the player with a little wobble and push each other apart, so they arrive as
// a swarm, not a stack.

import { BOSS, BOT, FIELD } from './config.js';

export const KIND_CRAWLER = 0;
export const KIND_ZIPPER = 1;
export const KIND_BRUTE = 2;
export const KIND_SPLITTER = 3;
export const KIND_BOSS = 4;

const KIND_DEFS = [BOT.crawler, BOT.zipper, BOT.brute, BOT.splitter];

export function kindDef(kind) {
  return KIND_DEFS[kind];
}

export function createBots(random) {
  const bots = [];

  function spawn(kind, x, y) {
    const def = kind === KIND_BOSS ? BOSS : KIND_DEFS[kind];
    const bot = {
      active: true,
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: def.radius,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      score: def.score || 0,
      wobble: random() * Math.PI * 2,
      lunge: 0,
      lungeCooldown: 1 + random() * 2,
      windup: 0,
      flash: 0,
      spawnAge: 0,
    };
    bots.push(bot);
    return bot;
  }

  function spawnEdge(kind, playerX, playerY) {
    // Enter from a random edge, at least 200 px from the player so nothing spawns on top.
    for (let tries = 0; tries < 12; tries += 1) {
      const side = Math.floor(random() * 4);
      let x;
      let y;
      if (side === 0) { x = 30 + random() * (FIELD.width - 60); y = 30; }
      else if (side === 1) { x = 30 + random() * (FIELD.width - 60); y = FIELD.height - 30; }
      else if (side === 2) { x = 30; y = 30 + random() * (FIELD.height - 60); }
      else { x = FIELD.width - 30; y = 30 + random() * (FIELD.height - 60); }
      if (Math.hypot(x - playerX, y - playerY) >= 200) return spawn(kind, x, y);
    }
    return spawn(kind, 40, 40);
  }

  function update(dt, playerX, playerY, time) {
    for (let i = 0; i < bots.length; i += 1) {
      const b = bots[i];
      if (!b.active) continue;
      b.spawnAge += dt;
      b.flash = Math.max(0, b.flash - dt * 4);
      b.wobble += dt * 2.2;
      const dx = playerX - b.x;
      const dy = playerY - b.y;
      const dist = Math.hypot(dx, dy) || 1;
      // Wobble perpendicular to the chase direction, so paths weave instead of lining up.
      const wx = -dy / dist * Math.sin(b.wobble) * 0.35;
      const wy = dx / dist * Math.sin(b.wobble) * 0.35;
      let speed = b.speed;
      if (b.kind === KIND_ZIPPER) {
        b.lungeCooldown -= dt;
        if (b.windup > 0) {
          // Telegraph: the zipper crouches and flashes for 0.35 s before it lunges,
          // so the lunge is dodgeable instead of a cheap hit.
          b.windup -= dt;
          speed = b.speed * 0.4;
          if (b.windup <= 0) {
            b.lunge = 0.45;
            b.lungeCooldown = 2.2 + random() * 1.5;
          }
        } else if (b.lungeCooldown <= 0 && dist < 260) {
          b.windup = 0.35;
        }
        if (b.lunge > 0) {
          b.lunge -= dt;
          speed = b.speed * 2.4;
        }
      }
      b.vx = (dx / dist + wx) * speed;
      b.vy = (dy / dist + wy) * speed;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    // Separation: neighbours push apart so the swarm spreads instead of stacking.
    for (let i = 0; i < bots.length; i += 1) {
      const a = bots[i];
      if (!a.active) continue;
      for (let j = i + 1; j < bots.length; j += 1) {
        const b = bots[j];
        if (!b.active) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.radius + b.radius - 2;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = (min - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  function drawOne(context, b, time) {
    const spawnScale = Math.min(1, b.spawnAge / 0.25);
    context.save();
    context.translate(b.x, b.y);
    context.scale(spawnScale, spawnScale);
    const flash = b.flash > 0;
    if (b.kind === KIND_CRAWLER) {
      // Tracked box: square body, tread strips, red eye.
      context.fillStyle = flash ? '#ffffff' : BOT.crawler.color;
      context.fillRect(-13, -13, 26, 26);
      context.fillStyle = '#0f172a';
      context.fillRect(-13, -9, 26, 4);
      context.fillRect(-13, 5, 26, 4);
      context.fillStyle = '#ef4444';
      context.beginPath();
      context.arc(4, 0, 4, 0, Math.PI * 2);
      context.fill();
    } else if (b.kind === KIND_ZIPPER) {
      // Dart: triangle pointing at the player, yellow with a dark spine. While it
      // winds up a lunge it flashes white and shows a warning mark.
      const angle = Math.atan2(b.vy, b.vx);
      context.rotate(angle);
      const winding = b.windup > 0;
      context.fillStyle = flash || (winding && Math.floor(time * 12) % 2 === 0) ? '#ffffff' : BOT.zipper.color;
      context.beginPath();
      context.moveTo(15, 0);
      context.lineTo(-10, -9);
      context.lineTo(-5, 0);
      context.lineTo(-10, 9);
      context.closePath();
      context.fill();
      context.fillStyle = '#0f172a';
      context.fillRect(-6, -1.5, 12, 3);
      if (winding) {
        context.rotate(-angle);
        context.fillStyle = '#ef4444';
        context.font = 'bold 16px system-ui, sans-serif';
        context.textAlign = 'center';
        context.fillText('!', 0, -18);
      }
    } else if (b.kind === KIND_BRUTE) {
      // Hex plate: heavy hexagon, dark core, three rivets.
      context.fillStyle = flash ? '#ffffff' : BOT.brute.color;
      context.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        const px = Math.cos(a) * 22;
        const py = Math.sin(a) * 22;
        if (k === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      context.fillStyle = '#0f172a';
      context.beginPath();
      context.arc(0, 0, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#facc15';
      for (let k = 0; k < 3; k += 1) {
        const a = (k / 3) * Math.PI * 2 + time * 0.5;
        context.beginPath();
        context.arc(Math.cos(a) * 15, Math.sin(a) * 15, 2.5, 0, Math.PI * 2);
        context.fill();
      }
    } else if (b.kind === KIND_SPLITTER) {
      // Twin orb: two violet circles orbiting each other.
      const a = time * 4;
      context.fillStyle = flash ? '#ffffff' : BOT.splitter.color;
      context.beginPath();
      context.arc(Math.cos(a) * 6, Math.sin(a) * 6, 9, 0, Math.PI * 2);
      context.arc(Math.cos(a + Math.PI) * 6, Math.sin(a + Math.PI) * 6, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0f172a';
      context.beginPath();
      context.arc(0, 0, 4, 0, Math.PI * 2);
      context.fill();
    } else {
      // VOLT WARDEN: crowned ring, rotating segments, volt core. HP shown as a ring arc.
      const segs = 8;
      for (let k = 0; k < segs; k += 1) {
        const a0 = (k / segs) * Math.PI * 2 + time * 0.6;
        const a1 = a0 + (Math.PI * 2) / segs - 0.22;
        context.fillStyle = flash ? '#ffffff' : (k % 2 === 0 ? '#facc15' : '#f97316');
        context.beginPath();
        context.arc(0, 0, 40, a0, a1);
        context.arc(0, 0, 30, a1, a0, true);
        context.closePath();
        context.fill();
      }
      context.fillStyle = '#0f172a';
      context.beginPath();
      context.arc(0, 0, 28, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#06b6d4';
      context.beginPath();
      context.arc(0, 0, 12 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
      context.fill();
      // HP arc above the boss.
      context.strokeStyle = 'rgba(248, 250, 252, 0.85)';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(0, 0, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (b.hp / b.maxHp));
      context.stroke();
    }
    context.restore();
  }

  return {
    list: bots,
    spawn,
    spawnEdge,
    update,
    draw(context, time) {
      for (let i = 0; i < bots.length; i += 1) {
        if (bots[i].active) drawOne(context, bots[i], time);
      }
    },
    countActive() {
      let n = 0;
      for (let i = 0; i < bots.length; i += 1) if (bots[i].active) n += 1;
      return n;
    },
    clear() {
      bots.length = 0;
    },
  };
}
