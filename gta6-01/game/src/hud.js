// The HUD: wanted stars, health and armour bars, cash, the clock, speed,
// the objective banner and the minimap. Everything is drawn in screen space
// on top of the world, in the same warm palette as the city itself.

import { FONT, PALETTE, PISTOL } from './config.js';
import { markerFor, missionTitle, currentStage } from './missions.js';
import { WORLD } from './config.js';

function clockText(clock) {
  const h = Math.floor(clock) % 24;
  const m = Math.floor((clock % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function bar(ctx, x, y, w, h, fraction, fill, back) {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, fraction)) * w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

function drawMinimap(ctx, g, x, y, size) {
  const scale = size / WORLD.size;
  ctx.save();
  ctx.fillStyle = 'rgba(16, 16, 24, 0.82)';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();

  // Sea and sand first, so the coast reads at a glance.
  ctx.fillStyle = '#2a7f9e';
  ctx.fillRect(x, y + WORLD.seaTop * scale, size, size - WORLD.seaTop * scale);
  ctx.fillStyle = '#e8cf9a';
  ctx.fillRect(x, y + WORLD.beachTop * scale, size, (WORLD.seaTop - WORLD.beachTop) * scale);

  // Roads as a pale grid.
  ctx.fillStyle = 'rgba(232, 228, 216, 0.55)';
  for (const line of g.city.lines) {
    ctx.fillRect(x + line * scale - 1, y, 2, size);
    ctx.fillRect(x, y + line * scale - 1, size, 2);
  }
  // Buildings as warm blocks.
  ctx.fillStyle = 'rgba(201, 111, 74, 0.8)';
  for (const b of g.city.buildings) {
    ctx.fillRect(x + b.x0 * scale, y + b.y0 * scale, Math.max(1, (b.x1 - b.x0) * scale), Math.max(1, (b.y1 - b.y0) * scale));
  }
  // The objective marker pulses gold.
  const marker = markerFor(g);
  if (marker) {
    const pulse = 3 + Math.sin(g.time * 4) * 1.5;
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(x + marker.x * scale, y + marker.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops red, traffic pale, Rico white with a gold ring.
  ctx.fillStyle = '#e5534b';
  for (const cop of g.cops) {
    ctx.fillRect(x + cop.x * scale - 2, y + cop.y * scale - 2, 4, 4);
  }
  ctx.fillStyle = 'rgba(245, 239, 224, 0.7)';
  for (const car of g.cars) {
    if (car.driver === 'traffic') ctx.fillRect(x + car.x * scale - 1.5, y + car.y * scale - 1.5, 3, 3);
  }
  const p = g.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + p.x * scale, y + p.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f2c94c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + p.x * scale, y + p.y * scale, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawHud(ctx, g, view) {
  const p = g.player;
  const w = view.width;
  const h = view.height;
  ctx.textBaseline = 'alphabetic';

  // Top-left: health, armour, cash.
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'left';
  ctx.fillText('RICO VEGA', 18, 30);
  bar(ctx, 18, 38, 190, 12, p.health / 100, '#e5534b', 'rgba(0,0,0,0.55)');
  bar(ctx, 18, 54, 190, 8, p.armor / 50, '#7fb8d8', 'rgba(0,0,0,0.55)');
  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = '#f2c94c';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 18, 92);
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`Respect ${p.respect}   •   Shells ${g.shellsFound}/12`, 18, 112);

  // Top-right: wanted stars, clock, district.
  ctx.textAlign = 'right';
  ctx.font = `26px ${FONT}`;
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < g.wanted.stars ? '#ffd166' : 'rgba(245,239,224,0.25)';
    ctx.fillText('★', w - 18 - i * 30, 34);
  }
  ctx.font = `700 18px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(clockText(g.clock), w - 18, 62);
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(g.districtName, w - 18, 82);

  // Top-centre: the mission objective, with distance and a timer when timed.
  const stage = currentStage(g);
  if (stage && !g.mission.failed) {
    const marker = markerFor(g);
    const dist = marker ? Math.round(Math.hypot(marker.x - p.x, marker.y - p.y)) : 0;
    const title = missionTitle(g);
    ctx.font = `700 17px ${FONT}`;
    ctx.textAlign = 'center';
    const label = stage.type === 'timed'
      ? `${title} — ${Math.max(0, stage.seconds - g.mission.timer).toFixed(0)}s left`
      : stage.type === 'tail'
        ? `${title} — stay in range (${Math.round(g.mission.timer)}s / ${stage.seconds}s)`
        : stage.type === 'escape'
          ? `${title} — lose the heat, then reach the safehouse`
          : `${title} — ${dist}m`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(w / 2 - tw / 2 - 14, 14, tw + 28, 30);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.strokeRect(w / 2 - tw / 2 - 14, 14, tw + 28, 30);
    ctx.fillStyle = '#f2c94c';
    ctx.fillText(label, w / 2, 35);
  }

  // Bottom-left: context hint (enter a car, race, respray) + controls.
  ctx.textAlign = 'left';
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = 'rgba(245,239,224,0.85)';
  let hintY = h - 24;
  if (g.hint) {
    ctx.fillText(g.hint, 18, hintY);
    hintY -= 20;
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(p.car ? 'W/S drive  •  A/D steer  •  Space handbrake  •  E exit  •  P pause  •  M mute' : 'WASD move  •  Shift run  •  E enter car  •  F punch  •  Click / G shoot  •  P pause  •  M mute', 18, hintY);

  // Speed, above the minimap when driving, clear of its border.
  if (p.car) {
    ctx.textAlign = 'right';
    ctx.font = `700 30px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.36)}`, w - 18, h - 210);
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('km/h', w - 18, h - 186);
  }

  // Ammo count next to the health bar when on foot with the pistol out.
  if (!p.car) {
    ctx.textAlign = 'left';
    ctx.font = `700 15px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`Pistol  ${p.ammo} / ${PISTOL.ammoMax}`, 18, 134);
  }

  // The minimap, bottom-right.
  drawMinimap(ctx, g, w - 198, h - 198, 180);

  // A short-lived message line just under the objective banner.
  if (g.hudMessage && g.hudMessageTimer > 0) {
    ctx.textAlign = 'center';
    ctx.font = `700 16px ${FONT}`;
    ctx.fillStyle = '#f2c94c';
    ctx.fillText(g.hudMessage, w / 2, 68);
  }

  // Dialogue card, bottom-centre.
  if (g.dialogue && g.dialogue.timer > 0) {
    const text = g.dialogue.text;
    ctx.font = `15px ${FONT}`;
    const tw = Math.min(560, ctx.measureText(text).width);
    const lines = wrapText(ctx, text, 560);
    const boxH = 30 + lines.length * 20 + 14;
    const boxW = Math.min(600, tw + 40);
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(w / 2 - boxW / 2, h - 210 - boxH, boxW, boxH);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.strokeRect(w / 2 - boxW / 2, h - 210 - boxH, boxW, boxH);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2c94c';
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(g.dialogue.speaker.toUpperCase(), w / 2 - boxW / 2 + 16, h - 210 - boxH + 22);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `15px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, w / 2 - boxW / 2 + 16, h - 210 - boxH + 46 + i * 20);
    });
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}
