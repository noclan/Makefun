// The wire: the player's only weapon. Hold the mouse to lay a copper trace; bring the
// tip back near an earlier point and the enclosed area becomes a plasma field that fries
// everything inside. A loop is only real when it is big enough (path at least 80 px, area
// at least 1200 px²) — tiny scribbles do nothing. Unfinished traces fade after 4 s, so the
// field never fills with stale wire. All geometry is plain arrays; nothing allocates per
// step except the closed polygon itself.

import { FIELD, TRACE } from './config.js';

function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Keep every second point so closed polygons stay small (≤64 vertices). */
function simplify(points) {
  if (points.length <= 64) return points.slice();
  const out = [];
  const step = Math.ceil(points.length / 64);
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  return out;
}

export function createTraces() {
  const points = [];
  let age = 0;
  const fields = [];

  function reset() {
    points.length = 0;
    fields.length = 0;
    age = 0;
  }

  return {
    get points() {
      return points;
    },
    get fields() {
      return fields;
    },
    get age() {
      return age;
    },
    reset,
    /** Drop the unfinished trace (the plasma fields stay). */
    clearTrace() {
      points.length = 0;
      age = 0;
    },
    /**
     * Lay wire toward (x, y). Returns a closed loop polygon when the tip comes back near
     * an earlier point, otherwise null. `onDraw` is called with the new segment length
     * so the caller can drain the wire meter.
     */
    drawTo(x, y, onDraw) {
      const clampedX = Math.max(4, Math.min(FIELD.width - 4, x));
      const clampedY = Math.max(4, Math.min(FIELD.height - 4, y));
      const last = points[points.length - 1];
      if (last) {
        const dx = clampedX - last.x;
        const dy = clampedY - last.y;
        const dist = Math.hypot(dx, dy);
        if (dist < TRACE.minPointGap) return null;
        if (points.length >= TRACE.maxPoints) return null;
        points.push({ x: clampedX, y: clampedY });
        age = 0;
        onDraw(dist);
        // Closure: the tip is near an old point (not the recent segment) and the loop
        // since then is long enough to be a real enclosure, not a wobble.
        if (points.length > TRACE.skipRecent + 4) {
          for (let i = 0; i <= points.length - TRACE.skipRecent - 1; i += 1) {
            const p = points[i];
            const ddx = clampedX - p.x;
            const ddy = clampedY - p.y;
            if (ddx * ddx + ddy * ddy > TRACE.closeDistance * TRACE.closeDistance) continue;
            const loop = points.slice(i);
            let length = 0;
            for (let k = 1; k < loop.length; k += 1) length += Math.hypot(loop[k].x - loop[k - 1].x, loop[k].y - loop[k - 1].y);
            if (length < TRACE.minLoopLength) return null;
            const polygon = simplify(loop);
            if (polygonArea(polygon) < TRACE.minLoopArea) return null;
            points.length = 0;
            age = 0;
            return polygon;
          }
        }
        return null;
      }
      points.push({ x: clampedX, y: clampedY });
      age = 0;
      return null;
    },
    /** A plasma field lives for `seconds`, frying anything that enters it. */
    addField(polygon, seconds) {
      fields.push({ polygon, ttl: seconds, maxTtl: seconds });
    },
    botsInside(polygon, bots) {
      const inside = [];
      for (let i = 0; i < bots.length; i += 1) {
        const b = bots[i];
        if (b.active && pointInPolygon(b.x, b.y, polygon)) inside.push(b);
      }
      return inside;
    },
    pointInField(x, y) {
      for (let i = 0; i < fields.length; i += 1) {
        if (pointInPolygon(x, y, fields[i].polygon)) return fields[i];
      }
      return null;
    },
    update(dt) {
      age += dt;
      if (age > TRACE.fadeSeconds && points.length > 0) {
        points.length = 0;
        age = 0;
      }
      for (let i = fields.length - 1; i >= 0; i -= 1) {
        fields[i].ttl -= dt;
        if (fields[i].ttl <= 0) fields.splice(i, 1);
      }
    },
  };
}
