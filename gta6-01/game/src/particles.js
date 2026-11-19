// Particles, skid marks, screen shake.
import { makeRng } from './random.js';

export function makeParticles() { return { list: [], skids: [], shake: 0 }; }
export function burst(state, x, y, color, n = 10, speed = 160) {
  const rnd = state.rng || Math.random;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, s = speed * (0.4 + rnd() * 0.8);
    state.particles.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + rnd() * 0.4, max: 0.9, color, size: 2 + rnd() * 3 });
  }
}
export function addSkid(state, x, y, angle) {
  state.particles.skids.push({ x, y, angle, life: 6 });
  if (state.particles.skids.length > 220) state.particles.skids.shift();
}
export function stepParticles(state, dt) {
  for (const pt of state.particles.list) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.94; pt.vy *= 0.94; pt.life -= dt; }
  state.particles.list = state.particles.list.filter(p => p.life > 0);
  for (const s of state.particles.skids) s.life -= dt;
  state.particles.skids = state.particles.skids.filter(s => s.life > 0);
  state.shake = Math.max(0, state.shake - dt * 22);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 8);
}
export function shake(state, amt) { state.shake = Math.max(state.shake, amt); }
