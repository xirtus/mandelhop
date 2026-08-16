// =============================================================================
// MANDELHOP — game.js  ★ TIMEWARP EDITION
// Modes: HUB (Pond Outside Time) · STAGE (temporal worlds) · ENDLESS (the
// Infinite Between) · BONUS (Mandelbrot pockets).
// The original invariant holds: visuals never affect gameplay. Lanes are
// constant velocity; combat is grid math; water is render-only.
// Time powers scale the WORLD clock only — the frog stays responsive.
// =============================================================================
import * as THREE from 'three';
import {
  COLS, HALF, colToX, rowToZ, HOP_DUR, HOP_H, WRAP_X, PORTAL_X, TORUS_SPAN,
  THEMES, BIOME_LEN, CHECKPOINT_EVERY, CHECKPOINT_AT, UNLOCK, HUB_THEME,
  speedAt, gapAt, mandelPulse, biomeAt, makeScratchTheme, lerpThemeInto,
} from './config.js';
import { RNG } from './rng.js';
import {
  buildVehicle, animateVehicle, buildPlatform, posePlatform,
  buildDragonfly, animateDragonfly, buildSnake, animateSnake,
  buildChomper, animateChomper, buildOrb, buildCheckpoint, buildWormhole,
  buildPortal, buildBonusPortal, buildBeetleEnemy, buildSpitter, buildSpore,
  buildGrapplePoint, buildCollapsePad, buildMushroom, buildDeathGate, buildGrowthSeed,
  buildChaseSerpent, animateChaseSerpent,
} from './entities.js';
import { BlobShadows } from './effects.js';
import { STAGES, WORLDS, POWERS, Progress, worldStages, RELIC_LABEL } from './stages.js';

const mod = (v, m) => ((v % m) + m) % m;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const torusDist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, TORUS_SPAN - d); };

const ENERGY_MAX = 42;
const LIVES = 3;

const MILESTONES = {
  [UNLOCK.DRAGONFLY]: ['SOMETHING IS HUNTING YOU', 'dragonflies patrol the air'],
  [UNLOCK.SINKER]: ['SOME LILIES SINK', 'red-veined pads cannot hold you long'],
  [UNLOCK.WRAP]: ['THE EDGE IS A CIRCLE', 'hop off one side — arrive at the other'],
  [UNLOCK.SHEAR]: ['SPACE SHEARS', 'the ground slides sideways between rows'],
  [UNLOCK.MIRROR]: ['MIRROR ZONES', 'left is right in the violet light'],
  [UNLOCK.PULSE]: ['THE MANDELBROT PULSE', 'the lanes breathe with the set'],
  [UNLOCK.CHOMPER]: ['THE GARDEN HUNGERS', 'do not linger on the jaws'],
};

export const GLYPH_LORE = [
  'the pond was one pond, once.',
  'the heron remembers rain that has not fallen yet.',
  'every hop is a small big bang.',
  'the set does not repeat. neither should you.',
  'time is a garden, not a river. gardens can be pruned.',
  'the frog was here before the water.',
  'somewhere, a crate dreams of being a flower.',
  'the ninth gate opens inward.',
  'you are the echo of the first hop.',
];

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // scene, ui, audio, effects, water, veg, fractals, frog, camera, world, +timemagic, flow, powers, collect, trial, guardian, hub
    this.state = 'title';
    this.mode = 'hub';
    this.seed = 7;
    this.biomeOffset = 0;
    this.rows = new Map();
    this.vehPool = new Map();
    this.platPool = new Map();
    this.scratch = makeScratchTheme();
    this._staticCache = new Map();
    this.shadows = new BlobShadows(this.scene, 130);
    this.frogRowFloat = 0;
    this.fx = 0; this.row = 0;
    this.maxRow = 0; this.combo = 0;
    this.score = 0; this.lives = LIVES; this.energy = ENERGY_MAX;
    this.respawnRow = 0;
    this.buffered = null; this.bufferT = 0;
    this.paused = false;
    this.biomeIdx = -1;
    this.shownMilestones = new Set();
    this.df = null;
    this.best = 0; this.bestDepth = 0;
    try {
      this.best = parseInt(localStorage.getItem('mandelhop_best') || '0', 10) || 0;
      this.bestDepth = parseInt(localStorage.getItem('mandelhop_depth') || '0', 10) || 0;
    } catch (e) { }
    this.progress = new Progress();
    this.ui.setBest(this.best);

    // stage state
    this.stage = null;            // active stage def
    this.trialMode = false;
    this.stageHasPhase = false;
    this.stagePlan = new Map();   // r → override spec
    this.deaths = 0;
    this.secretsFound = 0;
    this.secretsTotal = 0;
    this.chase = null;
    this.portal = null;           // {mesh, row, x}
    this.bonusReturn = null;
    this.phase = 0;
    this.worldT = 0;              // time-scaled world clock
    this.ceremonyActive = false;
    this._spores = [];            // spitter projectiles
    this._bonusUsedRows = new Set();
    this.swim = 0;                // >0: in the water, value = air seconds left
  }

  // ------------------------------------------------------------- themes
  rowAt(r) { return this.rows.get(r) || null; }
  chunkRng(cid) { return new RNG((this.seed ^ (cid * 2654435761)) >>> 0); }

  themeStaticAt(r) {
    const rr = r + this.biomeOffset;
    if (this._staticCache.has(rr)) return this._staticCache.get(rr);
    const { a, b, t } = biomeAt(rr);
    const tmp = makeScratchTheme();
    lerpThemeInto(tmp, a, b, t);
    const out = { vehicle: tmp.vehicle, vegHue: tmp.vegHue, vegHue2: tmp.vegHue2, flowerHue: tmp.flowerHue, vegDensity: tmp.vegDensity, fogDensity: tmp.fogDensity, mix: { ...tmp.mix } };
    for (const k of ['skyTop', 'skyMid', 'skyBot', 'fog', 'grass', 'road', 'bank', 'waterDeep', 'waterShallow', 'waterGlint', 'accent', 'frog', 'sun', 'hemiSky', 'hemiGround']) out[k] = tmp[k].getHex();
    if (this._staticCache.size > 300) this._staticCache.clear();
    this._staticCache.set(rr, out);
    return out;
  }

  // complication flags for row r, from stage def or endless depth
  _flags(r) {
    if (this.stage && !this.stage.guardian) return this.stage.c;
    if (this.stage?.guardian) return { speed: 1, density: 1 };
    if (this.mode === 'hub' || this.mode === 'bonus') return { speed: 0.8, density: 1 };
    return {  // endless: depth unlocks
      dragonfly: r > UNLOCK.DRAGONFLY ? 1 : 0, sinker: r > UNLOCK.SINKER ? 0.35 : 0,
      wrap: r > UNLOCK.WRAP ? 0.24 : 0, shear: r > UNLOCK.SHEAR ? 0.55 : 0,
      mirror: r > UNLOCK.MIRROR ? 0.16 : 0, pulse: r > UNLOCK.PULSE ? 0.6 : 0,
      snakes: r > UNLOCK.SNAKE ? 0.2 : 0, chompers: r > UNLOCK.CHOMPER ? 0.3 : 0,
      beetles: 0, spitters: 0, collapse: 0,
      speed: 1, density: 1, riverBias: 0, roadBias: 0,
    };
  }

  // ------------------------------------------------------------- world gen
  _resetWorld(seed, biomeOffset = 0) {
    this.seed = seed >>> 0;
    this.biomeOffset = biomeOffset;
    for (const row of [...this.rows.values()]) this._freeRow(row);
    this.rows.clear();
    this._staticCache.clear();
    this.veg.clearAll();
    this.collect.reset();
    this.fx = 0; this.row = 0;
    this.frogRowFloat = 0;
    this.maxRow = 0; this.combo = 0;
    this.respawnRow = 0;
    this.energy = ENERGY_MAX;
    this.buffered = null;
    this.biomeIdx = -1;
    this.shownMilestones.clear();
    this.phase = 0;
    this.stageHasPhase = false;
    this.portal = null;
    if (this.chase) { this.scene.remove(this.chase.mesh); this.chase.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    this.chase = null;
    this.audio.chaseHeart?.(false);
    this.deaths = 0;
    this.secretsFound = 0; this.secretsTotal = 0;
    this._bonusUsedRows = new Set();
    this._deathGateTaken = new Set();
    this._clearSpores();
    this.guardian.cleanup();
    if (this.df) { this.df.mesh.visible = false; this.df.state = 'hidden'; this.df.timer = 18; }
  }

  prepWorld() { this._resetWorld(7); for (let r = 0; r <= 45; r++) this._genRow(r); this.veg.sync(0, this); }

  // ---- HUB ----------------------------------------------------------------
  enterHub() {
    this.mode = 'hub';
    this.state = 'hub';
    this.stage = null;
    this.trialMode = false;
    this.trial.stop();
    this._resetWorld(1337);
    for (let r = 0; r <= 14; r++) this._genRow(r);
    this.veg.sync(0, this);
    this.hub.build(this.themeStaticAt(0));
    this.hub.enter();
    this.ui.hideOverlay();
    this.ui.setBiome('THE POND OUTSIDE TIME');
    this.ui.hint('');
    this.ui.showHud('hub');
    this.world.setCorridor(false);
    this.frog.revive(new THREE.Vector3(0, 0, 0));
    this.frog.setTheme(this.themeStaticAt(0));
    this.audio.setTheme(8);
    this.audio.setHubLayers(this.progress.data.stages ? WORLDS.filter(w => this.progress.stage(`w${w.id}s4`).done).length : 0);
    this.timemagic.enabled = false;
    this.camera.setMode('hub');
  }

  // ---- STAGE ENTRY ---------------------------------------------------------
  openStage(id, trial = false) {
    const s = STAGES[id];
    if (!s) return;
    this.audio.resume();
    this.mode = 'stage';
    this.stage = s;
    this.trialMode = trial;
    this.hub.exit();
    this._resetWorld(s.seed, (s.world - 1) * BIOME_LEN + (s.biomeOffset || 0));
    if (s.guardian) this.world.setCorridor(false);
    this._planStage();
    const genMax = s.guardian ? 12 : s.length + 4;
    for (let r = 0; r <= genMax; r++) this._genRow(r);
    this.veg.sync(0, this);
    this.score = 0; this.lives = LIVES;
    this.ui.setScore(0); this.ui.setLives(LIVES);
    this.ui.hideOverlay();
    this.ui.showHud('stage', { trial, stage: s, progress: this.progress });
    this.ui.setBiome(s.name.toUpperCase());
    this.ui.hint('');
    this.ui.bumpPollen(this.collect.got.pollen, this.collect.tot.pollen);
    this.ui.bumpPods(this.collect.got.pods, this.collect.tot.pods);
    this.ui.bumpShards(this.collect.got.shards, this.collect.tot.shards);
    this.state = 'play';
    this.paused = false;
    this.world.setCorridor(true);
    this.frog.revive(new THREE.Vector3(0, 0, 0));
    this.frog.setTheme(this.themeStaticAt(0));
    this.timemagic.enabled = true;
    this.camera.setMode(s.gimmick === 'chase' ? 'chase' : 'classic');
    this.flow.reset();
    if (trial) {
      const ghostSamples = this.progress.stage(s.id).ghost;
      this.trial.start(s.id, ghostSamples);
    } else {
      this.trial.beginRecord();
    }
    const world = WORLDS[s.world - 1];
    this.ui.banner(s.name, s.intro || world.blurb, 2600);
    this.audio.biomeSwell();
  }

  startEndless() {
    this.audio.resume();
    this.mode = 'endless';
    this.stage = null;
    this.trialMode = false;
    this.hub.exit();
    this.score = 0; this.lives = LIVES;
    this._resetWorld((Math.random() * 0xffffffff) >>> 0);
    for (let r = 0; r <= 45; r++) this._genRow(r);
    this.veg.sync(0, this);
    this.ui.setScore(0); this.ui.setLives(LIVES);
    this.ui.setDist(0);
    this.ui.hideOverlay();
    this.ui.showHud('endless');
    this.state = 'play';
    this.paused = false;
    this.world.setCorridor(true);
    this.timemagic.enabled = true;
    this.camera.setMode('classic');
    this.frog.revive(new THREE.Vector3(0, 0, 0));
    this.frog.setTheme(this.themeStaticAt(0));
    this.ui.banner('THE INFINITE BETWEEN', 'one endless descent · reach the mandalas', 2200);
  }

  // ---- STAGE PLANNING (deterministic collectible/feature layout) -----------
  _planStage() {
    const s = this.stage;
    this.stagePlan.clear();
    if (!s || s.guardian) { this._planGuardian(); return; }
    const rng = new RNG(s.seed ^ 0xC0FFEE);
    const L = s.length;
    const put = (r, spec) => {
      if (r < 2 || r > L) return;
      this.stagePlan.set(r, Object.assign(this.stagePlan.get(r) || {}, spec));
    };
    // checkpoints every ~16 rows on safe rows
    for (let r = 16; r < L - 4; r += 16) put(r, { forceSafe: true, checkpoint: true });
    put(L - 1, { forceSafe: true });
    put(L, { forceSafe: true, portal: true });
    put(0, { forceSafe: true }); put(1, { forceSafe: true });
    // pods: distribute variants along safe-ish rows
    let podCount = 0;
    const podVariants = [];
    for (const [v, n] of Object.entries(s.pods)) for (let i = 0; i < n; i++) podVariants.push(v);
    let guard = 0;
    while (podVariants.length && guard++ < 500) {
      const r = rng.int(4, L - 3);
      const existing = this.stagePlan.get(r);
      if (existing?.checkpoint || existing?.portal) continue;
      const col = rng.int(1, COLS - 2);
      const v = podVariants.pop();
      const list = existing?.pods || [];
      list.push({ variant: v, col });
      put(r, { pods: list, preferSafe: true });
      podCount++;
    }
    // shards: spread quintiles, risky spots
    for (let i = 0; i < (s.shards || 5); i++) {
      const r = Math.floor(L * (0.15 + 0.17 * i)) + rng.int(0, 4);
      const col = rng.pick([0, 1, COLS - 2, COLS - 1, rng.int(2, COLS - 3)]);
      put(r, { shard: { idx: i, col }, preferSafe: true });
    }
    // glyph in a hidden alcove
    const glyphRow = rng.int(Math.floor(L * 0.4), Math.floor(L * 0.8));
    put(glyphRow, { glyph: { idx: 0, col: rng.pick([0, COLS - 1]) }, forceSafe: true });
    // pollen drifts: arcs over random rows
    for (let i = 0; i < Math.floor(s.pollen / 5); i++) {
      const r = rng.int(2, L - 2);
      const col = rng.int(0, COLS - 1);
      const list = this.stagePlan.get(r)?.pollen || [];
      for (let k = 0; k < 5; k++) list.push({ col: clamp(col + k - 2, 0, COLS - 1), arc: k === 2 });
      put(r, { pollen: list });
    }
    // bonus portal mid-stage (side column)
    const br = rng.int(Math.floor(L * 0.35), Math.floor(L * 0.6));
    put(br, { forceSafe: true, bonus: { col: rng.pick([1, COLS - 2]) } });
    this.secretsTotal++;
    // death route gate near 2/3
    const dr = rng.int(Math.floor(L * 0.6), Math.floor(L * 0.75));
    put(dr, { forceSafe: true, deathGate: { col: rng.pick([1, COLS - 2]) } });
    this.secretsTotal++;
    // phase rows for phase stages
    if (s.gimmick === 'phase') {
      this.stageHasPhase = true;
      for (let r = 6; r < L - 4; r += rng.int(4, 7)) put(r, { phaseable: true, forceRiver: true });
    }
    // grapple rings over voids
    if (s.c.grapples) {
      for (let r = 8; r < L - 6; r += 9) put(r, { grapple: true, forceRiver: true, voidRiver: true });
    }
    // slide gates
    if (s.c.slideGates) {
      for (let r = 10; r < L - 4; r += 8) put(r, { vineBar: true, preferSafe: true });
    }
    // hourglasses in trial mode
    if (this.trialMode) {
      for (let r = 8; r < L - 2; r += 7) {
        put(r, { hourglass: { kind: rng.chance(0.7) ? 'minus' : 'freeze', col: rng.int(1, COLS - 2) } });
      }
    }
    // chase serpent
    if (s.gimmick === 'chase') this._chasePending = true;
  }

  _planGuardian() {
    // guardian arena: 10 safe rows, guardian spawns at row 4
    for (let r = 0; r <= 10; r++) this.stagePlan.set(r, { forceSafe: true });
    this.stagePlan.set(10, { forceSafe: true, portal: true, portalLocked: true });
  }

  // ------------------------------------------------------------- row generation
  _genRow(r) {
    if (this.rows.has(r)) return;
    const L = this.stage && !this.stage.guardian ? this.stage.length : Infinity;
    if (this.mode === 'stage' && !this.stage?.guardian && r > L + 3) return;
    const rng = new RNG((this.seed + r * 7919) >>> 0);
    const st = this.themeStaticAt(r);
    const flags = this._flags(r);
    const D = speedAt(this.mode === 'endless' ? r : r * 0.4) * (flags.speed || 1);
    const G = gapAt(this.mode === 'endless' ? r : r * 0.3);
    const spec = this.stagePlan.get(r) || {};

    // --- row type ---
    let type;
    if (this.mode === 'hub') type = 'safe';
    else if (this.stage?.guardian) type = 'safe';
    else if (spec.forceSafe) type = 'safe';
    else if (spec.forceRiver) type = 'river';
    else if (r === 0) type = 'safe';
    else if (this.mode === 'endless' && r > 0 && r % CHECKPOINT_EVERY === CHECKPOINT_AT) type = 'checkpoint';
    else {
      const mix = st.mix;
      const roadP = clamp(mix.road + (flags.roadBias || 0) + (spec.preferSafe ? -0.35 : 0), 0.05, 0.9);
      const riverP = clamp(mix.river + (flags.riverBias || 0), 0.03, 0.9);
      let roll = rng.next();
      type = roll < roadP ? 'road' : roll < roadP + riverP ? 'river' : 'safe';
      if (type === 'river') {
        let streak = 0;
        for (let k = r - 1; k >= 0 && this.rows.get(k)?.type === 'river'; k--) streak++;
        if (streak >= 4 || r < 7) type = 'safe';
      }
      if (this.mode === 'endless') { if (r <= 2) type = 'road'; if (r === 3) type = 'safe'; }
      else if (r <= 2) type = 'safe';
    }

    const row = {
      r, type, ents: [], vis: null,
      pool: false,   // swimmable water
      dir: rng.sign(), speed: 0, len: 0, gap: 0, kind: 'log',
      offset: 0, wrap: false, mirror: false, pulse: false,
      cA: rng.range(-0.8, -0.6), cB: rng.range(0.05, 0.2),
      minX: 0, total: 1, spacing: 1,
      snake: null, chompers: null, orbs: null, worm: null, check: null,
      sinkT: 0, phaseable: !!spec.phaseable, phaseFrozen: false,
      beetles: null, spitters: null, collapse: null, vineBar: null,
      grappleRing: null, bonusPortal: null, deathGate: null, alcove: null,
      voidRiver: !!spec.voidRiver,
    };

    // shear / mirror / pulse
    if ((flags.shear || 0) && rng.chance(flags.shear)) row.offset = rng.pick([-0.5, 0, 0.5]);
    if ((flags.mirror || 0) && type !== 'river' && type !== 'checkpoint' && rng.chance(flags.mirror)) row.mirror = true;
    if ((flags.pulse || 0) && (type === 'road' || type === 'river') && rng.chance(flags.pulse)) row.pulse = true;

    if (type === 'road' || type === 'river') {
      const isRoad = type === 'road';
      const isPool = !isRoad && this.mode === 'stage' && this.stage?.gimmick === 'swim' && rng.chance(0.55);
      row.dir = rng.sign();
      row.speed = (isRoad ? rng.range(1.3, 2.4) : rng.range(0.9, 1.9)) * D * (r <= 2 ? 0.6 : 1);
      // early-game easing: the first rows of World 1 never twitch
      if (this.mode === 'stage' && this.stage?.world === 1 && r < 14) row.speed = Math.min(row.speed, 1.75);
      const w1ease = this.mode === 'stage' && this.stage?.world === 1;
      row.len = isRoad
        ? (w1ease ? rng.pick([2, 2, 3]) : rng.pick([1, 1, 2, 2, 3]))
        : Math.max(2, rng.pick([2, 3, 3, 4]) - (this.mode === 'endless' && r > 200 ? 1 : 0));
      row.kind = isRoad ? 'vehicle' : (rng.chance(0.4) ? 'lily' : 'log');
      row.pool = isPool;
      if (isPool && rng.chance(0.5)) row.gap *= 1.8;   // open water stretches
      row.sinker = !isRoad && row.kind === 'lily' && (flags.sinker || 0) > 0 && rng.chance(flags.sinker);
      row.gap = (isRoad ? rng.range(2.6, 4.2) : rng.range(2.8, 4.4)) * G * (w1ease ? 1.15 : 1);
      if ((flags.wrap || 0) && rng.chance(flags.wrap)) row.wrap = true;
      if (spec.voidRiver) row.gap *= 2.2;   // near-uncrossable without grapple/freeze

      const margin = row.wrap ? PORTAL_X : WRAP_X;
      row.spacing = row.len + row.gap;
      const count = Math.ceil((margin * 2 + 4) / row.spacing) + 1;
      row.minX = -margin - row.len;
      row.total = count * row.spacing;
      for (let i = 0; i < count; i++) {
        const x = row.minX + i * row.spacing;
        const mesh = isRoad ? this._acquireVehicle(st, row.len, rng, r) : this._acquirePlatform(st, row, rng);
        mesh.position.set(x, isRoad ? 0 : 0.12, rowToZ(r));
        if (isRoad) mesh.rotation.y = row.dir > 0 ? 0 : Math.PI;
        this.scene.add(mesh);
        mesh.visible = true;
        row.ents.push({ x, mesh, len: row.len, nm: false });
      }
    } else {
      // safe-row / checkpoint features
      if (type === 'checkpoint' || spec.checkpoint) {
        const mesh = buildCheckpoint(st);
        mesh.position.set(0, 0, rowToZ(r));
        this.scene.add(mesh);
        row.check = { x: 0, mesh, active: false, bloomT: 0 };
      }
      if (this.mode === 'endless' && r > 5 && rng.chance(0.55)) {
        row.orbs = [];
        const n = rng.int(1, 2);
        for (let i = 0; i < n; i++) {
          const mesh = buildOrb(st);
          const x = rng.int(1, COLS - 2) - HALF;
          mesh.position.set(x, 0.4, rowToZ(r));
          this.scene.add(mesh);
          row.orbs.push({ x, mesh, taken: false });
        }
      }
      if (this.mode === 'endless' && r > UNLOCK.WRAP && rng.chance(0.18)) {
        const x1 = rng.int(-5, -2), x2 = rng.int(2, 5);
        const hue = rng.next();
        const m1 = buildWormhole(st, hue), m2 = buildWormhole(st, hue);
        m1.position.set(x1, 0, rowToZ(r)); m2.position.set(x2, 0, rowToZ(r));
        this.scene.add(m1, m2);
        const w1 = { x: x1, mesh: m1 }, w2 = { x: x2, mesh: m2 };
        w1.mate = w2; w2.mate = w1;
        row.worm = [w1, w2];
      }
      if ((flags.snakes || 0) && rng.chance(flags.snakes)) {
        const mesh = buildSnake(st, rng);
        mesh.position.set(0, 0, rowToZ(r));
        this.scene.add(mesh);
        row.snake = { mesh, sp: rng.range(0.35, 0.6) * (1 + r / 600), ph: rng.range(0, 6), alive: true };
      }
      if ((flags.chompers || 0) && !row.snake && rng.chance(flags.chompers)) {
        row.chompers = [];
        const n = rng.int(1, 3);
        for (let i = 0; i < n; i++) {
          const mesh = buildChomper(st, rng);
          const x = rng.int(-5, 5);
          mesh.position.set(x, 0, rowToZ(r));
          this.scene.add(mesh);
          row.chompers.push({ x, mesh, off: rng.range(0, 2.6) });
        }
      }
      // beetles
      if ((flags.beetles || 0) && rng.chance(flags.beetles)) {
        row.beetles = [];
        const n = rng.int(1, 2);
        for (let i = 0; i < n; i++) {
          const armored = rng.chance(0.4);
          const mesh = buildBeetleEnemy(st, rng, armored);
          const x = rng.range(-4, 4);
          mesh.position.set(x, 0, rowToZ(r));
          this.scene.add(mesh);
          row.beetles.push({ x, mesh, sp: rng.range(0.5, 0.9) * rng.sign(), ph: rng.range(0, 6), alive: true, armored });
        }
      }
      // spitters
      if ((flags.spitters || 0) && rng.chance(flags.spitters)) {
        row.spitters = [];
        const x = rng.int(-5, 5);
        const mesh = buildSpitter(st, rng);
        mesh.position.set(x, 0, rowToZ(r));
        this.scene.add(mesh);
        row.spitters.push({ x, mesh, cd: rng.range(1, 2.4), alive: true });
      }
      // growth seeds (time-accelerate → bounce mushroom)
      if (this.mode === 'stage' && (this.stage?.world || 1) >= 2 && !row.snake && !row.check && rng.chance(0.14)) {
        const mesh = buildGrowthSeed(st);
        const x = rng.int(-5, 5);
        mesh.position.set(x, 0, rowToZ(r));
        this.scene.add(mesh);
        row.seedSpot = { x, mesh, grown: 0 };   // grown: 0 seed, >0 mushroom timer
      }
      // collapse pads
      if ((flags.collapse || 0) && rng.chance(flags.collapse)) {
        row.collapse = [];
        const n = rng.int(1, 3);
        for (let i = 0; i < n; i++) {
          const mesh = buildCollapsePad(st);
          const x = rng.int(-5, 5);
          mesh.position.set(x, 0, rowToZ(r));
          this.scene.add(mesh);
          row.collapse.push({ x, mesh, state: 'idle', t: 0 });
        }
      }
      // slide vine bar
      if (spec.vineBar) {
        const barMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(st.vegHue !== undefined ? 0x2a7a3a : 0x2a7a3a), roughness: 0.7, emissive: 0x1a5a2a, emissiveIntensity: 0.8 });
        const bar = new THREE.Mesh(new THREE.BoxGeometry(13, 0.3, 0.16), barMat);
        bar.position.set(0, 0.52, rowToZ(r));
        const glow = new THREE.Mesh(new THREE.BoxGeometry(13, 0.05, 0.18), new THREE.MeshBasicMaterial({ color: 0x7dffb0 }));
        glow.position.set(0, 0.36, rowToZ(r));
        this.scene.add(bar, glow);
        row.vineBar = { bar, glow };
      }
      // death gate
      if (spec.deathGate) {
        const mesh = buildDeathGate(st);
        const x = colToX(spec.deathGate.col);
        mesh.position.set(x, 0, rowToZ(r));
        this.scene.add(mesh);
        row.deathGate = { x, mesh, open: false, taken: this._deathGateTaken?.has(r) || false };
      }
      // bonus portal
      if (spec.bonus) {
        const mesh = buildBonusPortal(st);
        const x = colToX(spec.bonus.col);
        mesh.position.set(x, 0, rowToZ(r));
        this.scene.add(mesh);
        row.bonusPortal = { x, mesh, used: this._bonusUsedRows.has(r) };
      }
    }

    // grapple ring over void rivers
    if (spec.grapple) {
      const mesh = buildGrapplePoint(st);
      const x = 0;
      mesh.position.set(x, 0, rowToZ(r));
      this.scene.add(mesh);
      row.grappleRing = { x, mesh };
      this.collect.addGrapple(mesh, HALF, r);   // col==HALF → x 0
    }

    // ---- collectibles from stage plan ----
    if (spec.pods && this.mode === 'stage') {
      for (const p of spec.pods) {
        const phase = p.variant === 'quantum' ? 1 : (p.variant === 'phase' ? 0 : -1);
        this.collect.addPod(p.variant, p.col, r, phase === -1 ? -1 : phase);
      }
    }
    if (spec.shard && this.mode === 'stage') this.collect.addShard(spec.shard.idx, spec.shard.col, r);
    if (spec.glyph && this.mode === 'stage') this.collect.addGlyph(spec.glyph.idx, spec.glyph.col, r, GLYPH_LORE[(this.stage.world * 3 + spec.glyph.idx) % GLYPH_LORE.length]);
    if (spec.hourglass) this.collect.addHourglass(spec.hourglass.kind, spec.hourglass.col, r);
    if (spec.pollen && this.mode === 'stage') {
      for (const pl of spec.pollen) {
        this.collect.addPollen(colToX(pl.col), pl.arc ? 0.55 : 0.3, rowToZ(r));
        this.collect.tot.pollen++;
      }
    }

    // ---- stage-end portal (also the bonus pocket's exit) ----
    if (spec.portal && (this.mode === 'stage' || this.mode === 'bonus')) {
      const mesh = buildPortal(st);
      mesh.position.set(0, 0, rowToZ(r));
      this.scene.add(mesh);
      row.portalMesh = mesh;
      this.portal = { mesh, row: r, x: 0, locked: !!spec.portalLocked };
    }

    if (this.mode !== 'hub') this.world.buildRowVisual(row, st, this.scene.fog);
    // bank lips
    const prev = this.rows.get(r - 1);
    if (prev) {
      if (row.type === 'river' && prev.type !== 'river') this.world.addBankLip(row, 0.5, st);
      if (row.type !== 'river' && prev.type === 'river') this.world.addBankLip(prev, -0.5, this.themeStaticAt(r - 1));
    }
    // ice overlay for phaseable rows
    if (row.phaseable) {
      const ice = new THREE.Mesh(new THREE.BoxGeometry(30, 0.1, 1.04),
        new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.85, roughness: 0.08, clearcoat: 1, emissive: 0x5599cc, emissiveIntensity: 0.9, iridescence: 0.6 }));
      ice.position.set(0, 0.02, rowToZ(r));
      ice.visible = false;
      this.scene.add(ice);
      row.iceOverlay = ice;
    }
    this.rows.set(r, row);
  }

  _freeRow(row) {
    for (const e of row.ents) {
      e.mesh.visible = false;
      this.scene.remove(e.mesh);
      const key = row.type === 'road' ? `v_${e.mesh.userData.style}_${e.len}_${e.mesh.userData.biome}` : `p_${e.mesh.userData.kind}_${e.len}_${e.mesh.userData.sinker ? 1 : 0}_${e.mesh.userData.biome}`;
      const pool = row.type === 'road' ? this.vehPool : this.platPool;
      if (!pool.has(key)) pool.set(key, []);
      pool.get(key).push(e.mesh);
    }
    this.world.releaseRow(row);
    const extras = [
      row.snake?.mesh, row.check?.mesh, row.portalMesh, row.iceOverlay,
      row.grappleRing?.mesh, row.bonusPortal?.mesh, row.deathGate?.mesh,
      row.vineBar?.bar, row.vineBar?.glow,
      ...(row.orbs || []).map(o => o.mesh),
      ...(row.chompers || []).map(c => c.mesh),
      ...(row.beetles || []).map(b => b.mesh),
      ...(row.spitters || []).map(s => s.mesh),
      ...(row.collapse || []).map(c => c.mesh),
      ...(row.worm || []).map(w => w.mesh),
    ];
    for (const f of extras) {
      if (!f) continue;
      this.scene.remove(f);
      f.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    }
    this.rows.delete(row.r);
  }

  _acquireVehicle(st, len, rng, r) {
    const b = Math.floor((r + this.biomeOffset) / 30);
    const key = `v_${st.vehicle}_${len}_${b}`;
    const pool = this.vehPool.get(key);
    if (pool && pool.length) return pool.pop();
    const mesh = buildVehicle(st.vehicle, len, st, rng);
    mesh.userData.style = st.vehicle;
    mesh.userData.biome = b;
    return mesh;
  }

  _acquirePlatform(st, row, rng) {
    const b = Math.floor((row.r + this.biomeOffset) / 30);
    const key = `p_${row.kind}_${row.len}_${row.sinker ? 1 : 0}_${b}`;
    const pool = this.platPool.get(key);
    if (pool && pool.length) return pool.pop();
    const mesh = buildPlatform(row.kind, row.len, st, rng, row.sinker);
    mesh.userData.biome = b;
    return mesh;
  }

  // ------------------------------------------------------------- phase shift
  applyPhase(p) {
    this.phase = p;
    for (const row of this.rows.values()) {
      if (!row.phaseable) continue;
      const frozen = p === 1;
      row.phaseFrozen = frozen;
      if (row.iceOverlay) row.iceOverlay.visible = frozen;
    }
    // phase/quantum pods visibility
    for (const pod of this.collect.pods) {
      if (pod.phase === -1) continue;
      pod.mesh.visible = pod.alive && (pod.phase === p);
    }
    this.effects.phaseBurst(this.frog.group.position.x, this.frog.group.position.z);
  }

  // ------------------------------------------------------------- input
  onDir(dx, dy) {
    this.audio.resume();
    if (this.paused) return;
    if (this.state === 'hub') { this._hubDir(dx, dy); return; }
    if (this.state !== 'play') return;
    // DOUBLE JUMP: mid-air direction = ripple-kick second hop
    if (this.frog.isHopping && !this.frog.dying) {
      if (this.powers.has('DOUBLE') && !this.powers.usedDouble && this.frog.hop) {
        this.powers.usedDouble = true;
        const cur = this.frog.group.position.clone();
        this.frog.hop = null;
        this.effects.rippleKick(cur.x, cur.y, cur.z);
        this.audio.doubleJump();
        this._hop(dx, dy, { fromPos: cur, arc: HOP_H * 0.9 });
        return;
      }
      this.buffered = [dx, dy]; this.bufferT = 0.28;
      return;
    }
    if (this.frog.dying) { this.buffered = [dx, dy]; this.bufferT = 0.28; return; }
    // slide jump: forward hop during slide = long jump
    if (this.powers.sliding > 0 && dy > 0) {
      this.powers.sliding = 0;
      this.frog.inner.scale.set(1, 1, 1);
      this.audio.slideJump();
      this._hop(0, 2, { long: true });
      return;
    }
    this._hop(dx, dy);
  }

  onAction(name) {
    if (name !== 'fps') this.audio.resume();
    switch (name) {
      case 'confirm':
        if (this.state === 'title') this.enterHub();
        else if (this.state === 'gameover') this.enterHub();
        else if (this.state === 'hub') this._hubConfirm();
        else if (this.state === 'play' && !this.paused) this.onDir(0, 1);
        break;
      case 'pause':
        if (this.state === 'play') {
          this.paused = !this.paused;
          if (this.paused) this.ui.showPause(); else this.ui.hideOverlay();
        }
        break;
      case 'mute':
        this.audio.setMuted(!this.audio.muted);
        this.ui.banner(this.audio.muted ? 'SOUND OFF' : 'SOUND ON', '', 900);
        break;
      case 'camera': {
        const modes = ['classic', 'immersive'];
        const cur = modes.indexOf(this.camera.mode);
        this.camera.setMode(modes[(cur + 1) % modes.length]);
        this.ui.banner(`CAMERA · ${this.camera.mode.toUpperCase()}`, '', 900);
        break;
      }
      case 'restart':
        if (this.state === 'play' || this.state === 'gameover') {
          if (this.mode === 'stage') this.openStage(this.stage.id, this.trialMode);
          else if (this.mode === 'endless') this.startEndless();
        }
        break;
      case 'exit':
        if (this.state === 'play' || this.state === 'gameover') this.enterHub();
        break;
      // ---- powers ----
      case 'spin': this.powers.spinHeld = true; this.powers.trySpin(this); break;
      case 'spinUp': this.powers.spinHeld = false; break;
      case 'slam': if (this.state === 'play' && !this.paused) this.powers.trySlam(this); break;
      case 'slide': if (this.state === 'play' && !this.paused) this.powers.trySlide(this); break;
      case 'seed': if (this.state === 'play' && !this.paused) this.powers.trySeed(this); break;
      case 'grapple': if (this.state === 'play' && !this.paused) this.powers.tryGrapple(this); break;
      case 'dash': if (this.state === 'play' && !this.paused) this.powers.tryDash(this); break;
      // ---- time ----
      case 'slow': this.timemagic.setSlow(true); break;
      case 'slowUp': this.timemagic.setSlow(false); break;
      case 'freeze': if (this.state === 'play' && !this.paused) this.timemagic.tryFreeze(this); break;
      case 'phase': if (this.state === 'play' && !this.paused) this.timemagic.tryPhase(this); break;
      case 'reverse': if (this.state === 'play' && !this.paused) this._tryReverse(); break;
      case 'accelerate': if (this.state === 'play' && !this.paused) this._tryAccelerate(); break;
    }
  }

  // ------------------------------------------------------------- hub movement
  _hubDir(dx, dy) {
    if (this.frog.isHopping) { this.buffered = [dx, dy]; this.bufferT = 0.28; return; }
    const tRow = clamp(this.row + dy, -2, 12);
    const row = this.rows.get(tRow);
    if (!row) return;
    let xT;
    if (dy === 0) {
      const col = clamp(Math.round(this.fx) + dx, -6, 6);
      xT = col;
    } else xT = clamp(this.fx, -6, 6);
    const from = this.frog.group.position.clone();
    this.fx = xT; this.row = tRow;
    this.audio.hop(0);
    this.frog.startHop(from, new THREE.Vector3(this.fx, 0, rowToZ(tRow)), HOP_DUR, () => {
      this.audio.land();
      this.veg.bloom(this.fx, rowToZ(this.row));
      // standing on a gate?
      const gate = this.hub.gateAt(this.fx, this.row);
      if (gate) this._gatePrompt(gate);
      else this.ui.hint('');
    });
  }

  _gatePrompt(gate) {
    if (gate.isInfinite) { this.ui.hint('SPACE — enter THE INFINITE BETWEEN'); return; }
    if (!gate.unlocked) { this.ui.hint(`🔒 ${WORLDS[gate.world - 1].name} — defeat the previous guardian`); return; }
    this.ui.hint(`SPACE — ${WORLDS[gate.world - 1].name}${gate.complete ? ' ✦' : ''}`);
  }

  _hubConfirm() {
    const gate = this.hub.gateAt(this.fx, this.row);
    if (!gate) return;
    if (gate.isInfinite) { this.startEndless(); return; }
    if (!gate.unlocked) { this.audio.uiClick(); return; }
    // open stage select
    this.state = 'stageSelect';
    this.audio.uiClick();
    this.ui.showStageSelect(WORLDS[gate.world - 1], worldStages(gate.world), this.progress, (stageId, trial) => {
      this.state = 'hub';
      if (stageId) this.openStage(stageId, trial);
      else this.ui.hideOverlay();
    });
  }

  // ------------------------------------------------------------- movement
  _rowX(row, col) { return colToX(col) + (row ? row.offset : 0); }
  _colOf(row, x) { return clamp(Math.round(x - (row ? row.offset : 0) + HALF), 0, COLS - 1); }

  _hop(dx, dy, opts = {}) {
    const row = this.rows.get(this.row);
    if (row && row.mirror && !opts.fromPos) dx = -dx;
    const tRow = Math.max(0, this.row + dy);
    const rowB = this.rows.get(tRow);
    if (!rowB) return;

    let xT;
    if (dy === 0) {
      const col = this._colOf(row, this.fx);
      let colT = col + dx;
      if (row && row.wrap && (colT < 0 || colT >= COLS)) {
        colT = colT < 0 ? COLS - 1 : 0;
        xT = this._rowX(row, colT);
        this.effects.sparkle(this.fx, rowToZ(this.row), 0x7dffb0);
        this.audio.wormhole();
      } else {
        colT = clamp(colT, 0, COLS - 1);
        if (colT === col && dx !== 0) { this.audio.land(); return; }
        xT = this._rowX(row, colT);
      }
    } else {
      // forward/back hops carry lateral intent — diagonal jumps are legal
      const lane = dx !== 0 ? this.fx + dx : this.fx;
      xT = clamp(lane, this._rowX(rowB, 0), this._rowX(rowB, COLS - 1));
      if (dy < 0) this.flow.reset();
    }

    const from = opts.fromPos || new THREE.Vector3(this.fx, this.frog.group.position.y, rowToZ(this.row));
    this.fx = xT; this.row = tRow;
    const to = new THREE.Vector3(this.fx, 0, rowToZ(tRow));
    if (rowB.type === 'river' && !rowB.phaseFrozen) to.y = rowB.kind === 'log' ? 0.42 : 0.14;
    if (dy > 0) this._hoppedFwd = true;
    this.audio.hop(this.combo);
    this.effects.sparkle(from.x, from.z, this.scratch.accent.getHex());
    const dur = opts.long ? HOP_DUR * 1.5 : HOP_DUR;
    const arc = opts.arc ?? (opts.long ? HOP_H * 1.5 : HOP_H);
    this.frog.startHop(from, to, dur, () => this._onLand());
    if (opts.long) this.frog.hop.arc = arc;
  }

  // multi-tile slide (powers)
  slideMove(dx, dy, tiles) {
    if (dy === 0) return;
    this._hop(0, dy * tiles, { long: false, arc: HOP_H * 0.28 });
  }

  // time dash: blink N tiles with afterimages + brief invulnerability
  dashMove(dx, dy, tiles, powers) {
    const from = this.frog.group.position.clone();
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const p = from.clone();
      p.z -= (i / steps) * tiles * 0;   // afterimages along actual path below
      powers.spawnAfterimage(p, this.frog.group.rotation.y);
    }
    this._dashInvuln = 0.22;
    this._hop(dx * (dy === 0 ? tiles : 0), dy * tiles, { arc: HOP_H * 0.5 });
    // afterimage trail along path
    const to = this.frog.hop?.to;
    if (to) for (let i = 0; i < steps; i++) {
      const p = from.clone().lerp(to, i / steps);
      powers.spawnAfterimage(p, this.frog.group.rotation.y);
    }
    this.effects.sparkle(from.x, from.z, 0x99ccff);
  }

  _onLand() {
    const z = rowToZ(this.row);
    const row = this.rows.get(this.row);
    this.audio.land();
    this.veg.bloom(this.fx, z);
    this.powers.onLanded();
    if (row && row.type === 'river' && !row.phaseFrozen) {
      this.water.addRipple(this.fx, z, 0.7);
      this.effects.ring(this.fx, z, this.scratch.waterGlint.getHex(), 0.8);
    } else {
      this.effects.pollenBurst(this.fx, z, this.scratch.accent.getHex());
    }
    // FLOW: rhythm landing
    this.flow.setFrog(this.fx, z);
    this.flow.onLand(this.worldT, this.audio.beatPhase(), !!this._hoppedFwd);
    if (row && row.type !== 'river') this._exitWater();

    if (this._hoppedFwd && this.row > this.maxRow) {
      this.maxRow = this.row;
      this.combo++;
      this.addScore(10, true);
      this.ui.setDist(this.maxRow);
      if (this.combo > 0 && this.combo % 8 === 0) {
        this.addScore(40, true);
        this.ui.popup('COMBO +40', this.frog.group.position, '#ffe066');
      }
      if (this.mode === 'endless') this._checkMilestones();
    }
    this._hoppedFwd = false;
    if (!row) return;

    // ---- landing on river ----
    if (row.type === 'river') {
      if (row.phaseFrozen) { this.frog.group.position.y = 0.05; }
      else {
        const ride = this._platformUnder(row);
        if (!ride) {
          if (row.pool) { this._enterWater(row); }
          else { this._die('water'); return; }
        } else {
          this._exitWater();
          this.frog.group.position.y = this._platformTop(row, ride);
        }
      }
    } else {
      // ground pods: landing on one bounces/breaks
      const pod = this.collect.podAt(this.fx, z);
      if (pod && pod.alive && pod.phase === -1 || (pod && pod.alive && pod.phase === this.phase)) {
        if (pod.variant === 'bounce') {
          this.collect._breakPod(pod, 'touch');
          this.audio.bounce();
          this._hop(0, 1, { arc: HOP_H * 2.1 });
          return;
        }
      }
      // bounce mushroom (grown via time-accelerate)
      if (row.seedSpot?.mushroom && Math.abs(this.fx - row.seedSpot.x) < 0.6) {
        this.audio.bounce();
        this.effects.ring(this.fx, z, 0x7dffb0, 1.4);
        this._hop(0, 2, { arc: HOP_H * 2.2 });
        return;
      }
      // collapse pads trigger
      if (row.collapse) {
        for (const c of row.collapse) {
          if (c.state === 'idle' && Math.abs(this.fx - c.x) < 0.55) {
            c.state = 'shaking'; c.t = 0;
            this.audio.creak?.();
          }
        }
      }
      // vine bar: grounded under bar without sliding = caught
      if (row.vineBar && this.powers.sliding <= 0) {
        this._die('squash'); return;
      }
      // death gate
      if (row.deathGate && !row.deathGate.taken && Math.abs(this.fx - row.deathGate.x) < 0.6) {
        if (this.deaths === 0) {
          row.deathGate.taken = true;
          this._deathGateTaken.add(row.r);
          this.secretsFound++;
          this.audio.secret();
          this.effects.goalBurst(row.deathGate.x, z, 0xff2255);
          this.ui.banner('DEATH ROUTE', 'flawless — the garden notices', 1800);
          this.collect.sprayPollen(row.deathGate.x, 0.4, z, 14);
          this.addScore(300, true);
        } else {
          this.ui.popup('SEALED', this.frog.group.position, '#ff2255');
        }
      }
      // bonus portal
      if (row.bonusPortal && !row.bonusPortal.used && Math.abs(this.fx - row.bonusPortal.x) < 0.6) {
        row.bonusPortal.used = true;
        this._bonusUsedRows.add(row.r);
        this._enterBonus(row);
        return;
      }
      // stage-end portal — the funnel: reaching the row at all completes it
      if (this.portal && this.row >= this.portal.row && !this.portal.locked) {
        this.fx += (this.portal.x - this.fx) * 0.35;   // portal draws you in
        this.frog.group.position.x = this.fx;
        this._completeStage();
        return;
      }
      // orbs (endless)
      if (row.orbs) {
        for (const o of row.orbs) {
          if (!o.taken && Math.abs(this.fx - o.x) < 0.5) {
            o.taken = true; o.mesh.visible = false;
            this.addScore(25, true);
            this.energy = Math.min(ENERGY_MAX, this.energy + 3);
            this.audio.orb();
            this.effects.sparkle(o.x, z, 0xffe066);
            this.ui.popup('+25 ✦', this.frog.group.position, '#ffe066');
          }
        }
      }
      // wormholes
      if (row.worm) {
        for (const w of row.worm) {
          if (Math.abs(this.fx - w.x) < 0.45) {
            this.effects.deathBurst(w.x, z, 0xbb66ff);
            this.fx = w.mate.x;
            this.frog.group.position.x = this.fx;
            this.effects.sparkle(w.mate.x, z, 0xbb66ff);
            this.audio.wormhole();
            this.camera.shake(0.12);
            break;
          }
        }
      }
      // checkpoint
      if (row.check && !row.check.active && Math.abs(this.fx - row.check.x) < 0.55) {
        row.check.active = true;
        row.check.bloomT = 0.001;
        this.respawnRow = this.row;
        this.energy = ENERGY_MAX;
        this.addScore(250, true);
        this.audio.goal(this.combo);
        this.effects.goalBurst(row.check.x, z, this.scratch.accent.getHex());
        this.ui.banner('CHECKPOINT BLOOMS', this.mode === 'endless' ? `depth ${this.row} · energy restored` : 'the flower remembers you', 1600);
      }
    }

    // collectibles gather
    const evs = this.collect.gather(this.fx, z, this.frog.group.position.y, 0, this.worldT);
    for (const ev of evs) this._collectEvent(ev);
  }

  _collectEvent(ev) {
    if (ev.type === 'shard') {
      this.audio.shardGet();
      this.effects.goalBurst(ev.x, ev.z, 0xff9aef);
      this.ui.bumpShards(this.collect.got.shards, this.collect.tot.shards);
      this.ui.popup('FRACTAL SHARD', new THREE.Vector3(ev.x, 0.5, ev.z), '#ff9aef');
      this.addScore(150, true);
    } else if (ev.type === 'glyph') {
      this.audio.secret();
      this.secretsFound++;
      this.ui.banner('SECRET GLYPH', ev.text, 2600);
      this.addScore(200, true);
    } else if (ev.type === 'hourglass') {
      if (ev.kind === 'minus') { this.trial.addTime(3); this.audio.hourglass(); }
      else { this.trial.freezeTimer(3); this.audio.hourglass(); }
      this.effects.sparkle(ev.x, ev.z, 0x9fd8ff);
    }
  }

  addScore(n, useFlow) {
    this.score += n * (useFlow ? this.flow.multiplier : 1);
    this.ui.setScore(this.score);
  }

  _checkMilestones() {
    for (const [k, v] of Object.entries(MILESTONES)) {
      const depth = parseInt(k, 10);
      if (this.maxRow >= depth && !this.shownMilestones.has(depth)) {
        this.shownMilestones.add(depth);
        this.ui.banner(v[0], v[1], 2600);
        this.audio.biomeSwell();
      }
    }
  }

  _platformUnder(row) {
    if (!row || row.type !== 'river') return null;
    for (const e of row.ents) {
      const d = row.wrap ? torusDist(this.fx, e.x) : Math.abs(this.fx - e.x);
      if (d < e.len / 2 + 0.28) return e;
    }
    return null;
  }

  _platformTop(row, e) { return e.mesh.position.y + (row.kind === 'log' ? 0.34 : 0.03); }

  // combat: powers → enemies
  enemyHit(x, z, r, how) {
    let hit = false;
    for (const row of this.rows.values()) {
      if (row.beetles) for (const b of row.beetles) {
        if (!b.alive) continue;
        if (Math.abs(b.mesh.position.x - x) < r && Math.abs(rowToZ(row.r) - z) < r) {
          if (b.armored && how !== 'slam' && how !== 'superspin') continue;
          b.alive = false;
          b.mesh.visible = false;
          this.effects.deathBurst(b.mesh.position.x, rowToZ(row.r), 0xff5533);
          this.audio.enemyDie();
          this.addScore(50, true);
          hit = true;
        }
      }
      if (row.spitters) for (const s of row.spitters) {
        if (!s.alive) continue;
        if (Math.abs(s.x - x) < r && Math.abs(rowToZ(row.r) - z) < r) {
          if (how === 'spin' || how === 'seed' || how === 'slam' || how === 'superspin') {
            s.alive = false;
            s.mesh.visible = false;
            this.effects.deathBurst(s.x, rowToZ(row.r), 0xff77cc);
            this.audio.enemyDie();
            this.addScore(50, true);
            hit = true;
          }
        }
      }
    }
    if (this.guardian.isActive) hit = this.guardian.tryHit(x, z, r, how) || hit;
    return hit;
  }

  slamCracks(x, z) {
    // slam also shakes loose nearby collapse pads
    for (const row of this.rows.values()) {
      if (!row.collapse) continue;
      for (const c of row.collapse) {
        if (c.state === 'idle' && Math.abs(c.x - x) < 1.4 && Math.abs(rowToZ(row.r) - z) < 1.4) {
          c.state = 'shaking'; c.t = -0.4;
        }
      }
    }
  }

  // ---- swimming ---------------------------------------------------------------
  _enterWater(row) {
    this.swim = 4.0;
    this.audio.splashIn?.() || this.audio.death && null;
    this.water.addRipple(this.fx, rowToZ(this.row), 1.2);
    this.effects.splash(this.fx, rowToZ(this.row), this.scratch.waterGlint.getHex());
    this.ui.showAir?.(true);
  }
  _exitWater() {
    if (this.swim > 0) { this.swim = 0; this.ui.showAir?.(false); }
  }

  // ---- object-level time powers ----------------------------------------------
  _tryReverse() {
    if (this.timemagic.meter < 0.3) return;
    // rebuild recently-fallen ruins & lift sinking pads in range
    let did = false;
    const fz = rowToZ(this.row);
    for (const row of this.rows.values()) {
      if (Math.abs(rowToZ(row.r) - fz) > 3.5) continue;
      if (row.collapse) for (const c of row.collapse) {
        if ((c.state === 'falling' || c.state === 'fallen') && Math.abs(c.x - this.fx) < 3.5) {
          c.state = 'rebuilding'; c.t = 0;
          c.mesh.visible = true;
          did = true;
        }
      }
      if (row.sinker && row.sinkT > 0.2) { row.sinkT = 0; did = true; }
    }
    if (did) {
      this.timemagic.meter -= 0.3;
      this.audio.phaseShift();
      this.effects.frostBurst(this.fx, fz);
    } else {
      this.ui.popup('NOTHING TO REVERSE', this.frog.group.position, '#9fd8ff');
    }
  }

  _tryAccelerate() {
    if (this.timemagic.meter < 0.25) return;
    const fz = rowToZ(this.row);
    for (const row of this.rows.values()) {
      const ss = row.seedSpot;
      if (!ss || ss.grown > 0 || ss.mushroom) continue;
      if (Math.abs(rowToZ(row.r) - fz) < 3 && Math.abs(ss.x - this.fx) < 3) {
        this.timemagic.meter -= 0.25;
        ss.grown = 8;
        ss.mesh.visible = false;
        const m = buildMushroom(this.themeStaticAt(row.r), null);
        m.position.set(ss.x, 0, rowToZ(row.r));
        m.scale.setScalar(0.01);
        this.scene.add(m);
        ss.mushroom = m;
        // grow-in
        const target = 1;
        const grow = () => {
          if (!ss.mushroom) return;
          ss.mushroom.scale.multiplyScalar(1.35);
          if (ss.mushroom.scale.x < target) requestAnimationFrame(grow);
          else ss.mushroom.scale.setScalar(target);
        };
        grow();
        this.audio.bounce();
        this.effects.flowBloom(ss.x, rowToZ(row.r));
        return;
      }
    }
    this.ui.popup('NO SEED IN REACH', this.frog.group.position, '#7dffb0');
  }

  // ---- bonus pocket ---------------------------------------------------------
  _enterBonus(srcRow) {
    this.audio.wormhole();
    this.effects.phaseBurst(this.fx, rowToZ(this.row));
    this.bonusReturn = { stageRows: this.rows, row: this.row, fx: this.fx, seed: this.seed, plan: this.stagePlan, biomeOffset: this.biomeOffset, uiBiome: null };
    // build tiny pocket dimension
    this.mode = 'bonus';
    const bseed = (this.seed ^ 0xB0B5) >>> 0;
    for (const row of [...this.rows.values()]) this._freeRow(row);
    this.rows.clear();
    this.seed = bseed;
    this.stagePlan = new Map();
    for (let r = 0; r <= 12; r++) this.stagePlan.set(r, { forceSafe: true });
    this.stagePlan.set(12, { forceSafe: true, portal: true });
    this.stagePlan.set(0, { forceSafe: true });
    const rng = new RNG(bseed);
    this.biomeOffset = 8 * BIOME_LEN;   // RECURSIVE COSMOS — outside time
    this._staticCache.clear();
    for (let r = 0; r <= 12; r++) this._genRow(r);
    // pocket full of pods & pollen
    const st = this.themeStaticAt(0);
    for (let r = 2; r <= 10; r += 2) {
      for (let c = 2; c < COLS - 2; c += 2) {
        this.collect.addPod(rng.pick(['normal', 'normal', 'time', 'musical']), c, r, -1);
      }
      for (let c = 1; c < COLS - 1; c += 2) { this.collect.addPollen(colToX(c), 0.4, rowToZ(r)); this.collect.tot.pollen++; }
    }
    this.row = 0; this.fx = 0;
    this.frog.revive(new THREE.Vector3(0, 0, 0));
    this.ui.banner('BONUS DIMENSION', 'break everything · no penalty for failure', 2200);
    this.secretsFound++;
    this.audio.secret();
  }

  _exitBonus(completed) {
    const ret = this.bonusReturn;
    if (!ret) return;
    for (const row of [...this.rows.values()]) this._freeRow(row);
    this.rows.clear();
    this.mode = 'stage';
    this.seed = ret.seed;
    this.stagePlan = ret.plan;
    this.biomeOffset = ret.biomeOffset;
    this._staticCache.clear();
    this._staticCache.clear();
    const genMax = this.stage.guardian ? 12 : this.stage.length + 4;
    for (let r = 0; r <= genMax; r++) this._genRow(r);
    // restore frog at the bonus portal row
    this.row = ret.row; this.fx = ret.fx;
    this.respawnRow = ret.row;
    this.frog.revive(new THREE.Vector3(ret.fx, 0, rowToZ(ret.row)));
    this.veg.sync(this.row, this);
    this.ui.banner(completed ? 'BONUS COMPLETE' : 'RETURNED', completed ? 'the pocket collapses behind you' : '', 1500);
    this.bonusReturn = null;
    if (completed) { this.addScore(500, true); }
  }

  // ---- stage completion ------------------------------------------------------
  _completeStage() {
    if (this.state !== 'play') return;
    this.state = 'complete';
    this.audio.portalEnter();
    this.effects.portalSwirl(this.portal.x, rowToZ(this.portal.row));
    const s = this.stage;
    if (this.mode === 'bonus') { this._exitBonus(true); this.state = 'play'; return; }

    // trial finish
    let trialRes = null;
    if (this.trialMode) {
      trialRes = this.trial.finish(s);
    } else {
      this.trial._passive = false;
      // first-ever completion leaves a ghost even before time runs
      if (!this.progress.stage(s.id).ghost && this.trial.record.length > 8) {
        trialRes = { time: null, relic: null, samples: this.trial.record };
      }
      this.trial.stop();
    }

    const res = {
      pollen: this.collect.got.pollen, pollenTot: this.collect.tot.pollen,
      pods: this.collect.got.pods, podsTot: this.collect.tot.pods,
      shards: this.collect.shardsFound.slice(), shardsTot: this.collect.tot.shards,
      glyphs: this.collect.got.glyphs, glyphsTot: this.collect.tot.glyphs,
      secrets: this.secretsFound, secretsTot: this.secretsTotal,
      deaths: this.deaths,
      time: trialRes ? trialRes.time : null,
      relic: trialRes ? trialRes.relic : null,
      ghost: trialRes ? trialRes.samples : null,
      blooms: [],
    };
    if (res.pods >= res.podsTot && res.podsTot > 0) res.blooms.push('PERFECT BLOOM');
    if (res.deaths === 0) res.blooms.push('NO-DEATH BLOOM');
    if (res.secrets >= res.secretsTot && res.secretsTot > 0) res.blooms.push('SEEKER BLOOM');
    if (res.pollen >= res.pollenTot * 0.95) res.blooms.push('POLLEN BLOOM');

    // record ghost from non-trial run too (positions recorded only in trial; skip)
    this.progress.recordCompletion(s.id, res);
    this.hub.refresh?.();

    // frog levitates into portal
    this.frog.kill('ascend', null);
    this.audio.levelClear();
    setTimeout(() => {
      this.ui.showCompletion(s, res, RELIC_LABEL, () => {
        this.enterHub();
      });
    }, 1400);
  }

  // ---- guardian down → power ceremony ----------------------------------------
  onGuardianDown() {
    const w = WORLDS[this.stage.world - 1];
    const power = w.power;
    this.portal && (this.portal.locked = false);
    if (power && !this.progress.hasPower(power)) {
      this.progress.grantPower(power);
      this.ceremonyActive = true;
      setTimeout(() => {
        this.ui.showCeremony(POWERS[power], () => {
          this.powers.grant(power);
          this.ceremonyActive = false;
          this.ui.banner(`${POWERS[power].name} AWAKENED`, POWERS[power].desc + '  ·  try it now!', 3200);
          this.audio.ceremony();
        });
      }, 1600);
    }
    // completion recorded at portal walk
  }

  // ---- death / respawn ---------------------------------------------------------
  _die(type) {
    if (this.state !== 'play') return;
    if (this._dashInvuln > 0) return;
    this.state = 'dying';
    this.deaths++;
    this.flow.reset();
    const z = rowToZ(this.row);
    this.audio.death(type);
    this.ui.flash();
    this.camera.shake(type === 'water' ? 0.3 : 0.6);
    if (type === 'water') {
      this.water.addRipple(this.fx, z, 1.6);
      this.effects.splash(this.fx, z, this.scratch.waterGlint.getHex());
      this.effects.ring(this.fx, z, this.scratch.waterGlint.getHex(), 1.5);
    } else {
      this.effects.deathBurst(this.fx, z, this.scratch.frog.getHex());
    }
    this.frog.kill(type === 'water' ? 'water' : 'squash', () => {
      if (this.mode === 'bonus') { this.state = 'play'; this._exitBonus(false); return; }
      this.lives--;
      // victory grace: guardian already falling — never game-over during the kill
      const g = this.guardian.active?.state;
      if (g === 'dying' || g === 'gone') this.lives = Math.max(this.lives, 1);
      this.ui.setLives(this.lives);
      if (this.lives <= 0) this._gameOver();
      else { this.state = 'play'; this._respawn(); }
    });
  }

  _respawn() {
    let r = -1;
    if (this.rows.has(this.respawnRow)) r = this.respawnRow;
    else {
      for (let k = Math.min(this.row, this.respawnRow); k <= this.row + 1; k++) {
        const row = this.rows.get(k);
        if (row && (row.type === 'safe' || row.type === 'checkpoint')) { r = k; break; }
      }
      if (r < 0) r = 0;
    }
    const row = this.rows.get(r);
    this.row = r;
    this.fx = this._rowX(row, COLS >> 1);
    this.combo = 0;
    this.buffered = null;
    this.energy = ENERGY_MAX;
    this.frog.revive(new THREE.Vector3(this.fx, 0, rowToZ(r)));
    this.frog.setTheme(this.themeStaticAt(r));
    this.effects.phaseBurst(this.fx, rowToZ(r));
  }

  _gameOver() {
    this.state = 'gameover';
    this.trial.stop();
    if (this.mode === 'endless') {
      const isNew = this.score > this.best;
      if (isNew) { this.best = this.score; try { localStorage.setItem('mandelhop_best', String(this.best)); } catch (e) { } }
      if (this.maxRow > this.bestDepth) { this.bestDepth = this.maxRow; try { localStorage.setItem('mandelhop_depth', String(this.bestDepth)); } catch (e) { } }
      this.ui.setBest(this.best);
      setTimeout(() => this.ui.showGameOver(this.score, this.maxRow, this.best, this.bestDepth, isNew, () => this.enterHub()), 500);
    } else {
      setTimeout(() => this.ui.showStageFail(this.stage, () => {
        if (this.mode === 'stage') this.openStage(this.stage.id, this.trialMode);
      }, () => this.enterHub()), 500);
    }
  }

  // ---- chase serpent -------------------------------------------------------------
  _startChase() {
    const mesh = buildChaseSerpent(this.themeStaticAt(this.row));
    mesh.scale.setScalar(1.15);
    this.scene.add(mesh);
    this.chase = { mesh, z: rowToZ(0) + 7.6, speed: (this.stage?.c.speed || 1) * 1.5, active: true };
    this.ui.banner('RUN', 'the fractal serpent hungers', 2000);
    this.audio.chaseHeart(true);
  }

  _updateChase(t, dt) {
    const c = this.chase;
    if (!c || !c.active) return;
    const frogZ = rowToZ(this.row);
    // serpent relentlessly closes distance; fast frog outruns it
    const gap = c.z - frogZ;
    if (gap > 8.6) c.z = frogZ + 8.6;   // never let it leave the frame's edge
    c.z -= dt * c.speed * (gap > 3.4 ? 1 : 0.62);
    c.mesh.position.set(this.fx * 0.75 + Math.sin(t * 0.8) * 1.2, -0.35, c.z);
    animateChaseSerpent(c.mesh, t);
    if (this.state === 'play' && c.z - frogZ < 1.3 && !this.frog.dying) {
      this._die('squash');
    }
    if (this.portal && this.row >= this.portal.row - 2) {
      c.active = false;
      this.audio.chaseHeart(false);
      this.effects.deathBurst(c.mesh.position.x, c.z, 0xff4488);
      c.mesh.visible = false;
      this.ui.banner('ESCAPED', 'the serpent loses your scent', 1800);
    }
  }

  _clearSpores() {
    for (const s of this._spores) this.scene.remove(s.mesh);
    this._spores = [];
  }

  // ---- dragonfly (endless + stages with flag) -------------------------------------
  _updateDragonfly(t, dt) {
    const allowed = this.mode === 'endless' ? this.maxRow >= UNLOCK.DRAGONFLY : (this.stage?.c.dragonfly > 0);
    if (!allowed) return;
    if (!this.df) {
      const mesh = buildDragonfly(this.themeStaticAt(this.row));
      this.scene.add(mesh);
      this.df = { mesh, state: 'hidden', timer: 10, x: 0, z: 0, dir: 1 };
    }
    const df = this.df;
    const frogZ = rowToZ(this.row);
    switch (df.state) {
      case 'hidden':
        df.timer -= dt;
        if (df.timer <= 0 && this.state === 'play') {
          df.state = 'stalk'; df.stalkT = 2.6;
          df.x = this.fx * 0.4 + (Math.random() - 0.5) * 6;
          df.z = frogZ + 5;
          df.mesh.visible = true;
        }
        break;
      case 'stalk': {
        df.stalkT -= dt;
        df.x += (this.fx - df.x) * dt * 0.8;
        df.z += (frogZ + 2.5 - df.z) * dt * 1.2;
        df.mesh.position.set(df.x, 0.35 + Math.sin(t * 3) * 0.1, df.z);
        animateDragonfly(df.mesh, t, 40);
        if (df.stalkT <= 0) { df.state = 'telegraph'; df.telT = 0.9; this.audio.telegraph(); }
        break;
      }
      case 'telegraph': {
        df.telT -= dt;
        df.mesh.position.x = df.x + (Math.random() - 0.5) * 0.15;
        df.mesh.position.z = df.z;
        df.mesh.position.y = 0.45 + Math.sin(t * 30) * 0.05;
        df.mesh.userData.glowMat.color.setHex(0xff2255);
        animateDragonfly(df.mesh, t, 90);
        if (df.telT <= 0) {
          df.state = 'dash';
          df.dir = Math.random() < 0.5 ? 1 : -1;
          df.x = -df.dir * 9;
          df.targetRow = this.row;
        }
        break;
      }
      case 'dash': {
        df.x += df.dir * 11 * dt;
        const dz = rowToZ(df.targetRow);
        df.z += (dz - df.z) * Math.min(1, dt * 10);
        df.mesh.position.set(df.x, 0.3, df.z);
        animateDragonfly(df.mesh, t, 110);
        if (this.state === 'play' && !this.frog.isHopping && !this.frog.dying
          && this.row === df.targetRow && Math.abs(this.fx - df.x) < 0.6
          && this.powers.sliding <= 0) {
          this._die('squash');
        }
        if (Math.abs(df.x) > 9.5) {
          df.state = 'hidden';
          df.mesh.visible = false;
          df.timer = this.mode === 'endless'
            ? (12 + Math.random() * 10) * Math.max(0.45, 1 - this.maxRow / 700)
            : (13 + Math.random() * 9) * Math.max(0.55, 1 - (this.stage?.world || 1) * 0.05);
        }
        break;
      }
    }
  }

  // ------------------------------------------------------------- frame
  update(t, dt) {
    if (this.paused) return;

    // self-heal: death anim interrupted by a teleport/transition can orphan state
    if (this.state === 'dying' && !this.frog.dying && !this.frog.isHopping) {
      this.state = 'play';
      this._respawn();
    }

    // world clock through time powers
    const wScale = this.timemagic.enabled ? this.timemagic.scale : 1;
    const wdt = dt * wScale;
    this.worldT += wdt;
    const wt = this.worldT;
    if (this._dashInvuln > 0) this._dashInvuln -= dt;

    // generate ahead / trim behind
    const genCap = (this.mode === 'stage' && !this.stage?.guardian) ? this.stage.length + 3 : Infinity;
    const ahead = Math.min(this.row + 45, genCap);
    for (let r = Math.max(0, this.row - 2); r <= ahead; r++) this._genRow(r);
    for (const row of [...this.rows.values()]) {
      if (row.r < this.row - 25) this._freeRow(row);
    }

    // pending chase start (after first rows generated)
    if (this._chasePending && this.mode === 'stage' && this.state === 'play') {
      this._chasePending = false;
      this._startChase();
    }

    // live theme
    if (this.mode === 'hub') {
      lerpThemeInto(this.scratch, HUB_THEME, THEMES[8], 0.15 + 0.1 * Math.sin(this.worldT * 0.05));
    } else {
      const biome = biomeAt(Math.max(0, this.row) + this.biomeOffset);
      lerpThemeInto(this.scratch, biome.a, biome.b, biome.t);
    }
    this.water.setTheme(this.scratch);
    this.world.applyLiveTheme(this.scratch, this.scene.fog);
    this.fractals.applyTheme(this.scratch, this.mode === 'hub' ? { index: 8, t: 0 } : biome);
    this.water.follow(rowToZ(this.row) - 12);
    const maskRow0 = this.row - 32;
    for (let i = 0; i < 128; i++) {
      const row = this.rows.get(maskRow0 + i);
      this.water.maskData[i] = (this.mode === 'hub' || (row && row.type === 'river')) ? 255 : 0;
    }
    this.water.setRowMask(maskRow0);
    const effBiomeIdx = this.mode === 'hub' ? 8 : (Math.floor((Math.max(0, this.row) + this.biomeOffset) / BIOME_LEN)) % THEMES.length;
    if (effBiomeIdx !== this.biomeIdx) {
      this.biomeIdx = effBiomeIdx;
      const th = THEMES[effBiomeIdx];
      if (this.mode === 'endless') this.ui.setBiome(th.name);
      if (this.mode === 'hub') { /* label stays POND OUTSIDE TIME */ }
      this.frog.setTheme(this.themeStaticAt(Math.max(0, this.row)));
      this.audio.setTheme(effBiomeIdx);
      if (this.mode === 'endless' && this.state === 'play' && this.row > 2) {
        this.ui.banner(th.name, `depth ${this.row}`, 2000);
        this.audio.biomeSwell();
      }
    }

    const frogZ = rowToZ(this.row);
    const playing = this.state === 'play';
    this.collect._themeFn = () => this.themeStaticAt(Math.max(0, this.row));

    // ---- lane simulation (world clock) ----
    const frogRide = (playing && !this.frog.isHopping && !this.frog.dying)
      ? { row: this.rows.get(this.row), e: this._platformUnder(this.rows.get(this.row)) }
      : null;
    if (frogRide && !frogRide.e) frogRide.row = null;

    for (const row of this.rows.values()) {
      if (row.ents.length === 0) continue;
      if (row.r < this.row - 12 || row.r > this.row + 40) continue;
      const mul = row.pulse ? 0.65 + 1.1 * mandelPulse(wt, row.cA, row.cB) : 1;
      row.pulseMul = mul;
      if (row.vis && row.vis.chev) row.vis.chev.uniforms.uPulse.value = mul;
      for (const e of row.ents) {
        const oldX = e.x;
        e.x = row.minX + mod(e.x - row.minX + row.dir * row.speed * mul * wdt, row.total);
        const delta = e.x - oldX;
        if (Math.abs(delta) > row.spacing && frogRide && frogRide.row === row && frogRide.e === e) {
          this.fx += delta;
          this.frog.group.position.x = this.fx;
        }
        e.mesh.position.x = e.x;
        if (row.type === 'road') animateVehicle(e.mesh, wt + e.x * 0.1, row.speed);
        else {
          let dip = 0;
          if (frogRide && frogRide.row === row && frogRide.e === e) dip = 0.07;
          if (row.sinker) dip = Math.max(dip, row.sinkT * 0.3);
          posePlatform(e.mesh, e.x, rowToZ(row.r), this.water, wt, dip);
        }
      }
    }

    if (playing && !this.frog.dying) {
      // buffered hops
      if (this.buffered && !this.frog.isHopping) {
        this.bufferT -= dt;
        if (this.bufferT > 0) { const [dx, dy] = this.buffered; this.buffered = null; this._hop(dx, dy); }
        else this.buffered = null;
      }
      const grounded = !this.frog.isHopping;
      if (grounded) {
        if (!this.buffered && this.input && this.mode !== 'hub') {
          const hd = this.input.heldDir();
          if (hd) this._hop(hd[0], hd[1]);
        }
        const row = this.rows.get(this.row);
        if (row) {
          // standing interactions — portals & gates respond to presence, not just landings
          if (this.state === 'play' && row.type !== 'river') {
            if (row.bonusPortal && !row.bonusPortal.used && Math.abs(this.fx - row.bonusPortal.x) < 0.6) {
              row.bonusPortal.used = true;
              this._bonusUsedRows.add(row.r);
              this._enterBonus(row);
            } else if (row.deathGate && !row.deathGate.taken && Math.abs(this.fx - row.deathGate.x) < 0.6) {
              if (this.deaths === 0) {
                row.deathGate.taken = true;
                this._deathGateTaken.add(row.r);
                this.secretsFound++;
                this.audio.secret();
                this.effects.goalBurst(row.deathGate.x, frogZ, 0xff2255);
                this.ui.banner('DEATH ROUTE', 'flawless — the garden notices', 1800);
                this.collect.sprayPollen(row.deathGate.x, 0.4, frogZ, 14);
                this.addScore(300, true);
              }
            } else if (this.portal && this.row >= this.portal.row && !this.portal.locked) {
              this.fx += (this.portal.x - this.fx) * 0.35;
              this.frog.group.position.x = this.fx;
              this._completeStage();
            }
          }
          if (row.type === 'river' && !row.phaseFrozen) {
            const ride = this._platformUnder(row);
            if (!ride) {
              if (row.pool) {
                if (this.swim <= 0) this._enterWater(row);
                // paddle: drift with the current, no platform needed
                const mul = row.pulse ? row.pulseMul : 1;
                this.fx += row.dir * row.speed * 0.35 * mul * wdt;
                this.frog.group.position.x = this.fx;
                this.frog.group.position.y = -0.12 + Math.sin(this.worldT * 2.2) * 0.05;
                if (!row.wrap && Math.abs(this.fx) > HALF + 0.9) { this._die('water'); }
              }
              else { this._die('water'); }
            }
            else {
              this._exitWater();
              const mul = row.pulse ? row.pulseMul : 1;
              this.fx += row.dir * row.speed * mul * wdt;
              this.frog.group.position.x = this.fx;
              this.frog.group.position.y = this._platformTop(row, ride);
              if (!row.wrap && Math.abs(this.fx) > HALF + 0.9) this._die('water');
              if (row.sinker) {
                row.sinkT += wdt;
                if (row.sinkT > 1.4) this._die('water');
              }
            }
          }
          // traffic
          if (this.state === 'play' && row.type === 'road') {
            for (const e of row.ents) {
              const d = row.wrap ? torusDist(this.fx, e.x) : Math.abs(this.fx - e.x);
              if (d < e.len / 2 + 0.30) { this._die('squash'); break; }
              if (d < e.len / 2 + 1.1 && !e.nm) { e.nm = true; this.audio.nearMiss(); this.flow.count += 0.5; }
              if (d > e.len / 2 + 1.6) e.nm = false;
            }
          }
          // snake
          if (this.state === 'play' && row.snake && row.snake.alive) {
            const sx = Math.sin((wt + row.snake.ph) * row.snake.sp) * 5.2;
            if (Math.abs(this.fx - sx) < 0.55) this._die('squash');
          }
          // chompers
          if (this.state === 'play' && row.chompers) {
            for (const c of row.chompers) {
              const ph = (wt + c.off) % 2.6;
              if (ph > 1.55 && ph < 1.85 && Math.abs(this.fx - c.x) < 0.45) this._die('squash');
            }
          }
          // beetles
          if (this.state === 'play' && row.beetles) {
            for (const b of row.beetles) {
              if (!b.alive) continue;
              if (Math.abs(this.fx - b.mesh.position.x) < 0.5 && this.powers.sliding <= 0) {
                if (this.powers.spinT > 0) continue;   // spinning through is handled by enemyHit
                this._die('squash');
              }
            }
          }
          // collapse pads standing check
          if (this.state === 'play' && row.collapse) {
            for (const c of row.collapse) {
              if (c.state === 'fallen' && Math.abs(this.fx - c.x) < 0.5) { this._die('squash'); }
            }
          }
        }
      }
      // swim air meter
      if (this.state === 'play' && this.swim > 0) {
        const row = this.rows.get(this.row);
        if (row && row.type === 'river' && row.pool && !this._platformUnder(row)) {
          this.swim -= wdt;
          this.ui.setAir?.(this.swim / 4);
          if (this.swim <= 0) { this.ui.showAir?.(false); this._die('water'); }
        } else {
          this._exitWater();
        }
      }
      // energy (endless only)
      if (this.state === 'play' && this.mode === 'endless') {
        this.energy -= dt;
        this.ui.setTime(this.energy / ENERGY_MAX);
        if (this.energy <= 0) this._die('squash');
      }
      const row = this.rows.get(this.row);
      this.audio.setWaterProximity(row && row.type === 'river' ? 1 : 0.25);
      // gather collectibles at frog (continuous, for moving through)
      const evs = this.collect.gather(this.fx, frogZ, this.frog.group.position.y, dt, wt);
      for (const ev of evs) this._collectEvent(ev);
    }

    // sinker recovery
    for (const row of this.rows.values()) {
      if (row.sinker && row.sinkT > 0 && this.row !== row.r) row.sinkT = Math.max(0, row.sinkT - wdt);
    }

    // ---- feature animation (world clock) ----
    for (const row of this.rows.values()) {
      if (row.r < this.row - 8 || row.r > this.row + 30) continue;
      const z = rowToZ(row.r);
      if (row.orbs) for (const o of row.orbs) {
        if (o.taken) continue;
        o.mesh.position.y = 0.4 + Math.sin(wt * 2.4 + o.x) * 0.1;
        o.mesh.userData.core.rotation.y = wt * 2;
      }
      if (row.snake) {
        const sx = Math.sin((wt + row.snake.ph) * row.snake.sp) * 5.2;
        row.snake.mesh.position.x = sx;
        animateSnake(row.snake.mesh, wt);
      }
      if (row.chompers) for (const c of row.chompers) {
        const ph = (wt + c.off) % 2.6;
        const open = ph < 1.4 ? Math.min(1, ph * 1.5) : ph < 1.55 ? 1 - (ph - 1.4) * 6.6 : ph < 1.85 ? 0 : (ph - 1.85) * 1.3;
        animateChomper(c.mesh, clamp(open, 0, 1));
      }
      if (row.worm) for (const w of row.worm) {
        w.mesh.userData.ring.rotation.y = wt * 1.4;
        w.mesh.userData.disc.rotation.y = wt * 1.4;
        w.mesh.userData.ring.scale.setScalar(1 + Math.sin(wt * 3 + w.x) * 0.08);
      }
      if (row.check) {
        const c = row.check;
        c.mesh.userData.ring.rotation.z = wt * 0.8;
        c.mesh.userData.ringMat.opacity = c.active ? 0.3 : 0.6 + Math.sin(wt * 3) * 0.2;
        if (c.active && c.bloomT > 0 && c.bloomT < 1) {
          c.bloomT += wdt;
          const e = 1 - Math.pow(1 - Math.min(1, c.bloomT * 2), 3);
          c.mesh.userData.lotus.scale.setScalar(Math.max(0.001, e));
        }
      }
      if (row.beetles) for (const b of row.beetles) {
        if (!b.alive) continue;
        b.mesh.position.x += Math.sin(wt * b.sp + b.ph) * wdt * 2 * Math.sign(b.sp);
        b.mesh.rotation.y = Math.sin(wt * b.sp + b.ph) > 0 ? 0.3 : -0.3;
        for (let i = 0; i < b.mesh.userData.legs.length; i++) {
          b.mesh.userData.legs[i].rotation.z = (i % 2 ? 1 : -1) * (0.4 + Math.sin(wt * 12 + i) * 0.3);
        }
      }
      if (row.spitters) for (const s of row.spitters) {
        if (!s.alive) continue;
        s.mesh.userData.bulb.scale.setScalar(1 + Math.sin(wt * 3) * 0.06);
        if (playing) {
          s.cd -= wdt;
          if (s.cd <= 0) {
            s.cd = 2.4;
            const mesh = buildSpore(0xff77cc);
            mesh.position.set(s.x, 0.85, z);
            this.scene.add(mesh);
            // aim at frog
            const dir = new THREE.Vector3(this.fx - s.x, 0.05, frogZ - z).normalize().multiplyScalar(3.2);
            this._spores.push({ mesh, vel: dir, t: 0, row: row.r });
            this.audio.spit?.();
          }
        }
      }
      if (row.collapse) for (const c of row.collapse) {
        if (c.state === 'shaking') {
          c.t += wdt;
          c.mesh.position.x = c.x + (Math.random() - 0.5) * 0.05;
          if (c.t > 0.75) { c.state = 'falling'; c.t = 0; }
        } else if (c.state === 'falling') {
          c.t += wdt;
          c.mesh.position.y = -c.t * c.t * 6;
          c.mesh.rotation.x = c.t * 1.5;
          if (c.t > 0.5) { c.state = 'fallen'; c.t = 0; c.mesh.visible = false; }
        } else if (c.state === 'fallen') {
          c.t += wdt;
          if (c.t > 2.5) {
            c.state = 'idle'; c.mesh.visible = true;
            c.mesh.position.set(c.x, 0, z); c.mesh.rotation.set(0, 0, 0);
          }
        } else if (c.state === 'rebuilding') {
          c.t += wdt;
          const k = Math.min(1, c.t / 0.5);
          c.mesh.position.y = -(1 - k) * (1 - k) * 1.5;
          c.mesh.rotation.x = (1 - k) * 1.5;
          if (k >= 1) { c.state = 'idle'; c.mesh.position.set(c.x, 0, z); c.mesh.rotation.set(0, 0, 0); }
        }
      }
      if (row.seedSpot) {
        const ss = row.seedSpot;
        if (ss.grown > 0) {
          ss.grown -= wdt;
          if (ss.mushroom) {
            ss.mushroom.userData.cap.scale.setScalar(1 + Math.sin(wt * 5) * 0.08);
            if (ss.grown <= 0) {   // wilt
              this.scene.remove(ss.mushroom);
              ss.mushroom = null;
              ss.mesh.visible = true;
            }
          }
        }
      }
      if (row.vineBar) {
        row.vineBar.glow.material.color.setHSL(0.32, 1, 0.5 + Math.sin(wt * 4) * 0.15);
      }
      if (row.grappleRing) {
        row.grappleRing.mesh.rotation.y = wt * 0.6;
      }
      if (row.portalMesh) {
        const u = row.portalMesh.userData;
        u.discMat.uniforms.uTime.value = wt;
        u.ring.rotation.z = wt * 0.4;
        u.petals.rotation.z = -wt * 0.2;
        if (this.portal?.locked) u.ring.material.emissiveIntensity = 0.4;
      }
      if (row.bonusPortal) {
        const b = row.bonusPortal;
        b.mesh.userData.ring.rotation.y = wt * 1.8;
        b.mesh.userData.disc.rotation.y = wt * 1.8;
      }
      if (row.deathGate) {
        row.deathGate.mesh.userData.skull.rotation.y = wt * 2;
        row.deathGate.mesh.userData.mat.opacity = this.deaths === 0 ? 0.85 : 0.25;
      }
    }

    // spores flight (world clock so freeze holds them)
    for (let i = this._spores.length - 1; i >= 0; i--) {
      const s = this._spores[i];
      s.t += wdt;
      s.mesh.position.addScaledVector(s.vel, wdt);
      // spin reflects spores
      if (this.powers.spinT > 0 && Math.hypot(s.mesh.position.x - this.fx, s.mesh.position.z - frogZ) < 1.3) {
        s.vel.multiplyScalar(-1.6);
        this.audio.reflect?.();
        this.effects.sparkle(s.mesh.position.x, s.mesh.position.z, 0xff77cc);
      }
      // hit frog?
      if (this.state === 'play' && !this.frog.isHopping && Math.abs(s.mesh.position.x - this.fx) < 0.4 && Math.abs(s.mesh.position.z - frogZ) < 0.4 && this.powers.sliding <= 0) {
        this._die('squash');
      }
      if (s.t > 3) { this.scene.remove(s.mesh); this._spores.splice(i, 1); }
    }

    this._updateDragonfly(t, wdt);
    if (this.chase) this._updateChase(t, wdt);
    if (this.guardian.isActive) this.guardian.update(t, wdt, this);

    // guardian stage: spawn boss when frog reaches arena
    if (this.stage?.guardian && playing && !this.guardian.isActive && !this._guardianDone && this.row >= 3) {
      this.guardian.start(this, this.stage.world - 1, this.themeStaticAt(this.row));
    }
    if (this.stage?.guardian && this.guardian.active?.state === 'gone' && !this._guardianDone) {
      this._guardianDone = true;
    }

    // frog sync
    if (!this.frog.isHopping && !this.frog.dying) {
      this.frog.group.position.z = frogZ;
      const row = this.rows.get(this.row);
      if (row && row.type === 'river' && row.pool && this.swim > 0 && !this._platformUnder(row)) {
        this.frog.group.position.y = -0.12 + Math.sin(this.worldT * 2.2) * 0.05;
      }
      if (!row || (row.type !== 'river' || row.phaseFrozen)) {
        this.frog.group.position.x = this.fx;
        if (!row || row.type !== 'river') this.frog.group.position.y = row && row.phaseFrozen ? 0.05 : 0;
      }
    }
    this.veg.setFrog(this.frog.group.position.x, this.frog.group.position.z);
    this.veg.sync(this.row, this);

    // systems
    this.timemagic.update(t, dt, this);
    this.flow.update(this.worldT, dt);
    this.powers.update(t, dt, this);
    this.collect.update(wt, wdt, this.frog.group.position, this.flow.state ? 2.6 : 1.6);
    this.trial.update(dt, this.frog.group.position);
    if (this.mode === 'hub') this.hub.update(t, dt, this.frog.group.position);

    // blob shadows
    let si = 0;
    const fy = this.frog.group.position.y;
    const fs = Math.max(0.3, 0.62 - fy * 0.4);
    this.shadows.set(si++, this.frog.group.position.x, 0.01, this.frog.group.position.z, fs, fs);
    for (const row of this.rows.values()) {
      if (row.r < this.row - 6 || row.r > this.row + 22) continue;
      for (const e of row.ents) {
        if (si >= 108) break;
        if (Math.abs(e.x) < WRAP_X) {
          this.shadows.set(si++, e.x, row.type === 'river' ? 0.06 : 0.01, rowToZ(row.r),
            e.len * 0.9, row.type === 'river' ? 0.7 : 0.75);
        }
      }
    }
    if (this.guardian.isActive && this.guardian.active.mesh.visible) {
      const m = this.guardian.active.mesh.position;
      this.shadows.set(si++, m.x, 0.01, m.z, 2.2, 2.2);
    }
    if (this.df && this.df.mesh.visible) {
      this.shadows.set(si++, this.df.mesh.position.x, 0.01, this.df.mesh.position.z, 0.5, 0.5);
    }
    this.shadows.commit(si);

    if (this.state !== 'title' && this.state !== 'gameover') {
      this.camera.update(t, dt, this.frog.group.position, this);
    }
  }
}
