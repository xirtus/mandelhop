// =============================================================================
// MANDELHOP — stages.js  ★ THE TIMEWARP CAMPAIGN
// Data-driven temporal worlds. Each stage is a seeded descent segment with an
// end portal, collectible par counts, ability metadata and relic times.
// Progression persists to localStorage. The endless descent survives as the
// arcade mode "THE INFINITE BETWEEN", entered from the hub.
// =============================================================================

// Power ids (unlock order == guardian order)
export const POWERS = {
  SPIN:      { name: 'CYCLONE SPIN',      key: 'J',  icon: '🌀', desc: 'spin attack · break pods · reflect spores' },
  DOUBLE:    { name: 'DOUBLE JUMP',       key: 'mid-air dir', icon: '⏫', desc: 'kick off a temporal ripple in mid-air' },
  SLAM:      { name: 'SUPER BELLY SLAM',  key: 'K',  icon: '💥', desc: 'shockwave · armored pods · cracked ground' },
  SEED:      { name: 'TEMPORAL SEED SHOT',key: 'I',  icon: '🌰', desc: 'spit chronoseeds at distant targets' },
  SLIDE:     { name: 'SLIDE / SLIDE JUMP',key: 'L',  icon: '🛝', desc: 'skim low & fast · slide-jump flies far' },
  GRAPPLE:   { name: 'TONGUE GRAPPLE',    key: 'U',  icon: '👅', desc: 'swing from marked bloom-rings' },
  SUPERSPIN: { name: 'TEMPORAL SUPER SPIN', key: 'hold J', icon: '🌪', desc: 'vortex hover · heavy pods' },
  DASH:      { name: 'TIME DASH',         key: 'H',  icon: '⚡', desc: 'blink through space & hazards' },
};

// Time powers (always-on toolkit, meter-limited, taught in-world)
export const TIME_POWERS = {
  SLOW:   { name: 'TIME SLOW',   key: 'hold T', icon: '🐌' },
  FREEZE: { name: 'TIME FREEZE', key: 'F',      icon: '❄' },
  PHASE:  { name: 'PHASE SHIFT', key: 'G',      icon: '⇄' },
};

const W = (id, name, biome, guardian, power, hue, blurb) => ({ id, name, biome, guardian, power, hue, blurb });

export const WORLDS = [
  W(1, 'FIRST POND',        0, 'THE HERON OF FIRST RAIN', 'SPIN',      0.32, 'pure frogger fundamentals in the primordial garden'),
  W(2, 'CARBONIFEROUS',     4, 'QUEEN OF THE GIANT REEDS','DOUBLE',    0.08, 'giant plants · enormous insects · primitive amphibians'),
  W(3, 'ANCIENT GARDEN',    1, 'THE DROWNED ARCHITECT',   'SLAM',      0.12, 'ruined temples and water engineering'),
  W(4, 'CLOCKWORK MARSH',   7, 'THE CLOCKWORK TOAD KING', 'SEED',      0.09, 'mechanical frogs · gears · industrial wetlands'),
  W(5, 'ELECTRIC EDEN',     3, 'THE SERPENT OF STATIC',   'SLIDE',     0.55, 'psychedelic color, music, impossible botanical forms'),
  W(6, 'NEON BIOSPHERE',    5, 'THE SYNTHETIC HERD',      'GRAPPLE',   0.75, 'synthetic organisms · futuristic water systems'),
  W(7, 'THE LAST OCEAN',    6, 'THE LAST KOI',            'SUPERSPIN', 0.58, 'ruined future earth swallowed by water'),
  W(8, 'MANDELBROT',        2, 'THE RECURSIVE FLOWER',    'DASH',      0.85, 'geometry and causality begin breaking down'),
  W(9, 'OUTSIDE TIME',      8, 'THE ANCIENT AMPHIBIAN',   null,        0.95, 'past and future coexist simultaneously'),
];

// complication flags → mapped onto generator
const C = (o = {}) => Object.assign({
  dragonfly: 0, sinker: 0, wrap: 0, shear: 0, mirror: 0, pulse: 0,
  snakes: 0, chompers: 0, beetles: 0, spitters: 0, collapse: 0,
  speed: 1.0, density: 1.0, riverBias: 0, roadBias: 0,
}, o);

// S(id, world, name, opts)
const S = (world, n, name, o = {}) => Object.assign({
  id: `w${world}s${n}`, world, name,
  length: 60, seed: world * 1000 + n * 97,
  gimmick: 'none',            // none | chase | phase | swim
  pods: {}, pollen: 120, shards: 5, glyphs: 1,
  requiredAbilities: [], optionalAbilities: [], secretAbilities: [],
  relics: null,               // computed
  c: C(),
  intro: '',
}, o);

export const STAGES = {};
const ADD = (s) => { STAGES[s.id] = s; };

// ---------------- WORLD I — FIRST POND (teach the language) ------------------
ADD(S(1, 1, 'FIRST LIGHT MARSH', {
  length: 46, pollen: 110, pods: { normal: 10 }, intro: 'hop · the garden listens',
  c: C({ speed: 0.75 }), shards: 5,
}));
ADD(S(1, 2, 'LILY LOGIC', {
  length: 54, pollen: 130, pods: { normal: 14, bounce: 2 }, intro: 'rivers remember your weight',
  c: C({ speed: 0.8, sinker: 0.25, riverBias: 0.12 }),
}));
ADD(S(1, 3, 'DRAGONFLY DAWN', {
  length: 60, pollen: 150, pods: { normal: 14, time: 3 }, intro: 'something is hunting you',
  c: C({ speed: 0.95, dragonfly: 1, sinker: 0.3, riverBias: 0.1 }),
}));
ADD(S(1, 4, 'THE HERON OF FIRST RAIN', {
  length: 0, guardian: 1, intro: 'the first guardian stirs',
}));

// ---------------- WORLD II — CARBONIFEROUS -----------------------------------
ADD(S(2, 1, 'GIANT REED FLATS', {
  length: 62, pollen: 160, pods: { normal: 16, bounce: 4, spore: 2 },
  requiredAbilities: ['SPIN'],
  c: C({ speed: 0.95, sinker: 0.35, chompers: 0.25, riverBias: 0.15 }),
  intro: 'spin the spore pods before they burst',
}));
ADD(S(2, 2, 'PREHISTORIC RAPIDS', {
  length: 68, pollen: 170, pods: { normal: 16, time: 4, spore: 3 },
  requiredAbilities: ['SPIN'],
  c: C({ speed: 1.05, sinker: 0.4, dragonfly: 1, riverBias: 0.35, pulse: 0.3 }),
  gimmick: 'chase', intro: 'THE FRACTAL SERPENT WAKES — do not stop',
}));
ADD(S(2, 3, 'AMPHIBIAN ANCESTORS', {
  length: 70, pollen: 180, pods: { normal: 18, bounce: 3, armored: 2 },
  requiredAbilities: ['SPIN'],
  c: C({ speed: 1.05, snakes: 0.3, chompers: 0.3, beetles: 0.4, riverBias: 0.1 }),
  intro: 'armored pods resist the spin — for now',
}));
ADD(S(2, 4, 'QUEEN OF THE GIANT REEDS', { length: 0, guardian: 2 }));

// ---------------- WORLD III — ANCIENT GARDEN ---------------------------------
ADD(S(3, 1, 'FLOODED STEPS', {
  length: 72, pollen: 190, pods: { normal: 18, armored: 4, time: 4 },
  requiredAbilities: ['SPIN', 'DOUBLE'],
  c: C({ speed: 1.05, sinker: 0.4, collapse: 0.3, riverBias: 0.25, wrap: 0.2 }),
  intro: 'double jump — kick the air itself',
}));
ADD(S(3, 2, 'THE WATERWORKS', {
  length: 76, pollen: 200, pods: { normal: 18, armored: 4, spore: 4, phase: 3 },
  requiredAbilities: ['SPIN', 'DOUBLE'], gimmick: 'phase',
  c: C({ speed: 1.1, sinker: 0.4, riverBias: 0.3, phase: 1 }),
  intro: 'G — shift between NOW and THEN',
}));
ADD(S(3, 3, 'TWO TIMELINES', {
  length: 80, pollen: 210, pods: { normal: 20, phase: 6, quantum: 3 },
  requiredAbilities: ['SPIN', 'DOUBLE'], gimmick: 'phase',
  c: C({ speed: 1.1, phase: 1, mirror: 0.15, riverBias: 0.2, collapse: 0.3 }),
  secretAbilities: ['SLAM'],
  intro: 'some pods only exist in one timeline',
}));
ADD(S(3, 4, 'THE DROWNED ARCHITECT', { length: 0, guardian: 3 }));

// ---------------- WORLD IV — CLOCKWORK MARSH ---------------------------------
ADD(S(4, 1, 'GEARFLOW', {
  length: 78, pollen: 210, pods: { normal: 20, armored: 5, countdown: 4 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM'],
  c: C({ speed: 1.15, pulse: 0.5, shear: 0.4, roadBias: 0.15, spitters: 0.3 }),
  intro: 'belly slam — the marsh rings like a bell',
}));
ADD(S(4, 2, 'THE HARVESTER', {
  length: 84, pollen: 220, pods: { normal: 20, countdown: 6, spore: 4 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM'], gimmick: 'chase',
  c: C({ speed: 1.2, pulse: 0.5, roadBias: 0.2, dragonfly: 1, shear: 0.3 }),
  intro: 'the harvester does not negotiate',
}));
ADD(S(4, 3, 'CHRONOFOUNDRY', {
  length: 86, pollen: 230, pods: { normal: 22, armored: 6, seedTarget: 3, time: 4 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM'],
  c: C({ speed: 1.2, pulse: 0.6, shear: 0.5, mirror: 0.2, wrap: 0.25 }),
  secretAbilities: ['SEED'],
  intro: 'a switch glows beyond reach — remember it',
}));
ADD(S(4, 4, 'THE CLOCKWORK TOAD KING', { length: 0, guardian: 4 }));

// ---------------- WORLD V — ELECTRIC EDEN ------------------------------------
ADD(S(5, 1, 'PSYCHEDELIC CANOPY', {
  length: 84, pollen: 240, pods: { normal: 22, musical: 6, bounce: 5 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED'],
  c: C({ speed: 1.2, chompers: 0.35, sinker: 0.4, riverBias: 0.2, snakes: 0.3 }),
  intro: 'chronoseeds — spit time itself (I)',
}));
ADD(S(5, 2, 'THE HUM', {
  length: 88, pollen: 250, pods: { normal: 24, musical: 8, spore: 4 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED'],
  c: C({ speed: 1.25, pulse: 0.5, mirror: 0.25, beetles: 0.5, spitters: 0.4 }),
  intro: 'the garden hums in your rhythm',
}));
ADD(S(5, 3, 'IMPOSSIBLE BLOOM', {
  length: 92, pollen: 260, pods: { normal: 24, quantum: 4, phase: 4, musical: 4 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED'], gimmick: 'phase',
  c: C({ speed: 1.25, phase: 1, sinker: 0.45, collapse: 0.35, riverBias: 0.25 }),
  secretAbilities: ['SLIDE'],
  intro: 'low vines ahead — something slick would pass under',
}));
ADD(S(5, 4, 'THE SERPENT OF STATIC', { length: 0, guardian: 5 }));

// ---------------- WORLD VI — NEON BIOSPHERE ----------------------------------
ADD(S(6, 1, 'SYNTHETIC SHALLOWS', {
  length: 90, pollen: 260, pods: { normal: 26, armored: 6, countdown: 5 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED', 'SLIDE'],
  c: C({ speed: 1.3, slideGates: 1, roadBias: 0.2, pulse: 0.5, shear: 0.4 }),
  intro: 'slide (L) · slide-jump flies farther than running',
}));
ADD(S(6, 2, 'CHROME CURRENTS', {
  length: 94, pollen: 280, pods: { normal: 26, time: 6, quantum: 4 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED', 'SLIDE'], gimmick: 'swim',
  c: C({ speed: 1.3, riverBias: 0.45, sinker: 0.4, pulse: 0.4 }),
  intro: 'the water is a machine — ride it',
}));
ADD(S(6, 3, 'BLOOM-RING SKYWAY', {
  length: 96, pollen: 280, pods: { normal: 26, grapple: 6, bounce: 5 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED', 'SLIDE'],
  c: C({ speed: 1.3, grapples: 1, collapse: 0.4, wrap: 0.3, riverBias: 0.2 }),
  secretAbilities: ['GRAPPLE'],
  intro: 'rings of flowers hang over the void — for later',
}));
ADD(S(6, 4, 'THE SYNTHETIC HERD', { length: 0, guardian: 6 }));

// ---------------- WORLD VII — THE LAST OCEAN ---------------------------------
ADD(S(7, 1, 'DROWNED CITY', {
  length: 96, pollen: 300, pods: { normal: 28, grapple: 6, armored: 6 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED', 'SLIDE', 'GRAPPLE'],
  c: C({ speed: 1.35, grapples: 1, riverBias: 0.4, sinker: 0.5, collapse: 0.4 }),
  intro: 'the tongue remembers every branch (U)',
}));
ADD(S(7, 2, 'UNDERTOW', {
  length: 100, pollen: 320, pods: { normal: 28, time: 6, spore: 6 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED', 'SLIDE', 'GRAPPLE'], gimmick: 'chase',
  c: C({ speed: 1.4, riverBias: 0.35, pulse: 0.5, dragonfly: 1, collapse: 0.4 }),
  intro: 'the black-hole flower pulls the sea behind you',
}));
ADD(S(7, 3, 'THE DROWNING LIBRARY', {
  length: 104, pollen: 320, pods: { normal: 30, quantum: 6, phase: 5, heavy: 3 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED', 'SLIDE', 'GRAPPLE'], gimmick: 'phase',
  c: C({ speed: 1.4, phase: 1, mirror: 0.3, shear: 0.5, riverBias: 0.3 }),
  secretAbilities: ['SUPERSPIN'],
  intro: 'heavy pods ignore your spin — for now',
}));
ADD(S(7, 4, 'THE LAST KOI', { length: 0, guardian: 7 }));

// ---------------- WORLD VIII — MANDELBROT ------------------------------------
ADD(S(8, 1, 'THE SET ITSELF', {
  length: 104, pollen: 340, pods: { normal: 30, heavy: 5, quantum: 5 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED', 'SLIDE', 'GRAPPLE', 'SUPERSPIN'],
  c: C({ speed: 1.45, pulse: 0.7, shear: 0.6, mirror: 0.35, wrap: 0.4, collapse: 0.45 }),
  intro: 'hold the spin — become the vortex',
}));
ADD(S(8, 2, 'CAUSALITY DRAIN', {
  length: 108, pollen: 350, pods: { normal: 32, countdown: 6, phase: 6, heavy: 4 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED', 'SLIDE', 'GRAPPLE', 'SUPERSPIN'], gimmick: 'phase',
  c: C({ speed: 1.5, phase: 1, pulse: 0.7, mirror: 0.4, riverBias: 0.3 }),
  intro: 'cause and effect are negotiable here',
}));
ADD(S(8, 3, 'ESCAPE VELOCITY', {
  length: 112, pollen: 360, pods: { normal: 32, dash: 6, time: 6 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED', 'SLIDE', 'GRAPPLE', 'SUPERSPIN'], gimmick: 'chase',
  c: C({ speed: 1.55, roadBias: 0.25, pulse: 0.7, shear: 0.6, dragonfly: 1 }),
  secretAbilities: ['DASH'],
  intro: 'fractured light marks a path only a blink could cross',
}));
ADD(S(8, 4, 'THE RECURSIVE FLOWER', { length: 0, guardian: 8 }));

// ---------------- WORLD IX — OUTSIDE TIME ------------------------------------
ADD(S(9, 1, 'EVERYWHEN', {
  length: 116, pollen: 400, pods: { normal: 34, phase: 8, quantum: 6, dash: 4 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED', 'SLIDE', 'GRAPPLE', 'SUPERSPIN', 'DASH'], gimmick: 'phase',
  c: C({ speed: 1.6, phase: 1, pulse: 0.8, mirror: 0.4, shear: 0.6, wrap: 0.4, collapse: 0.5, riverBias: 0.3 }),
  intro: 'time dash (H) — blink through the impossible',
}));
ADD(S(9, 2, 'THE GARDEN REMEMBERS', {
  length: 120, pollen: 420, pods: { normal: 36, heavy: 6, musical: 8, spore: 6 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED', 'SLIDE', 'GRAPPLE', 'SUPERSPIN', 'DASH'],
  c: C({ speed: 1.65, pulse: 0.8, mirror: 0.45, shear: 0.7, snakes: 0.4, chompers: 0.4, beetles: 0.5, spitters: 0.5 }),
  intro: 'every era at once — the whole moveset sings',
}));
ADD(S(9, 3, 'THE LAST HOP', {
  length: 128, pollen: 460, pods: { normal: 40, quantum: 8, dash: 6, countdown: 8 },
  requiredAbilities: ['SPIN', 'DOUBLE', 'SLAM', 'SEED', 'SLIDE', 'GRAPPLE', 'SUPERSPIN', 'DASH'], gimmick: 'chase',
  c: C({ speed: 1.75, roadBias: 0.2, riverBias: 0.25, pulse: 0.9, shear: 0.7, dragonfly: 1, collapse: 0.5 }),
  intro: 'the universe watches one frog hop',
}));
ADD(S(9, 4, 'THE ANCIENT AMPHIBIAN', { length: 0, guardian: 9 }));

// relic times derive from length & speed: gold ≈ perfect flow run
for (const s of Object.values(STAGES)) {
  if (s.guardian) { s.relics = { bronze: 300, silver: 240, gold: 180, prismatic: 140 }; continue; }
  const eff = s.length / (s.c.speed || 1);
  s.relics = {
    bronze: Math.round(eff * 2.6),
    silver: Math.round(eff * 2.0),
    gold: Math.round(eff * 1.55),
    prismatic: Math.round(eff * 1.25),
  };
}

export function worldStages(w) {
  return Object.values(STAGES).filter(s => s.world === w).sort((a, b) => a.id.localeCompare(b.id));
}

// ------------------------------------------------------------- save / progress
const SAVE_KEY = 'mandelhop_timewarp_v1';

export class Progress {
  constructor() {
    this.data = { stages: {}, powers: [], shards: 0, blooms: {}, glyphs: {}, hub: 0, endlessBest: 0 };
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.data = Object.assign(this.data, JSON.parse(raw));
    } catch (e) { }
  }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { } }

  stage(id) {
    if (!this.data.stages[id]) this.data.stages[id] = {
      done: false, pollen: 0, pods: 0, shards: [], blooms: [], relic: null,
      bestTime: null, ghost: null, secrets: 0,
    };
    return this.data.stages[id];
  }
  hasPower(p) { return this.data.powers.includes(p); }
  grantPower(p) { if (!this.hasPower(p)) { this.data.powers.push(p); this.save(); } }
  get powers() { return this.data.powers; }

  worldUnlocked(w) {
    if (w === 1) return true;
    // previous world's guardian defeated
    return !!this.stage(`w${w - 1}s4`).done;
  }
  stageUnlocked(s) {
    if (!this.worldUnlocked(s.world)) return false;
    if (s.id.endsWith('s1')) return true;
    const prev = worldStages(s.world);
    const idx = prev.findIndex(x => x.id === s.id);
    return idx > 0 && !!this.stage(prev[idx - 1].id).done;
  }
  recordCompletion(id, res) {
    const st = this.stage(id);
    st.done = true;
    st.pollen = Math.max(st.pollen, res.pollen);
    st.pods = Math.max(st.pods, res.pods);
    for (const sh of res.shards) if (!st.shards.includes(sh)) st.shards.push(sh);
    for (const b of res.blooms) if (!st.blooms.includes(b)) st.blooms.push(b);
    st.secrets = Math.max(st.secrets || 0, res.secrets || 0);
    if (res.time != null && (st.bestTime == null || res.time < st.bestTime)) st.bestTime = res.time;
    if (res.relic && relicRank(res.relic) > relicRank(st.relic)) st.relic = res.relic;
    if (res.ghost) st.ghost = res.ghost;
    this.data.shards = Object.values(this.data.stages).reduce((n, s) => n + (s.shards ? s.shards.length : 0), 0);
    this.save();
  }
}

export const RELICS = ['bronze', 'silver', 'gold', 'prismatic'];
export const relicRank = (r) => r ? RELICS.indexOf(r) + 1 : 0;
export const RELIC_LABEL = { bronze: 'BRONZE EPOCH', silver: 'SILVER EPOCH', gold: 'GOLDEN EPOCH', prismatic: 'PRISMATIC EPOCH' };
export const relicFor = (stage, t) => {
  if (t <= stage.relics.prismatic) return 'prismatic';
  if (t <= stage.relics.gold) return 'gold';
  if (t <= stage.relics.silver) return 'silver';
  if (t <= stage.relics.bronze) return 'bronze';
  return null;
};
