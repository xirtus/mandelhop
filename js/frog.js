// =============================================================================
// MANDELHOP — frog.js
// A tiny jewel-like living creature: procedural body, glossy wet skin with
// iridescence & clearcoat, golden eyes that look where it hops, blinking,
// breathing, anticipation squash → elastic stretch → landing compression,
// splayed toes, death by flattening or drowning.
// =============================================================================
import * as THREE from 'three';
import { HOP_H } from './config.js';

export class Frog {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.inner = new THREE.Group();      // squash/stretch applied here
    this.group.add(this.inner);
    this.hop = null;
    this.dying = null;
    this.blinkT = 2;
    this.lookTarget = new THREE.Vector2(0, -1);
    this.baseY = 0;

    const skin = this.skinMat = new THREE.MeshPhysicalMaterial({
      color: 0x46ff7e, roughness: 0.28, metalness: 0.0,
      clearcoat: 1.0, clearcoatRoughness: 0.18,
      iridescence: 0.65, iridescenceIOR: 1.3,
      sheen: 0.4, sheenColor: 0x88ffcc,
      envMapIntensity: 0.5,
    });
    const belly = new THREE.MeshPhysicalMaterial({
      color: 0xd8ffb0, roughness: 0.5, clearcoat: 0.6, envMapIntensity: 0.4,
    });

    // body
    const body = this.body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18), skin);
    body.scale.set(1, 0.78, 1.12);
    body.position.y = 0.26;
    this.inner.add(body);

    const bellyM = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 12), belly);
    bellyM.scale.set(0.85, 0.6, 1.0);
    bellyM.position.set(0, 0.19, -0.03);
    this.inner.add(bellyM);

    // head
    const head = this.head = new THREE.Group();
    head.position.set(0, 0.42, -0.22);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), skin);
    skull.scale.set(1.1, 0.85, 0.9);
    head.add(skull);

    // eyes: golden iris, black pupil, on stalks
    this.eyes = [];
    const eyeWhite = new THREE.MeshPhysicalMaterial({ color: 0xffd94d, roughness: 0.15, clearcoat: 1 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a0510 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), eyeWhite);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), pupilMat);
      pupil.position.set(0, 0.03, -0.055);
      eye.add(ball, pupil);
      eye.position.set(s * 0.115, 0.12, -0.05);
      head.add(eye);
      this.eyes.push({ group: eye, pupil });
    }
    this.inner.add(head);

    // legs — back thighs big, feet with toes
    this.legs = [];
    const mkLeg = (s, back) => {
      const leg = new THREE.Group();
      const thigh = new THREE.Mesh(new THREE.SphereGeometry(back ? 0.13 : 0.07, 12, 10), skin);
      thigh.scale.set(0.8, 0.7, 1.3);
      leg.add(thigh);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skin);
      foot.scale.set(1, 0.4, 1.6);
      foot.position.set(0, -0.08, back ? 0.16 : -0.12);
      leg.add(foot);
      for (let tI = -1; tI <= 1; tI++) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), skin);
        toe.position.set(tI * 0.05, -0.1, (back ? 0.24 : -0.2));
        leg.add(toe);
      }
      leg.position.set(s * (back ? 0.26 : 0.16), 0.14, back ? 0.14 : -0.24);
      this.inner.add(leg);
      this.legs.push({ group: leg, back, side: s });
      return leg;
    };
    mkLeg(-1, true); mkLeg(1, true); mkLeg(-1, false); mkLeg(1, false);

    // dorsal spots
    const spotMat = new THREE.MeshBasicMaterial({ color: 0x0a3d1e });
    for (let i = 0; i < 7; i++) {
      const spot = new THREE.Mesh(new THREE.SphereGeometry(0.02 + (i % 3) * 0.008, 6, 5), spotMat);
      const a = i * 2.4;
      spot.position.set(Math.cos(a) * 0.16, 0.42, Math.sin(a) * 0.18 + 0.02);
      spot.scale.y = 0.4;
      this.inner.add(spot);
    }

    scene.add(this.group);
    this.group.scale.setScalar(1.22);   // jewel-like but READABLE
  }

  setTheme(t) {
    this.skinMat.color.setHex(t.frog);
    this.skinMat.sheenColor.setHex(t.accent);
  }

  // --- hopping -----------------------------------------------------------------
  startHop(from, to, dur, onLand) {
    this.hop = { from: from.clone(), to: to.clone(), t: 0, dur, onLand };
    const d = to.clone().sub(from);
    this.yawFrom = this.group.rotation.y;
    this.yawTo = Math.atan2(-d.x, -d.z);
    this.lookTarget.set(d.x, d.z).normalize();
  }

  get isHopping() { return !!this.hop; }

  kill(type, onDone) {
    this.dying = { type, t: 0, dur: type === 'water' ? 1.0 : type === 'ascend' ? 1.3 : 0.8, onDone };
  }

  revive(pos) {
    this.dying = null; this.hop = null;
    this.group.position.copy(pos);
    this.group.rotation.set(0, 0, 0);
    this.group.visible = true;
    this.inner.scale.set(1, 1, 1);
    this.inner.position.y = 0;
  }

  update(t, dt) {
    const g = this.group, inner = this.inner;

    if (this.dying) {
      const d = this.dying;
      d.t += dt;
      const t01 = Math.min(1, d.t / d.dur);
      if (d.type === 'water') {
        inner.position.y = -t01 * 0.9;
        inner.scale.setScalar(1 - t01 * 0.5);
        g.rotation.y += dt * 9;
      } else if (d.type === 'ascend') {
        // completion: levitate, spin gently, dissolve upward into light
        inner.position.y = t01 * 2.2;
        inner.scale.setScalar(Math.max(0.01, 1 - t01 * 0.9));
        g.rotation.y += dt * 3.5;
      } else {
        // flattened — dramatic squash with slight spin-up pop
        inner.scale.set(1 + t01 * 1.4, Math.max(0.08, 1 - t01 * 1.1), 1 + t01 * 1.4);
        inner.position.y = -t01 * 0.05;
      }
      if (t01 >= 1 && d.onDone) { const cb = d.onDone; d.onDone = null; cb(); }
      return;
    }

    if (this.hop) {
      const h = this.hop;
      h.t += dt / h.dur;
      const t01 = Math.min(1, h.t);
      // anticipation → flight → land easing
      const e = t01 < 0.18 ? (t01 / 0.18) * 0.12 : 0.12 + (t01 - 0.18) / 0.82 * 0.88;
      g.position.lerpVectors(h.from, h.to, e);
      const arc = Math.sin(Math.PI * Math.max(0, (e - 0.12) / 0.88));
      g.position.y += arc * HOP_H;   // additive arc over the from→to height blend
      // rotation: face target, with a little pitch-up mid-flight
      let dy = h.to.x !== h.from.x || h.to.z !== h.from.z ? this.yawTo : g.rotation.y;
      let diff = dy - this.yawFrom;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      g.rotation.y = this.yawFrom + diff * Math.min(1, t01 * 3);
      // squash & stretch: crouch early, stretch mid, compress on land
      let sy, sxz;
      if (t01 < 0.18) { const k = t01 / 0.18; sy = 1 - 0.25 * k; sxz = 1 + 0.15 * k; }
      else if (t01 < 0.85) { sy = 1.12; sxz = 0.92; }
      else { const k = (t01 - 0.85) / 0.15; sy = 1.12 - 0.42 * k; sxz = 0.92 + 0.28 * k; }
      inner.scale.set(sxz, sy, sxz);
      // legs: tuck during flight
      for (const l of this.legs) {
        const tuck = Math.sin(Math.PI * t01);
        l.group.rotation.x = (l.back ? 0.9 : -0.6) * tuck;
      }
      if (h.t >= 1) {
        const cb = h.onLand;
        this.hop = null;
        g.position.copy(h.to);
        this.landT = 0;               // triggers landing squash recovery
        if (cb) cb();
      }
    } else {
      // landing recovery (springy overshoot)
      if (this.landT !== undefined && this.landT < 0.3) {
        this.landT += dt;
        const k = this.landT / 0.3;
        const w = Math.sin(k * Math.PI * 2) * (1 - k) * 0.18;
        inner.scale.set(1 - w * 0.5, 1 + w, 1 - w * 0.5);
      } else {
        // idle breathing
        const br = Math.sin(t * 2.6) * 0.03;
        inner.scale.set(1 + br * 0.5, 1 + br, 1 + br * 0.5);
        inner.position.y = 0;
        for (const l of this.legs) l.group.rotation.x *= 0.8;
      }
    }

    // throat sac pulse
    this.head.scale.setScalar(1 + Math.sin(t * 2.6) * 0.03);

    // eyes look toward movement; blink
    this.blinkT -= dt;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3.5;
    const blink = this.blinkT < 0.12 ? 0.15 : 1;
    for (const e of this.eyes) {
      e.group.scale.y += (blink - e.group.scale.y) * 0.5;
      e.pupil.position.x += (this.lookTarget.x * 0.02 - e.pupil.position.x) * 0.2;
      e.pupil.position.y += (0.03 - this.lookTarget.y * 0.015 - e.pupil.position.y) * 0.2;
    }
  }
}
