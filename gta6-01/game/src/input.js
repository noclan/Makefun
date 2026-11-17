// Keyboard + mouse state. Held keys are read every step; one-shot presses
// (confirm, pause, interact, punch, shoot, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice. The mouse position is tracked for aiming the pistol.

export const ACT_CONFIRM = 1;
export const ACT_PAUSE = 2;
export const ACT_INTERACT = 4;
export const ACT_PUNCH = 8;
export const ACT_SHOOT = 16;
export const ACT_MUTE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const SHOOT = new Set(['KeyG']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, moved: false };

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || RUN.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACT_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACT_PAUSE;
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACT_INTERACT;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACT_PUNCH;
    } else if (SHOOT.has(event.code)) {
      if (!event.repeat) actions |= ACT_SHOOT;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACT_MUTE;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur so the player never drives off on their own.
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.moved = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.down = true;
    actions |= ACT_CONFIRM;
    actions |= ACT_SHOOT;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  function anyHeld(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    // Steering: -1..1 on each axis, from whatever keys are held.
    steerX() {
      return (anyHeld(RIGHT) ? 1 : 0) - (anyHeld(LEFT) ? 1 : 0);
    },
    steerY() {
      return (anyHeld(DOWN) ? 1 : 0) - (anyHeld(UP) ? 1 : 0);
    },
    running() {
      return anyHeld(RUN);
    },
    // True while this physical key is held down (used for the handbrake).
    isHeld(code) {
      return held.has(code);
    },
    mouse,
    // Test hooks: a playtest script can press keys without a real keyboard.
    press(code) {
      held.add(code);
    },
    release(code) {
      held.delete(code);
    },
    tap(action) {
      actions |= action;
    },
    // The one-shot presses since the last call, as ACT_* flags. With a mask,
    // only those flags are taken; the rest stay queued for the next caller.
    // The main loop takes CONFIRM and PAUSE here; the game step takes the
    // rest, so a press is never eaten by the wrong layer.
    takeActions(mask) {
      const wanted = mask === undefined ? 0xffffffff : mask;
      const taken = actions & wanted;
      actions &= ~wanted;
      return taken;
    },
  };
}
