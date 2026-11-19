// Keyboard + mouse state, shared by the browser loop and the shot autopilot.
export function createInput() {
  return { up: false, down: false, left: false, right: false, run: false, action: false, punch: false, shoot: false, pause: false, mute: false, mouseX: 0, mouseY: 0, mouseDown: false, _pressed: new Set() };
}
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', KeyE: 'action', KeyF: 'punch',
  Space: 'punch', KeyP: 'pause', Escape: 'pause', KeyM: 'mute',
};
export function attachInput(input) {
  if (typeof window === 'undefined') return () => {};
  const dn = (e) => {
    const k = KEYMAP[e.code]; if (!k) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!input[k]) input._pressed.add(k);
    input[k] = true;
    if (e.code === 'KeyE') input._pressed.add('action');
  };
  const up = (e) => { const k = KEYMAP[e.code]; if (k) input[k] = false; };
  const mm = (e) => { input.mouseX = e.clientX; input.mouseY = e.clientY; };
  const md = () => { input.mouseDown = true; input.shoot = true; };
  const mu = () => { input.mouseDown = false; input.shoot = false; };
  window.addEventListener('keydown', dn); window.addEventListener('keyup', up);
  window.addEventListener('mousemove', mm); window.addEventListener('mousedown', md); window.addEventListener('mouseup', mu);
  return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); window.removeEventListener('mousemove', mm); window.removeEventListener('mousedown', md); window.removeEventListener('mouseup', mu); };
}
export function wasPressed(input, key) { const hit = input._pressed.has(key); if (hit) input._pressed.delete(key); return hit; }
export function clearPressed(input) { input._pressed.clear(); }
