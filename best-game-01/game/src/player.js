// The player: a spark-bot, a copper-ringed core with a cyan eye that looks where it
// moves. WASD/arrows steer, Shift dashes (brief burst, short cooldown, tiny invulnerability
// so a dash through a gap feels brave, not suicidal). A hit squashes the bot and blinks it
// while invulnerable. The dash ring around the player shows when the dash is ready.

import { FIELD, PLAYER } from './config.js';

export function createPlayer() {
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    faceX: 0,
    faceY: -1,
    invulnerable: 0,
    dashTime: 0,
    dashCooldown: 0,
    squash: 0,
    moving: false,
  };

  return {
    state: player,
    reset() {
      player.x = FIELD.width / 2;
      player.y = FIELD.height / 2;
      player.vx = 0;
      player.vy = 0;
      player.faceX = 0;
      player.faceY = -1;
      player.invulnerable = 0;
      player.dashTime = 0;
      player.dashCooldown = 0;
      player.squash = 0;
      player.moving = false;
    },
    /**
     * Move the player. Returns true when a dash started this step (for the whoosh).
     * `move` is a normalised vector; `wantDash` is the one-shot dash press.
     */
    update(dt, move, wantDash) {
      player.moving = move.x !== 0 || move.y !== 0;
      if (player.moving) {
        player.faceX = move.x;
        player.faceY = move.y;
      }
      player.invulnerable = Math.max(0, player.invulnerable - dt);
      player.dashCooldown = Math.max(0, player.dashCooldown - dt);
      player.squash = Math.max(0, player.squash - dt * 5);
      let dashing = false;
      if (wantDash && player.dashCooldown <= 0 && player.dashTime <= 0) {
        player.dashTime = PLAYER.dashTime;
        player.dashCooldown = PLAYER.dashCooldown;
        player.invulnerable = Math.max(player.invulnerable, 0.25);
        dashing = true;
      }
      const speed = player.dashTime > 0 ? PLAYER.dashSpeed : PLAYER.speed;
      if (player.dashTime > 0) player.dashTime -= dt;
      // Acceleration: quick to start, quicker to stop — the bot feels responsive, not icy.
      const accel = player.moving || player.dashTime > 0 ? 14 : 18;
      const tx = move.x * speed;
      const ty = move.y * speed;
      player.vx += (tx - player.vx) * Math.min(1, accel * dt);
      player.vy += (ty - player.vy) * Math.min(1, accel * dt);
      player.x = Math.max(player.radius + 2, Math.min(FIELD.width - player.radius - 2, player.x + player.vx * dt));
      player.y = Math.max(player.radius + 2, Math.min(FIELD.height - player.radius - 2, player.y + player.vy * dt));
      return dashing;
    },
    hit() {
      player.invulnerable = PLAYER.invulnerable;
      player.squash = 1;
    },
    draw(context, time) {
      const p = player;
      // Blink while invulnerable after a hit: hidden on every other tenth of a second.
      if (p.invulnerable > 0.1 && Math.floor(p.invulnerable * 10) % 2 === 0) return;
      const squashY = 1 - 0.12 * p.squash;
      const squashX = 1 + 0.12 * p.squash;
      context.save();
      context.translate(p.x, p.y);
      context.scale(squashX, squashY);
      // Dash-ready ring (fades in as the cooldown ends).
      if (p.dashCooldown <= 0) {
        context.strokeStyle = 'rgba(6, 182, 212, 0.55)';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(0, 0, p.radius + 7 + Math.sin(time * 3) * 1.5, 0, Math.PI * 2);
        context.stroke();
      } else {
        context.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(0, 0, p.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.dashCooldown / PLAYER.dashCooldown));
        context.stroke();
      }
      // Copper outer ring.
      context.fillStyle = '#f97316';
      context.beginPath();
      context.arc(0, 0, p.radius, 0, Math.PI * 2);
      context.fill();
      // Dark core.
      context.fillStyle = '#0f172a';
      context.beginPath();
      context.arc(0, 0, p.radius - 4, 0, Math.PI * 2);
      context.fill();
      // Cyan eye looking where the bot moves.
      context.fillStyle = '#06b6d4';
      context.beginPath();
      context.arc(p.faceX * 5, p.faceY * 5, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f8fafc';
      context.beginPath();
      context.arc(p.faceX * 5 + 1.5, p.faceY * 5 - 1.5, 1.8, 0, Math.PI * 2);
      context.fill();
      context.restore();
    },
  };
}
