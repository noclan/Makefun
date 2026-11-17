// Menus and saving: the title screen, pause, busted and wasted screens, and
// the localStorage save (cash, mission progress, shells, respect). Saving is
// quiet and frequent — after every mission and every shell — so a busted
// Rico never loses more than a few minutes of progress.

import { FONT, PALETTE, SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(g) {
  try {
    const data = {
      cash: g.player.cash,
      respect: g.player.respect,
      missionIndex: g.mission.index,
      shellsFound: g.shellsFound,
      shellsTaken: g.city.shells.map((s) => s.taken),
      clock: g.clock,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function applySave(g, data) {
  if (!data) return;
  g.player.cash = data.cash || 0;
  g.player.respect = data.respect || 0;
  g.mission.index = Math.min(data.missionIndex || 0, 5);
  g.shellsFound = data.shellsFound || 0;
  if (Array.isArray(data.shellsTaken)) {
    data.shellsTaken.forEach((taken, i) => {
      if (g.city.shells[i]) g.city.shells[i].taken = !!taken;
    });
  }
  if (typeof data.clock === 'number') g.clock = data.clock;
}

// --- Menu drawing (screen space, over the world) ---

function panel(ctx, w, h, title, lines, prompt, accent) {
  const boxW = 620;
  const lineH = 30;
  const boxH = 150 + lines.length * lineH + 60;
  const x = (w - boxW) / 2;
  const y = (h - boxH) / 2;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle = accent || PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, boxW, boxH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c94c';
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(title, w / 2, y + 66);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `17px ${FONT}`;
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, y + 118 + i * lineH);
  });
  ctx.fillStyle = '#f2c94c';
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText(prompt, w / 2, y + boxH - 28);
}

export function drawTitle(ctx, g, view, hasSave) {
  const w = view.width;
  const h = view.height;
  // A warm dusk wash over the attract-mode city behind the panel.
  ctx.fillStyle = 'rgba(20, 12, 28, 0.35)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c94c';
  ctx.font = `700 64px ${FONT}`;
  ctx.fillText('SOLMAR', w / 2, 150);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText('— Streets of Gold —', w / 2, 192);
  const lines = [
    'Rico Vega is back in Solmar Bay after five years away.',
    'Mama Rosa needs a driver. The Varela crew needs a lesson.',
    '',
    'Steal cars. Outrun the law. Finish all six missions.',
    'WASD move / drive  •  E enter a car  •  F punch  •  Click to shoot',
  ];
  panel(ctx, w, h, '', lines, hasSave ? 'Press Enter — New Game  •  C — Continue' : 'Press Enter to start', '#f2c94c');
  // The panel title is blank by design: the big SOLMAR above is the title.
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT}`;
  ctx.fillText('A sun-soaked open-world caper. Original story, original city, no borrowed names.', w / 2, h - 28);
}

export function drawPaused(ctx, view) {
  panel(ctx, view.width, view.height, 'PAUSED', ['The streets of Solmar will wait for you.', 'M — mute sound'], 'Press P to resume');
}

export function drawBusted(ctx, view, cashLost) {
  panel(ctx, view.width, view.height, 'BUSTED', [`The Solmar PD caught up with you.`, `Bail and fines: $${cashLost}.`, 'Mama Rosa is not impressed.'], 'Press Enter to try again', '#7fb8d8');
}

export function drawWasted(ctx, view, cashLost) {
  panel(ctx, view.width, view.height, 'WASTED', ['Rico went down in the streets of Solmar.', `Hospital bill: $${cashLost}.`, 'The Varelas are laughing. Make them stop.'], 'Press Enter to try again', '#e5534b');
}

export function drawMissionComplete(ctx, view, title, reward) {
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(20, 18, 28, 0.6)';
  ctx.fillRect(0, view.height / 2 - 70, view.width, 140);
  ctx.fillStyle = '#f2c94c';
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText('MISSION COMPLETE', view.width / 2, view.height / 2 - 8);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `20px ${FONT}`;
  ctx.fillText(`${title}   •   +$${reward}`, view.width / 2, view.height / 2 + 32);
}
