// A tiny seeded random source (mulberry32) plus the small helpers the rest of
// the game leans on. One seed, one city: the same seed always builds the same
// Solmar Bay, which is what makes the staged screenshots repeatable.

export function makeRng(seed) {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let mix = Math.imul(state ^ (state >>> 15), 1 | state);
    mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, low, high) {
  return low + rng() * (high - low);
}

export function int(rng, low, high) {
  return low + Math.floor(rng() * (high - low + 1));
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function chance(rng, probability) {
  return rng() < probability;
}

export function shuffle(rng, list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const held = list[i];
    list[i] = list[j];
    list[j] = held;
  }
  return list;
}
