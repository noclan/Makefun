// Keyboard and pointer input. Held keys give a movement vector; one-shot presses (start,
// restart, pause, dash, shop buys) are queued as bit flags and taken once by the loop, so a
// press between two frames is never lost and never counted twice. The mouse is the weapon:
// hold to draw wire, release to stop. Pointer positions are converted from window pixels
// into field pixels through the shared `view` the renderer writes each resize.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_DASH = 8;
export const ACTION_MUTE = 16;
export const ACTION_BUY1 = 32;
export const ACTION_BUY2 = 64;
export const ACTION_BUY3 = 128;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);
const MUTE = new Set(['KeyM']);
const BUY1 = new Set(['Digit1', 'Numpad1']);
const BUY2 = new Set(['Digit2', 'Numpad2']);
const BUY3 = new Set(['Digit3', 'Numpad3']);

export function createInput(target, view) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let actions = 0;
  // Pointer position in FIELD pixels; `drawing` is true while the button is held.
  const pointer = { x: 640, y: 360, drawing: false, inside: false };

  function toField(event) {
    const rect = target.getBoundingClientRect();
    const px = (event.clientX - rect.left) * (target.width / rect.width);
    const py = (event.clientY - rect.top) * (target.height / rect.height);
    pointer.x = (px - view.x) / view.scale;
    pointer.y = (py - view.y) / view.scale;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (BUY1.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BUY1;
    } else if (BUY2.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BUY2;
    } else if (BUY3.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BUY3;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false; down = false; left = false; right = false;
    pointer.drawing = false;
  });
  target.addEventListener('pointerdown', (event) => {
    toField(event);
    pointer.drawing = true;
    pointer.inside = true;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointermove', (event) => {
    toField(event);
    pointer.inside = true;
  });
  target.addEventListener('pointerup', () => {
    pointer.drawing = false;
  });
  target.addEventListener('pointerleave', () => {
    pointer.inside = false;
    pointer.drawing = false;
  });
  // Touch: one finger draws, so the game is playable on a touchscreen too.
  target.addEventListener('touchstart', (event) => event.preventDefault(), { passive: false });

  return {
    pointer,
    /** Normalised movement vector from held keys (0,0 when none). */
    moveVector() {
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      const y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
