// =============================================================================
// MANDELHOP — water.js  ★ HERO FEATURE
// Real-time displaced water: sum of directional waves with JONSWAP-inspired
// amplitude distribution (energy concentrated at long wavelengths — see
// poseidon, MIT (c) 2026 owenyuwono, which implements Horvath 2015 via FFT
// cascades; here adapted as an analytic multi-wave sum for WebGL2 robustness).
// Analytic normals, Fresnel, subsurface scatter, sun glitter, bank + ripple
// foam. VISUAL ONLY: gameplay platforms run on deterministic timers; the same
// heightAt() is used to bob/pitch logs & lily pads so visuals stay coherent.
// =============================================================================
import * as THREE from 'three';

// Wave set — [dirX, dirZ, amplitude, spatialFreq, speed]
// Amplitude decays with frequency (spectral falloff); speeds follow ~sqrt
// deep-water dispersion so long swells travel faster than ripples.
const WAVES = [
  [1.0, 0.25, 0.055, 1.9, 1.05],
  [-0.62, 1.0, 0.042, 2.7, 1.45],
  [0.42, -1.0, 0.030, 3.9, 1.95],
  [1.0, -0.55, 0.020, 6.1, 2.6],
  [-1.0, -0.30, 0.013, 9.0, 3.3],
  [0.2, 1.0, 0.008, 13.5, 4.2],
];

const MAX_RIP = 14;

function waveGLSL() {
  // Unrolled wave sum: height + gradient (for analytic normals)
  const F = (n) => Number(n).toFixed(4);   // force float literals
  let h = '', g = '';
  for (const [dx, dz, a, f, s] of WAVES) {
    const inv = 1 / Math.hypot(dx, dz);
    const nx = F(dx * inv), nz = F(dz * inv);
    h += `h += ${F(a)} * sin(${F(f)} * dot(vec2(${nx}, ${nz}), p.xz) + ${F(s)} * uTime);\n`;
    g += `grad += ${F(a * f)} * vec2(${nx}, ${nz}) * cos(${F(f)} * dot(vec2(${nx}, ${nz}), p.xz) + ${F(s)} * uTime);\n`;
  }
  return { h, g };
}

export class WaterSystem {
  constructor(scene) {
    this.ripples = new Array(MAX_RIP).fill(0).map(() => new THREE.Vector4(0, 0, -100, 0));
    this._ripIdx = 0;

    const geo = new THREE.PlaneGeometry(48, 52, 150, 110);
    geo.rotateX(-Math.PI / 2);

    const { h, g } = waveGLSL();

    this.uniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x062a4a) },
      uShallow: { value: new THREE.Color(0x1fb6a6) },
      uGlint: { value: new THREE.Color(0xaef2ff) },
      uSky: { value: new THREE.Color(0x4a1e6e) },
      uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.35).normalize() },
      uSunColor: { value: new THREE.Color(0xfff1dc) },
      uFogColor: { value: new THREE.Color(0x2a1140) },
      uFogDensity: { value: 0.026 },
      uRip: { value: this.ripples },
      uBeat: { value: 0 },
      uOffset: { value: new THREE.Vector2(0, 0) },   // plane world origin (waves are world-anchored)
      uMask: { value: null },                        // 1D row-type mask (river=1)
      uMaskRow0: { value: 0 },                       // row index of mask texel 0
    };
    // 128-row sliding window mask, updated by the game
    this.maskData = new Uint8Array(128);
    const maskTex = new THREE.DataTexture(this.maskData, 128, 1, THREE.RedFormat);
    maskTex.needsUpdate = true;
    maskTex.minFilter = THREE.NearestFilter;
    maskTex.magFilter = THREE.NearestFilter;
    this.uniforms.uMask.value = maskTex;

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: false,
      vertexShader: /* glsl */`
        uniform float uTime;
        uniform vec2 uOffset;
        uniform sampler2D uMask;
        uniform float uMaskRow0;
        uniform vec4 uRip[${MAX_RIP}];
        varying vec3 vPos;
        varying vec3 vNorm;
        varying float vRipFoam;
        varying float vCrest;
        varying float vMask;
        void main() {
          vec3 p = position;
          vec2 wp = p.xz + uOffset;   // world-space coords
          float rowF = floor(-wp.y + 0.5);
          float mu = (rowF - uMaskRow0 + 0.5) / 128.0;
          vMask = (mu < 0.0 || mu > 1.0) ? 0.0 : texture2D(uMask, vec2(mu, 0.5)).r;
          float h = 0.0;
          vec2 grad = vec2(0.0);
          ${h}
          ${g}
          // Interactive ripples: expanding decaying rings (frog splashes)
          float ripFoam = 0.0;
          for (int i = 0; i < ${MAX_RIP}; i++) {
            vec4 r = uRip[i];
            float age = uTime - r.z;
            if (r.w > 0.001 && age > 0.0 && age < 2.6) {
              float d = distance(wp, r.xy);   // ripples stored in world coords
              float rad = age * 2.4;
              float ring = exp(-abs(d - rad) * 4.5) * exp(-age * 1.7) * r.w;
              h += ring * 0.09 * sin((d - rad) * 10.0);
              ripFoam += ring;
            }
          }
          p.y += h;
          vCrest = h;
          vRipFoam = ripFoam;
          vMask *= 1.0; // vertex-stage sample
          vPos = vec3(wp.x, p.y, wp.y);   // world position for shading
          vNorm = normalize(vec3(-grad.x, 1.0, -grad.y));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uDeep, uShallow, uGlint, uSky, uSunColor, uFogColor;
        uniform vec3 uSunDir;
        uniform float uFogDensity;
        uniform float uBeat;
        varying vec3 vPos;
        varying vec3 vNorm;
        varying float vRipFoam;
        varying float vCrest;
        varying float vMask;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                     mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }

        void main() {
          if (vMask < 0.5) discard;   // land rows: no water
          vec3 V = normalize(cameraPosition - vPos);
          vec3 N = normalize(vNorm + vec3(
            (noise(vPos.xz * 9.0 + uTime * 0.7) - 0.5) * 0.28,
            0.0,
            (noise(vPos.xz * 9.0 - uTime * 0.6) - 0.5) * 0.28));

          // Fresnel — grazing angles pick up the sky
          float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
          fres = mix(0.04, 1.0, fres);

          // Body color: LUMINOUS turquoise heart — bioluminescent, never black.
          // Fully adaptive: dark biomes get the full glow; already-bright waters
          // (the hub pond) compress toward their old serene balance.
          float lum = dot(uShallow, vec3(0.299, 0.587, 0.114));
          float bright = smoothstep(0.5, 0.72, lum);
          float lift = mix(1.65, 0.8, bright);
          float floorGlow = mix(0.78, 0.26, bright);
          float crest = smoothstep(-0.02, 0.14, vCrest);
          vec3 body = mix(uDeep * 1.15, uShallow * lift, crest * 0.4 + floorGlow);

          // caustic web — soft filaments over the glowing body
          float c1 = noise(vPos.xz * 2.8 + uTime * 0.4);
          float c2 = noise(vPos.xz * 3.4 - uTime * 0.33 + 7.7);
          float streak = pow(1.0 - abs(c1 - c2) * 2.0, 6.0) * 0.38 * (1.0 - bright * 0.5);

          vec3 col = mix(body, uSky * 1.25, fres * 0.28);
          col += uShallow * streak;
          // living glow — the pond breathes with the music
          col += uShallow * 0.16 * (1.0 - bright * 0.65) * (0.6 + 0.4 * uBeat);

          // Sun glitter: tight specular + sparkle hash
          vec3 H = normalize(normalize(uSunDir) + V);
          float spec = pow(max(dot(N, H), 0.0), 220.0);
          float sparkle = step(0.9975, hash(floor(vPos.xz * 34.0) + floor(uTime * 9.0) * 0.37));
          col += uSunColor * (spec * 1.6 + sparkle * 0.7 * (0.5 + uBeat)) * (0.3 + fres);

          // Foam: ripple rings + crest tips
          float foamN = noise(vPos.xz * 7.0 + uTime * 0.5);
          float foam = clamp(vRipFoam * 1.6, 0.0, 1.0)
                     + smoothstep(0.115, 0.17, vCrest) * smoothstep(0.6, 0.9, foamN) * 0.5;
          col = mix(col, uGlint, clamp(foam, 0.0, 1.0) * 0.8);

          // Exp2 fog to match scene
          float depth = length(cameraPosition - vPos);
          float fogF = 1.0 - exp(-uFogDensity * uFogDensity * depth * depth);
          col = mix(col, uFogColor, fogF);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(0, 0, -12);
    scene.add(this.mesh);
  }

  // The infinite river: plane follows the frog; waves stay world-anchored.
  follow(centerZ) {
    this.mesh.position.z = centerZ;
    this.uniforms.uOffset.value.set(0, centerZ);
  }

  // Live theme — fields are THREE.Color (blended per frame by the game)
  setTheme(t) {
    this.uniforms.uDeep.value.copy(t.waterDeep);
    this.uniforms.uShallow.value.copy(t.waterShallow);
    this.uniforms.uGlint.value.copy(t.waterGlint);
    this.uniforms.uSky.value.copy(t.skyMid);
    this.uniforms.uSunColor.value.copy(t.sun);
    this.uniforms.uFogColor.value.copy(t.fog);
    this.uniforms.uFogDensity.value = t.fogDensity;
  }

  addRipple(x, z, strength = 1) {
    const r = this.ripples[this._ripIdx];
    r.set(x, z, this.uniforms.uTime.value, strength);
    this._ripIdx = (this._ripIdx + 1) % MAX_RIP;
  }

  update(t, beat) {
    this.uniforms.uTime.value = t;
    this.uniforms.uBeat.value = beat;
  }

  // game writes the sliding river-row window
  setRowMask(row0) {
    this.uniforms.uMaskRow0.value = row0;
    this.uniforms.uMask.value.needsUpdate = true;
  }

  // Deterministic height — same math as vertex shader (waves only, no ripples)
  heightAt(x, z, t) {
    let h = 0;
    for (const [dx, dz, a, f, s] of WAVES) {
      const inv = 1 / Math.hypot(dx, dz);
      h += a * Math.sin(f * ((dx * inv) * x + (dz * inv) * z) + s * t);
    }
    return h;
  }
}
