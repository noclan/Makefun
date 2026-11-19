// SOLMAR boot: fixed-step 1/60 loop, screen states, ?shot= / ?seed= handling.
import { createGame, stepGame, startNewGame, saveState, loadState } from './game.js';
import { createInput, attachInput, wasPressed, clearPressed } from './input.js';
import { drawWorld } from './render.js';
import { drawHud } from './hud.js';
import { drawMenu, drawPause, drawEnd, handleMenuKey } from './ui.js';
import { AudioEngine } from './audio.js';
import { buildShot, isShotScene } from './shots.js';
import { startMission } from './missions.js';
import { cycleStation } from './stations.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const shotName = params.get('shot');
let state, input = createInput(), audio = new AudioEngine(), paused = false, last = performance.now(), acc = 0;
if (shotName && isShotScene(shotName)) {
  state = buildShot(shotName);
} else {
  state = createGame(seed);
  loadState(state);
}
attachInput(input);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') handleMenuKey(state, 'Enter');
  if (e.code === 'KeyM') audio.setMuted(!audio.muted);
  if (e.code === 'KeyR' && state.screen === 'play') { const s = cycleStation(state); audio.setStation(s); }
  if (e.code === 'KeyN' && state.screen === 'play' && state.nextMission) startMission(state, state.nextMission);
});
function resize() { canvas.width = 1280; canvas.height = 720; }
resize();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (wasPressed(input, 'pause') && state.screen === 'play') { paused = !paused; saveState(state); }
  clearPressed(input);
  // Aim: mouse position relative to the player on screen.
  if (state.player && !state.player.inCar) {
    const px = 640, py = 360;
    state.aimAngle = Math.atan2(input.mouseY - py, input.mouseX - px);
  }
  if (!paused && (state.screen === 'play' || state.screen === 'shot')) {
    acc += dt;
    while (acc >= 1 / 60) { stepGame(state, input, 1 / 60); acc -= 1 / 60; }
    audio.ensure(); audio.startMusic();
    const sp = state.player.inCar ? Math.abs(state.player.inCar.speed) / 620 : 0;
    audio.engine(sp); audio.musicTick(dt, state.elapsed); audio.sirenTick(state.elapsed);
    for (const ev of state.events) {
      if (ev.kind === 'shot') audio.shot();
      if (ev.kind === 'crash') audio.crash();
      if (ev.kind === 'pickup') audio.pickup();
      if (ev.kind === 'mission-done') audio.jingle();
    }
  }
  ctx.clearRect(0, 0, 1280, 720);
  if (state.screen === 'title') drawMenu(ctx, state, 1280, 720);
  else {
    drawWorld(ctx, state, 1280, 720);
    drawHud(ctx, state, 1280, 720);
    if (paused) drawPause(ctx, 1280, 720);
    if (state.screen === 'busted' || state.screen === 'wasted') drawEnd(ctx, state, 1280, 720);
  }
  if (statusEl) statusEl.textContent = state.screen === 'title' ? 'SOLMAR — press Enter to start' : `SOLMAR — $${state.player.cash} — ${state.phase.name} — ${state.screen}`;
  requestAnimationFrame(frame);
}
if (shotName && isShotScene(shotName)) {
  // Full-bleed frame for the screenshot: hide the status/help bars.
  if (statusEl) statusEl.style.display = 'none';
  const helpEl = document.getElementById('help'); if (helpEl) helpEl.style.display = 'none';
  canvas.style.width = '1280px'; canvas.style.height = '720px'; canvas.style.maxHeight = 'none'; canvas.style.maxWidth = 'none';
  // One static render, then signal readiness for the screenshot.
  drawWorld(ctx, state, 1280, 720); drawHud(ctx, state, 1280, 720);
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
