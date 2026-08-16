// =============================================================================
// MANDELHOP — world.js (infinite descent edition)
// Pooled row strips (grass / chevron road / river bed), bank lips, portal &
// mirror pillars, world-following base slab, side walls, drifting spores,
// and scene lighting with live per-frame theme blending.
// =============================================================================
import * as THREE from 'three';
import { rowToZ, PORTAL_X } from './config.js';

function hsl(h, s, l) { return new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l); }

const CHEV_VERT = /* glsl */`
  varying vec3 vWP;
  void main() {
    vWP = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const CHEV_FRAG = /* glsl */`
  uniform vec3 uCol, uChev, uFogColor;
  uniform float uTime, uSpeed, uDir, uFogDensity, uPulse;
  varying vec3 vWP;
  void main() {
    vec3 col = uCol;
    float sp = uSpeed * uPulse;
    float edge = smoothstep(0.36, 0.44, abs(fract(vWP.z + 0.5) - 0.5));
    float dash = step(0.5, fract(vWP.x * 0.5 - uTime * sp * uDir * 0.4));
    float ch = fract((vWP.x * uDir - uTime * sp * uDir) * 0.33 + abs(fract(vWP.z + 0.5) - 0.5) * 0.8);
    float chevron = smoothstep(0.08, 0.02, abs(ch - 0.5)) * 0.5;
    col += uChev * (chevron * 0.35 + edge * dash * 0.12);
    float depth = length(cameraPosition - vWP);
    float f = 1.0 - exp(-uFogDensity * uFogDensity * depth * depth);
    gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
  }
`;

export class World {
  constructor(scene) {
    this.scene = scene;

    // lighting
    this.hemi = new THREE.HemisphereLight(0x8a6cff, 0x1a3d24, 0.72);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 1.35);
    this.sun.position.set(5, 10, 4);
    this.glow1 = new THREE.PointLight(0xff7ecb, 12, 14, 1.8);
    this.glow2 = new THREE.PointLight(0x59f2e6, 12, 14, 1.8);
    this.glow3 = new THREE.PointLight(0xffd76e, 7, 10, 1.8);   // foreground warmth
    scene.add(this.hemi, this.sun, this.glow1, this.glow2, this.glow3);

    // pools
    this.stripGeo = new THREE.BoxGeometry(30, 0.3, 1.0);
    this.bankGeo = new THREE.BoxGeometry(30, 0.36, 0.18);
    this.pillarGeo = new THREE.BoxGeometry(0.2, 1.4, 0.2);
    this._matPool = [];
    this._chevPool = [];
    this._bankMatPool = [];
    this._pillarMatPool = [];
    this._strips = [];   // free meshes
    this._banks = [];
    this._pillars = [];
    this.activeChevrons = new Set();

    // followers: base slab, side walls, spores
    this.base = new THREE.Mesh(new THREE.BoxGeometry(46, 0.2, 170),
      new THREE.MeshStandardMaterial({ color: 0x0a2015, roughness: 0.95 }));
    this.base.position.y = -0.12;   // below row strips
    scene.add(this.base);
    this.walls = [];
    this.crystals = [];
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1430, roughness: 0.95 });
    this.crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0xff7ecb, roughness: 0.15, emissive: 0xaa3377, emissiveIntensity: 1.2,
      transparent: true, opacity: 0.92,
    });
    this.trimMat = new THREE.MeshBasicMaterial({ color: 0x66f2ff, transparent: true, opacity: 0.55 });
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 110), wallMat);
      wall.position.set(s * 8.2, -0.5, -20);
      scene.add(wall); this.walls.push(wall);
      // glowing terrace trim — turns barriers into garden architecture
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 110), this.trimMat);
      trim.position.set(s * 6.55, 0.33, -20);
      scene.add(trim); this.walls.push(trim);
      for (let i = 0; i < 6; i++) {
        const cry = new THREE.Mesh(new THREE.OctahedronGeometry(0.2 + (i % 3) * 0.12, 0), this.crystalMat);
        cry.position.set(s * (7.6 + (i % 2) * 0.9), 0.3 + (i % 3) * 0.3, -i * 9 - 2);
        cry.userData.spin = 0.4 + i * 0.1;
        scene.add(cry); this.crystals.push(cry);
      }
    }
    this.wallMat = wallMat;

    // drifting spores (follow frog)
    const N = 260;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), phase = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = 0.3 + Math.random() * 4;
      pos[i * 3 + 2] = 8 - Math.random() * 48;
      phase[i] = Math.random() * Math.PI * 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.sporeUniforms = { uTime: { value: 0 }, uBeat: { value: 0 }, uCol: { value: new THREE.Color(0xffe066) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.sporeUniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float aPhase;
        uniform float uTime, uBeat;
        varying float vA;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.3 + aPhase) * 0.8;
          p.y += sin(uTime * 0.45 + aPhase * 2.0) * 0.5;
          p.z += cos(uTime * 0.22 + aPhase) * 0.6;
          vA = 0.35 + 0.3 * sin(uTime * 1.4 + aPhase * 3.0) + uBeat * 0.3;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (20.0 + uBeat * 12.0) / max(1.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uCol;
        varying float vA;
        void main() {
          float m = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5));
          gl_FragColor = vec4(uCol, m * vA);
        }
      `,
    });
    this.spores = new THREE.Points(geo, mat);
    this.spores.frustumCulled = false;
    scene.add(this.spores);
  }

  // ---- per-frame live theme (th fields are THREE.Color) ----
  applyLiveTheme(th, fogRef) {
    this.hemi.color.copy(th.hemiSky);
    this.hemi.groundColor.copy(th.hemiGround);
    this.sun.color.copy(th.sun);
    this.glow1.color.copy(th.skyBot);
    this.glow2.color.copy(th.waterShallow);
    this.sporeUniforms.uCol.value.copy(th.accent);
    fogRef.color.copy(th.fog);
    fogRef.density = th.fogDensity;
    this.base.material.color.copy(th.grass).multiplyScalar(0.35);
    this.wallMat.color.copy(th.vegHue !== undefined ? hsl(th.vegHue, 0.4, 0.14) : th.grass);
    this.crystalMat.color.copy(hsl(th.flowerHue, 0.8, 0.5));
    this.trimMat.color.copy(th.accent);
    this.crystalMat.emissive.copy(hsl(th.flowerHue, 0.9, 0.32));
  }

  // ---- pool helpers ----
  _mat(color, rough = 0.9) {
    const m = this._matPool.pop() || new THREE.MeshStandardMaterial({ roughness: 0.9 });
    m.color.set(color); m.roughness = rough;
    return m;
  }
  _strip() { return this._strips.pop() || new THREE.Mesh(this.stripGeo); }
  _bank() { return this._banks.pop() || new THREE.Mesh(this.bankGeo); }
  _pillar() { return this._pillars.pop() || new THREE.Mesh(this.pillarGeo); }
  _chev() {
    const m = this._chevPool.pop() || new THREE.ShaderMaterial({
      uniforms: {
        uCol: { value: new THREE.Color() }, uChev: { value: new THREE.Color() },
        uTime: { value: 0 }, uSpeed: { value: 1 }, uDir: { value: 1 }, uPulse: { value: 1 },
        uFogColor: { value: new THREE.Color() }, uFogDensity: { value: 0.03 },
      },
      vertexShader: CHEV_VERT, fragmentShader: CHEV_FRAG,
    });
    this.activeChevrons.add(m);
    return m;
  }

  // ---- row visuals (theme st = plain static object with hex/colors) ----
  buildRowVisual(row, st, fogRef) {
    const vis = row.vis = { strips: [], banks: [], pillars: [], chev: null, mats: [] };
    const z = rowToZ(row.r);
    if (row.type === 'road') {
      const m = this._strip();
      const chev = this._chev();
      chev.uniforms.uCol.value.set(st.road);
      chev.uniforms.uChev.value.set(st.accent).multiplyScalar(0.5);
      chev.uniforms.uDir.value = row.dir;
      chev.uniforms.uSpeed.value = row.speed;
      chev.uniforms.uFogColor.value.copy(fogRef.color);
      chev.uniforms.uFogDensity.value = fogRef.density;
      m.material = chev;
      m.position.set(0, -0.15, z);
      this.scene.add(m);
      vis.strips.push(m); vis.chev = chev;
    } else {
      const m = this._strip();
      if (row.type === 'river') {
        m.material = this._mat(new THREE.Color(st.waterDeep).multiplyScalar(0.85).lerp(new THREE.Color(st.waterShallow), 0.25));
        m.position.set(0, -0.62, z);
      } else {
        const c = new THREE.Color(st.grass);
        if (row.type === 'checkpoint') c.lerp(new THREE.Color(st.accent), 0.25);
        if (row.mirror) c.lerp(new THREE.Color(0x8844ff), 0.35);
        m.material = this._mat(c);
        m.position.set(0, -0.15, z);
      }
      vis.mats.push(m.material);
      this.scene.add(m);
      vis.strips.push(m);
    }
    // portal / mirror pillars
    if (row.wrap || row.mirror) {
      const color = row.wrap ? 0x7dffb0 : 0xbb66ff;
      for (const s of [-1, 1]) {
        const p = this._pillar();
        p.material = this._pillarMatPool.pop() || new THREE.MeshBasicMaterial({});
        p.material.color.set(color);
        p.material.transparent = true; p.material.opacity = 0.85;
        p.position.set(s * (PORTAL_X - 0.35), 0.7, z);
        this.scene.add(p);
        vis.pillars.push(p);
      }
    }
  }

  // bank lip between a river row and a non-river neighbor (dz = +0.5 / -0.5)
  addBankLip(row, dz, st) {
    const b = this._bank();
    b.material = this._bankMatPool.pop() || new THREE.MeshStandardMaterial({ roughness: 0.9 });
    b.material.color.set(st.bank);
    b.position.set(0, -0.16, rowToZ(row.r) + dz);
    this.scene.add(b);
    row.vis.banks.push(b);
  }

  releaseRow(row) {
    const vis = row.vis;
    if (!vis) return;
    for (const m of vis.strips) {
      this.scene.remove(m);
      if (vis.chev && m.material === vis.chev) {
        this.activeChevrons.delete(vis.chev);
        this._chevPool.push(vis.chev);
      } else {
        m.material.roughness = 0.9;
        this._matPool.push(m.material);
      }
      this._strips.push(m);
    }
    for (const b of vis.banks) { this.scene.remove(b); this._bankMatPool.push(b.material); this._banks.push(b); }
    for (const p of vis.pillars) { this.scene.remove(p); this._pillarMatPool.push(p.material); this._pillars.push(p); }
    row.vis = null;
  }

  setCorridor(on) {
    for (const w of this.walls) w.visible = on;
    for (const c of this.crystals) c.visible = on;
    this.base.visible = on;
  }

  setTrimColor(c) { this.trimMat.color.set(c); }

  update(t, beat, frogZ) {
    this.sporeUniforms.uTime.value = t;
    this.sporeUniforms.uBeat.value = beat;
    for (const m of this.activeChevrons) m.uniforms.uTime.value = t;
    this.base.position.z = frogZ - 18;   // covers well behind the camera
    this.spores.position.z = frogZ;
    for (const w of this.walls) w.position.z = frogZ - 18;
    for (const c of this.crystals) {
      c.rotation.y = t * c.userData.spin;
      c.rotation.x = t * c.userData.spin * 0.6;
      if (c.position.z > frogZ + 8) c.position.z -= 54;   // leapfrog ahead
      else if (c.position.z < frogZ - 48) c.position.z += 54;
    }
    this.glow1.position.set(-4, 1.5, frogZ - 4);
    this.glow2.position.set(4, 1.5, frogZ - 9);
    this.glow3.position.set(2.5, 1.2, frogZ + 5);
    this.glow1.intensity = 10 + beat * 5 + Math.sin(t * 1.3) * 2;
    this.glow2.intensity = 10 + beat * 5 + Math.cos(t * 1.1) * 2;
    this.glow3.intensity = 6 + beat * 3;
  }
}
