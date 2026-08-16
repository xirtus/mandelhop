// =============================================================================
// MANDELHOP — config.js
// Grid constants, themes, infinite-track biome & difficulty model.
// ONE ENDLESS DESCENT: rows are generated forever; biomes blend every
// BIOME_LEN rows; difficulty and complications scale with depth.
// =============================================================================
import { RNG } from './rng.js';
import * as THREE from 'three';
// (RNG import kept for module compat)

export const TILE = 1;
export const COLS = 13;
export const HALF = (COLS - 1) / 2;               // 6
export const colToX = c => (c - HALF) * TILE;
export const rowToZ = r => -r * TILE;

export const HOP_DUR = 0.17;
export const HOP_H = 0.42;
export const WRAP_X = 14;            // default lane wrap half-extent (offscreen)
export const PORTAL_X = 7.3;         // torus-row wrap half-extent (portal edges)
export const TORUS_SPAN = PORTAL_X * 2;

export const BIOME_LEN = 30;         // rows per biome
export const CHECKPOINT_EVERY = 40;  // checkpoint at r % 40 === 20
export const CHECKPOINT_AT = 20;

// Depth-locked complications
export const UNLOCK = {
  SINKER: 60,        // sinking lily pads
  WRAP: 90,          // torus portal rows
  SHEAR: 120,        // sheared rows (x offsets)
  MIRROR: 150,       // mirror zones (left/right swap)
  SNAKE: 150,        // snakes on safe rows
  PULSE: 200,        // mandelbrot lane-speed pulsing
  CHOMPER: 250,      // chomper plants
  DRAGONFLY: 40,     // hunting dragonflies
};

// --- THE BIOMES (in journey order) ------------------------------------------
export const THEMES = [
  { name: 'NEON GARDEN',
    skyTop: 0x12082b, skyMid: 0x4a1e6e, skyBot: 0xff7ecb, skySeed: 11,
    fog: 0x2a1140, fogDensity: 0.026,
    grass: 0x14532d, road: 0x191030, bank: 0x0e3d24,
    waterDeep: 0x062a4a, waterShallow: 0x1fb6a6, waterGlint: 0xaef2ff,
    vegHue: 0.32, vegHue2: 0.9, vegDensity: 1.0, flowerHue: 0.88,
    vehicle: 'car', accent: 0xffe066, frog: 0x46ff7e,
    sun: 0xfff1dc, hemiSky: 0x8a6cff, hemiGround: 0x1a3d24,
    mix: { road: 0.45, river: 0.2 } },
  { name: 'DUSK HIGHWAY',
    skyTop: 0x0b0620, skyMid: 0x34125e, skyBot: 0xff9a3d, skySeed: 23,
    fog: 0x1c0f38, fogDensity: 0.028,
    grass: 0x1a4028, road: 0x141024, bank: 0x12301e,
    waterDeep: 0x0a1e3c, waterShallow: 0x2a6fd4, waterGlint: 0xbfe0ff,
    vegHue: 0.26, vegHue2: 0.06, vegDensity: 0.8, flowerHue: 0.05,
    vehicle: 'car', accent: 0xff5d5d, frog: 0x6dff5e,
    sun: 0xffc890, hemiSky: 0x7a5cff, hemiGround: 0x241a30,
    mix: { road: 0.68, river: 0.06 } },
  { name: 'SAPPHIRE RIVER',
    skyTop: 0x03182b, skyMid: 0x0b3a5c, skyBot: 0x39d0ff, skySeed: 37,
    fog: 0x07253c, fogDensity: 0.03,
    grass: 0x0d4a3a, road: 0x0c1c33, bank: 0x093a2e,
    waterDeep: 0x03223d, waterShallow: 0x25c7d9, waterGlint: 0xd6fbff,
    vegHue: 0.45, vegHue2: 0.55, vegDensity: 1.1, flowerHue: 0.55,
    vehicle: 'beetle', accent: 0x66f2ff, frog: 0x54ffb8,
    sun: 0xd6fbff, hemiSky: 0x5cc8ff, hemiGround: 0x0a2e2a,
    mix: { road: 0.15, river: 0.6 } },
  { name: 'JADE WETLAND',
    skyTop: 0x0a2018, skyMid: 0x1d5c3a, skyBot: 0xffd76e, skySeed: 51,
    fog: 0x0f2f22, fogDensity: 0.032,
    grass: 0x1d5c34, road: 0x14301f, bank: 0x144527,
    waterDeep: 0x0a3326, waterShallow: 0x53d9a3, waterGlint: 0xeaffd0,
    vegHue: 0.38, vegHue2: 0.13, vegDensity: 1.3, flowerHue: 0.12,
    vehicle: 'beetle', accent: 0xffd76e, frog: 0x9dff4e,
    sun: 0xffe9b0, hemiSky: 0xa8e6a0, hemiGround: 0x14301c,
    mix: { road: 0.3, river: 0.45 } },
  { name: 'PSYCHEDELIC RAINFOREST',
    skyTop: 0x06170e, skyMid: 0x14532d, skyBot: 0xff4fa3, skySeed: 67,
    fog: 0x0a2416, fogDensity: 0.034,
    grass: 0x0f3d24, road: 0x101a12, bank: 0x0b2e1b,
    waterDeep: 0x052e22, waterShallow: 0x2ee6a8, waterGlint: 0xd0ffe9,
    vegHue: 0.3, vegHue2: 0.92, vegDensity: 1.5, flowerHue: 0.9,
    vehicle: 'caterpillar', accent: 0xff4fa3, frog: 0x4eff9e,
    sun: 0xffd0e9, hemiSky: 0x7affc8, hemiGround: 0x0f2416,
    mix: { road: 0.45, river: 0.3 } },
  { name: 'ALIEN JUNGLE',
    skyTop: 0x150530, skyMid: 0x3d0f6e, skyBot: 0x2ef2ff, skySeed: 83,
    fog: 0x1c0a3d, fogDensity: 0.034,
    grass: 0x2a1450, road: 0x180c33, bank: 0x1e0f3d,
    waterDeep: 0x120a3a, waterShallow: 0x7a5cff, waterGlint: 0xe0d6ff,
    vegHue: 0.75, vegHue2: 0.5, vegDensity: 1.5, flowerHue: 0.52,
    vehicle: 'caterpillar', accent: 0x2ef2ff, frog: 0x5effe0,
    sun: 0xd6c8ff, hemiSky: 0xb08aff, hemiGround: 0x1c1033,
    mix: { road: 0.4, river: 0.35 } },
  { name: 'FRACTAL OCEAN',
    skyTop: 0x020a1e, skyMid: 0x0a2350, skyBot: 0x59f2e6, skySeed: 97,
    fog: 0x041530, fogDensity: 0.03,
    grass: 0x0a2a4a, road: 0x081830, bank: 0x082038,
    waterDeep: 0x021430, waterShallow: 0x1f9fd4, waterGlint: 0xcafcff,
    vegHue: 0.55, vegHue2: 0.14, vegDensity: 1.0, flowerHue: 0.14,
    vehicle: 'orb', accent: 0x59f2e6, frog: 0x66ffd0,
    sun: 0xcafcff, hemiSky: 0x59c8f2, hemiGround: 0x0a1c30,
    mix: { road: 0.12, river: 0.62 } },
  { name: 'MANDELBROT TEMPLE',
    skyTop: 0x0a0214, skyMid: 0x2b0a4a, skyBot: 0xffb347, skySeed: 113,
    fog: 0x14062b, fogDensity: 0.028,
    grass: 0x2b1a10, road: 0x1a0f24, bank: 0x20140c,
    waterDeep: 0x1a0a2e, waterShallow: 0xc9a227, waterGlint: 0xfff0c0,
    vegHue: 0.85, vegHue2: 0.1, vegDensity: 0.9, flowerHue: 0.09,
    vehicle: 'orb', accent: 0xffb347, frog: 0xd4ff4e,
    sun: 0xffe0a0, hemiSky: 0xd49aff, hemiGround: 0x241408,
    mix: { road: 0.5, river: 0.25 } },
  { name: 'RECURSIVE COSMOS',
    skyTop: 0x050214, skyMid: 0x1c0f45, skyBot: 0xb44dff, skySeed: 131,
    fog: 0x0a0620, fogDensity: 0.024,
    grass: 0x141033, road: 0x0e0a24, bank: 0x0f0c28,
    waterDeep: 0x0a0a2e, waterShallow: 0x6e4dff, waterGlint: 0xe6d9ff,
    vegHue: 0.65, vegHue2: 0.95, vegDensity: 1.2, flowerHue: 0.95,
    vehicle: 'manta', accent: 0xb44dff, frog: 0x8affde,
    sun: 0xe6d9ff, hemiSky: 0xc49aff, hemiGround: 0x100c24,
    mix: { road: 0.42, river: 0.35 } },
];

// --- THE POND OUTSIDE TIME (hub): luminous serene pond in recursive space ---
export const HUB_THEME = {
  name: 'THE POND OUTSIDE TIME',
  skyTop: 0x0c0624, skyMid: 0x3d1a6e, skyBot: 0xff7ecb, skySeed: 149,
  fog: 0x1c0f38, fogDensity: 0.02,
  grass: 0x14523d, road: 0x191030, bank: 0x0e3d24,
  waterDeep: 0x0a3a5c, waterShallow: 0x35d9c8, waterGlint: 0xcafcff,
  vegHue: 0.38, vegHue2: 0.85, vegDensity: 1.1, flowerHue: 0.85,
  vehicle: 'orb', accent: 0x7dffb0, frog: 0x46ff7e,
  sun: 0xfff1dc, hemiSky: 0x9a7cff, hemiGround: 0x12351f,
  mix: { road: 0, river: 0 },
};

// --- difficulty scalars -------------------------------------------------------
export const speedAt = (r) => Math.min(1 + r * 0.005, 2.6);
export const gapAt = (r) => Math.max(0.55, 1 - r * 0.0012);

// Mandelbrot orbit-trap pulse: organic 0..1 oscillation, deterministic in t.
// Used for lane-speed modulation deep in the descent.
export function mandelPulse(t, cx, cy) {
  const cX = cx + Math.sin(t * 0.05) * 0.01;
  const cY = cy + Math.cos(t * 0.04) * 0.01;
  let zx = 0, zy = 0, trap = 1e9;
  for (let i = 0; i < 14; i++) {
    const x2 = zx * zx - zy * zy + cX;
    zy = 2 * zx * zy + cY; zx = x2;
    const d = zx * zx + zy * zy;
    if (d < trap) trap = d;
    if (d > 16) break;
  }
  return Math.exp(-trap * 2.5);
}

// --- theme blending ------------------------------------------------------------
// Scratch theme with preallocated Colors (no per-frame allocation).
const COLOR_KEYS = ['skyTop', 'skyMid', 'skyBot', 'fog', 'grass', 'road', 'bank',
  'waterDeep', 'waterShallow', 'waterGlint', 'accent', 'frog', 'sun', 'hemiSky', 'hemiGround'];
const HUE_KEYS = ['vegHue', 'vegHue2', 'flowerHue'];
const NUM_KEYS = ['fogDensity', 'vegDensity'];

export function makeScratchTheme() {
  const o = { name: '', vehicle: 'car', mix: { road: 0.4, river: 0.3 } };
  for (const k of COLOR_KEYS) o[k] = new THREE.Color(0);
  for (const k of HUE_KEYS) o[k] = 0;
  for (const k of NUM_KEYS) o[k] = 0;
  return o;
}

const lerpHue = (a, b, t) => {
  let d = b - a;
  if (d > 0.5) d -= 1; if (d < -0.5) d += 1;
  return ((a + d * t) % 1 + 1) % 1;
};

const _ca = new THREE.Color(), _cb = new THREE.Color();
export function lerpThemeInto(out, a, b, t) {
  for (const k of COLOR_KEYS) out[k].lerpColors(_ca.setHex(a[k]), _cb.setHex(b[k]), t);
  for (const k of HUE_KEYS) out[k] = lerpHue(a[k], b[k], t);
  for (const k of NUM_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  out.vehicle = t < 0.5 ? a.vehicle : b.vehicle;
  out.mix.road = a.mix.road + (b.mix.road - a.mix.road) * t;
  out.mix.river = a.mix.river + (b.mix.river - a.mix.river) * t;
  return out;
}

export function biomeAt(r) {
  const f = r / BIOME_LEN;
  const i = Math.floor(f) % THEMES.length;
  return { a: THEMES[i], b: THEMES[(i + 1) % THEMES.length], t: f - Math.floor(f), index: Math.floor(f) };
}
