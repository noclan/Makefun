// Juice: particles, skid marks, floating score text and the camera shake.
// Everything here is cosmetic — the sim never reads it — but it is what
// makes a crash feel like a crash and a pickup feel like a reward.

export function createEffects(rng) {
  const particles = [];
  const skids = [];
  const floats = [];
  let trauma = 0;

  function burst(x, y, color, count, speed, life, size) {
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * Math.PI * 2;
      const v = speed * (0.4 + rng() * 0.6);
      particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: life * (0.6 + rng() * 0.4),
        maxLife: life,
        size: size * (0.6 + rng() * 0.8),
        color,
      });
    }
    if (particles.length > 400) particles.splice(0, particles.length - 400);
  }

  function smoke(x, y) {
    burst(x, y, '#8a8a8a', 3, 30, 0.9, 7);
  }

  function sparks(x, y) {
    burst(x, y, '#ffd166', 10, 260, 0.35, 3);
  }

  function blood(x, y) {
    burst(x, y, '#c0392b', 8, 140, 0.5, 4);
  }

  function muzzle(x, y, angle) {
    for (let i = 0; i < 5; i += 1) {
      const spread = (rng() - 0.5) * 0.5;
      particles.push({
        x, y,
        vx: Math.cos(angle + spread) * 420,
        vy: Math.sin(angle + spread) * 420,
        life: 0.12, maxLife: 0.12, size: 3, color: '#ffe066',
      });
    }
  }

  function skidMark(x, y, angle, length) {
    skids.push({ x, y, angle, length, life: 6 });
    if (skids.length > 240) skids.shift();
  }

  function floatText(x, y, text, color) {
    floats.push({ x, y, text, color, life: 1.4 });
    if (floats.length > 24) floats.shift();
  }

  function shake(amount) {
    trauma = Math.min(1, trauma + amount);
  }

  function shakeOffset() {
    if (trauma <= 0) return { x: 0, y: 0 };
    const power = trauma * trauma * 14;
    return { x: (rng() * 2 - 1) * power, y: (rng() * 2 - 1) * power };
  }

  function step(dt) {
    trauma = Math.max(0, trauma - dt * 1.6);
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    for (let i = skids.length - 1; i >= 0; i -= 1) {
      skids[i].life -= dt;
      if (skids[i].life <= 0) skids.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i -= 1) {
      const f = floats[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }
  }

  return { particles, skids, floats, burst, smoke, sparks, blood, muzzle, skidMark, floatText, shake, shakeOffset, step };
}
