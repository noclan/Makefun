// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between five screens — title, play, paused, busted, wasted — and the title
// screen runs the city behind it as a living backdrop.
//
// ?seed=N fixes the city. ?shot=chase|downtown|mission|dusk (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createGame, stepGame } from './game.js';
import { createInput, ACT_CONFIRM, ACT_PAUSE } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED, SCREEN_WASTED } from './render.js';
import { drawHud } from './hud.js';
import { applySave, drawBusted, drawPaused, drawTitle, drawWasted, loadSave } from './ui.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { retryMission } from './missions.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const ctx = canvas.getContext('2d');

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const g = createGame(seed);
  g.audio = null;
  stageShot(name, g);
  let painted = 0;
  function paint() {
    renderer.drawWorld(g);
    ctx.setTransform(renderer.view.scale, 0, 0, renderer.view.scale, renderer.view.x, renderer.view.y);
    drawHud(ctx, g, { width: renderer.VIEW_W, height: renderer.VIEW_H });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  const saved = loadSave();
  let g = createGame(seed);
  g.audio = audio;
  g.attract = true;
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function startGame(useSave) {
    g = createGame(seed);
    g.audio = audio;
    if (useSave && saved) applySave(g, saved);
    g.camera.x = g.player.x;
    g.camera.y = g.player.y;
    screen = SCREEN_PLAY;
    audio.unlock();
    window.__solmarGame = g;
    announce(useSave ? 'Welcome back to Solmar Bay.' : 'Welcome to Solmar Bay. Drive to Café Luna.');
  }

  function openTitle() {
    g = createGame(seed);
    g.audio = audio;
    g.attract = true;
    screen = SCREEN_TITLE;
    announce('Solmar, Streets of Gold. Press Enter to start.');
  }

  function step() {
    if (screen !== SCREEN_PLAY) return;
    // Aim: the mouse position in world coordinates, when the mouse moved.
    if (input.mouse.moved) {
      const dpr = window.devicePixelRatio || 1;
      const sx = input.mouse.x * dpr;
      const sy = input.mouse.y * dpr;
      g.aimWorld = {
        x: (sx - renderer.view.x) / renderer.view.scale + g.camera.x - renderer.VIEW_W / 2,
        y: (sy - renderer.view.y) / renderer.view.scale + g.camera.y - renderer.VIEW_H / 2,
      };
    }
    stepGame(g, STEP, input);
    if (g.over) {
      screen = g.over.type === 'busted' ? SCREEN_BUSTED : SCREEN_WASTED;
      announce(g.over.type === 'busted' ? `Busted. You lost $${g.over.lost}.` : `Wasted. You lost $${g.over.lost}.`);
    }
  }

  function handleActions() {
    // Only the screen-level actions are taken here; the rest (interact,
    // punch, shoot, mute) stay queued for the game step.
    const actions = input.takeActions(ACT_CONFIRM | ACT_PAUSE);
    if (screen === SCREEN_TITLE) {
      if (actions & ACT_CONFIRM) startGame(false);
      // C continues a saved game; the key is read straight off the event.
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACT_CONFIRM) {
        g.over = null;
        screen = SCREEN_PLAY;
        announce('Back on the streets.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACT_PAUSE | ACT_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & ACT_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if ((actions & ACT_CONFIRM) && g.mission.failed) {
      retryMission(g);
      announce('Mission restarted.');
    }
  }

  // C on the title screen continues the saved game.
  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_TITLE && event.code === 'KeyC' && saved) {
      startGame(true);
    }
    if (event.code === 'Space' || event.code === 'Enter') audio.unlock();
  });
  canvas.addEventListener('pointerdown', () => audio.unlock());

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
      if (screen === SCREEN_TITLE) {
        // The attract-mode city still lives behind the menu.
        stepGame(g, STEP, input);
      }
    }
    renderer.drawWorld(g);
    ctx.setTransform(renderer.view.scale, 0, 0, renderer.view.scale, renderer.view.x, renderer.view.y);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(ctx, g, { width: renderer.VIEW_W, height: renderer.VIEW_H });
    }
    if (screen === SCREEN_TITLE) drawTitle(ctx, g, { width: renderer.VIEW_W, height: renderer.VIEW_H }, !!saved);
    else if (screen === SCREEN_PAUSED) drawPaused(ctx, { width: renderer.VIEW_W, height: renderer.VIEW_H });
    else if (screen === SCREEN_BUSTED) drawBusted(ctx, { width: renderer.VIEW_W, height: renderer.VIEW_H }, g.over ? g.over.lost : 0);
    else if (screen === SCREEN_WASTED) drawWasted(ctx, { width: renderer.VIEW_W, height: renderer.VIEW_H }, g.over ? g.over.lost : 0);
  }

  // Leaving the tab pauses a running game rather than letting Rico drive
  // unseen into the sea.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar, Streets of Gold. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

// Test hook for the headless playtest: the live game, its input and its
// step function, so a script can drive Rico without a real keyboard.
window.__solmar = { createGame, stepGame, retryMission };
