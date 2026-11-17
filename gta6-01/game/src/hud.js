// The HUD: a rich screen-space layer over the world — district card,
// mission banner, wanted stars, a right-hand status panel (cash, weapon,
// health, armour, respect), a circular minimap with a route line, a
// circular speedometer gauge, a radio bar, hints and dialogue. Everything
// sits inside a 16 px safe margin: no text is ever clipped at an edge.

import { FONT, PALETTE, PISTOL, RADIO, WORLD, respectLevel } from './config.js';
import { markerFor, missionTitle, currentStage } from './missions.js';

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

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
}

function wantedLabel(stars) {
  if (stars === 0) return 'CLEAN';
  if (stars <= 2) return 'WANTED';
  if (stars === 3) return 'HOT';
  if (stars === 4) return 'MOST WANTED';
  return 'LOCKDOWN';
}

function gearFor(speed, reversing) {
  if (reversing) return 'R';
  if (speed < 5) return 'N';
  if (speed < 150) return '1';
  if (speed < 300) return '2';
  if (speed < 450) return '3';
  if (speed < 600) return '4';
  return '5';
}

function drawMinimap(ctx, g, cx, cy, radius) {
  const scale = (radius * 2) / WORLD.size;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(16, 16, 24, 0.85)';
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  // Sea and sand first, so the coast reads at a glance.
  ctx.fillStyle = '#2a7f9e';
  ctx.fillRect(cx - radius, cy - radius + WORLD.seaTop * scale, radius * 2, radius * 2);
  ctx.fillStyle = '#e8cf9a';
  ctx.fillRect(cx - radius, cy - radius + WORLD.beachTop * scale, radius * 2, (WORLD.seaTop - WORLD.beachTop) * scale);

  // Roads as a pale grid.
  ctx.fillStyle = 'rgba(232, 228, 216, 0.75)';
  for (const line of g.city.lines) {
    ctx.fillRect(cx - radius + line * scale - 1.5, cy - radius, 3, radius * 2);
    ctx.fillRect(cx - radius, cy - radius + line * scale - 1.5, radius * 2, 3);
  }
  // Buildings as warm blocks.
  ctx.fillStyle = 'rgba(201, 111, 74, 0.45)';
  for (const b of g.city.buildings) {
    ctx.fillRect(cx - radius + b.x0 * scale, cy - radius + b.y0 * scale, Math.max(1, (b.x1 - b.x0) * scale), Math.max(1, (b.y1 - b.y0) * scale));
  }
  // Route line: a dashed gold run from Rico to the objective.
  const marker = markerFor(g);
  const p = g.player;
  if (marker) {
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - radius + p.x * scale, cy - radius + p.y * scale);
    ctx.lineTo(cx - radius + marker.x * scale, cy - radius + marker.y * scale);
    ctx.stroke();
    ctx.setLineDash([]);
    const pulse = 4 + Math.sin(g.time * 4) * 1.5;
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(cx - radius + marker.x * scale, cy - radius + marker.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops red, traffic pale, Rico white with a gold ring.
  ctx.fillStyle = '#e5534b';
  for (const cop of g.cops) {
    ctx.fillRect(cx - radius + cop.x * scale - 2, cy - radius + cop.y * scale - 2, 4, 4);
  }
  ctx.fillStyle = 'rgba(245, 239, 224, 0.7)';
  for (const car of g.cars) {
    if (car.driver === 'traffic') ctx.fillRect(cx - radius + car.x * scale - 1.5, cy - radius + car.y * scale - 1.5, 3, 3);
  }
  // Rico: a white arrow pointing the way he faces.
  ctx.save();
  ctx.translate(cx - radius + p.x * scale, cy - radius + p.y * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#f2c94c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx - radius + p.x * scale, cy - radius + p.y * scale, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // Gold rim, a north marker, and the district name beneath.
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius - 12);
  ctx.lineTo(cx - 6, cy - radius - 2);
  ctx.lineTo(cx + 6, cy - radius - 2);
  ctx.closePath();
  ctx.fill();
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - radius - 16);
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = '#f2c94c';
  ctx.fillText(g.districtName.toUpperCase(), cx, cy + radius + 16);
}

function drawSpeedGauge(ctx, g, cx, cy, radius) {
  const p = g.player;
  const car = p.car;
  const speed = car ? Math.round(Math.abs(car.speed) * 0.36) : 0;
  const top = car ? Math.round(760 * 0.36) : 274;
  const frac = Math.min(1, speed / top);
  // Dial face.
  ctx.fillStyle = PALETTE.panel;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Sweep arc for the speed.
  const start = Math.PI * 0.75;
  const end = start + frac * Math.PI * 1.5;
  ctx.strokeStyle = '#f2c94c';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 8, start, end);
  ctx.stroke();
  // Needle.
  const needle = start + frac * Math.PI * 1.5;
  ctx.strokeStyle = '#e5534b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needle) * (radius - 14), cy + Math.sin(needle) * (radius - 14));
  ctx.stroke();
  // Readout: speed, gear, car name.
  ctx.textAlign = 'center';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`${speed}`, cx, cy + 2);
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('km/h', cx, cy + 17);
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = '#f2c94c';
  ctx.fillText(car ? `GEAR ${gearFor(Math.abs(car.speed), car.speed < 0)}` : 'ON FOOT', cx, cy + 34);
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(car ? car.name.toUpperCase() : 'RICO VEGA', cx, cy - radius - 8);
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

export function drawHud(ctx, g, view) {
  const p = g.player;
  const w = view.width;
  const h = view.height;
  ctx.textBaseline = 'alphabetic';

  // --- Top-left: district card with clock. ---
  panel(ctx, 16, 16, 300, 62);
  ctx.textAlign = 'left';
  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = '#f2c94c';
  ctx.fillText(g.districtName.toUpperCase(), 30, 42);
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  const tag = g.districtTag || '';
  ctx.fillText(tag, 30, 62);
  ctx.textAlign = 'right';
  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(clockText(g.clock), 302, 42);
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('SOLMAR BAY', 302, 62);

  // --- Top-centre: mission banner with chapter, name, timer/distance. ---
  const stage = currentStage(g);
  if (stage && !g.mission.failed) {
    const marker = markerFor(g);
    const dist = marker ? Math.round(Math.hypot(marker.x - p.x, marker.y - p.y)) : 0;
    const total = 6;
    const head = `MISSION ${g.mission.index + 1}/${total} — ${missionTitle(g).toUpperCase()}`;
    const sub = stage.type === 'timed'
      ? `${Math.max(0, stage.seconds - g.mission.timer).toFixed(0)}s LEFT — DRIVE!`
      : stage.type === 'tail'
        ? `STAY IN RANGE — ${Math.round(g.mission.timer)}s / ${stage.seconds}s`
        : stage.type === 'escape'
          ? 'LOSE THE HEAT, THEN REACH THE SAFEHOUSE'
          : stage.type === 'car'
            ? 'GET A CAR — PRESS E NEAR ONE'
            : `${stage.hint || 'REACH THE MARKER'} — ${dist}m`;
    ctx.font = `700 15px ${FONT}`;
    const hw = Math.max(ctx.measureText(head).width, ctx.measureText(sub).width);
    const bw = hw + 36;
    const bx = w / 2 - bw / 2;
    panel(ctx, bx, 16, bw, 52);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2c94c';
    ctx.fillText(head, w / 2, 37);
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(sub, w / 2, 57);
  }

  // --- Top-right: wanted stars + label, on a solid backing so no
  // world traffic can ever show through them. ---
  panel(ctx, w - 186, 14, 170, 54);
  ctx.textAlign = 'right';
  ctx.font = `26px ${FONT}`;
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < g.wanted.stars ? '#ffd166' : 'rgba(245,239,224,0.25)';
    ctx.fillText('★', w - 16 - i * 30, 40);
  }
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = g.wanted.stars >= 3 ? '#e5534b' : PALETTE.muted;
  ctx.fillText(wantedLabel(g.wanted.stars), w - 16, 62);

  // --- Right panel: cash, weapon, health, armour, respect. ---
  const px = w - 276;
  const py = 78;
  const pw = 260;
  const ph = 168;
  panel(ctx, px, py, pw, ph);
  ctx.textAlign = 'left';
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('CASH', px + 14, py + 20);
  ctx.font = `700 28px ${FONT}`;
  ctx.fillStyle = '#f2c94c';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, px + 14, py + 50);
  ctx.font = `700 14px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(p.car ? `CAR — ${p.car.name.toUpperCase()}` : `PISTOL  ${p.ammo} / ${PISTOL.ammoMax}`, px + 14, py + 74);
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('HEALTH', px + 14, py + 94);
  bar(ctx, px + 74, py + 84, 172, 11, p.health / 100, '#e5534b', 'rgba(0,0,0,0.55)');
  ctx.fillText('ARMOUR', px + 14, py + 114);
  bar(ctx, px + 74, py + 104, 172, 11, p.armor / 50, '#7fb8d8', 'rgba(0,0,0,0.55)');
  const respect = respectLevel(p.respect);
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`RESPECT — ${respect.name}  Lv ${respect.index}`, px + 14, py + 136);
  bar(ctx, px + 14, py + 142, 232, 9, respect.progress, '#f2c94c', 'rgba(0,0,0,0.55)');
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`Shells ${g.shellsFound}/12`, px + 14, py + 162);

  // --- Bottom-right: circular minimap, lifted so its district label
  // sits inside the frame, never on the edge. ---
  drawMinimap(ctx, g, w - 104, h - 118, 84);

  // --- Speedometer gauge, left of the minimap. ---
  drawSpeedGauge(ctx, g, w - 290, h - 62, 52);

  // --- Bottom-centre: radio bar. ---
  const radio = g.radio || { station: RADIO.station, track: RADIO.tracks[0] };
  const radioText = `♪ ${radio.station}  •  ${RADIO.genre}  •  ${radio.track}`;
  ctx.font = `13px ${FONT}`;
  const rw = Math.min(560, ctx.measureText(radioText).width + 32);
  panel(ctx, w / 2 - rw / 2, h - 46, rw, 28);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c94c';
  ctx.fillText(radioText, w / 2, h - 27);

  // --- Bottom-left: context hint + controls, on a dark strip so the
  // text stays readable over the busy world. ---
  ctx.fillStyle = 'rgba(20, 18, 28, 0.72)';
  ctx.fillRect(10, h - 86, 470, 76);
  ctx.textAlign = 'left';
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = 'rgba(245,239,224,0.9)';
  let hintY = h - 58;
  if (g.hint) {
    ctx.fillText(g.hint, 16, hintY);
    hintY -= 20;
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `12px ${FONT}`;
  ctx.fillText(p.car ? 'W/S drive • A/D steer • Space brake • E exit • P pause' : 'WASD move • Shift run • E enter car • F punch • G shoot • P pause', 16, hintY);

  // --- Short-lived message under the mission banner. ---
  if (g.hudMessage && g.hudMessageTimer > 0) {
    ctx.textAlign = 'center';
    ctx.font = `700 16px ${FONT}`;
    ctx.fillStyle = '#f2c94c';
    ctx.fillText(g.hudMessage, w / 2, 92);
  }

  // --- Dialogue card, bottom-centre above the radio bar. ---
  if (g.dialogue && g.dialogue.timer > 0) {
    const text = g.dialogue.text;
    ctx.font = `15px ${FONT}`;
    const lines = wrapText(ctx, text, 560);
    const boxH = 30 + lines.length * 20 + 14;
    const boxW = 600;
    const boxY = h - 250 - boxH;
    // Solid fill: world barks must never show through the dialogue.
    ctx.fillStyle = '#17141f';
    ctx.fillRect(w / 2 - boxW / 2, boxY, boxW, boxH);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w / 2 - boxW / 2, boxY, boxW, boxH);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2c94c';
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(g.dialogue.speaker.toUpperCase(), w / 2 - boxW / 2 + 16, boxY + 22);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `15px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, w / 2 - boxW / 2 + 16, boxY + 46 + i * 20);
    });
  }
}
