// Drawing only: the camera, the world, and the light. The renderer takes the
// game state and paints one frame — ground, sea and sand, roads, buildings
// with long golden-hour shadows, palms, cars, people, particles, then a
// time-of-day tint over everything. The logical view is always 1280x720 and
// scales to fit the window.

import { CAR_TYPES, FONT, PALETTE, WORLD } from './config.js';
import { makeRng } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const VIEW_W = 1280;
const VIEW_H = 720;

function lightFor(clock) {
  // Golden hour, dusk, night, dawn, day — one tint per part of the day.
  if (clock >= 17 && clock < 19) return { color: '255, 150, 60', alpha: 0.16 };
  if (clock >= 19 && clock < 20.5) return { color: '120, 70, 160', alpha: 0.26 };
  if (clock >= 20.5 || clock < 5) return { color: '20, 30, 80', alpha: 0.4 };
  if (clock >= 5 && clock < 7) return { color: '255, 120, 140', alpha: 0.16 };
  return { color: '255, 220, 140', alpha: 0.05 };
}

function isNight(clock) {
  return clock >= 20 || clock < 5.5;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const boatRng = makeRng(99);
  const boats = [];
  for (let i = 0; i < 7; i += 1) {
    boats.push({ x: 2980 + boatRng() * 180, y: 1380 + boatRng() * 800, angle: boatRng() * Math.PI * 2, len: 26 + boatRng() * 20 });
  }
  const umbrellaSpots = [];
  for (let i = 0; i < 10; i += 1) {
    umbrellaSpots.push({ x: 200 + boatRng() * 2800, y: 2920 + boatRng() * 90, color: ['#e8316b', '#f2c94c', '#2ec4b6', '#e86a5a'][i % 4] });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    canvas.width = w;
    canvas.height = h;
    view.scale = Math.min(w / VIEW_W, h / VIEW_H);
    view.x = (w - VIEW_W * view.scale) / 2;
    view.y = (h - VIEW_H * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? '700 ' : ''}${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.fillText(value, x, y);
  }

  function drawGround(g, cam) {
    const x0 = cam.x - VIEW_W / 2;
    const y0 = cam.y - VIEW_H / 2;
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, VIEW_W, VIEW_H);
    // Sea and sand along the south edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(x0, WORLD.beachTop, VIEW_W, WORLD.seaTop - WORLD.beachTop);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(x0, WORLD.seaTop, VIEW_W, VIEW_H);
    // The marina bay on the east edge.
    const m = WORLD.marina;
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0);
    // Beach umbrellas.
    for (const u of umbrellaSpots) {
      if (u.x < x0 - 40 || u.x > x0 + VIEW_W + 40 || u.y < y0 - 40 || u.y > y0 + VIEW_H + 40) continue;
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(u.x - 1, u.y, 2, 12);
      ctx.fillStyle = u.color;
      ctx.beginPath();
      ctx.arc(u.x, u.y, 11, Math.PI, 0);
      ctx.fill();
    }
    // Boats in the marina.
    for (const b of boats) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-b.len / 2, -5, b.len, 10);
      ctx.fillStyle = '#c94f43';
      ctx.fillRect(-b.len / 2, -5, 6, 10);
      ctx.restore();
    }
  }

  function drawRoads(g, cam) {
    const x0 = cam.x - VIEW_W / 2;
    const y0 = cam.y - VIEW_H / 2;
    const x1 = x0 + VIEW_W;
    const y1 = y0 + VIEW_H;
    ctx.fillStyle = PALETTE.road;
    for (const line of g.city.lines) {
      if (line > y0 - 40 && line < y1 + 40) ctx.fillRect(x0, line - WORLD.roadWidth / 2, VIEW_W, WORLD.roadWidth);
      if (line > x0 - 40 && line < x1 + 40) ctx.fillRect(line - WORLD.roadWidth / 2, y0, WORLD.roadWidth, VIEW_H);
    }
    // Lane dashes and crosswalks.
    ctx.fillStyle = PALETTE.lane;
    for (const line of g.city.lines) {
      for (let d = 0; d < WORLD.size; d += 64) {
        const nearCrossing = g.city.lines.some((c) => Math.abs(d - c) < 48);
        if (nearCrossing) continue;
        if (line > y0 - 40 && line < y1 + 40) ctx.fillRect(x0 + d, line - 2, 30, 4);
        if (line > x0 - 40 && line < x1 + 40) ctx.fillRect(line - 2, y0 + d, 4, 30);
      }
    }
    ctx.fillStyle = PALETTE.crosswalk;
    for (const hx of g.city.lines) {
      for (const hy of g.city.lines) {
        if (hx < x0 - 60 || hx > x1 + 60 || hy < y0 - 60 || hy > y1 + 60) continue;
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(hx - 24 + i * 7, hy - 30, 4, 60);
          ctx.fillRect(hx - 30, hy - 24 + i * 7, 60, 4);
        }
      }
    }
  }

  function drawBlocks(g, cam) {
    const x0 = cam.x - VIEW_W / 2;
    const y0 = cam.y - VIEW_H / 2;
    const x1 = x0 + VIEW_W;
    const y1 = y0 + VIEW_H;
    for (const block of g.city.blocks) {
      if (block.x1 < x0 || block.x0 > x1 || block.y1 < y0 || block.y0 > y1) continue;
      ctx.fillStyle = block.district === 'hills' ? PALETTE.park : PALETTE.sidewalk;
      ctx.fillRect(block.x0, block.y0, block.x1 - block.x0, block.y1 - block.y0);
    }
  }

  function drawBuildings(g, cam) {
    const x0 = cam.x - VIEW_W / 2;
    const y0 = cam.y - VIEW_H / 2;
    const x1 = x0 + VIEW_W;
    const y1 = y0 + VIEW_H;
    const sunX = 0.85;
    const sunY = 0.5;
    for (const b of g.city.buildings) {
      if (b.x1 < x0 || b.x0 > x1 || b.y1 < y0 || b.y0 > y1) continue;
      // Long shadow toward the east: the sun is low over the bay.
      ctx.fillStyle = 'rgba(30, 20, 40, 0.28)';
      ctx.fillRect(b.x0 + b.height * sunX, b.y0 + b.height * sunY, b.x1 - b.x0, b.y1 - b.y0);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x0 + 4, b.y0 + 4, b.x1 - b.x0 - 8, b.y1 - b.y0 - 8);
      if (b.windows) {
        ctx.fillStyle = 'rgba(255, 240, 180, 0.75)';
        const cols = Math.floor((b.x1 - b.x0) / 22);
        const rows = Math.floor((b.y1 - b.y0) / 22);
        for (let c = 0; c < cols; c += 1) {
          for (let r = 0; r < rows; r += 1) {
            if ((c * 7 + r * 3) % 4 === 0) continue;
            ctx.fillRect(b.x0 + 8 + c * 22, b.y0 + 8 + r * 22, 8, 6);
          }
        }
      }
    }
    // Trees and palms.
    for (const t of g.city.trees) {
      if (t.x < x0 - 20 || t.x > x1 + 20 || t.y < y0 - 20 || t.y > y1 + 20) continue;
      ctx.fillStyle = 'rgba(30, 20, 40, 0.2)';
      ctx.beginPath();
      ctx.arc(t.x + 6, t.y + 6, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a7a3a';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6aa84f';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const palm of g.city.palms) {
      if (palm.x < x0 - 20 || palm.x > x1 + 20 || palm.y < y0 - 20 || palm.y > y1 + 20) continue;
      ctx.strokeStyle = '#8a6a4a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y + 8);
      ctx.lineTo(palm.x, palm.y - 8);
      ctx.stroke();
      ctx.strokeStyle = '#3f8f4f';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(palm.x, palm.y - 8);
        ctx.lineTo(palm.x + Math.cos(a) * palm.r, palm.y - 8 + Math.sin(a) * palm.r * 0.6);
        ctx.stroke();
      }
    }
  }

  function drawLandmarks(g, cam) {
    const pins = [
      { at: g.city.landmarks.cafeLuna, label: 'Café Luna', color: '#e86a5a' },
      { at: g.city.landmarks.bank, label: 'Bank', color: '#f2c94c' },
      { at: g.city.landmarks.respray, label: 'Pay-n-Spray', color: '#8a6fb8' },
      { at: g.city.landmarks.safehouse, label: 'Safehouse', color: '#7fae62' },
      { at: g.city.landmarks.hospital, label: 'Hospital', color: '#e8e8e8' },
      { at: g.city.landmarks.policeStation, label: 'Solmar PD', color: '#7fb8d8' },
      { at: g.city.landmarks.raceStart, label: 'Race', color: '#e8316b' },
    ];
    for (const pin of pins) {
      const d = Math.hypot(pin.at.x - g.player.x, pin.at.y - g.player.y);
      ctx.fillStyle = pin.color;
      ctx.beginPath();
      ctx.arc(pin.at.x, pin.at.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (d < 500) text(pin.label, pin.at.x, pin.at.y - 16, 13, '#ffffff', 'center', true);
    }
    // Seashells on the sand.
    for (const s of g.city.shells) {
      if (s.taken) continue;
      ctx.fillStyle = '#ffb8d1';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Pickups bob gently.
    for (const item of g.pickups) {
      const bob = Math.sin(item.bob) * 3;
      const color = item.kind === 'health' ? '#e5534b' : item.kind === 'armor' ? '#7fb8d8' : '#f2c94c';
      ctx.fillStyle = color;
      ctx.fillRect(item.x - 8, item.y - 8 + bob, 16, 16);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(item.x - 8, item.y - 8 + bob, 16, 16);
      text(item.kind === 'health' ? '+' : item.kind === 'armor' ? 'A' : '•', item.x, item.y + 4 + bob, 13, '#ffffff', 'center', true);
    }
  }

  function drawSkids(g) {
    ctx.strokeStyle = 'rgba(20, 20, 24, 0.4)';
    ctx.lineWidth = 5;
    for (const s of g.effects.skids) {
      ctx.globalAlpha = Math.min(1, s.life / 3);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(s.angle) * s.length, s.y + Math.sin(s.angle) * s.length);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawCar(g, car) {
    const spec = CAR_TYPES[car.type];
    const len = spec.length;
    const wid = spec.width;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(30, 20, 40, 0.25)';
    ctx.fillRect(-len / 2 + 4, -wid / 2 + 4, len, wid);
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
    ctx.fill();
    // Roof and windshield.
    ctx.fillStyle = car.roof;
    ctx.beginPath();
    ctx.roundRect(-len / 4, -wid / 2 + 3, len / 2, wid - 6, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 220, 240, 0.85)';
    ctx.fillRect(len / 4, -wid / 2 + 3, 5, wid - 6);
    // Cop livery: white body, blue doors, flashing light bar.
    if (car.type === 'cop') {
      ctx.fillStyle = '#1d3557';
      ctx.fillRect(-len / 4, -wid / 2, len / 2, 4);
      ctx.fillRect(-len / 4, wid / 2 - 4, len / 2, 4);
      const flash = Math.floor(g.time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#e5534b' : '#4a7fb8';
      ctx.fillRect(-4, -wid / 2 + 2, 8, 5);
      ctx.fillStyle = flash ? '#4a7fb8' : '#e5534b';
      ctx.fillRect(-4, wid / 2 - 7, 8, 5);
    }
    if (car.type === 'taxi') {
      ctx.fillStyle = '#1a1a1a';
      ctx.font = `700 8px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, -wid / 2 - 4);
    }
    // Headlights at night: two cones of light ahead.
    if (isNight(g.clock)) {
      const grad = ctx.createRadialGradient(len / 2, 0, 4, len / 2, 0, 90);
      grad.addColorStop(0, 'rgba(255, 240, 180, 0.35)');
      grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(len / 2, 0, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe9a0';
      ctx.beginPath();
      ctx.arc(len / 2, -6, 3, 0, Math.PI * 2);
      ctx.arc(len / 2, 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Damage smoke is drawn by the effects system; a wrecked car sags.
    if (car.damage >= 100) {
      ctx.fillStyle = 'rgba(40, 40, 40, 0.5)';
      ctx.fillRect(-len / 2, -wid / 2, len, wid);
    }
    ctx.restore();
  }

  function drawPerson(g, person, isPlayer) {
    ctx.save();
    ctx.translate(person.x, person.y);
    if (person.down) {
      ctx.fillStyle = person.color || '#e8a34c';
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, person.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    // Shadow.
    ctx.fillStyle = 'rgba(30, 20, 40, 0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 4, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    ctx.fillStyle = isPlayer ? '#f2c94c' : person.color || '#e8a34c';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2118';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick.
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(person.angle) * 8, Math.sin(person.angle) * 8);
    ctx.lineTo(Math.cos(person.angle) * 16, Math.sin(person.angle) * 16);
    ctx.stroke();
    if (isPlayer && !g.player.car) {
      // Rico's pistol, when he has just fired or is aiming.
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(person.angle) * 10, Math.sin(person.angle) * 10);
      ctx.lineTo(Math.cos(person.angle) * 20, Math.sin(person.angle) * 20);
      ctx.stroke();
    }
    ctx.restore();
    // A fare customer waves.
    if (person.taxi) {
      text('TAXI?', person.x, person.y - 24, 13, '#f2c94c', 'center', true);
    }
  }

  function drawWorld(g) {
    const cam = g.camera;
    const shake = g.effects.shakeOffset();
    const cx = cam.x + shake.x;
    const cy = cam.y + shake.y;
    // Letterbox backdrop, then the 1280x720 view transform.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#14121c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.save();
    ctx.translate(-(cx - VIEW_W / 2), -(cy - VIEW_H / 2));
    drawGround(g, { x: cx, y: cy });
    drawBlocks(g, { x: cx, y: cy });
    drawRoads(g, { x: cx, y: cy });
    drawBuildings(g, { x: cx, y: cy });
    drawLandmarks(g, { x: cx, y: cy });
    drawSkids(g);
    // The objective marker: a pulsing gold ring on the ground.
    const marker = g.marker;
    if (marker) {
      const pulse = 26 + Math.sin(g.time * 4) * 6;
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of g.cars) drawCar(g, car);
    for (const ped of g.peds) drawPerson(g, ped, false);
    for (const cop of g.cops) {
      if (cop.kind === 'cop') drawPerson(g, cop, false);
    }
    if (!g.player.car) drawPerson(g, g.player, true);
    // Bullets.
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 3;
    for (const b of g.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.stroke();
    }
    // Particles.
    for (const pt of g.effects.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Floating score text.
    for (const f of g.effects.floats) {
      ctx.globalAlpha = Math.min(1, f.life);
      text(f.text, f.x, f.y, 16, f.color, 'center', true);
    }
    ctx.globalAlpha = 1;
    // A bark bubble near the pedestrian who said it.
    if (g.lastBark && g.lastBark.timer > 0) {
      ctx.globalAlpha = Math.min(1, g.lastBark.timer);
      text(g.lastBark.text, g.lastBark.x, g.lastBark.y - 26, 13, '#ffffff', 'center');
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // Time-of-day tint over the whole frame.
    const light = lightFor(g.clock);
    ctx.fillStyle = `rgba(${light.color}, ${light.alpha})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Night streetlight glow around the player.
    if (isNight(g.clock)) {
      const px = VIEW_W / 2;
      const py = VIEW_H / 2;
      const grad = ctx.createRadialGradient(px, py, 60, px, py, 320);
      grad.addColorStop(0, 'rgba(255, 220, 140, 0.12)');
      grad.addColorStop(1, 'rgba(255, 220, 140, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { drawWorld, view, VIEW_W, VIEW_H };
}
