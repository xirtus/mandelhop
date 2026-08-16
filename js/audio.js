// =============================================================================
// MANDELHOP — audio.js
// Fully generative soundtrack: oscillators, filters, envelopes, noise,
// tempo-synced delay, generated-IR convolution reverb, lookahead sequencer.
// Gameplay composes the music: hops = melody, lanes = rhythm, logs = bass,
// water = filtered noise drone, goals = harmonic resolution.
// No prerecorded audio. No copyrighted melodies — all voices derive from a
// generative pentatonic system seeded per theme.
// =============================================================================

const BPM = 96;
const BEAT = 60 / BPM;            // 0.625 s
const BAR = BEAT * 4;

// D dorian-ish pentatonic ladder (semitone offsets from root)
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
// Chord progression roots (semitones from D): i, VI, III, VII — dreamy loop
const PROG = [0, -4, 5, -2];
const ROOT = 146.83;              // D3

const st = (root, semis) => root * Math.pow(2, semis / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.started = false;
    this.theme = 0;
    this.tension = 0;             // 0..1 near-miss / danger modulation
    this._combo = 0;
    this._beatCount = 0;
    this._nextBeat = 0;
    this._noiseT = 0;
  }

  resume() {
    if (!this.ctx) this._init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.started = true;
  }

  _init() {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 22; comp.ratio.value = 8;
    this.master.connect(comp); comp.connect(ctx.destination);

    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.8;
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9;
    // TIME FILTER — time-slow stretches the whole orchestra through glass
    this.timeFilt = ctx.createBiquadFilter();
    this.timeFilt.type = 'lowpass'; this.timeFilt.frequency.value = 18000; this.timeFilt.Q.value = 0.5;
    this.musicBus.connect(this.timeFilt); this.timeFilt.connect(this.master);
    this.sfxBus.connect(this.master);
    // flow percussion bus
    this.flowBus = ctx.createGain(); this.flowBus.gain.value = 0.0;
    this.flowBus.connect(this.timeFilt);

    // Tempo-synced dotted-eighth delay
    this.delay = ctx.createDelay(2.0);
    this.delay.delayTime.value = BEAT * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const fbFilt = ctx.createBiquadFilter(); fbFilt.type = 'lowpass'; fbFilt.frequency.value = 2400;
    this.delay.connect(fb); fb.connect(fbFilt); fbFilt.connect(this.delay);
    this.delaySend = ctx.createGain(); this.delaySend.gain.value = 0.5;
    this.delaySend.connect(this.delay); this.delay.connect(this.musicBus);

    // Generated impulse-response convolution reverb (2.4 s decaying stereo noise)
    const len = Math.floor(ctx.sampleRate * 2.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const n = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
        lp += 0.24 * (n - lp);          // soften highs over time
        d[i] = lp * 1.6;
      }
    }
    this.verb = ctx.createConvolver(); this.verb.buffer = ir;
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.55;
    this.verbSend.connect(this.verb); this.verb.connect(this.musicBus);

    // Water noise bed: looped noise → bandpass, LFO-breathing
    const nlen = ctx.sampleRate * 2;
    const nbuf = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = nbuf.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nbuf;
    const nsrc = ctx.createBufferSource(); nsrc.buffer = nbuf; nsrc.loop = true;
    this.waterFilt = ctx.createBiquadFilter(); this.waterFilt.type = 'bandpass';
    this.waterFilt.frequency.value = 700; this.waterFilt.Q.value = 0.6;
    this.waterGain = ctx.createGain(); this.waterGain.gain.value = 0.0;
    nsrc.connect(this.waterFilt); this.waterFilt.connect(this.waterGain);
    this.waterGain.connect(this.musicBus); nsrc.start();

    // Drone: two detuned saws → lowpass with slow LFO
    this.droneGain = ctx.createGain(); this.droneGain.gain.value = 0.05;
    this.droneFilt = ctx.createBiquadFilter(); this.droneFilt.type = 'lowpass';
    this.droneFilt.frequency.value = 320; this.droneFilt.Q.value = 2.2;
    this.droneOsc = [];
    for (const det of [-6, 5]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = ROOT / 2; o.detune.value = det;
      o.connect(this.droneFilt); o.start(); this.droneOsc.push(o);
    }
    this.droneFilt.connect(this.droneGain); this.droneGain.connect(this.musicBus);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lfoG = ctx.createGain(); lfoG.gain.value = 140;
    lfo.connect(lfoG); lfoG.connect(this.droneFilt.frequency); lfo.start();

    this._nextBeat = ctx.currentTime + 0.1;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  setTheme(i) {
    this.theme = i;
    if (!this.ctx) return;
    // Root drifts by whole tones per world — same system, new color
    const root = ROOT * Math.pow(2, (i % 5) / 12);
    for (const o of this.droneOsc) o.frequency.setTargetAtTime(root / 2, this.ctx.currentTime, 1.2);
  }

  beatPhase() {
    if (!this.ctx) return 0;
    return 1 - Math.max(0, Math.min(1, (this._nextBeat - this.ctx.currentTime) / BEAT));
  }

  // Lookahead sequencer — call every frame
  update() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    while (this._nextBeat < now + 0.18) {
      this._scheduleBeat(this._nextBeat, this._beatCount);
      this._beatCount++;
      this._nextBeat += BEAT;
    }
    // Water noise breathes; tension tightens the drone filter
    this._noiseT += 0.016;
    const wTarget = 0.028 + 0.02 * Math.sin(this._noiseT * 0.4);
    this.waterGain.gain.setTargetAtTime(wTarget, now, 0.4);
    this.droneFilt.frequency.setTargetAtTime(320 + this.tension * 900, now, 0.3);
    this.tension = Math.max(0, this.tension - 0.01);
  }

  _scheduleBeat(t, beat) {
    const bar = Math.floor(beat / 4);
    const inBar = beat % 4;
    const chordRoot = PROG[bar % 4];
    const themeShift = (this.theme % 5);

    // Bass pulse on beats 0 and 2 (logs/bass voice) — short sine pluck
    if (inBar === 0 || inBar === 2) {
      this._pluck(t, st(ROOT / 2, chordRoot), 0.24, 'sine', 0.22, 300);
    }
    // Sparkle hat: filtered noise tick on offbeats, density rises with theme
    if (inBar === 1 || inBar === 3 || (this.theme > 3 && beat % 2 === 1)) {
      this._hat(t, 0.03 + this.theme * 0.004);
    }
    // Pad chord at bar start — slow-attack triangles, 3 voices
    if (inBar === 0) {
      for (const iv of [0, 3, 7]) {
        this._pad(t, st(ROOT, chordRoot + iv + 12), BAR * 1.1, 0.028 + this.tension * 0.01);
      }
    }
    // Shimmer arp every 2 bars, higher themes
    if (this.theme >= 2 && beat % 8 === 4) {
      const n = PENTA[(bar * 3 + themeShift) % PENTA.length];
      this._pluck(t, st(ROOT * 2, n + chordRoot), 0.5, 'triangle', 0.05, 3200, true);
    }
    // FLOW percussion: the level becomes an instrument
    if (this._flow01 > 0.25) {
      const f = this._flow01;
      // four-on-floor soft kick
      this._kick(t, 0.10 * f);
      // 16th hats at high flow
      if (f > 0.6) {
        for (const off of [0.25, 0.5, 0.75]) this._hat(t + BEAT * off, 0.02 * f);
      }
      // clap on 2 & 4 in FLOW STATE
      if (this._flowState && (inBar === 1 || inBar === 3)) this._clap(t, 0.09);
      // arp run at bar end
      if (this._flowState && inBar === 3) {
        const n = PENTA[(bar * 5 + inBar) % PENTA.length];
        this._pluck(t + BEAT * 0.5, st(ROOT * 4, n + chordRoot), 0.3, 'square', 0.03, 5000, true);
      }
    }
    // hub awakening layers: extra pad richness per completed world
    if (this._hubLayers > 0 && inBar === 2) {
      for (let i = 0; i < Math.min(this._hubLayers, 4); i++) {
        this._pad(t, st(ROOT, PROG[bar % 4] + PENTA[(i * 2 + bar) % 7] + 24), BAR * 0.9, 0.012);
      }
    }
  }

  _kick(t, vol) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    const g = this._env(t, 0.003, 0.22, vol);
    o.connect(g); g.connect(this.flowBus);
    o.start(t); o.stop(t + 0.3);
  }
  _clap(t, vol) {
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.4;
    const g = this._env(t, 0.002, 0.16, vol);
    s.connect(f); f.connect(g); g.connect(this.flowBus); g.connect(this.verbSend);
    s.start(t, Math.random()); s.stop(t + 0.2);
  }

  // --- voices ----------------------------------------------------------------
  _env(t, a, d, peak = 1) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    return g;
  }

  _pluck(t, freq, dur, type, vol, lpf = 4000, echo = false) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lpf;
    const g = this._env(t, 0.008, dur, vol);
    o.connect(f); f.connect(g); g.connect(this.musicBus);
    g.connect(this.verbSend);
    if (echo) g.connect(this.delaySend);
    o.start(t); o.stop(t + dur + 0.1);
  }

  _pad(t, freq, dur, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.verbSend); g.connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.1);
  }

  _hat(t, vol) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 1.7;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = this._env(t, 0.002, 0.05, vol);
    s.connect(f); f.connect(g); g.connect(this.musicBus);
    s.start(t, Math.random()); s.stop(t + 0.08);
  }

  // --- gameplay events ---------------------------------------------------------
  // Hop = melody. Consecutive forward hops climb the pentatonic ladder.
  hop(combo = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const idx = (2 + combo) % PENTA.length;
    const oct = combo > 6 ? 2 : 1;
    const chordRoot = PROG[Math.floor(this._beatCount / 4) % 4];
    this._pluck(t, st(ROOT * oct, PENTA[idx] + chordRoot + 12), 0.35, 'triangle', 0.16, 4000, true);
  }

  land() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this._pluck(this.ctx.currentTime, st(ROOT, -12), 0.1, 'sine', 0.1, 500);
  }

  nearMiss() { this.tension = Math.min(1, this.tension + 0.35); }

  goal(combo = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const chordRoot = PROG[Math.floor(this._beatCount / 4) % 4];
    // Resolve: root triad arpeggio + shimmer
    [0, 3, 7, 12].forEach((iv, i) => {
      this._pluck(t + i * 0.07, st(ROOT * 2, chordRoot + iv), 0.9, 'triangle', 0.14, 5000, true);
    });
    this._pluck(t, st(ROOT, chordRoot), 1.4, 'sine', 0.2, 800);
  }

  levelClear() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    PENTA.slice(0, 8).forEach((n, i) => {
      this._pluck(t + i * 0.09, st(ROOT * 2, n), 1.0, 'triangle', 0.12, 6000, true);
    });
  }

  death(type = 'squash') {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (type === 'water') {
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = 0.6;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.5);
      const g = this._env(t, 0.01, 0.5, 0.35);
      s.connect(f); f.connect(g); g.connect(this.sfxBus); g.connect(this.verbSend);
      s.start(t, Math.random()); s.stop(t + 0.6);
    }
    // Descending detuned sweep — the falling feeling
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(440, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.55);
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 1200;
    const g2 = this._env(t, 0.005, 0.55, 0.18);
    o.connect(f2); f2.connect(g2); g2.connect(this.sfxBus); g2.connect(this.verbSend);
    o.start(t); o.stop(t + 0.7);
  }

  // Dragonfly telegraph — rising menace gliss
  telegraph() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.85);
    const tr = ctx.createOscillator(); tr.frequency.value = 22;
    const trG = ctx.createGain(); trG.gain.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.95);
    tr.connect(trG); trG.connect(g.gain);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3;
    o.connect(f); f.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + 1.0); tr.start(t); tr.stop(t + 1.0);
    this.tension = 1;
  }

  // Wormhole / portal — two-way pitch swoop
  wormhole() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(1800, t + 0.14);
    o.frequency.exponentialRampToValueAtTime(220, t + 0.32);
    const g = this._env(t, 0.01, 0.34, 0.18);
    o.connect(g); g.connect(this.sfxBus); g.connect(this.delaySend);
    o.start(t); o.stop(t + 0.5);
  }

  // Pollen orb pickup — bright pentatonic blip
  orb() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const n = PENTA[(this._beatCount * 5) % PENTA.length];
    this._pluck(t, st(ROOT * 4, n), 0.3, 'sine', 0.12, 6000, true);
  }

  // Biome crossing — filtered noise swell
  biomeSwell() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime;
    const sN = ctx.createBufferSource(); sN.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 1.2);
    const g = this._env(t, 0.5, 1.4, 0.1);
    sN.connect(f); f.connect(g); g.connect(this.verbSend);
    sN.start(t, Math.random()); sN.stop(t + 2);
  }

  uiClick() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this._pluck(this.ctx.currentTime, st(ROOT * 2, 7), 0.12, 'sine', 0.08, 3000);
  }

  setWaterProximity(f) {  // 0 far … 1 at river — mix noise bed
    if (this.ctx) this.waterGain.gain.setTargetAtTime(0.02 + f * 0.06, this.ctx.currentTime, 0.25);
  }
}

// =============================================================================
// TIMEWARP VOICES — appended to AudioEngine.prototype
// =============================================================================
const AEP = AudioEngine.prototype;

AEP.setFlow = function (f01, state) {
  this._flow01 = f01; this._flowState = state;
  if (this.ctx) this.flowBus.gain.setTargetAtTime(f01 * 0.9, this.ctx.currentTime, 0.4);
};
AEP.setHubLayers = function (n) { this._hubLayers = n; };

// --- time powers ------------------------------------------------------------
AEP.timeSlowStart = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  this.timeFilt.frequency.setTargetAtTime(900, t, 0.12);
  const o = this.ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(800, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 0.4);
  const g = this._env(t, 0.01, 0.4, 0.12);
  o.connect(g); g.connect(this.sfxBus); g.connect(this.verbSend);
  o.start(t); o.stop(t + 0.5);
};
AEP.timeSlowEnd = function () {
  if (!this.ctx) return;
  this.timeFilt.frequency.setTargetAtTime(18000, this.ctx.currentTime, 0.1);
};
AEP.timeFreeze = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  this.timeFilt.frequency.setTargetAtTime(500, t, 0.05);
  // sustained spectral chord — the world holds its breath
  this._freezeOsc = [];
  [0, 3, 7, 12].forEach((iv, i) => {
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.value = st(ROOT * 2, iv);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.3);
    g.gain.setTargetAtTime(0.0001, t + 1.6, 0.3);
    o.connect(g); g.connect(this.verbSend); g.connect(this.musicBus);
    o.start(t); o.stop(t + 3);
    this._freezeOsc.push(o);
  });
  this._gliss(t, 1200, 2400, 0.3, 0.06);
};
AEP.timeThaw = function () {
  if (!this.ctx) return;
  this.timeFilt.frequency.setTargetAtTime(18000, this.ctx.currentTime, 0.2);
  this._gliss(this.ctx.currentTime, 400, 1600, 0.25, 0.08);
};
AEP.phaseShift = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  // two-way mandala sweep
  this._gliss(t, 300, 2400, 0.18, 0.14);
  this._gliss(t + 0.16, 2400, 200, 0.3, 0.12);
  const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
  const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
  f.frequency.setValueAtTime(400, t);
  f.frequency.exponentialRampToValueAtTime(4000, t + 0.4);
  const g = this._env(t, 0.02, 0.5, 0.12);
  s.connect(f); f.connect(g); g.connect(this.verbSend);
  s.start(t, Math.random()); s.stop(t + 0.6);
};
AEP._gliss = function (t, f0, f1, dur, vol) {
  if (!this.ctx) return;
  const o = this.ctx.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = this._env(t, 0.008, dur, vol);
  o.connect(g); g.connect(this.sfxBus); g.connect(this.delaySend);
  o.start(t); o.stop(t + dur + 0.1);
};

// --- powers ------------------------------------------------------------------
AEP.spin = function (super_) {
  if (!this.ctx || this.ctx.state !== 'running') return;
  const t = this.ctx.currentTime;
  const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = super_ ? 0.8 : 1.3;
  const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
  f.frequency.setValueAtTime(600, t);
  f.frequency.exponentialRampToValueAtTime(super_ ? 5200 : 3800, t + (super_ ? 0.7 : 0.3));
  const g = this._env(t, 0.01, super_ ? 0.75 : 0.32, super_ ? 0.22 : 0.14);
  s.connect(f); f.connect(g); g.connect(this.sfxBus); g.connect(this.verbSend);
  s.start(t, Math.random()); s.stop(t + (super_ ? 0.9 : 0.45));
  this._pluck(t, st(ROOT * 2, 7), 0.2, 'square', 0.05, 4000, true);
};
AEP.slam = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  const o = this.ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(30, t + 0.25);
  const g = this._env(t, 0.004, 0.4, 0.4);
  o.connect(g); g.connect(this.sfxBus);
  o.start(t); o.stop(t + 0.5);
  const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
  const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
  const g2 = this._env(t, 0.002, 0.3, 0.25);
  s.connect(f); f.connect(g2); g2.connect(this.sfxBus); g2.connect(this.verbSend);
  s.start(t, Math.random()); s.stop(t + 0.4);
};
AEP.seedSpit = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  this._pluck(t, st(ROOT * 3, 5), 0.12, 'square', 0.09, 3000);
  this._gliss(t, 900, 1800, 0.09, 0.06);
};
AEP.slide = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
  const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 1;
  const g = this._env(t, 0.01, 0.3, 0.1);
  s.connect(f); f.connect(g); g.connect(this.sfxBus);
  s.start(t, Math.random()); s.stop(t + 0.4);
};
AEP.slideJump = function () { this._gliss(this.ctx?.currentTime ?? 0, 500, 1400, 0.15, 0.1); };
AEP.grapple = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  this._gliss(t, 1400, 500, 0.12, 0.1);
  this._pluck(t + 0.1, st(ROOT * 2, 10), 0.3, 'triangle', 0.1, 4000, true);
};
AEP.timeDash = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = 2;
  const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.setValueAtTime(400, t);
  f.frequency.exponentialRampToValueAtTime(6000, t + 0.15);
  const g = this._env(t, 0.005, 0.22, 0.16);
  s.connect(f); f.connect(g); g.connect(this.sfxBus); g.connect(this.delaySend);
  s.start(t, Math.random()); s.stop(t + 0.3);
};
AEP.doubleJump = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  this._pluck(t, st(ROOT * 2, 12), 0.2, 'triangle', 0.12, 5000, true);
  this._pluck(t + 0.05, st(ROOT * 2, 19), 0.25, 'triangle', 0.09, 5000, true);
};
AEP.bounce = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  const o = this.ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(300, t);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.12);
  const g = this._env(t, 0.005, 0.18, 0.14);
  o.connect(g); g.connect(this.sfxBus);
  o.start(t); o.stop(t + 0.25);
};

// --- collectibles -------------------------------------------------------------
AEP.podBreak = function (variant) {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = 1.4;
  const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.8;
  const g = this._env(t, 0.003, 0.18, 0.2);
  s.connect(f); f.connect(g); g.connect(this.sfxBus); g.connect(this.verbSend);
  s.start(t, Math.random()); s.stop(t + 0.25);
  // each variant sings its own little interval
  const iv = { normal: 0, time: 7, bounce: 5, armored: 3, spore: 1, countdown: 6, phase: 10, quantum: 11, musical: 12, heavy: 2, grapple: 8, dash: 9, seedTarget: 4 }[variant] ?? 0;
  this._pluck(t, st(ROOT * 3, iv), variant === 'musical' ? 0.5 : 0.2, 'triangle', 0.1, 5000, true);
  if (variant === 'musical') {
    [7, 12, 17].forEach((n, i) => this._pluck(t + 0.07 * (i + 1), st(ROOT * 3, n), 0.3, 'triangle', 0.08, 5000, true));
  }
};
AEP.pollen = function (n) {
  if (!this.ctx || this.ctx.state !== 'running') return;
  if (n % 3 !== 0) return;   // thin the stream musically
  const t = this.ctx.currentTime;
  const idx = (n / 3) % PENTA.length;
  this._pluck(t, st(ROOT * 4, PENTA[idx]), 0.16, 'sine', 0.05, 7000, true);
};
AEP.shardGet = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  [0, 7, 12, 19, 24].forEach((iv, i) => {
    this._pluck(t + i * 0.06, st(ROOT * 3, iv), 0.5, 'triangle', 0.1, 6000, true);
  });
};
AEP.secret = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  // mysterious descending tritone shimmer
  [12, 6, 0].forEach((iv, i) => this._pluck(t + i * 0.12, st(ROOT * 2, iv), 0.7, 'sine', 0.12, 4000, true));
  this._gliss(t, 2000, 300, 0.6, 0.05);
};
AEP.hourglass = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  this._pluck(t, st(ROOT * 3, 0), 0.2, 'sine', 0.1, 5000, true);
  this._pluck(t + 0.08, st(ROOT * 3, 7), 0.3, 'sine', 0.1, 5000, true);
};

// --- flow ----------------------------------------------------------------------
AEP.perfectTick = function (count) {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  const idx = Math.max(0, Math.min(Math.floor(count), PENTA.length - 1)) | 0;
  this._pluck(t, st(ROOT * 4, PENTA[idx]), 0.12, 'sine', 0.07, 8000);
};
AEP.flowStart = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  [0, 3, 7, 12, 15, 19].forEach((iv, i) => {
    this._pluck(t + i * 0.05, st(ROOT * 2, iv), 0.6, 'triangle', 0.09, 6000, true);
  });
};
AEP.flowEnd = function () { };
AEP.flowBreak = function (count) {
  if (!this.ctx) return;
  this._gliss(this.ctx.currentTime, 900, 250, 0.3, 0.06);
};

// --- enemies & boss ---------------------------------------------------------------
AEP.enemyDie = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  this._pluck(t, st(ROOT, 7), 0.15, 'square', 0.1, 2000);
  this._gliss(t, 800, 200, 0.15, 0.08);
};
AEP.spit = function () { this._gliss(this.ctx?.currentTime ?? 0, 600, 900, 0.08, 0.05); };
AEP.reflect = function () { this._gliss(this.ctx?.currentTime ?? 0, 1800, 600, 0.1, 0.09); };
AEP.creak = function () { this._gliss(this.ctx?.currentTime ?? 0, 140, 90, 0.3, 0.07); };
AEP.bossRoar = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  const o = this.ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(80, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 1.2);
  const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
  const g = this._env(t, 0.05, 1.4, 0.3);
  o.connect(f); f.connect(g); g.connect(this.sfxBus); g.connect(this.verbSend);
  o.start(t); o.stop(t + 1.6);
  this.tension = 1;
};
AEP.bossHit = function (n) {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  this._pluck(t, st(ROOT, -5), 0.3, 'sine', 0.25, 400);
  [0, 5, 9].forEach((iv, i) => this._pluck(t + i * 0.07, st(ROOT * 2, iv + n * 2), 0.4, 'square', 0.08, 3000, true));
};
AEP.bossTired = function () {
  if (!this.ctx) return;
  this._gliss(this.ctx.currentTime, 600, 220, 0.5, 0.1);
};
AEP.bossDown = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  PENTA.slice(0, 8).reverse().forEach((n, i) => {
    this._pluck(t + i * 0.1, st(ROOT * 2, n), 0.8, 'triangle', 0.1, 6000, true);
  });
  this.tension = 0;
};
AEP.ceremony = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  // the new motif — rising gene arpeggio
  [0, 3, 7, 10, 12, 15, 19, 24].forEach((iv, i) => {
    this._pluck(t + i * 0.11, st(ROOT * 2, iv), 1.0, 'triangle', 0.11, 6000, true);
  });
  this._pluck(t + 0.9, st(ROOT, 0), 2.0, 'sine', 0.16, 800);
};
AEP.portalEnter = function () {
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  this._gliss(t, 200, 3200, 0.7, 0.14);
  [0, 7, 12].forEach((iv, i) => this._pluck(t + 0.3 + i * 0.09, st(ROOT * 3, iv), 0.8, 'sine', 0.1, 6000, true));
};
AEP.chaseHeart = function (on) {
  this._chase = on;
  if (this.ctx && on) this.tension = 1;
};
