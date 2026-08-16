// =============================================================================
// MANDELHOP — ghost.js  ★ TIME RUN: stopwatch, time pods, ghosts, relics
// Every stage doubles as a speedrun course. Runs are recorded at 12Hz and the
// best run replays as a translucent temporal frog with a fractal ribbon.
// =============================================================================
import * as THREE from 'three';
import { relicFor, RELIC_LABEL } from './stages.js';

const HZ = 12, MAX_SAMPLES = 12 * 360;   // 6 min cap

export class Trial {
  constructor(ctx) {
    Object.assign(this, ctx);   // scene, ui, audio
    this.active = false;
    this.t = 0;
    this.freezeBonus = 0;       // timer frozen countdown
    this.record = [];
    this._acc = 0;
    this.ghost = null;          // {samples, i} playback
    this._buildGhostMesh();
  }

  _buildGhostMesh() {
    // elegant translucent temporal frog + ribbon trail
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9fd8ff, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), mat);
    body.scale.set(1, 0.78, 1.12); body.position.y = 0.26;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), mat);
    head.position.set(0, 0.44, -0.2);
    g.add(body, head);
    g.visible = false;
    this.scene.add(g);
    this.ghostMesh = g;

    // ribbon: dynamic line strip
    this.ribbonN = 90;
    const geo = new THREE.BufferGeometry();
    this.ribbonPos = new Float32Array(this.ribbonN * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.ribbonPos, 3));
    this.ribbon = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0x66f2ff, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.ribbon.frustumCulled = false;
    this.ribbon.visible = false;
    this.scene.add(this.ribbon);
  }

  beginRecord() {   // normal runs also record — ghosts everywhere
    this.record = [];
    this._acc = 0;
    this._passive = true;
    this._passiveT0 = performance.now();
  }

  start(stageId, ghostSamples) {
    this._passive = false;
    this.active = true;
    this.t = 0; this.freezeBonus = 0;
    this.record = [];
    this._acc = 0;
    this.stageId = stageId;
    this.ghost = ghostSamples && ghostSamples.length > 4 ? { samples: ghostSamples, i: 0 } : null;
    this.ghostMesh.visible = !!this.ghost;
    this.ribbon.visible = !!this.ghost;
    this.ui.showStopwatch(true);
  }

  stop() {
    this.active = false;
    this.ghostMesh.visible = false;
    this.ribbon.visible = false;
    this.ui.showStopwatch(false);
  }

  addTime(sec) { this.t = Math.max(0, this.t - sec); this.ui.popstop?.(`−${sec}s`); }
  freezeTimer(sec) { this.freezeBonus = sec; }

  update(dt, frogPos) {
    if (!this.active) {
      // passive recording for future ghosts
      if (this._passive) {
        this._acc += dt;
        if (this._acc >= 1 / HZ && this.record.length < MAX_SAMPLES) {
          this._acc = 0;
          this.record.push([+((performance.now() - this._passiveT0) / 1000).toFixed(3), +frogPos.x.toFixed(2), +frogPos.y.toFixed(2), +frogPos.z.toFixed(2)]);
        }
      }
      return;
    }
    if (this.freezeBonus > 0) this.freezeBonus -= dt;
    else this.t += dt;
    this.ui.setStopwatch(this.t, this.freezeBonus > 0);
    // record
    this._acc += dt;
    if (this._acc >= 1 / HZ && this.record.length < MAX_SAMPLES) {
      this._acc = 0;
      this.record.push([+this.t.toFixed(3), +frogPos.x.toFixed(2), +frogPos.y.toFixed(2), +frogPos.z.toFixed(2)]);
    }
    // ghost playback
    if (this.ghost) {
      const s = this.ghost.samples;
      while (this.ghost.i < s.length - 1 && s[this.ghost.i + 1][0] <= this.t) this.ghost.i++;
      const i = this.ghost.i;
      const a = s[i], b = s[Math.min(i + 1, s.length - 1)];
      const k = b[0] > a[0] ? (this.t - a[0]) / (b[0] - a[0]) : 0;
      const x = a[1] + (b[1] - a[1]) * k, y = a[2] + (b[2] - a[2]) * k, z = a[3] + (b[3] - a[3]) * k;
      this.ghostMesh.position.set(x, y, z);
      // ribbon: last N samples up to i
      const n = Math.min(this.ribbonN, i + 1);
      for (let j = 0; j < this.ribbonN; j++) {
        const si = Math.max(0, i - (this.ribbonN - 1 - j));
        this.ribbonPos[j * 3] = s[si][1];
        this.ribbonPos[j * 3 + 1] = s[si][2] + 0.25 + (j < this.ribbonN - n ? -50 : 0);
        this.ribbonPos[j * 3 + 2] = s[si][3];
      }
      this.ribbon.geometry.attributes.position.needsUpdate = true;
    }
  }

  finish(stage) {
    const time = this.t;
    const relic = relicFor(stage, time);
    this.stop();
    return { time, relic, samples: this.record.slice(0, MAX_SAMPLES) };
  }
}
