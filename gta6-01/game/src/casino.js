// Casino Solmar: slots and a quick card game, played for cash.
// Walk up to the casino doors and the games open. Chips are just cash:
// a bet leaves the wallet, a win pays straight back into it.
// Slots pay on matching symbols; the card game is a draw-to-21 duel
// against the house. Cash out any time by walking away.

export const CASINO_SPOT = { x: 1700, y: 1360, w: 170, h: 120, label: 'CASINO SOLMAR' };

const SLOTS = ['🍒', '🍋', '⭐', '💎', '7️⃣', '🔔'];

export function ensureCasino(state) {
  const d = state.depth;
  if (!d.casino) d.casino = { plays: 0, slotsWon: 0, cardsWon: 0, biggestWin: 0, inside: false, lastSpin: null, lastHand: null };
  return d.casino;
}

export function nearCasino(state) {
  const p = state.player;
  const dx = p.x - (CASINO_SPOT.x + CASINO_SPOT.w / 2);
  const dy = p.y - (CASINO_SPOT.y + CASINO_SPOT.h / 2);
  return dx * dx + dy * dy < 130 * 130;
}

export function stepCasino(state, dt) {
  const c = ensureCasino(state);
  c.inside = nearCasino(state);
  void dt;
}

function drawCard(rng) {
  return 1 + Math.floor(rng() * 10);
}

// Spin the slots. Bet must be a positive amount the player can afford.
// Returns the spin result: symbols, payout, and a short line for the HUD.
export function playSlots(state, bet) {
  const c = ensureCasino(state);
  const p = state.player;
  if (bet <= 0 || p.cash < bet) return { ok: false, reason: 'not enough cash for that bet' };
  p.cash -= bet;
  c.plays += 1;
  const rng = state.rng;
  const reels = [SLOTS[Math.floor(rng() * SLOTS.length)], SLOTS[Math.floor(rng() * SLOTS.length)], SLOTS[Math.floor(rng() * SLOTS.length)]];
  let mult = 0;
  if (reels[0] === reels[1] && reels[1] === reels[2]) mult = reels[0] === '7️⃣' ? 25 : reels[0] === '💎' ? 12 : 8;
  else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) mult = 2;
  const payout = bet * mult;
  if (payout > 0) {
    p.cash += payout;
    c.slotsWon += 1;
    if (payout > c.biggestWin) c.biggestWin = payout;
    state.events.push({ kind: 'casino-win', amount: payout });
  }
  c.lastSpin = { reels, payout };
  return { ok: true, reels, payout, win: payout > 0, line: payout > 0 ? `Slots paid $${payout}!` : 'No luck this spin.' };
}

// One hand of 21 against the house. Both sides draw until they stand;
// the house stands on 16. Closest to 21 without going over wins the pot.
export function playCards(state, bet) {
  const c = ensureCasino(state);
  const p = state.player;
  if (bet <= 0 || p.cash < bet) return { ok: false, reason: 'not enough cash for that bet' };
  p.cash -= bet;
  c.plays += 1;
  const rng = state.rng;
  let mine = drawCard(rng) + drawCard(rng);
  while (mine < 15) mine += drawCard(rng);
  let house = drawCard(rng) + drawCard(rng);
  while (house < 16) house += drawCard(rng);
  const bust = (v) => v > 21;
  let payout = 0;
  let line = '';
  if (bust(mine) && bust(house)) { payout = bet; line = 'Both busted — bet returned.'; }
  else if (bust(mine)) { line = `Busted on ${mine}. House takes it.`; }
  else if (bust(house) || mine > house) { payout = bet * 2; line = `You held ${mine} against ${house}. You win $${payout}!`; }
  else if (mine === house) { payout = bet; line = `Push on ${mine} — bet returned.`; }
  else { line = `House held ${house} against your ${mine}.`; }
  if (payout > 0) {
    p.cash += payout;
    if (payout > bet) { c.cardsWon += 1; if (payout > c.biggestWin) c.biggestWin = payout; }
    state.events.push({ kind: 'casino-win', amount: payout });
  }
  c.lastHand = { mine, house, payout };
  return { ok: true, mine, house, payout, win: payout > bet, line };
}

export function casinoSummary(state) {
  const c = ensureCasino(state);
  return `Casino: ${c.plays} games, ${c.slotsWon + c.cardsWon} wins, biggest win $${c.biggestWin}`;
}
