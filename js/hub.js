// =============================================================================
// MANDELHOP — hub.js  ★ THE POND OUTSIDE TIME
// A serene impossible pond floating in recursive space — the warp room.
// Nine temporal gates on lily isles; each completed world wakes more of the
// hub: plants grow, creatures arrive, music thickens, fractals unfold.
// =============================================================================
import * as THREE from 'three';
import { rowToZ, colToX, HALF } from './config.js';
import { WORLDS, worldStages } from './stages.js';

function hsl(h, s, l) { return new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l); }

export class Hub {
  constructor(ctx) {
    Object.assign(this, ctx);   // scene, progress, ui, audio
    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);
    this.gates = [];            // {world, x, z, mesh, ring, lock}
    this.decor = [];            // awakening tiers
    this._built = false;
  }

  build(theme) {
    if (this._built) return;
    this._built = true;
    const g = this.group;

    // central isle — the First Lily
    const isleMat = new THREE.MeshPhysicalMaterial({ color: 0x1d6e4a, roughness: 0.5, clearcoat: 0.8 });
    const isle = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.35, 24), isleMat);
    isle.position.set(0, -0.05, 0);
    g.add(isle);
    // sacred-geometry inlay
    const inlay = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.9, 6),
      new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.y = 0.13;
    g.add(inlay);
    this.inlay = inlay;

    // nine gates in a 3×3 arc beyond the isle
    for (let w = 0; w < 9; w++) {
      const world = WORLDS[w];
      const col = (w % 3 - 1) * 4;
      const row = 3 + Math.floor(w / 3) * 3;
      const x = col, z = rowToZ(row);
      const gate = this._buildGate(world, theme);
      gate.root.position.set(x, 0, z);
      g.add(gate.root);
      this.gates.push({ world: w + 1, x, z, ...gate });
    }

    // the INFINITE BETWEEN gate (endless arcade) — to the side
    const inf = this._buildGate({ id: 0, name: 'THE INFINITE BETWEEN', hue: 0.5 }, theme, true);
    inf.root.position.set(-5.5, 0, rowToZ(1));
    inf.root.scale.setScalar(0.8);
    g.add(inf.root);
    this.infiniteGate = { world: 0, x: -5.5, z: rowToZ(1), ...inf };

    // ambient koi — drifting light fish under the pond surface
    this.koi = [];
    const koiMat = new THREE.MeshBasicMaterial({ color: 0x66f2ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 7; i++) {
      const k = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 6), koiMat);
      k.rotation.x = Math.PI / 2;
      k.userData = { a: Math.random() * Math.PI * 2, r: 3.5 + Math.random() * 4, sp: 0.2 + Math.random() * 0.3, y: -0.25 - Math.random() * 0.2 };
      g.add(k); this.koi.push(k);
    }

    // awakening decor tiers (revealed as worlds complete)
    const tiers = [
      () => this._addBloomRing(2.6, 8, 0.3),     // W1: flowers around isle
      () => this._addLanterns(4),                // W2: floating lanterns
      () => this._addBloomRing(5.2, 12, 0.55),
      () => this._addCrystals(6),                // W4
      () => this._addBloomRing(7.4, 16, 0.8),
      () => this._addLanterns(8),
      () => this._addCrystals(10),
      () => this._addBloomRing(9.2, 22, 0.95),
      () => this._addCrown(),                    // W9: the Pond remembers everything
    ];
    this.tierBuilders = tiers;
  }

  _buildGate(world, theme, isInfinite = false) {
    const root = new THREE.Group();
    const hue = world.hue ?? 0.8;
    // pad isle
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.55, 0.3, 10),
      new THREE.MeshPhysicalMaterial({ color: hsl(hue, 0.6, 0.28), roughness: 0.5, clearcoat: 0.7 }));
    pad.position.y = -0.02;
    root.add(pad);
    // tall swirling portal ring
    const ringMat = new THREE.MeshPhysicalMaterial({
      color: hsl(hue, 0.9, 0.5), emissive: hsl(hue, 1, 0.4), emissiveIntensity: 2,
      roughness: 0.25, clearcoat: 1, iridescence: 0.8,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.08, 10, 44), ringMat);
    ring.position.y = 1.25;
    root.add(ring);
    // swirling vortex disc
    const discMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uA: { value: hsl(hue, 1, 0.7) }, uB: { value: hsl(hue + 0.12, 1, 0.5) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uA, uB; varying vec2 vUv;
        void main(){
          float r = length(vUv); if (r>1.0) discard;
          float a = atan(vUv.y, vUv.x);
          float sw = sin(a*4.0 - uTime*3.0 + r*10.0)*0.5+0.5;
          vec3 col = mix(uA, uB, sw);
          gl_FragColor = vec4(col, smoothstep(1.0,0.8,r) * (0.3+0.6*sw));
        }`,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.86, 36), discMat);
    disc.position.y = 1.25;
    root.add(disc);
    // lock crystal (shown when locked)
    const lock = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.3, metalness: 0.8, transparent: true, opacity: 0.9 }));
    lock.position.y = 1.25;
    root.add(lock);
    // floating name label
    const label = this._makeLabel(world.name, isInfinite ? '#9fd8ff' : '#ffe9f6');
    label.position.y = 2.6;
    root.add(label);
    return { root, ring, disc, discMat, lock, ringMat, hue, isInfinite, label };
  }

  _makeLabel(text, color) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 72;
    const g = c.getContext('2d');
    g.font = '600 34px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 18;
    g.fillStyle = color;
    g.fillText(text, 256, 38);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.36),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    return m;
  }

  _addBloomRing(r, n, hue) {
    const grp = new THREE.Group();
    const pm = new THREE.MeshStandardMaterial({ color: hsl(hue, 0.85, 0.6), emissive: hsl(hue, 0.9, 0.35), emissiveIntensity: 1.4, roughness: 0.4 });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 5), pm);
      fl.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r - 4);
      fl.rotation.x = 0.4;
      grp.add(fl);
    }
    grp.userData.tier = this.decor.length;
    this.group.add(grp); this.decor.push(grp);
    return grp;
  }
  _addLanterns(n) {
    const grp = new THREE.Group();
    const lm = new THREE.MeshBasicMaterial({ color: 0xffd76e, transparent: true, opacity: 0.85 });
    for (let i = 0; i < n; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), lm);
      l.position.set((Math.random() - 0.5) * 14, 1.5 + Math.random() * 2, -Math.random() * 10);
      l.userData.ph = Math.random() * 6;
      grp.add(l);
    }
    grp.userData.tier = this.decor.length;
    grp.userData.lanterns = true;
    this.group.add(grp); this.decor.push(grp);
    return grp;
  }
  _addCrystals(n) {
    const grp = new THREE.Group();
    const cm = new THREE.MeshPhysicalMaterial({ color: 0xbb66ff, roughness: 0.15, emissive: 0x662299, emissiveIntensity: 1.2, transparent: true, opacity: 0.9 });
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.15 + Math.random() * 0.2, 0), cm);
      c.position.set((Math.random() - 0.5) * 16, 0.4 + Math.random() * 1.4, -2 - Math.random() * 9);
      c.userData.ph = Math.random() * 6;
      grp.add(c);
    }
    grp.userData.tier = this.decor.length;
    grp.userData.crystals = true;
    this.group.add(grp); this.decor.push(grp);
    return grp;
  }
  _addCrown() {
    // a slow-turning Mandelbrot crown above the isle
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4 + i * 0.5, 0.02, 6, 64), mat);
      ring.position.y = 3 + i * 0.4;
      ring.userData.spin = 0.3 + i * 0.2;
      grp.add(ring);
    }
    grp.userData.tier = this.decor.length;
    grp.userData.crown = true;
    this.group.add(grp); this.decor.push(grp);
    return grp;
  }

  enter() {
    this.group.visible = true;
    this.refresh();
  }
  exit() { this.group.visible = false; }

  // recompute locked/awakened state from progress
  refresh() {
    const done = WORLDS.filter(w => this.progress.stage(`w${w.id}s4`).done).length;
    // build decor lazily & toggle visibility
    if (this.tierBuilders) {
      for (let i = 0; i < this.tierBuilders.length; i++) {
        if (i < done && !this.decor[i]) this.tierBuilders[i]();
      }
    }
    for (let i = 0; i < this.decor.length; i++) this.decor[i].visible = i < done;
    for (const gate of this.gates) {
      const unlocked = this.progress.worldUnlocked(gate.world);
      const complete = this.progress.stage(`w${gate.world}s4`).done;
      gate.lock.visible = !unlocked;
      gate.ring.visible = unlocked;
      gate.disc.visible = unlocked;
      gate.ringMat.emissiveIntensity = complete ? 3.2 : unlocked ? 2 : 0.4;
      gate.complete = complete;
      gate.unlocked = unlocked;
    }
    this.audio?.setHubLayers?.(done);
  }

  // frog at (fx,row) — return gate it stands on, or null
  gateAt(fx, row) {
    const z = rowToZ(row);
    for (const gate of [...this.gates, this.infiniteGate]) {
      if (Math.abs(gate.x - fx) < 0.9 && Math.abs(gate.z - z) < 0.9) return gate;
    }
    return null;
  }

  update(t, dt, frogPos) {
    if (!this.group.visible) return;
    this.inlay.rotation.z = t * 0.1;
    for (const gate of [...this.gates, this.infiniteGate]) {
      gate.discMat.uniforms.uTime.value = t;
      gate.label.lookAt(frogPos.x * 0.3, 7.4, frogPos.z + 8.6);
      if (gate === this.infiniteGate) { gate.ring.rotation.y = t * 0.8; continue; }
      if (!gate.unlocked) { gate.lock.rotation.y = t * 0.5; continue; }
      gate.ring.rotation.y = t * 0.8;
    }
    for (const k of this.koi) {
      k.userData.a += dt * k.userData.sp;
      k.position.set(Math.cos(k.userData.a) * k.userData.r, k.userData.y, Math.sin(k.userData.a) * k.userData.r - 4);
      k.rotation.z = -k.userData.a - Math.PI / 2;
    }
    for (const d of this.decor) {
      if (!d.visible) continue;
      if (d.userData.lanterns || d.userData.crystals) {
        for (const c of d.children) {
          c.position.y += Math.sin(t * 1.2 + c.userData.ph) * 0.002;
          c.rotation.y = t * 0.4 + c.userData.ph;
        }
      }
      if (d.userData.crown) {
        for (const r of d.children) { r.rotation.x = t * r.userData.spin; r.rotation.y = t * r.userData.spin * 0.7; }
      }
    }
  }
}
