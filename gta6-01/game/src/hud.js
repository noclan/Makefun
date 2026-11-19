// HUD: wanted stars, health/armor, cash, clock, speed, objective, minimap, arrow.
import { CFG } from './config.js';
import { missionTarget } from './missions.js';
import { clockLabel } from './dayphase.js';
import { drawDepthHud } from './depth.js';

export function drawHud(ctx, state, W, H) {
  const p = state.player;
  ctx.save();
  // Top-left: cash + time + phase.
  ctx.fillStyle = CFG.colors.hudBg; ctx.beginPath(); ctx.roundRect(12, 12, 250, 64, 10); ctx.fill();
  ctx.fillStyle = '#7CFC9A'; ctx.font = 'bold 26px sans-serif'; ctx.fillText(`$${p.cash}`, 24, 42);
  ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.fillText(`${clockLabel(state.clock)}  ${state.phase.name}`, 24, 64);
  drawDepthHud(ctx, state, W, H);
  // Top-right: wanted stars.
  ctx.fillStyle = CFG.colors.hudBg; ctx.beginPath(); ctx.roundRect(W - 210, 12, 198, 44, 10); ctx.fill();
  ctx.font = '24px sans-serif';
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i < state.wanted ? '#ffc94d' : 'rgba(255,255,255,0.25)'; ctx.fillText('★', W - 196 + i * 38, 44); }
  // Bottom-left: health + armor.
  ctx.fillStyle = CFG.colors.hudBg; ctx.beginPath(); ctx.roundRect(12, H - 66, 260, 54, 10); ctx.fill();
  bar(ctx, 24, H - 50, 140, 12, p.health / 100, '#ff5a5a');
  bar(ctx, 24, H - 30, 140, 12, p.armor / 100, '#5aa8ff');
  ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText(`HP ${Math.round(p.health)}  ARMOR ${Math.round(p.armor)}`, 172, H - 32);
  ctx.fillText(`AMMO ${p.ammo}`, 24, H - 58 + 0); // label above bars is drawn by the bar row; keep ammo visible
  // Bottom-right: speed + car, above the minimap so they never overlap.
  if (p.inCar) {
    ctx.fillStyle = CFG.colors.hudBg; ctx.beginPath(); ctx.roundRect(W - 190, H - 236, 178, 54, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif'; ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.32)} km/h`, W - 178, H - 204);
    ctx.font = '13px sans-serif'; ctx.fillText(p.inCar.name, W - 178, H - 186);
  }
  // Objective banner.
  if (state.mission && !state.mission.done) {
    const m = state.mission;
    ctx.fillStyle = 'rgba(255,201,77,0.92)'; ctx.beginPath(); ctx.roundRect(W / 2 - 260, 12, 520, 40, 10); ctx.fill();
    ctx.fillStyle = '#222'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`${m.def.id}. ${m.def.title}${m.def.kind === 'deliver' ? ` — ${Math.ceil(m.timer)}s left` : ''}`, W / 2, 38);
    ctx.textAlign = 'left';
  }
  // Dialogue card.
  if (state.dialogue) {
    ctx.fillStyle = 'rgba(12,14,22,0.78)'; ctx.beginPath(); ctx.roundRect(W / 2 - 280, H - 150, 560, 62, 10); ctx.fill();
    ctx.fillStyle = '#ffc94d'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(state.dialogue.who, W / 2 - 264, H - 124);
    ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif'; wrapText(ctx, state.dialogue.text, W / 2 - 264, H - 102, 528, 18);
  }
  // Off-screen objective arrow.
  if (state.mission && !state.mission.done) {
    const tgt = missionTarget(state.mission, state);
    const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(W / 2 + Math.cos(ang) * 150, H / 2 - 40 + Math.sin(ang) * 110); ctx.rotate(ang);
    ctx.fillStyle = '#ffc94d'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#ffc94d'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(`${Math.round(d)}m`, W / 2 + Math.cos(ang) * 150 - 14, H / 2 - 40 + Math.sin(ang) * 110 + 30);
  }
  drawMinimap(ctx, state, W, H);
  ctx.restore();
}
function bar(ctx, x, y, w, h, f, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h);
}
function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = '';
  for (const w of words) { if (ctx.measureText(line + w).width > maxW) { ctx.fillText(line, x, y); line = ''; y += lh; } line += w + ' '; }
  ctx.fillText(line, x, y);
}
export function drawMinimap(ctx, state, W, H) {
  const S = 150, mx = W - S - 14, my = H - S - 14, scale = S / CFG.world;
  ctx.fillStyle = 'rgba(10,12,20,0.72)'; ctx.beginPath(); ctx.roundRect(mx - 6, my - 6, S + 12, S + 12, 10); ctx.fill();
  ctx.fillStyle = '#2f8fa8'; ctx.fillRect(mx, my, S, S);
  ctx.fillStyle = '#c9b183'; ctx.fillRect(mx + CFG.beachX * scale, my, S - CFG.beachX * scale, S);
  ctx.fillStyle = '#3a3a42';
  for (let x = 340; x < CFG.world; x += 340) ctx.fillRect(mx + x * scale, my, 3, S);
  for (let y = 340; y < CFG.world; y += 340) ctx.fillRect(mx, my + y * scale, S, 3);
  const dot = (x, y, color, r = 3) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(mx + x * scale, my + y * scale, r, 0, Math.PI * 2); ctx.fill(); };
  for (const c of state.traffic) dot(c.x, c.y, '#ddd', 2);
  for (const cop of state.cops) dot(cop.x, cop.y, '#3e7be8', 4);
  if (state.mission && !state.mission.done) { const t = missionTarget(state.mission, state); dot(t.x, t.y, '#ffc94d', 6); }
  dot(state.player.x, state.player.y, '#fff', 4);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(mx, my, S, S);
}
