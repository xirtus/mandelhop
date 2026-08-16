// =============================================================================
// MANDELHOP — fractals.js (infinite descent edition)
// The kaleidoscopic Mandelbrot/Julia sky dome (camera-following, seed morphs
// between biomes — the sky IS the descent) and recursive L-system trees that
// leapfrog alongside the frog forever, tinted by the live biome blend.
// =============================================================================
import * as THREE from 'three';

function hsl(h, s, l) { return new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l); }

export class FractalWorld {
  constructor(scene) {
    this.scene = scene;

    this.skyUniforms = {
      uTime: { value: 0 },
      uTop: { value: new THREE.Color(0x12082b) },
      uMid: { value: new THREE.Color(0x4a1e6e) },
      uBot: { value: new THREE.Color(0xff7ecb) },
      uSeed: { value: new THREE.Vector2(-0.745, 0.113) },
      uBeat: { value: 0 },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uTop, uMid, uBot;
        uniform vec2 uSeed;
        uniform float uBeat;
        varying vec3 vDir;

        void main() {
          vec3 d = normalize(vDir);
          float az = atan(d.z, d.x);
          float el = d.y;
          float folds = 6.0;
          az = mod(az, 6.28318 / folds);
          az = abs(az - 3.14159 / folds);

          float zoom = 0.35 + 0.05 * sin(uTime * 0.05);
          vec2 c = uSeed + zoom * vec2(cos(az), sin(az)) * (0.4 + 0.9 * (1.0 - abs(el)));
          vec2 jc = uSeed + 0.08 * vec2(sin(uTime * 0.07), cos(uTime * 0.09));
          vec2 z = c;
          float m = 0.0;
          for (int i = 0; i < 48; i++) {
            z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + jc;
            if (dot(z, z) > 16.0) { m = float(i) / 48.0; break; }
            m = float(i) / 48.0;
          }
          float sm = m + 1.0 - log2(log(max(dot(z, z), 1.0001)) * 0.5) * 0.06;
          sm = fract(sm * 2.0 + uTime * 0.015);

          vec3 col = mix(uBot * 1.15, uMid, smoothstep(0.0, 0.45, sm));
          col = mix(col, uTop, smoothstep(0.45, 0.95, sm));
          float fil = pow(1.0 - abs(sm - 0.5) * 2.0, 4.0);
          col += uBot * fil * 1.1;
          col += uMid * pow(1.0 - abs(sm - 0.25) * 2.0, 6.0) * 0.5;
          col *= 0.75 + 0.5 * smoothstep(-0.2, 0.4, el);

          vec3 grad = mix(uBot, uTop, smoothstep(-0.3, 0.9, el));
          col = mix(grad, col, 0.72);

          float ring = sin(el * 18.0 - uTime * 0.5) * 0.5 + 0.5;
          col += uMid * ring * 0.12 * (1.0 + uBeat);
          col *= 1.25;

          vec2 sp = floor(d.xz / max(0.05, 1.0 - el) * 90.0);
          float star = step(0.998, fract(sin(dot(sp, vec2(12.9898, 78.233))) * 43758.5453));
          col += vec3(star) * smoothstep(0.35, 0.8, el) * (0.6 + 0.4 * sin(uTime * 2.0 + sp.x));

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(70, 40, 24), skyMat);
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    this.trees = null;
    this.barkMat = null;
    this.tipMat = null;
    this.tipBaseHue = 0.88;
    this._buildTrees();
  }

  // Live theme every frame; biome = { a, b, t, index } for the seed morph.
  applyTheme(th, biome) {
    this.skyUniforms.uTop.value.copy(th.skyTop);
    this.skyUniforms.uMid.value.copy(th.skyMid);
    this.skyUniforms.uBot.value.copy(th.skyBot);
    const aA = biome.index * 2.399963, aB = (biome.index + 1) * 2.399963;
    const sx = -0.745 + Math.cos(aA) * 0.12 * (1 - biome.t) + Math.cos(aB) * 0.12 * biome.t;
    const sy = 0.113 + Math.sin(aA) * 0.09 * (1 - biome.t) + Math.sin(aB) * 0.09 * biome.t;
    this.skyUniforms.uSeed.value.set(sx, sy);
    if (this.barkMat) {
      this.barkMat.color.copy(hsl(th.vegHue - 0.05, 0.5, 0.22));
      this.barkMat.emissive.copy(hsl(th.vegHue, 0.7, 0.15));
      this.tipBaseHue = th.flowerHue;
    }
  }

  _buildTrees() {
    this.trees = new THREE.Group();
    const barkMat = this.barkMat = new THREE.MeshStandardMaterial({
      color: 0x2a4a2a, roughness: 0.9, emissive: 0x1a5a2a, emissiveIntensity: 0.4,
    });
    const tipMat = this.tipMat = new THREE.MeshBasicMaterial({ color: 0xff7ecb });
    const segs = [], tips = [];
    const branch = (p, dir, len, rad, depth) => {
      const end = p.clone().addScaledVector(dir, len);
      segs.push([p.clone(), end, rad]);
      if (depth <= 0) { tips.push(end); return; }
      const n = depth > 2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const axis = new THREE.Vector3(Math.sin(i * 2.4 + depth), 0.3, Math.cos(i * 2.4 + depth)).normalize();
        const nd = dir.clone().applyAxisAngle(axis, 0.5 + i * 0.35).normalize();
        nd.y = Math.abs(nd.y) * 0.7 + 0.5; nd.normalize();
        branch(end, nd, len * 0.62, rad * 0.55, depth - 1);
      }
    };
    const treeBases = [];
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      treeBases.push(new THREE.Vector3(side * (8.6 + (i % 3)), 0, -1.5 - i * 5.5));
    }
    for (const b of treeBases) branch(b, new THREE.Vector3(0, 1, 0), 1.3, 0.09, 3);

    const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 5, 1);
    const bark = new THREE.InstancedMesh(cylGeo, barkMat, segs.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    segs.forEach((s, i) => {
      const mid = s[0].clone().add(s[1]).multiplyScalar(0.5);
      const dir = s[1].clone().sub(s[0]);
      const len = dir.length();
      q.setFromUnitVectors(up, dir.normalize());
      m4.compose(mid, q, new THREE.Vector3(s[2], len, s[2]));
      bark.setMatrixAt(i, m4);
    });
    this.trees.add(bark);

    const tipGeo = new THREE.IcosahedronGeometry(0.07, 0);
    const tipMesh = new THREE.InstancedMesh(tipGeo, tipMat, tips.length);
    tips.forEach((p, i) => {
      m4.compose(p, q.identity(), new THREE.Vector3(1, 1, 1).multiplyScalar(0.7 + (i % 3) * 0.3));
      tipMesh.setMatrixAt(i, m4);
    });
    this.trees.add(tipMesh);
    this.scene.add(this.trees);
  }

  update(t, dt, beat, camPos, frogZ) {
    this.skyUniforms.uTime.value = t;
    this.skyUniforms.uBeat.value = beat;
    if (camPos) this.sky.position.set(camPos.x, 0, camPos.z);
    if (this.trees) {
      // keep the forest bracketing the frog — smooth follow, snap if far
      const targetZ = frogZ - 18;
      this.trees.position.z += (targetZ - this.trees.position.z) * Math.min(1, dt * 2);
      if (Math.abs(this.trees.position.z - targetZ) > 26) this.trees.position.z = targetZ;
    }
    if (this.tipMat) {
      this.tipMat.color.copy(hsl(this.tipBaseHue + Math.sin(t * 0.3) * 0.1, 0.9, 0.55 + beat * 0.2));
    }
  }
}
