// =============================================================================
// MANDELHOP — timemagic.js  ★ TEMPORAL POWERS
// TIME SLOW (hold T): world 0.3×, frog responsive · meter-drained
// TIME FREEZE (F): dynamic objects crystallize for ~2.2s — stepping stones
// PHASE SHIFT (G): swap NOW ↔ THEN on phase-enabled rows (fractal flash)
// Everything routes through one clock: game.update uses worldDt = dt*scale.
// =============================================================================
import * as THREE from 'three';

export class TimeMagic {
  constructor(ctx) {
    Object.assign(this, ctx);   // scene, audio, effects, ui, camera
    this.scale = 1;             // world timescale (frog unaffected)
    this.slowHeld = false;
    this.meter = 1;             // 0..1 chrono energy
    this.freezeT = 0;           // >0 while frozen
    this.phase = 0;             // 0 = NOW, 1 = THEN
    this.phaseFlash = 0;
    this.enabled = true;

    // fullscreen temporal FX overlay (vignette + chroma + mandala flash)
    this.uniforms = {
      uSlow: { value: 0 },       // 0..1 slow intensity
      uFreeze: { value: 0 },
      uFlash: { value: 0 },      // phase flash
      uTime: { value: 0 },
      uFlow: { value: 0 },       // flow-state saturation bloom
      uAspect: { value: innerWidth / innerHeight },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true, depthWrite: false, depthTest: false,
      vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform float uSlow, uFreeze, uFlash, uTime, uFlow, uAspect;
        void main() {
          vec2 uv = gl_FragCoord.xy / vec2(textureSize); // placeholder, replaced below
        }
      `,
    });
    // (proper fragment set below — three has no textureSize in frag; use plain uv quad)
    mat.fragmentShader = /* glsl */`
      uniform float uSlow, uFreeze, uFlash, uTime, uFlow, uAspect;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        p.x *= uAspect;
        float r = length(p);
        vec3 col = vec3(0.0);
        float a = 0.0;
        // SLOW: cool teal glass vignette + drifting hourglass motes ring
        if (uSlow > 0.001) {
          float vig = smoothstep(0.35, 1.15, r);
          col += vec3(0.15, 0.75, 0.85) * vig * 0.35 * uSlow;
          float ring = smoothstep(0.02, 0.0, abs(r - 0.85 - sin(uTime*0.7)*0.03) - 0.015);
          col += vec3(0.4, 0.9, 1.0) * ring * 0.4 * uSlow;
          a = max(a, vig * 0.32 * uSlow + ring * 0.25 * uSlow);
        }
        // FREEZE: crystalline frost rim + hex shimmer
        if (uFreeze > 0.001) {
          float vig = smoothstep(0.55, 1.2, r);
          float hexv = abs(sin(p.x*22.0)) * abs(sin((p.x*0.5+p.y*0.866)*22.0)) * abs(sin((-p.x*0.5+p.y*0.866)*22.0));
          float frost = vig * (0.32 + 0.45*smoothstep(0.55, 1.0, hexv));
          col += vec3(0.75, 0.9, 1.0) * frost * uFreeze * 1.35;
          a = max(a, frost * 0.5 * uFreeze);
        }
        // PHASE FLASH: mandala burst from center
        if (uFlash > 0.001) {
          float ang = atan(p.y, p.x);
          float pet = 0.5 + 0.5*sin(ang*12.0 + r*20.0 - uTime*30.0);
          float burst = smoothstep(uFlash, uFlash-0.25, r) * smoothstep(0.0, 0.15, r);
          col += vec3(1.0, 0.85, 0.95) * burst * (0.4+0.6*pet) * uFlash;
          a = max(a, burst * 0.85 * uFlash);
        }
        // FLOW: warm golden breath at edges
        if (uFlow > 0.001) {
          float vig = smoothstep(0.75, 1.25, r);
          col += vec3(1.0, 0.8, 0.3) * vig * 0.22 * uFlow * (0.7+0.3*sin(uTime*4.0));
          a = max(a, vig * 0.18 * uFlow);
        }
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }
    `;
    mat.vertexShader = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    quad.renderOrder = 999;
    this.scene.add(quad);
    addEventListener('resize', () => { this.uniforms.uAspect.value = innerWidth / innerHeight; });
  }

  get frozen() { return this.freezeT > 0; }

  // called from input
  setSlow(held) {
    if (held && this.meter <= 0.02) held = false;
    if (held && !this.slowHeld && this.enabled) this.audio?.timeSlowStart?.();
    if (!held && this.slowHeld) this.audio?.timeSlowEnd?.();
    this.slowHeld = held && this.enabled;
  }
  tryFreeze(game) {
    if (!this.enabled || this.meter < 0.42 || this.frozen) return false;
    this.meter -= 0.42;
    this.freezeT = 2.2;
    this.audio?.timeFreeze?.();
    this.effects?.frostBurst?.(game.frog.group.position.x, game.frog.group.position.z);
    return true;
  }
  tryPhase(game) {
    if (!this.enabled || !game.stageHasPhase || this.meter < 0.25) return false;
    this.meter -= 0.25;
    this.phase = 1 - this.phase;
    this.phaseFlash = 1;
    this.audio?.phaseShift?.();
    game.applyPhase(this.phase);
    return true;
  }

  update(t, dt, game) {
    // target world scale
    let target = 1;
    if (this.frozen) target = 0.0;
    else if (this.slowHeld) target = 0.3;
    this.scale += (target - this.scale) * Math.min(1, dt * 10);
    if (this.scale < 0.01 && !this.frozen) this.scale = 0.01;

    // meter economy
    if (this.slowHeld) this.meter -= dt * 0.34;
    else this.meter += dt * (game?.state === 'play' ? 0.075 : 0.15);
    this.meter = Math.max(0, Math.min(1, this.meter));
    if (this.meter <= 0 && this.slowHeld) this.setSlow(false);

    if (this.freezeT > 0) {
      this.freezeT -= dt;
      if (this.freezeT <= 0) { this.freezeT = 0; this.audio?.timeThaw?.(); }
    }
    this.phaseFlash = Math.max(0, this.phaseFlash - dt * 2.2);

    this.uniforms.uTime.value = t;
    this.uniforms.uSlow.value += ((this.slowHeld ? 1 : 0) - this.uniforms.uSlow.value) * Math.min(1, dt * 8);
    this.uniforms.uFreeze.value += ((this.frozen ? 1 : 0) - this.uniforms.uFreeze.value) * Math.min(1, dt * 8);
    this.uniforms.uFlash.value = this.phaseFlash;
    this.uniforms.uFlow.value = game?.flow ? game.flow.flow01 : 0;
    this.ui?.setChrono?.(this.meter, this.slowHeld, this.frozen);
  }
}
