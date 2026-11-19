// Camera + world drawing + time-of-day lighting tint.
import { CFG } from './config.js';
import { districtAt, isRoad } from './world.js';
import { drawDepth } from './depth.js';

export function drawWorld(ctx, state, W, H) {
  const cam = state.camera;
  const sx = Math.sin(state.elapsed * 47.3) * state.shake * 0.5, sy = Math.cos(state.elapsed * 39.1) * state.shake * 0.5;
  const ox = W / 2 - cam.x + sx, oy = H / 2 - cam.y + sy;
  ctx.save(); ctx.translate(ox, oy);
  const vx0 = cam.x - W / 2 - 80, vy0 = cam.y - H / 2 - 80, vx1 = cam.x + W / 2 + 80, vy1 = cam.y + H / 2 + 80;
  // Sea + sand.
  ctx.fillStyle = '#1d6d84'; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  ctx.fillStyle = '#2f8fa8'; ctx.fillRect(Math.max(vx0, 0), vy0, Math.min(vx1, CFG.seaX) - Math.max(vx0, 0), vy1 - vy0);
  ctx.fillStyle = CFG.colors.sand; ctx.fillRect(CFG.seaX, vy0, CFG.beachX - CFG.seaX, vy1 - vy0);
  // Land base.
  ctx.fillStyle = '#c9b183'; ctx.fillRect(CFG.beachX, vy0, vx1 - CFG.beachX, vy1 - vy0);
  // Parks.
  for (const pk of state.world.parks) { ctx.fillStyle = '#6da34e'; ctx.fillRect(pk.x, pk.y, pk.w, pk.h); ctx.fillStyle = '#8fc36a'; ctx.fillRect(pk.x + 14, pk.y + 14, pk.w - 28, pk.h - 28); }
  // Roads.
  ctx.fillStyle = CFG.colors.road;
  for (let x = CFG.roadGap; x < CFG.world; x += CFG.roadGap) ctx.fillRect(x, 0, CFG.roadW, CFG.world);
  for (let y = CFG.roadGap; y < CFG.world; y += CFG.roadGap) ctx.fillRect(0, y, CFG.world, CFG.roadW);
  ctx.strokeStyle = CFG.colors.roadLine; ctx.lineWidth = 3; ctx.setLineDash([26, 30]);
  for (let x = CFG.roadGap; x < CFG.world; x += CFG.roadGap) { ctx.beginPath(); ctx.moveTo(x + CFG.roadW / 2, 0); ctx.lineTo(x + CFG.roadW / 2, CFG.world); ctx.stroke(); }
  for (let y = CFG.roadGap; y < CFG.world; y += CFG.roadGap) { ctx.beginPath(); ctx.moveTo(0, y + CFG.roadW / 2); ctx.lineTo(CFG.world, y + CFG.roadW / 2); ctx.stroke(); }
  ctx.setLineDash([]);
  // Marina piers + boats.
  for (const pier of state.world.piers) { ctx.fillStyle = '#8a6a4a'; ctx.fillRect(pier.x, pier.y, pier.w, pier.h); ctx.fillStyle = '#f2f2f2'; ctx.fillRect(pier.x + 30, pier.y - 34, 44, 16); }
  // Respray shop + café landmarks.
  const r = state.world.respray; ctx.fillStyle = '#37c8b0'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.fillText('RESPRAY $150', r.x + 12, r.y + 30);
  const c = state.world.cafe; ctx.fillStyle = '#ff7a5c'; ctx.fillRect(c.x, c.y, c.w, c.h); ctx.fillStyle = '#fff'; ctx.fillText('CAFÉ LUNA', c.x + 12, c.y + 28);
  // Buildings with long golden-hour shadows.
  for (const b of state.world.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    ctx.fillStyle = 'rgba(60,30,10,0.28)'; ctx.fillRect(b.x + b.height * 0.45, b.y + b.height * 0.3, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof; ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = 'rgba(255,240,170,0.85)';
    const cols = Math.max(2, Math.floor(b.w / 26)), rows = Math.max(2, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) ctx.fillRect(b.x + 8 + i * 24, b.y + 8 + j * 24, 10, 12);
    if (b.tall) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(b.x, b.y, 8, b.h); }
  }
  // Palm trees.
  for (const t of state.world.trees) {
    if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + 4, t.y - 14); ctx.stroke();
    ctx.fillStyle = '#3f9e4d'; ctx.beginPath(); ctx.arc(t.x + 4, t.y - 18, 13, 0, Math.PI * 2); ctx.fill();
  }
  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,20,0.5)'; ctx.lineWidth = 4;
  for (const s of state.particles.skids) { ctx.beginPath(); ctx.moveTo(s.x - 8, s.y); ctx.lineTo(s.x + 8, s.y); ctx.stroke(); }
  drawEntities(ctx, state);
  drawDepth(ctx, state);
  // Lighting tint.
  ctx.fillStyle = state.phase.tint; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  if (state.phase.dark > 0) { ctx.fillStyle = `rgba(8,10,40,${state.phase.dark})`; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0); }
  // Night streetlight glows.
  if (state.phase.lamps) {
    ctx.fillStyle = 'rgba(255,220,120,0.12)';
    for (let x = CFG.roadGap; x < CFG.world; x += CFG.roadGap) for (let y = CFG.roadGap; y < CFG.world; y += CFG.roadGap) { ctx.beginPath(); ctx.arc(x + 20, y + 20, 30, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
  return { ox, oy };
}
function drawCarShape(ctx, car, elapsed = 0) {
  ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-CFG.carL / 2 + 4, -CFG.carW / 2 + 5, CFG.carL, CFG.carW);
  ctx.fillStyle = car.color; ctx.beginPath(); ctx.roundRect(-CFG.carL / 2, -CFG.carW / 2, CFG.carL, CFG.carW, 9); ctx.fill();
  ctx.fillStyle = '#1c2733'; ctx.fillRect(-8, -CFG.carW / 2 + 5, 20, CFG.carW - 10);
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(CFG.carL / 2 - 4, -CFG.carW / 2 + 4, 4, 8); ctx.fillRect(CFG.carL / 2 - 4, CFG.carW / 2 - 12, 4, 8);
  if (car.type === 'cop') { ctx.fillStyle = '#fff'; ctx.fillRect(-CFG.carL / 2 + 6, -CFG.carW / 2, 14, CFG.carW); ctx.fillStyle = '#e83e3e'; ctx.fillRect(-2, -5, 8, 10); ctx.fillStyle = '#3e7be8'; ctx.fillRect(6, -5, 8, 10); }
  if (car.type === 'taxi') { ctx.fillStyle = '#222'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('TAXI', -14, 4); }
  if (car.hp < 40) { ctx.fillStyle = 'rgba(120,120,120,0.7)'; ctx.beginPath(); ctx.arc(-10, -6, 12 + Math.sin(elapsed * 7 + car.x) * 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function drawEntities(ctx, state) {
  for (const car of state.cars) drawCarShape(ctx, car, state.elapsed);
  for (const car of state.traffic) drawCarShape(ctx, car, state.elapsed);
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    ctx.fillStyle = pk.kind === 'health' ? '#ff5a5a' : pk.kind === 'armor' ? '#5aa8ff' : pk.kind === 'ammo' ? '#ffc94d' : '#37c8b0';
    ctx.beginPath(); ctx.arc(pk.x, pk.y + Math.sin(state.elapsed * 3 + pk.bob) * 2, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.fillText(pk.kind[0].toUpperCase(), pk.x - 4, pk.y + 4);
  }
  for (const ped of state.peds) {
    if (ped.hp <= 0) { ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(ped.x, ped.y, 10, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.fillStyle = ped.color; ctx.beginPath(); ctx.arc(ped.x, ped.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(ped.x, ped.y - 3, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Mission target + tail target.
  if (state.mission && !state.mission.done) {
    const tgt = state.mission.def.kind === 'tail' ? state.tailTarget : null;
    const tx = tgt ? tgt.x : null;
    // Marker drawn by hud via missionTarget; here draw the tail car.
    if (tgt) { ctx.fillStyle = '#7a2a8a'; ctx.beginPath(); ctx.arc(tgt.x, tgt.y, 14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('V', tgt.x - 4, tgt.y + 4); }
  }
  for (const cop of state.cops) {
    if (cop.car) continue;
    ctx.fillStyle = '#2b3a55'; ctx.beginPath(); ctx.arc(cop.x, cop.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dfe8ff'; ctx.beginPath(); ctx.arc(cop.x, cop.y - 3, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Player.
  const p = state.player;
  if (!p.inCar) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.facing);
    ctx.fillStyle = '#e83e3e'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(3, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(10, -3, 10, 6); // pistol
    if (state.muzzle > 0) { ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(26, 0, 9, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('RICO', p.x - 14, p.y - 20);
  }
  // Bullets + particles.
  ctx.fillStyle = '#ffe066';
  for (const b of state.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); }
  for (const pt of state.particles.list) { ctx.fillStyle = pt.color; ctx.globalAlpha = Math.max(0, pt.life / pt.max); ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
}
