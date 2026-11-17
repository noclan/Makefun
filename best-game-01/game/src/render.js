// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. The floor is a circuit board: blueprint grid, copper traces, hazard chevrons at
// the edges, four terminal props with blinking ports. Plasma fields glow cyan over the
// floor; the unfinished trace is a live copper line with a sparking tip. Screenshake is
// applied as a translate from the trauma rig, so the field itself never moves.

import { FIELD, FONT, PALETTE } from './config.js';
import { drawHud, drawPanel } from './ui.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

// Four terminal props: circuit blocks with ports and a blinking status light.
const TERMINALS = [
  { x: 150, y: 130 },
  { x: 1130, y: 130 },
  { x: 150, y: 590 },
  { x: 1130, y: 590 },
];

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function drawFloor(time) {
    context.fillStyle = PALETTE.deep;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Blueprint grid.
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x <= FIELD.width; x += 64) {
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, FIELD.height);
    }
    for (let y = 0; y <= FIELD.height; y += 64) {
      context.moveTo(0, y + 0.5);
      context.lineTo(FIELD.width, y + 0.5);
    }
    context.stroke();
    // Copper traces baked into the floor: a few long runs with vias.
    context.strokeStyle = 'rgba(249, 115, 22, 0.28)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, 200);
    context.lineTo(420, 200);
    context.lineTo(420, 520);
    context.lineTo(900, 520);
    context.lineTo(900, 200);
    context.lineTo(1280, 200);
    context.moveTo(0, 480);
    context.lineTo(300, 480);
    context.lineTo(300, 120);
    context.lineTo(760, 120);
    context.lineTo(760, 600);
    context.lineTo(1280, 600);
    context.moveTo(0, 320);
    context.lineTo(180, 320);
    context.lineTo(180, 640);
    context.lineTo(560, 640);
    context.moveTo(1080, 0);
    context.lineTo(1080, 240);
    context.lineTo(1280, 240);
    context.moveTo(560, 0);
    context.lineTo(560, 80);
    context.lineTo(980, 80);
    context.lineTo(980, 420);
    context.stroke();
    context.fillStyle = 'rgba(249, 115, 22, 0.4)';
    const vias = [[420, 200], [420, 520], [900, 520], [900, 200], [300, 480], [300, 120], [760, 120], [760, 600], [180, 320], [180, 640], [560, 640], [1080, 240], [560, 80], [980, 80], [980, 420]];
    for (let i = 0; i < vias.length; i += 1) {
      context.beginPath();
      context.arc(vias[i][0], vias[i][1], 5, 0, Math.PI * 2);
      context.fill();
    }
    // Glowing floor nodes: small cyan points scattered on the grid so the empty
    // stretches of arena read as circuitry, not blank space. Fixed positions,
    // gentle pulse — dressing only, no gameplay.
    const nodes = [[96, 96], [224, 288], [352, 416], [480, 96], [608, 288], [736, 544], [864, 160], [992, 384], [1120, 512], [160, 544], [640, 640], [1152, 64]];
    for (let i = 0; i < nodes.length; i += 1) {
      const pulse = 0.35 + 0.2 * Math.sin(time * 2 + i * 1.7);
      context.fillStyle = `rgba(6, 182, 212, ${pulse})`;
      context.beginPath();
      context.arc(nodes[i][0], nodes[i][1], 3, 0, Math.PI * 2);
      context.fill();
    }
    // Hazard chevrons along the top and bottom edges.
    context.fillStyle = 'rgba(239, 68, 68, 0.35)';
    for (let x = 16; x < FIELD.width - 16; x += 48) {
      context.beginPath();
      context.moveTo(x, 10);
      context.lineTo(x + 12, 2);
      context.lineTo(x + 24, 10);
      context.lineTo(x + 12, 18);
      context.closePath();
      context.fill();
      context.beginPath();
      context.moveTo(x, FIELD.height - 10);
      context.lineTo(x + 12, FIELD.height - 2);
      context.lineTo(x + 24, FIELD.height - 10);
      context.lineTo(x + 12, FIELD.height - 18);
      context.closePath();
      context.fill();
    }
    // Terminal props.
    for (let i = 0; i < TERMINALS.length; i += 1) {
      const t = TERMINALS[i];
      context.fillStyle = '#1e293b';
      context.fillRect(t.x - 34, t.y - 24, 68, 48);
      context.strokeStyle = '#f97316';
      context.lineWidth = 2;
      context.strokeRect(t.x - 34, t.y - 24, 68, 48);
      context.fillStyle = '#0f172a';
      for (let p = 0; p < 3; p += 1) {
        context.beginPath();
        context.arc(t.x - 18 + p * 18, t.y - 8, 4, 0, Math.PI * 2);
        context.fill();
      }
      // Blinking status light.
      const on = Math.floor(time * 2 + i) % 2 === 0;
      context.fillStyle = on ? '#06b6d4' : '#155e75';
      context.beginPath();
      context.arc(t.x + 24, t.y + 12, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#94a3b8';
      context.font = `11px ${FONT}`;
      context.textAlign = 'center';
      context.fillText(`T-${i + 1}`, t.x, t.y + 20);
    }
  }

  function drawFields(world) {
    const fields = world.traces.fields;
    for (let i = 0; i < fields.length; i += 1) {
      const f = fields[i];
      const k = f.ttl / f.maxTtl;
      const pulse = 0.5 + 0.5 * Math.sin(world.state.time * 14);
      context.save();
      context.beginPath();
      for (let v = 0; v < f.polygon.length; v += 1) {
        if (v === 0) context.moveTo(f.polygon[v].x, f.polygon[v].y);
        else context.lineTo(f.polygon[v].x, f.polygon[v].y);
      }
      context.closePath();
      context.fillStyle = `rgba(6, 182, 212, ${0.30 + 0.20 * pulse * k})`;
      context.fill();
      context.strokeStyle = `rgba(6, 182, 212, ${0.55 + 0.35 * pulse})`;
      context.lineWidth = 3;
      context.stroke();
      context.restore();
    }
  }

  function drawTrace(world, time) {
    const points = world.traces.points;
    if (points.length < 2) return;
    const fading = world.traces.age > 2.5;
    const alpha = fading ? Math.max(0.15, 1 - (world.traces.age - 2.5) / 1.5) : 1;
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = '#f97316';
    context.lineWidth = 4;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
    context.stroke();
    context.strokeStyle = 'rgba(250, 204, 21, 0.8)';
    context.lineWidth = 1.5;
    context.stroke();
    // Sparking tip.
    const tip = points[points.length - 1];
    const r = 4 + Math.sin(time * 20) * 1.5;
    context.fillStyle = '#facc15';
    context.beginPath();
    context.arc(tip.x, tip.y, r, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawPickups(world) {
    const pickups = world.pickups;
    for (let i = 0; i < pickups.length; i += 1) {
      const p = pickups[i];
      if (!p.active) continue;
      const bob = Math.sin(world.state.time * 4 + i) * 3;
      const y = p.y + bob;
      if (p.kind === 'scrap') {
        // Bolt: yellow diamond with a dark slash.
        context.fillStyle = '#facc15';
        context.beginPath();
        context.moveTo(p.x, y - 11);
        context.lineTo(p.x + 8, y);
        context.lineTo(p.x, y + 11);
        context.lineTo(p.x - 8, y);
        context.closePath();
        context.fill();
        context.fillStyle = '#0f172a';
        context.fillRect(p.x - 1.5, y - 6, 3, 12);
      } else if (p.kind === 'heart') {
        // Core: red heart.
        context.fillStyle = '#ef4444';
        context.beginPath();
        context.arc(p.x - 5, y - 2, 6, 0, Math.PI * 2);
        context.arc(p.x + 5, y - 2, 6, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(p.x - 10, y);
        context.lineTo(p.x, y + 11);
        context.lineTo(p.x + 10, y);
        context.closePath();
        context.fill();
      } else {
        // Overcharge: cyan star.
        context.fillStyle = '#06b6d4';
        context.beginPath();
        for (let k = 0; k < 10; k += 1) {
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
          const rr = k % 2 === 0 ? 12 : 5;
          const px = p.x + Math.cos(a) * rr;
          const py = y + Math.sin(a) * rr;
          if (k === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
        context.fill();
      }
    }
  }

  /** Celebration sparks on the win screen: fixed positions, gentle pulse, drawn
   *  under the panel so the victory frame is a celebration, not an empty grid. */
  function drawWinSparks(time) {
    const sparks = [
      [120, 120, '#facc15'], [300, 90, '#06b6d4'], [520, 130, '#f97316'],
      [760, 90, '#facc15'], [980, 130, '#06b6d4'], [1160, 110, '#f97316'],
      [140, 620, '#06b6d4'], [360, 650, '#facc15'], [600, 620, '#f97316'],
      [820, 650, '#06b6d4'], [1040, 620, '#facc15'], [1200, 640, '#06b6d4'],
      [90, 360, '#f97316'], [1190, 360, '#facc15'],
    ];
    for (let i = 0; i < sparks.length; i += 1) {
      const s = sparks[i];
      const pulse = 0.45 + 0.4 * Math.sin(time * 3 + i * 1.3);
      context.fillStyle = s[2];
      context.globalAlpha = pulse;
      context.beginPath();
      context.arc(s[0], s[1], 5, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = pulse * 0.5;
      context.beginPath();
      context.arc(s[0], s[1], 10, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  /** Paint one frame: floor, fields, trace, pickups, bots, player, particles, then HUD/panels. */
  function draw(world, screen, best) {
    const state = world.state;
    const shake = world.particles.shakeOffset();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shake.x * view.scale, view.y + shake.y * view.scale);
    drawFloor(state.time);
    drawFields(world);
    drawTrace(world, state.time);
    drawPickups(world);
    world.drawBots(context, state.time);
    if (state.phase !== 'attract') world.drawPlayer(context, state.time);
    world.particles.draw(context);
    if (screen === SCREEN_WIN) drawWinSparks(state.time);
    // Hit flash: a red vignette that fades fast.
    if (state.hitFlash > 0) {
      context.fillStyle = `rgba(239, 68, 68, ${state.hitFlash * 0.18})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    // HUD on every screen except the title (the title panel carries its own info).
    if (screen !== SCREEN_TITLE) drawHud(context, world);
    if (screen === SCREEN_TITLE) {
      drawPanel(context, 'SURGELOOP', [
        'The only weapon is wire. Hold the mouse and draw a loop',
        'around the bots — close it and the loop becomes plasma.',
        '',
        'Move with WASD or arrows.  Shift to dash.  P to pause.',
        'Scrap buys upgrades between waves. Wave 10 is VOLT WARDEN:',
        'only a closed loop can hurt it.',
        '',
        best > 0 ? `Best score ${best}` : 'No score yet — set the first one.',
      ], 'Press Space or click to start');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel(context, 'Paused', ['The bots will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel(context, 'GAME OVER', [
        `Score ${state.score}   •   Wave ${state.wave} of 10`,
        `Best ${best}`,
        '',
        'The swarm got through. Draw tighter loops next run.',
      ], 'Press Space or click to play again');
    } else if (screen === SCREEN_WIN) {
      drawPanel(context, 'GRID SAVED', [
        `Score ${state.score}   •   All 10 waves cleared`,
        `Best ${best}`,
        '',
        'VOLT WARDEN is scrap. The loop held. You win.',
      ], 'Press Space or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
