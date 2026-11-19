// Menus: title / pause / busted / wasted, plus save/load wiring.
import { saveState, loadState, startNewGame } from './game.js';
import { startMission, nextMissionId } from './missions.js';

export function drawMenu(ctx, state, W, H) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#ff9a5c'); grad.addColorStop(0.55, '#c94f7c'); grad.addColorStop(1, '#2b3a6e');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (let i = 0; i < 24; i++) { const x = (i * 173) % W, y = (i * 97) % H; ctx.fillRect(x, y, 90, 120); }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 64px sans-serif'; ctx.fillText('SOLMAR', W / 2, 150);
  ctx.fillStyle = '#ffc94d'; ctx.font = 'bold 30px sans-serif'; ctx.fillText('— Streets of Gold —', W / 2, 196);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
  ctx.fillText('Rico Vega is back in Solmar Bay after five years. Mama Rosa needs a driver.', W / 2, 250);
  ctx.fillText('Steal cars, outrun the cops, run six jobs for Café Luna — and don\'t get busted.', W / 2, 278);
  ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#ffc94d';
  ctx.fillText('Press ENTER to start  •  WASD drive / walk  •  E enter car  •  F punch  •  Click shoot  •  M mute', W / 2, 350);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '16px sans-serif';
  ctx.fillText('A cheerful crime caper in a sun-soaked coastal city. No real city, no real crew — all our own.', W / 2, 400);
  if (state.completed && state.completed.length) ctx.fillText(`Missions done: ${state.completed.length}/6   •   Cash $${state.player.cash}`, W / 2, 440);
  ctx.textAlign = 'left'; ctx.restore();
}
export function drawPause(ctx, W, H) {
  ctx.fillStyle = 'rgba(10,12,20,0.72)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif'; ctx.fillText('PAUSED', W / 2, H / 2 - 20);
  ctx.font = '18px sans-serif'; ctx.fillText('Press P to keep playing  •  Progress saves automatically', W / 2, H / 2 + 20);
  ctx.textAlign = 'left';
}
export function drawEnd(ctx, state, W, H) {
  ctx.fillStyle = state.screen === 'busted' ? 'rgba(30,60,180,0.8)' : 'rgba(140,20,20,0.8)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 56px sans-serif';
  ctx.fillText(state.screen === 'busted' ? 'BUSTED!' : 'WASTED!', W / 2, H / 2 - 10);
  ctx.font = '19px sans-serif';
  ctx.fillText(state.screen === 'busted' ? 'The Solmar police caught Rico. Mama Rosa will bail him out — for a fee.' : 'Rico is down. The city keeps moving without him.', W / 2, H / 2 + 30);
  ctx.fillText('Press ENTER to try again', W / 2, H / 2 + 64);
  ctx.textAlign = 'left';
}
export function handleMenuKey(state, key) {
  if (key === 'Enter') {
    if (state.screen === 'title') { startNewGame(state); return true; }
    if (state.screen === 'busted' || state.screen === 'wasted') {
      state.player.health = 100; state.player.cash = Math.max(0, state.player.cash - 100);
      state.wanted = 0; state.cops.length = 0; state.screen = 'play';
      if (state.mission) startMission(state, state.mission.def.id);
      return true;
    }
  }
  return false;
}
export { saveState, loadState, nextMissionId };
