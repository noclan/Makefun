// Depth hub: one place that owns the extra systems' shared state,
// steps them every tick, draws their buildings and markers, and
// saves/loads them. The core loop only calls initDepth, stepDepth,
// drawDepth and drawDepthHud — everything else lives in its own file.

import { CASINO_SPOT, ensureCasino, stepCasino } from './casino.js';
import { CLUB_SPOT, ensureClub, stepClub } from './nightclub.js';
import { FIGHT_SPOT, ensureFight, stepFight, fightPunch } from './fightclub.js';
import { ARCADE_SPOT, ensureArcade, stepArcade, reflexPunch } from './arcade.js';
import { ensureHeist, stepHeist, heistTarget } from './heist.js';
import { BUSINESS_DEFS, ensureBusiness, stepBusiness, defendBusiness } from './business.js';
import { ensureJobs, stepJobs, jobTarget } from './jobs.js';
import { RACE_DEFS, ensureRaces, stepRaces, raceTarget } from './races.js';
import { SHOP_SPOTS, ensureShops } from './shops.js';
import { GARAGE_SPOT, ensureCustoms, stepCustoms } from './customs.js';
import { respectLevel, nextRespectLevel } from './progression.js';
import { ensurePackages, stepPackages, drawPackages, r9HudLines } from './packages.js';
import { ensurePhotos, stepPhotos, drawPhotos } from './photos.js';
import { ensureMurals, stepMurals, drawMurals } from './streetart.js';
import { ensureFish, stepFish, drawFish } from './fishing.js';
import { ensureBoats, stepBoats, drawBoats } from './boats.js';
import { ensureFerry, stepFerry, drawFerry } from './ferry.js';
import { ensureIsland, stepIsland, drawIsland, islandTarget } from './island.js';
import { ensureMilitary, stepMilitary, drawMilitary } from './military.js';
import { ensurePort, stepPort, drawPort, portTarget } from './portside.js';
import { ensureStations, stepStations } from './stations.js';
import { ensureCarVariety, stepCarVariety } from './carvariety.js';
import { ensureLeague, stepLeague, drawLeague, leagueTarget } from './league.js';
import { ensureBounty, stepBounty, drawBounty, bountyTarget } from './bounty.js';
import { ensureSmuggle, stepSmuggle, drawSmuggle, smuggleTarget } from './smuggle.js';
import { ensureStreetlife, stepStreetlife, drawStreetlife, streetlifeTarget } from './streetlife.js';

export const VENUES = [
  { key: 'casino', x: CASINO_SPOT.x, y: CASINO_SPOT.y, w: CASINO_SPOT.w, h: CASINO_SPOT.h, label: CASINO_SPOT.label, color: '#b8860b' },
  { key: 'club', x: CLUB_SPOT.x, y: CLUB_SPOT.y, w: CLUB_SPOT.w, h: CLUB_SPOT.h, label: CLUB_SPOT.label, color: '#e83e8c' },
  { key: 'fight', x: FIGHT_SPOT.x, y: FIGHT_SPOT.y, w: FIGHT_SPOT.w, h: FIGHT_SPOT.h, label: FIGHT_SPOT.label, color: '#5a3a2a' },
  { key: 'arcade', x: ARCADE_SPOT.x, y: ARCADE_SPOT.y, w: ARCADE_SPOT.w, h: ARCADE_SPOT.h, label: ARCADE_SPOT.label, color: '#3e7be8' },
  { key: 'guns', x: SHOP_SPOTS.guns.x, y: SHOP_SPOTS.guns.y, w: SHOP_SPOTS.guns.w, h: SHOP_SPOTS.guns.h, label: SHOP_SPOTS.guns.label, color: '#2b3a55' },
  { key: 'clothes', x: SHOP_SPOTS.clothes.x, y: SHOP_SPOTS.clothes.y, w: SHOP_SPOTS.clothes.w, h: SHOP_SPOTS.clothes.h, label: SHOP_SPOTS.clothes.label, color: '#ff7a5c' },
  { key: 'garage', x: GARAGE_SPOT.x, y: GARAGE_SPOT.y, w: GARAGE_SPOT.w, h: GARAGE_SPOT.h, label: GARAGE_SPOT.label, color: '#4a7a6a' },
];

export function initDepth(state) {
  state.depth = {};
  ensureCasino(state);
  ensureClub(state);
  ensureFight(state);
  ensureArcade(state);
  ensureHeist(state);
  ensureBusiness(state);
  ensureJobs(state);
  ensureRaces(state);
  ensureShops(state);
  ensureCustoms(state);
  ensurePackages(state);
  ensurePhotos(state);
  ensureMurals(state);
  ensureFish(state);
  ensureBoats(state);
  ensureFerry(state);
  ensureIsland(state);
  ensureMilitary(state);
  ensurePort(state);
  ensureStations(state);
  ensureCarVariety(state);
  ensureLeague(state);
  ensureBounty(state);
  ensureSmuggle(state);
  ensureStreetlife(state);
  return state.depth;
}

export function stepDepth(state, input, dt) {
  if (!state.depth) initDepth(state);
  // One shared rising edge on the action key (E): the core loop already
  // consumed wasPressed('action') for entering cars, so the depth
  // systems watch the held key instead. The first system to use the
  // edge clears it for the rest of the tick.
  const edge = !!input.action && !state.depth._prevAction;
  state.depth._prevAction = !!input.action;
  state.depth.actionEdge = edge;
  stepCasino(state, dt);
  stepClub(state, dt);
  stepFight(state, dt);
  stepArcade(state, dt);
  stepHeist(state, dt);
  stepBusiness(state, dt);
  stepJobs(state, dt);
  stepRaces(state, dt);
  stepCustoms(state, dt);
  stepPackages(state, dt);
  stepPhotos(state, dt);
  stepMurals(state, dt);
  stepFish(state, dt);
  stepBoats(state, input, dt);
  stepFerry(state, dt);
  stepIsland(state, dt);
  stepMilitary(state, dt);
  stepPort(state, dt);
  stepStations(state, dt);
  stepCarVariety(state, dt);
  stepLeague(state, dt);
  stepBounty(state, dt);
  stepSmuggle(state, dt);
  stepStreetlife(state, dt);
  // A punch this tick belongs to whichever hands-on activity is live.
  const punched = state.events.some((e) => e.kind === 'punch');
  if (punched && input.punch) {
    if (!fightPunch(state)) {
      const a = ensureArcade(state);
      if (a.reflex) reflexPunch(state);
      else defendBusiness(state);
    }
  }
}

// Draw venue buildings and live activity markers in world coordinates.
// Called from the world renderer, inside its camera transform, before
// the lighting tint so venues catch the same golden-hour light.
export function drawDepth(ctx, state) {
  if (!state.depth) return;
  const cam = state.camera;
  const vx0 = cam.x - 640 - 80, vy0 = cam.y - 360 - 80, vx1 = cam.x + 640 + 80, vy1 = cam.y + 360 + 80;
  for (const v of VENUES) {
    if (v.x > vx1 || v.x + v.w < vx0 || v.y > vy1 || v.y + v.h < vy0) continue;
    ctx.fillStyle = 'rgba(60,30,10,0.28)';
    ctx.fillRect(v.x + 14, v.y + 10, v.w, v.h);
    ctx.fillStyle = v.color;
    ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(v.label, v.x + 10, v.y + 28);
    // Neon glow on the night spots after dark.
    if ((v.key === 'club' || v.key === 'casino') && state.phase && state.phase.lamps) {
      const pulse = 0.5 + 0.5 * Math.sin(state.elapsed * 3 + v.x);
      ctx.fillStyle = `rgba(255,80,200,${0.25 + pulse * 0.3})`;
      ctx.fillRect(v.x, v.y + v.h - 12, v.w, 12);
    }
  }
  // Owned businesses get a gold roof stripe.
  const b = ensureBusiness(state);
  for (const def of BUSINESS_DEFS) {
    const owned = b.owned[def.id];
    if (!owned) continue;
    ctx.fillStyle = owned.smashed ? '#c0392b' : '#ffd23e';
    ctx.fillRect(def.x - 40, def.y - 40, 90, 14);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(owned.smashed ? 'SMASHED' : def.name.toUpperCase(), def.x - 40, def.y - 44);
    if (b.attack === def.id) {
      const blink = Math.sin(state.elapsed * 8) > 0;
      if (blink) {
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath();
        ctx.arc(def.x, def.y - 60, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('!', def.x - 4, def.y - 54);
      }
    }
  }
  // Gold markers for whatever side activity is live.
  const marks = [];
  const jt = jobTarget(state);
  if (jt) marks.push({ x: jt.x, y: jt.y, label: 'JOB' });
  const rt = raceTarget(state);
  if (rt) marks.push({ x: rt.x, y: rt.y, label: 'RACE' });
  const ht = heistTarget(state);
  if (ht) marks.push({ x: ht.x, y: ht.y, label: 'HEIST' });
  const it = islandTarget(state);
  if (it) marks.push({ x: it.x, y: it.y, label: 'ISLAND' });
  const pt = portTarget(state);
  if (pt) marks.push({ x: pt.x, y: pt.y, label: 'PORT' });
  const lt = leagueTarget(state);
  if (lt) marks.push({ x: lt.x, y: lt.y, label: 'LEAGUE' });
  const bt = bountyTarget(state);
  if (bt) marks.push({ x: bt.x, y: bt.y, label: 'BOUNTY' });
  const st = smuggleTarget(state);
  if (st) marks.push({ x: st.x, y: st.y, label: 'SMUGGLE' });
  const et = streetlifeTarget(state);
  if (et) marks.push({ x: et.x, y: et.y, label: 'EVENT' });
  for (const mk of marks) {
    const bob = Math.sin(state.elapsed * 4) * 5;
    ctx.fillStyle = '#ffc94d';
    ctx.beginPath();
    ctx.moveTo(mk.x, mk.y - 34 + bob);
    ctx.lineTo(mk.x - 11, mk.y - 58 + bob);
    ctx.lineTo(mk.x + 11, mk.y - 58 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(mk.label, mk.x - 16, mk.y - 62 + bob);
  }
  // Round 9 world layers: collectibles, water life, districts, hunts.
  drawPackages(ctx, state);
  drawPhotos(ctx, state);
  drawMurals(ctx, state);
  drawFish(ctx, state);
  drawBoats(ctx, state);
  drawFerry(ctx, state);
  drawIsland(ctx, state);
  drawMilitary(ctx, state);
  drawPort(ctx, state);
  drawLeague(ctx, state);
  drawBounty(ctx, state);
  drawSmuggle(ctx, state);
  drawStreetlife(ctx, state);
}

// Respect strip under the cash box, plus one line naming the live activity.
export function drawDepthHud(ctx, state, W, H) {
  if (!state.depth) return;
  const level = respectLevel(state);
  const next = nextRespectLevel(state);
  const r = state.respect || 0;
  const span = next ? next.at - level.at : 10;
  const frac = next ? Math.max(0, Math.min(1, (r - level.at) / span)) : 1;
  ctx.fillStyle = 'rgba(12,14,22,0.62)';
  ctx.beginPath();
  ctx.roundRect(12, 82, 250, 34, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(24, 96, 150, 10);
  ctx.fillStyle = '#c77dff';
  ctx.fillRect(24, 96, 150 * frac, 10);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`RESPECT ${r} — ${level.name}`, 182, 105);
  const live = liveActivityLine(state);
  if (live) {
    ctx.fillStyle = 'rgba(12,14,22,0.62)';
    ctx.beginPath();
    ctx.roundRect(12, H - 112, 330, 30, 10);
    ctx.fill();
    ctx.fillStyle = '#ffc94d';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(live, 24, H - 92);
  }
  // Round 9 status lines: collectibles + radio, under the respect bar
  // (top-left, clear of the dialogue card at the bottom).
  const extra = r9HudLines(state);
  for (let i = 0; i < extra.length; i++) {
    const y = 122 + i * 34;
    const w = i === 0 ? 660 : 220;
    ctx.fillStyle = 'rgba(12,14,22,0.62)';
    ctx.beginPath();
    ctx.roundRect(12, y, w, 30, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(extra[i], 24, y + 20);
  }
  void W;
}

function liveActivityLine(state) {
  const j = ensureJobs(state);
  if (j.taxi) return j.taxi.stage === 'pickup' ? 'TAXI: pick up the fare' : 'TAXI: drop off the passenger';
  if (j.courier) return `COURIER: ${j.courier.stage === 'pickup' ? 'grab the package' : 'deliver it'} — ${Math.ceil(j.courier.timer)}s`;
  const r = ensureRaces(state);
  if (r.active) return `RACE: ${r.active.def.name} — checkpoint ${r.active.stage + 1}/${r.active.def.checkpoints.length}`;
  const h = ensureHeist(state);
  if (h.stage === 2) return `HEIST: hold the vault spot — ${Math.floor(h.hold)}/15s`;
  if (h.stage === 3) return `HEIST GETAWAY: reach the bridge — ${Math.ceil(h.timer)}s`;
  const f = ensureFight(state);
  if (f.active) return `FIGHT: round ${f.round} — foe ${Math.max(0, f.foeHp)}/${f.foeMax} HP`;
  const b = ensureBusiness(state);
  if (b.attack) return 'RIVALS ATTACKING A BUSINESS — get there and punch them off!';
  return null;
}

// Plain-data snapshot for the save file. The active race stores its id,
// not the def object, so loading can re-link it.
export function saveDepth(state) {
  if (!state.depth) return null;
  const d = state.depth;
  const races = d.races ? { ...d.races, active: d.races.active ? { raceId: d.races.active.def.id, stage: d.races.active.stage, t: d.races.active.t, rival: d.races.active.rival } : null } : null;
  return { ...d, races };
}

export function loadDepth(state, data) {
  if (!data) return;
  initDepth(state);
  const d = state.depth;
  for (const key of Object.keys(data)) {
    if (key === 'races' && data.races) {
      d.races = { ...data.races, active: null };
    } else {
      d[key] = data[key];
    }
  }
  // Re-link an active race to its def by id.
  if (data.races && data.races.active) {
    const saved = data.races.active;
    const def = RACE_DEFS.find((x) => x.id === saved.raceId) || null;
    if (def) d.races.active = { def, stage: saved.stage, t: saved.t, rival: saved.rival };
  }
}
