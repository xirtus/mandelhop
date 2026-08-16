// =============================================================================
// MANDELHOP — vegetation.js (infinite descent edition)
// Chunked procedural ecosystem: each chunk covers CHUNK_ROWS of the endless
// track and is built from the biome genome at its location, so the flora
// visibly mutates as you descend. Ribbon blades + sway-factor wind model
// adapted from gaia (MIT, (c) 2026 owenyuwono) — see LICENSES.md.
// Blades part around the frog; flowers bloom in waves from successful hops;
// everything breathes with the music.
// =============================================================================
import * as THREE from 'three';
import { rowToZ } from './config.js';

const CHUNK_ROWS = 24;

const WIND_GLSL = /* glsl */`
uniform float uTime;
uniform float uWindStrength;
uniform vec2 uWindDir;
uniform float uBeat;
uniform vec3 uFrog;
vec3 windOffset(vec3 worldPos, float swayFactor) {
  vec3 windDir3 = normalize(vec3(uWindDir.x, 0.0, uWindDir.y));
  vec3 crossDir = vec3(-windDir3.z, 0.0, windDir3.x);
  float phase = dot(worldPos, windDir3) * 0.8 + uTime;
  float flex = pow(swayFactor, 1.0);
  float breathe = 1.0 + uBeat * 0.45;
  float primarySway = sin(phase * 1.1) * uWindStrength * flex * 1.2 * breathe;
  float turbSway = sin(phase * 2.73 + worldPos.y * 1.4) * uWindStrength * flex * 0.35;
  float crossSway = sin(phase * 0.83 + 0.9) * uWindStrength * flex * 0.08;
  return windDir3 * (primarySway + turbSway) + crossDir * crossSway;
}
`;

const FOG_GLSL = /* glsl */`
uniform vec3 uFogColor;
uniform float uFogDensity;
vec3 applyFog(vec3 col, vec3 worldPos) {
  float depth = length(cameraPosition - worldPos);
  float f = 1.0 - exp(-uFogDensity * uFogDensity * depth * depth);
  return mix(col, uFogColor, f);
}
`;

function bladeGeometry(segs = 4, width = 0.055, height = 0.5, curve = 0.22) {
  const pos = [], nor = [], uv = [], sway = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = t * height;
    const bend = t * t * curve;
    const w = width * (1 - t * 0.85) * 0.5;
    if (i === segs) {
      pos.push(0, y, bend); nor.push(0, 0, 1); uv.push(0.5, t); sway.push(t);
    } else {
      pos.push(-w, y, bend, w, y, bend);
      nor.push(0, 0, 1, 0, 0, 1);
      uv.push(0, t, 1, t);
      sway.push(t, t);
    }
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = i * 2 + 1;
    if (i < segs - 1) {
      idx.push(a, b, i * 2 + 2, b, i * 2 + 3, i * 2 + 2);
    } else {
      idx.push(a, b, segs * 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
  g.setIndex(idx);
  return g;
}

function flowerGeometry(petals = 6, petalLen = 0.16, petalW = 0.07) {
  const pos = [], aAngle = [], aR = [], aW = [], aCenter = [], idx = [];
  let vi = 0;
  for (let p = 0; p < petals; p++) {
    const ang = (p / petals) * Math.PI * 2;
    const base = vi;
    const push = (r, w, c) => { pos.push(0, 0, 0); aAngle.push(ang); aR.push(r); aW.push(w); aCenter.push(c); vi++; };
    push(0, 0, 0.4);
    push(petalLen * 0.6, -petalW, 0); push(petalLen * 0.6, petalW, 0);
    push(petalLen, 0, 0.1);
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const ci = vi;
  for (let p = 0; p <= petals; p++) {
    const ang = (p / petals) * Math.PI * 2;
    pos.push(0, 0, 0); aAngle.push(ang); aR.push(p === 0 ? 0 : 0.045); aW.push(0); aCenter.push(1); vi++;
  }
  for (let p = 0; p < petals - 1; p++) idx.push(ci, ci + 1 + p, ci + 2 + p);
  idx.push(ci, ci + petals, ci + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aAngle', new THREE.Float32BufferAttribute(aAngle, 1));
  g.setAttribute('aR', new THREE.Float32BufferAttribute(aR, 1));
  g.setAttribute('aW', new THREE.Float32BufferAttribute(aW, 1));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(aCenter, 1));
  g.setIndex(idx);
  return g;
}

function hsl(h, s, l) { return new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l); }

const GRASS_VERT = /* glsl */`
  attribute float aSway;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying vec3 vWP;
  varying float vT;
  ${WIND_GLSL}
  void main() {
    vT = uv.y;
    vec4 wp = instanceMatrix * vec4(position, 1.0);
    wp.xyz += windOffset(wp.xyz, aSway);
    vec2 toF = wp.xz - uFrog.xz;
    float d = length(toF);
    float push = smoothstep(1.15, 0.0, d);
    wp.xz += normalize(toF + vec2(0.001)) * push * aSway * 0.5;
    wp.y -= push * aSway * 0.22;
    vWP = wp.xyz;
    vColor = aColor;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const GRASS_FRAG = /* glsl */`
  varying vec3 vColor;
  varying vec3 vWP;
  varying float vT;
  uniform float uBeat;
  ${FOG_GLSL}
  void main() {
    vec3 col = vColor * (0.45 + vT * 0.85);
    col += vColor * vT * uBeat * 0.35;
    gl_FragColor = vec4(applyFog(col, vWP), 1.0);
  }
`;
const FLOWER_VERT = /* glsl */`
  attribute float aAngle;
  attribute float aR;
  attribute float aW;
  attribute float aCenter;
  attribute float aPhase;
  attribute vec3 aColor;
  attribute vec3 aGlow;
  uniform vec2 uBloomPos;
  uniform float uBloomT;
  varying vec3 vColor, vGlow, vWP;
  varying float vCenter, vR;
  ${WIND_GLSL}
  void main() {
    vec4 root = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float wave = 0.0;
    float age = uTime - uBloomT;
    if (age > 0.0 && age < 3.0) {
      float d = distance(root.xz, uBloomPos);
      wave = exp(-abs(d - age * 3.2) * 1.4) * exp(-age * 0.9);
    }
    float open = clamp(0.45 + 0.2 * sin(uTime * 0.7 + aPhase) + uBeat * 0.25 + wave * 1.1, 0.0, 1.4);
    float th = mix(0.12, 1.3, open);
    vec3 radial = vec3(cos(aAngle), 0.0, sin(aAngle));
    vec3 perp = vec3(-sin(aAngle), 0.0, cos(aAngle));
    vec3 local = radial * sin(th) * aR + vec3(0.0, cos(th) * aR + 0.42, 0.0) + perp * aW * (1.0 - th * 0.25);
    vec4 wp = instanceMatrix * vec4(local, 1.0);
    wp.xyz += windOffset(wp.xyz, 0.35);
    vec2 toF = wp.xz - uFrog.xz;
    float d2 = length(toF);
    wp.xz += normalize(toF + vec2(0.001)) * smoothstep(0.8, 0.0, d2) * 0.25;
    vWP = wp.xyz; vColor = aColor; vGlow = aGlow; vCenter = aCenter; vR = aR;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const FLOWER_FRAG = /* glsl */`
  varying vec3 vColor, vGlow, vWP;
  varying float vCenter, vR;
  uniform float uBeat;
  ${FOG_GLSL}
  void main() {
    vec3 col = vColor * (0.55 + vR * 2.2);
    col = mix(col, vGlow * (1.6 + uBeat * 1.2), vCenter);
    gl_FragColor = vec4(applyFog(col, vWP), 1.0);
  }
`;

export class Vegetation {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map();
    this.uFrog = new THREE.Vector3(0, 0, 0);
    this.bloomPos = new THREE.Vector2(0, 0);
    this.bloomT = { value: -100 };
    this._t = 0;
    // shared geometry
    this.gGeo = bladeGeometry(4, 0.05, 0.42, 0.2);
    this.stGeo = bladeGeometry(2, 0.03, 0.42, 0.05);
    this.rGeo = bladeGeometry(3, 0.045, 1.1, 0.3);
    this.fGeo = flowerGeometry(7, 0.17, 0.075);
    this.ctGeo = new THREE.CapsuleGeometry(0.045, 0.16, 3, 6);
  }

  _uniforms(theme) {
    return {
      uTime: { value: this._t },
      uWindStrength: { value: 0.16 },
      uWindDir: { value: new THREE.Vector2(1, 0.3) },
      uBeat: { value: 0 },
      uFrog: { value: this.uFrog },
      uFogColor: { value: new THREE.Color(theme.fog) },
      uFogDensity: { value: theme.fogDensity },
    };
  }

  _buildChunk(cid, game) {
    const theme = game.themeStaticAt(cid * CHUNK_ROWS + CHUNK_ROWS / 2);
    const rng = game.chunkRng(cid);
    const group = new THREE.Group();
    const mats = [];
    const dens = theme.vegDensity;

    const gMat = new THREE.ShaderMaterial({ uniforms: this._uniforms(theme), side: THREE.DoubleSide, vertexShader: GRASS_VERT, fragmentShader: GRASS_FRAG });
    mats.push(gMat);
    const fUniforms = this._uniforms(theme);
    fUniforms.uBloomPos = { value: this.bloomPos };
    fUniforms.uBloomT = this.bloomT;
    const fMat = new THREE.ShaderMaterial({ uniforms: fUniforms, side: THREE.DoubleSide, vertexShader: FLOWER_VERT, fragmentShader: FLOWER_FRAG });
    mats.push(fMat);

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const cTmp = new THREE.Color();

    // gather plantable spots from the actual row data
    const safeSpots = [], reedSpots = [];
    for (let r = cid * CHUNK_ROWS; r < cid * CHUNK_ROWS + CHUNK_ROWS; r++) {
      const row = game.rowAt(r);
      if (!row) continue;
      if (row.type === 'safe' || row.type === 'checkpoint') safeSpots.push(r);
      if (row.type === 'river') reedSpots.push(r);
    }

    // ---- grass ----
    const gCount = Math.floor(1050 * dens);
    const grass = new THREE.InstancedMesh(this.gGeo.clone(), gMat, gCount);
    const geo = grass.geometry;
    const aPhase = new Float32Array(gCount), aColor = new Float32Array(gCount * 3);
    for (let i = 0; i < gCount; i++) {
      let x, z;
      const roll = rng.next();
      if (roll < 0.6 && safeSpots.length) {
        const r = safeSpots[rng.int(0, safeSpots.length - 1)];
        x = rng.range(-8.5, 8.5); z = rowToZ(r) + rng.range(-0.45, 0.45);
      } else {
        x = rng.sign() * rng.range(6.9, 9.4);
        z = rowToZ(cid * CHUNK_ROWS + rng.range(0, CHUNK_ROWS));
      }
      p3.set(x, 0, z);
      q.setFromAxisAngle(up, rng.range(0, Math.PI * 2));
      const sc = rng.range(0.6, 1.5);
      s3.set(sc, sc * rng.range(0.8, 1.4), sc);
      m4.compose(p3, q, s3);
      grass.setMatrixAt(i, m4);
      aPhase[i] = rng.range(0, Math.PI * 2);
      const hue = theme.vegHue + rng.range(-0.06, 0.06) + (rng.chance(0.08) ? 0.25 : 0);
      cTmp.copy(hsl(hue, 0.85, rng.range(0.16, 0.3)));
      aColor[i * 3] = cTmp.r; aColor[i * 3 + 1] = cTmp.g; aColor[i * 3 + 2] = cTmp.b;
    }
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(aColor, 3));
    grass.frustumCulled = false;
    group.add(grass);

    // ---- flowers (+stems) ----
    const fCount = Math.floor(90 * dens);
    const flowers = new THREE.InstancedMesh(this.fGeo.clone(), fMat, fCount);
    const fgeo = flowers.geometry;
    const fPhase = new Float32Array(fCount), fCol = new Float32Array(fCount * 3), fGlow = new Float32Array(fCount * 3);
    const spots = [];
    for (let i = 0; i < fCount; i++) {
      let x, z;
      if (safeSpots.length && rng.chance(0.75)) {
        const r = safeSpots[rng.int(0, safeSpots.length - 1)];
        x = rng.range(-8, 8); z = rowToZ(r) + rng.range(-0.4, 0.4);
      } else {
        x = rng.sign() * rng.range(7, 9.2);
        z = rowToZ(cid * CHUNK_ROWS + rng.range(0, CHUNK_ROWS));
      }
      spots.push([x, z]);
      p3.set(x, 0, z);
      q.setFromAxisAngle(up, rng.range(0, Math.PI * 2));
      const sc = rng.range(0.7, 1.6);
      s3.set(sc, sc, sc);
      m4.compose(p3, q, s3);
      flowers.setMatrixAt(i, m4);
      fPhase[i] = rng.range(0, Math.PI * 2);
      cTmp.copy(hsl(theme.flowerHue + rng.range(-0.08, 0.08), 0.9, rng.range(0.5, 0.68)));
      fCol[i * 3] = cTmp.r; fCol[i * 3 + 1] = cTmp.g; fCol[i * 3 + 2] = cTmp.b;
      cTmp.copy(hsl(theme.vegHue2, 1.0, 0.7));
      fGlow[i * 3] = cTmp.r; fGlow[i * 3 + 1] = cTmp.g; fGlow[i * 3 + 2] = cTmp.b;
    }
    fgeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(fPhase, 1));
    fgeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(fCol, 3));
    fgeo.setAttribute('aGlow', new THREE.InstancedBufferAttribute(fGlow, 3));
    flowers.frustumCulled = false;
    group.add(flowers);

    const stems = new THREE.InstancedMesh(this.stGeo.clone(), gMat, fCount);
    const stgeo = stems.geometry;
    const stPhase = new Float32Array(fCount), stCol = new Float32Array(fCount * 3);
    for (let i = 0; i < fCount; i++) {
      p3.set(spots[i][0], 0, spots[i][1]);
      q.identity(); s3.set(1, 1, 1);
      m4.compose(p3, q, s3);
      stems.setMatrixAt(i, m4);
      stPhase[i] = rng.range(0, Math.PI * 2);
      cTmp.copy(hsl(theme.vegHue, 0.7, 0.3));
      stCol[i * 3] = cTmp.r; stCol[i * 3 + 1] = cTmp.g; stCol[i * 3 + 2] = cTmp.b;
    }
    stgeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(stPhase, 1));
    stgeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(stCol, 3));
    stems.frustumCulled = false;
    group.add(stems);

    // ---- reeds & cattails on river banks ----
    const rCount = Math.floor(70 * dens);
    const reeds = new THREE.InstancedMesh(this.rGeo.clone(), gMat, rCount);
    const rgeo = reeds.geometry;
    const rPhase = new Float32Array(rCount), rCol = new Float32Array(rCount * 3);
    const cattailSpots = [];
    for (let i = 0; i < rCount; i++) {
      let x, z;
      if (reedSpots.length && rng.chance(0.7)) {
        const r = reedSpots[rng.int(0, reedSpots.length - 1)];
        x = rng.range(-8.5, 8.5);
        z = rowToZ(r) + rng.sign() * rng.range(0.4, 0.75);
      } else {
        x = rng.sign() * rng.range(7, 9);
        z = rowToZ(cid * CHUNK_ROWS + rng.range(0, CHUNK_ROWS));
      }
      p3.set(x, 0, z);
      q.setFromAxisAngle(up, rng.range(0, Math.PI * 2));
      const sc = rng.range(0.8, 1.6);
      s3.set(sc, sc, sc);
      m4.compose(p3, q, s3);
      reeds.setMatrixAt(i, m4);
      rPhase[i] = rng.range(0, Math.PI * 2);
      cTmp.copy(hsl(theme.vegHue + 0.04, 0.6, rng.range(0.25, 0.4)));
      rCol[i * 3] = cTmp.r; rCol[i * 3 + 1] = cTmp.g; rCol[i * 3 + 2] = cTmp.b;
      if (rng.chance(0.35)) cattailSpots.push([x, z, sc]);
    }
    rgeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(rPhase, 1));
    rgeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(rCol, 3));
    reeds.frustumCulled = false;
    group.add(reeds);

    if (cattailSpots.length) {
      const ctMat = new THREE.MeshStandardMaterial({
        color: hsl(theme.flowerHue, 0.7, 0.35),
        emissive: hsl(theme.flowerHue, 0.9, 0.3), emissiveIntensity: 1.2, roughness: 0.6,
      });
      const cattails = new THREE.InstancedMesh(this.ctGeo, ctMat, cattailSpots.length);
      cattailSpots.forEach((sp, i) => {
        p3.set(sp[0], 1.05 * sp[2], sp[1]);
        q.identity(); s3.set(sp[2], sp[2], sp[2]);
        m4.compose(p3, q, s3);
        cattails.setMatrixAt(i, m4);
      });
      group.add(cattails);
    }

    this.scene.add(group);
    return { group, mats };
  }

  _freeChunk(cid) {
    const c = this.chunks.get(cid);
    if (!c) return;
    c.group.traverse(o => {
      if (o.geometry && o.geometry !== this.ctGeo) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    this.scene.remove(c.group);
    this.chunks.delete(cid);
  }

  sync(centerRow, game) {
    const cMin = Math.floor((centerRow - 14) / CHUNK_ROWS);
    const cMax = Math.floor((centerRow + 42) / CHUNK_ROWS);
    for (const cid of [...this.chunks.keys()]) {
      if (cid < cMin || cid > cMax) this._freeChunk(cid);
    }
    for (let cid = Math.max(0, cMin); cid <= cMax; cid++) {
      if (!this.chunks.has(cid)) this.chunks.set(cid, this._buildChunk(cid, game));
    }
  }

  clearAll() { for (const cid of [...this.chunks.keys()]) this._freeChunk(cid); }

  setFrog(x, z) { this.uFrog.set(x, 0, z); }
  bloom(x, z) { this.bloomPos.set(x, z); this.bloomT.value = this._t; }

  update(t, beat) {
    this._t = t;
    for (const c of this.chunks.values()) {
      for (const m of c.mats) {
        m.uniforms.uTime.value = t;
        m.uniforms.uBeat.value = beat;
      }
    }
  }
}
