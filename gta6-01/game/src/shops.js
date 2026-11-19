// Shops: spend cash on gear that stays with the player.
// Ammo & Co sells bullets, armor plates, and medkits. The boutique
// next door sells outfits — pure style, but style is respect in
// Solmar. Everything bought lands in the player's inventory, which
// the save file keeps between sessions.

export const SHOP_SPOTS = {
  guns: { x: 1360, y: 680, w: 150, h: 110, label: 'AMMO & CO' },
  clothes: { x: 2040, y: 1700, w: 150, h: 110, label: 'BOUTIQUE SOL' },
};

export const SHOP_ITEMS = [
  { id: 'ammo24', shop: 'guns', name: 'Pistol ammo x24', price: 60, desc: '+24 bullets' },
  { id: 'ammo60', shop: 'guns', name: 'Pistol ammo x60', price: 130, desc: '+60 bullets' },
  { id: 'armor50', shop: 'guns', name: 'Armor plates', price: 150, desc: '+50 armor' },
  { id: 'medkit', shop: 'guns', name: 'Medkit', price: 90, desc: 'heal 50 HP now' },
  { id: 'jacket', shop: 'clothes', name: 'Gold bomber jacket', price: 300, desc: '+4 respect, new look' },
  { id: 'shades', shop: 'clothes', name: 'Sunset shades', price: 120, desc: '+2 respect, new look' },
  { id: 'sneakers', shop: 'clothes', name: 'Neon sneakers', price: 180, desc: '+2 respect, new look' },
  { id: 'suit', shop: 'clothes', name: 'White linen suit', price: 600, desc: '+6 respect, new look' },
];

export function ensureShops(state) {
  const d = state.depth;
  if (!d.shops) d.shops = { inventory: { ammo: 0, armor: 0, medkits: 0, outfits: [] }, spent: 0, bought: 0 };
  return d.shops;
}

export function nearShop(state) {
  const p = state.player;
  for (const key of Object.keys(SHOP_SPOTS)) {
    const s = SHOP_SPOTS[key];
    const dx = p.x - (s.x + s.w / 2);
    const dy = p.y - (s.y + s.h / 2);
    if (dx * dx + dy * dy < 120 * 120) return key;
  }
  return null;
}

export function buyItem(state, id) {
  const s = ensureShops(state);
  const item = SHOP_ITEMS.find((x) => x.id === id);
  if (!item) return { ok: false, reason: 'no such item' };
  const p = state.player;
  if (p.cash < item.price) return { ok: false, reason: `${item.name} costs $${item.price}` };
  p.cash -= item.price;
  s.spent += item.price;
  s.bought += 1;
  switch (item.id) {
    case 'ammo24': p.ammo += 24; s.inventory.ammo += 24; break;
    case 'ammo60': p.ammo += 60; s.inventory.ammo += 60; break;
    case 'armor50': p.armor = Math.min(100, p.armor + 50); s.inventory.armor += 50; break;
    case 'medkit': p.health = Math.min(100, p.health + 50); s.inventory.medkits += 1; break;
    case 'jacket': s.inventory.outfits.push('Gold bomber jacket'); p.outfit = 'jacket'; state.respect = (state.respect || 0) + 4; break;
    case 'shades': s.inventory.outfits.push('Sunset shades'); p.outfit = 'shades'; state.respect = (state.respect || 0) + 2; break;
    case 'sneakers': s.inventory.outfits.push('Neon sneakers'); p.outfit = 'sneakers'; state.respect = (state.respect || 0) + 2; break;
    case 'suit': s.inventory.outfits.push('White linen suit'); p.outfit = 'suit'; state.respect = (state.respect || 0) + 6; break;
    default: break;
  }
  state.events.push({ kind: 'shop-buy', id });
  return { ok: true, line: `Bought ${item.name} — ${item.desc}.` };
}

export function shopsSummary(state) {
  const s = ensureShops(state);
  return `Shops: ${s.bought} items bought, $${s.spent} spent, outfits: ${s.inventory.outfits.join(', ') || 'none'}`;
}
