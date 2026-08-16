// =============================================================================
// MANDELHOP — rng.js
// Seeded deterministic PRNG. Adapted from gaia (MIT, (c) 2026 owenyuwono).
// All world generation randomness flows from here — no Math.random in gen code.
// =============================================================================
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function rng() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed) { this.f = mulberry32(seed); }
  next() { return this.f(); }
  range(a, b) { return a + (b - a) * this.f(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  sign() { return this.f() < 0.5 ? -1 : 1; }
  chance(p) { return this.f() < p; }
}
