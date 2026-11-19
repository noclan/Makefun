// Day cycle: golden hour -> dusk -> night streetlights -> dawn.
import { CFG } from './config.js';
import { clamp, lerp } from './random.js';

export function phaseAt(clock) {
  // clock in hours, 0..24. Returns name + light tint + darkness.
  if (clock >= 16 && clock < 18.5) return { name: 'Golden Hour', tint: 'rgba(255,166,66,0.14)', dark: 0.02, lamps: false };
  if (clock >= 18.5 && clock < 20) return { name: 'Dusk', tint: 'rgba(214,92,140,0.20)', dark: 0.10, lamps: true };
  if (clock >= 20 || clock < 5.5) return { name: 'Night', tint: 'rgba(20,30,90,0.30)', dark: 0.28, lamps: true };
  if (clock >= 5.5 && clock < 7.5) return { name: 'Dawn', tint: 'rgba(255,190,120,0.12)', dark: 0.04, lamps: false };
  return { name: 'Day', tint: 'rgba(255,240,200,0.05)', dark: 0, lamps: false };
}
export function stepClock(state, dt) {
  state.elapsed += dt;
  // 420 s per full day: clock advances 24h over CFG.dayLength.
  state.clock = (state.clock + (dt / CFG.dayLength) * 24) % 24;
  state.phase = phaseAt(state.clock);
}
export function clockLabel(clock) {
  const h = Math.floor(clock), m = Math.floor((clock - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
