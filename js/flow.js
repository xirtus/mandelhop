// =============================================================================
// MANDELHOP — flow.js  ★ HOP FLOW → FLOW STATE
// Perfectly chained landings build FLOW. At full flow the level becomes an
// instrument: percussion layers in, flowers open, grass pulses, fractals spin,
// water ripples sync, score doubles. Breaking rhythm collapses it gracefully.
// =============================================================================

export class Flow {
  constructor(ctx) {
    Object.assign(this, ctx);   // audio, effects, ui, veg, water
    this.count = 0;             // chained perfect landings
    this.flow01 = 0;            // smoothed 0..1
    this.lastLand = -10;
    this.state = false;         // FLOW STATE active
    this.beatGrace = 0.16;      // |land−beat| window for "perfect"
    this.chainGrace = 0.5;      // max gap between hop chains
  }

  reset() {
    if (this.count > 3) this.audio?.flowBreak?.(this.count);
    this.count = 0;
  }

  // called on every landing. t = sim time, beatPhase01 = 1→0 pulse each beat
  onLand(t, beatPhase01, movedForward) {
    const gap = t - this.lastLand;
    this.lastLand = t;
    // beat-perfect: land near beat start (phase near 1 or 0)
    const dBeat = Math.min(beatPhase01, 1 - beatPhase01); // distance to beat edge
    const perfect = dBeat < this.beatGrace || dBeat > (1 - this.beatGrace);
    if (movedForward && gap < this.chainGrace + 0.35) {
      this.count += perfect ? 2 : 1;
      if (perfect) {
        this.effects?.sparkle?.(this._fx ?? 0, this._fz ?? 0, 0xffe066);
        this.audio?.perfectTick?.(this.count);
      }
    } else if (movedForward) {
      this.count = Math.max(1, Math.floor(this.count * 0.3));
    } else {
      this.count = Math.max(0, this.count - 2);
    }
    const wasFlow = this.state;
    this.state = this.count >= 8;
    if (this.state && !wasFlow) {
      this.audio?.flowStart?.();
      this.ui?.banner?.('FLOW STATE', 'the garden plays with you', 1600);
      this.effects?.flowBloom?.(this._fx ?? 0, this._fz ?? 0);
    }
    if (perfect || this.state) this.veg?.bloom?.(this._fx ?? 0, this._fz ?? 0);
  }

  setFrog(x, z) { this._fx = x; this._fz = z; }

  get multiplier() { return this.state ? 2 : 1; }

  update(t, dt) {
    // decay if no landing for a while
    if (t - this.lastLand > 1.4) this.count = Math.max(0, this.count - dt * 3.2);
    if (this.state && this.count < 5) { this.state = false; this.audio?.flowEnd?.(); }
    const target = Math.min(1, this.count / 10);
    this.flow01 += (target - this.flow01) * Math.min(1, dt * 3.5);
    this.audio?.setFlow?.(this.flow01, this.state);
    this.ui?.setFlow?.(this.flow01, this.state);
  }
}
