// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, game over and victory.
// Heavy hits trigger hitstop: the gameplay delta scales to 0.05 for 60–90 ms while the
// render loop keeps drawing, so the impact reads as weight, not lag.
//
// ?seed=N fixes the world. ?shot=title|play|loop|victory (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
// ?bot=1 runs the autopilot live behind the real game, for bot playtests.
// window.__gameState publishes screen, score, wave, lives, frames and player position
// every frame for the playtest driver.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BOSS_HIT, EVENT_BUY, EVENT_DASH, EVENT_HIT, EVENT_KILL, EVENT_LOOP, EVENT_OVER,
  EVENT_PICKUP, EVENT_WAVE_CLEAR, EVENT_WIN, createWorld,
} from './field.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAutopilot, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const botMode = params.get('bot') === '1' || params.get('bot') === 'slow';
// A slow bot updates its pilot every other step: the weaker player the difficulty
// is measured against (fast bot should outlive and outscore it).
const botSlow = params.get('bot') === 'slow';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const world = createWorld(random);
const audio = createAudio(random);
const renderer = createRenderer(canvas);
const input = createInput(canvas, renderer.view);
const pilot = botMode ? createAutopilot(world) : null;
// The title attract pilot: same autopilot, separate instance so live input never fights it.
const pilotAttract = createAutopilot(world);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let hitstopRemaining = 0;
  let timeScale = 1;
  let botTitleSteps = 0;
  let botStepCount = 0;
  let botControl = null;
  world.resetAttract();

  // Diagnostics for the bot playtest driver (and any human watching the console).
  window.__gameState = {
    screen, score: 0, wave: 0, lives: 3, bots: 0, wire: 100,
    frames: 0, player: { x: 640, y: 360 }, surge: 0, state: 'title',
  };

  function publishState() {
    const s = window.__gameState;
    const st = world.state;
    s.screen = screen;
    s.score = st.score;
    s.wave = st.wave;
    s.lives = st.lives;
    s.bots = st.spawnQueue.length + world.bots.filter((b) => b.active).length;
    s.wire = Math.round(st.wire);
    s.frames = st.frames;
    s.player.x = Math.round(world.player.x);
    s.player.y = Math.round(world.player.y);
    s.surge = st.lastSurge.count;
    s.state = st.phase;
  }

  // Screen readers (and anyone watching the page's text) hear screen changes and hits.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    world.startWave(1);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Draw loops around the bots to fry them.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.victory();
      announce(`Victory. Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.gameOver();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function hitstop(ms) {
    hitstopRemaining = Math.max(hitstopRemaining, ms / 1000);
    timeScale = 0.05;
    audio.setDuck(0.6);
  }

  function handleEvents(events) {
    if (events & EVENT_LOOP) {
      const kills = world.state.lastSurge.count;
      audio.loopClose(kills);
      hitstop(70);
    }
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_BUY) audio.click();
    if (events & EVENT_BOSS_HIT) {
      audio.bossHit();
      hitstop(60);
    }
    if (events & EVENT_HIT) {
      audio.hit();
      hitstop(70);
      announce(world.state.lives === 1 ? 'Hit. 1 core left.' : `Hit. ${world.state.lives} cores left.`);
    }
    if (events & EVENT_WAVE_CLEAR) audio.waveClear();
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  // Screen-level presses (start, restart, pause, mute). The world-level presses (dash,
  // shop buys) stay in `actions` and ride down into step() with the control object.
  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (botMode) return; // The autopilot drives; human keys only mute.
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  // One fixed step. `actions` is the frame's one-shot presses (dash, shop buys, confirm
  // to leave the shop); the autopilot builds its own control each step in bot mode.
  function step(actions) {
    if (screen === SCREEN_TITLE) {
      if (botMode) {
        botTitleSteps += 1;
        if (botTitleSteps > 30) {
          startGame();
          return;
        }
        world.step(STEP, pilot.update(STEP));
      } else {
        world.step(STEP, pilotAttract.update(STEP));
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    let ctrl;
    if (botMode) {
      // The slow bot thinks every other step and reuses its last order in between.
      botStepCount += 1;
      if (!botSlow || botStepCount % 2 === 1) botControl = pilot.update(STEP);
      ctrl = botControl;
    } else {
      ctrl = {
        move: input.moveVector(),
        pointer: input.pointer,
        actions,
        wantDash: Boolean(actions & ACTION_DASH),
      };
    }
    const events = world.step(STEP, ctrl);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    // Hitstop decays in REAL time; the gameplay delta is scaled, the render is not.
    if (hitstopRemaining > 0) {
      hitstopRemaining -= Math.min((now - last) / 1000, MAX_FRAME);
      if (hitstopRemaining <= 0) {
        timeScale = 1;
        audio.setDuck(1);
      }
    }
    accumulator += Math.min((now - last) / 1000, MAX_FRAME) * timeScale;
    last = now;
    // One-shot presses are taken once per frame, here, so neither the screens nor the
    // world can eat them before the other sees them.
    const actions = botMode ? 0 : input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best);
    publishState();
  }

  // Leaving the tab pauses a running game rather than letting bots close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('SURGELOOP. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
