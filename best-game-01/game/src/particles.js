// Particles and the trauma-based screenshake rig (game-feel.md). Particles are a fixed
// pool allocated once at boot — nothing allocates mid-frame. Shake is trauma squared, so
// small events barely move the camera and big ones snap hard; the noise is driven by
// accumulated game time, never the wall clock, so replays stay deterministic.

const POOL_SIZE = 256;

function pseudoNoise(t, seed) {
  const x = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export function createParticles() {
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i += 1) {
    pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff', drag: 0 });
  }
  let trauma = 0;
  let time = 0;

  function spawn(x, y, vx, vy, life, size, color, drag) {
    for (let i = 0; i < pool.length; i += 1) {
      const p = pool[i];
      if (p.active) continue;
      p.active = true;
      p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.life = life; p.maxLife = life; p.size = size; p.color = color; p.drag = drag;
      return;
    }
  }

  return {
    /** Radial burst of `count` sparks. Speed in px/s, life in seconds. */
    burst(x, y, color, count, speed, life, size) {
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + (i * 0.7);
        const v = speed * (0.4 + 0.6 * ((i * 37) % 10) / 10);
        spawn(x, y, Math.cos(angle) * v, Math.sin(angle) * v, life * (0.6 + 0.4 * ((i * 13) % 10) / 10), size, color, 3);
      }
    },
    /** Expanding ring: a few sparks placed on a circle, flying outward. */
    ring(x, y, color, radius, count) {
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2;
        spawn(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, Math.cos(angle) * 260, Math.sin(angle) * 260, 0.45, 3, color, 2);
      }
    },
    /** A short-lived floating text mote (score popups ride the same pool). */
    mote(x, y, color) {
      spawn(x, y, 0, -46, 0.8, 4, color, 0);
    },
    addTrauma(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    update(dt) {
      time += dt;
      trauma = Math.max(0, trauma - 1.4 * dt);
      for (let i = 0; i < pool.length; i += 1) {
        const p = pool[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d;
        p.vy *= d;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },
    /** Current shake offset in field pixels; 0 when calm. */
    shakeOffset() {
      if (trauma <= 0) return { x: 0, y: 0 };
      const s = trauma * trauma;
      const freq = time * 32;
      return {
        x: 14 * s * pseudoNoise(freq, 1),
        y: 14 * s * pseudoNoise(freq, 2),
      };
    },
    get trauma() {
      return trauma;
    },
    draw(context) {
      for (let i = 0; i < pool.length; i += 1) {
        const p = pool[i];
        if (!p.active) continue;
        context.globalAlpha = Math.max(0, p.life / p.maxLife);
        context.fillStyle = p.color;
        context.beginPath();
        context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    },
  };
}
