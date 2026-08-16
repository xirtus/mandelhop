// =============================================================================
// MANDELHOP — effects.js
// Stateless GPU particle pool (position derived analytically from birth,
// velocity & gravity — zero per-frame CPU writes except on emit), expanding
// ripple rings, and instanced soft blob shadows.
// =============================================================================
import * as THREE from 'three';

const MAX_P = 1600;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this._cursor = 0;

    const geo = new THREE.BufferGeometry();
    this.aPos = new Float32Array(MAX_P * 3);
    this.aVel = new Float32Array(MAX_P * 3);
    this.aCol = new Float32Array(MAX_P * 3);
    this.aBirth = new Float32Array(MAX_P).fill(-1000);
    this.aLife = new Float32Array(MAX_P).fill(1);
    this.aSize = new Float32Array(MAX_P).fill(1);
    this.aGrav = new Float32Array(MAX_P);
    geo.setAttribute('position', new THREE.BufferAttribute(this.aPos, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(this.aVel, 3));
    geo.setAttribute('aCol', new THREE.BufferAttribute(this.aCol, 3));
    geo.setAttribute('aBirth', new THREE.BufferAttribute(this.aBirth, 1));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.aLife, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.aSize, 1));
    geo.setAttribute('aGrav', new THREE.BufferAttribute(this.aGrav, 1));

    this.pUniforms = { uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.pUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec3 aVel;
        attribute vec3 aCol;
        attribute float aBirth, aLife, aSize, aGrav;
        uniform float uTime;
        varying vec3 vCol;
        varying float vA;
        void main() {
          float age = uTime - aBirth;
          float t01 = clamp(age / aLife, 0.0, 1.0);
          vec3 p = position + aVel * age + vec3(0.0, -aGrav, 0.0) * age * age;
          vA = (1.0 - t01) * step(age, aLife) * step(0.0, age);
          vCol = aCol;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = aSize * (1.0 - t01 * 0.6) * 320.0 / max(1.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vCol;
        varying float vA;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float m = smoothstep(0.5, 0.05, length(d));
          gl_FragColor = vec4(vCol, m * vA);
        }
      `,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // ripple ring pool
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.42, 0.5, 40);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
      }));
      m.visible = false;
      m.userData = { t: 0, life: 0.8, str: 1 };
      scene.add(m);
      this.rings.push(m);
    }
    this._ringIdx = 0;
    this._t = 0;
  }

  _emit(n, x, y, z, opt) {
    const col = new THREE.Color(opt.color);
    for (let i = 0; i < n; i++) {
      const j = this._cursor;
      this._cursor = (this._cursor + 1) % MAX_P;
      this.aPos[j * 3] = x + (Math.random() - 0.5) * opt.spread;
      this.aPos[j * 3 + 1] = y + Math.random() * 0.1;
      this.aPos[j * 3 + 2] = z + (Math.random() - 0.5) * opt.spread;
      const a = Math.random() * Math.PI * 2;
      const sp = opt.speed * (0.4 + Math.random() * 0.8);
      this.aVel[j * 3] = Math.cos(a) * sp;
      this.aVel[j * 3 + 1] = opt.up * (0.5 + Math.random());
      this.aVel[j * 3 + 2] = Math.sin(a) * sp;
      const v = 0.85 + Math.random() * 0.3;
      this.aCol[j * 3] = col.r * v; this.aCol[j * 3 + 1] = col.g * v; this.aCol[j * 3 + 2] = col.b * v;
      this.aBirth[j] = this._t;
      this.aLife[j] = opt.life * (0.7 + Math.random() * 0.6);
      this.aSize[j] = opt.size * (0.6 + Math.random() * 0.8);
      this.aGrav[j] = opt.grav;
    }
    for (const k of ['position', 'aVel', 'aCol', 'aBirth', 'aLife', 'aSize', 'aGrav']) {
      this.points.geometry.getAttribute(k).needsUpdate = true;
    }
  }

  pollenBurst(x, z, color) {
    this._emit(26, x, 0.1, z, { color, spread: 0.5, speed: 0.9, up: 1.4, life: 1.1, size: 0.06, grav: 1.2 });
  }
  splash(x, z, color) {
    this._emit(46, x, 0.05, z, { color, spread: 0.4, speed: 1.6, up: 2.6, life: 0.8, size: 0.07, grav: 4.5 });
  }
  sparkle(x, z, color) {
    this._emit(12, x, 0.25, z, { color, spread: 0.25, speed: 0.4, up: 0.9, life: 0.6, size: 0.05, grav: 0.6 });
  }
  deathBurst(x, z, color) {
    this._emit(70, x, 0.3, z, { color, spread: 0.4, speed: 2.6, up: 2.2, life: 1.0, size: 0.09, grav: 3.2 });
  }
  goalBurst(x, z, color) {
    this._emit(90, x, 0.2, z, { color, spread: 0.3, speed: 1.8, up: 3.2, life: 1.6, size: 0.08, grav: 1.8 });
  }

  ring(x, z, color, str = 1) {
    const r = this.rings[this._ringIdx];
    this._ringIdx = (this._ringIdx + 1) % this.rings.length;
    r.visible = true;
    r.position.set(x, 0.1, z);
    r.material.color.setHex(color);
    r.userData.t = 0;
    r.userData.str = str;
  }

  update(t, dt) {
    this._t = t;
    this.pUniforms.uTime.value = t;
    for (const r of this.rings) {
      if (!r.visible) continue;
      r.userData.t += dt;
      const t01 = r.userData.t / r.userData.life;
      if (t01 >= 1) { r.visible = false; continue; }
      const s = 0.3 + t01 * 2.6 * r.userData.str;
      r.scale.set(s, 1, s);
      r.material.opacity = (1 - t01) * 0.7;
    }
  }
}

// --- Instanced blob shadows ----------------------------------------------------
export class BlobShadows {
  constructor(scene, cap = 80) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false,
    }), cap);
    this.mesh.renderOrder = 1;
    this.mesh.frustumCulled = false;
    this.cap = cap;
    this._m4 = new THREE.Matrix4();
    scene.add(this.mesh);
  }
  set(i, x, y, z, sx, sz) {
    this._m4.makeScale(sx, 1, sz);
    this._m4.setPosition(x, y + 0.02, z);
    this.mesh.setMatrixAt(i, this._m4);
  }
  commit(n) {
    this.mesh.count = Math.min(n, this.cap);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// =============================================================================
// TIMEWARP FX — added to Effects.prototype (keeps the stateless GPU pool)
// =============================================================================
Effects.prototype.podBurst = function (x, y, z, color, variant) {
  const n = variant === 'musical' ? 40 : 30;
  this._emit(n, x, y, z, { color, spread: 0.3, speed: 2.2, up: 2.4, life: 0.9, size: 0.075, grav: 3.4 });
  this._emit(12, x, y, z, { color: 0xffffff, spread: 0.15, speed: 0.8, up: 3.2, life: 0.6, size: 0.05, grav: 1.5 });
  this.ring(x, z, color, 0.9);
};
Effects.prototype.pollenMote = function (x, y, z) {
  this._emit(3, x, y, z, { color: 0xffe066, spread: 0.1, speed: 0.3, up: 0.8, life: 0.5, size: 0.05, grav: 0.2 });
};
Effects.prototype.shockwave = function (x, z, color) {
  this.ring(x, z, color, 2.2);
  this.ring(x, z, 0xffffff, 1.4);
  this._emit(50, x, 0.15, z, { color, spread: 0.5, speed: 3.4, up: 1.2, life: 0.7, size: 0.08, grav: 2.2 });
};
Effects.prototype.spiral = function (x, y, z, color) {
  this._emit(8, x, y, z, { color, spread: 0.4, speed: 1.4, up: 0.4, life: 0.5, size: 0.05, grav: -0.5 });
};
Effects.prototype.flowBloom = function (x, z) {
  this._emit(70, x, 0.2, z, { color: 0xffd76e, spread: 1.2, speed: 1.8, up: 2.8, life: 1.6, size: 0.07, grav: 1.2 });
  this.ring(x, z, 0xffd76e, 2.6);
};
Effects.prototype.frostBurst = function (x, z) {
  this._emit(60, x, 0.3, z, { color: 0x9fd8ff, spread: 1.6, speed: 1.2, up: 1.6, life: 1.4, size: 0.06, grav: 0.15 });
  this.ring(x, z, 0x9fd8ff, 3.0);
};
Effects.prototype.phaseBurst = function (x, z) {
  this._emit(80, x, 0.4, z, { color: 0xee99ff, spread: 2.0, speed: 2.4, up: 2.0, life: 1.0, size: 0.07, grav: 0.4 });
  this.ring(x, z, 0xee99ff, 2.4);
};
Effects.prototype.rippleKick = function (x, y, z) {
  this._emit(16, x, y, z, { color: 0xaef2ff, spread: 0.2, speed: 0.9, up: 0.4, life: 0.5, size: 0.06, grav: 0.8 });
  this.ring(x, z, 0xaef2ff, 0.9);
};
Effects.prototype.portalSwirl = function (x, z) {
  this._emit(120, x, 0.6, z, { color: 0xff9aef, spread: 0.8, speed: 2.8, up: 3.6, life: 1.8, size: 0.08, grav: -0.6 });
  this.ring(x, z, 0xff9aef, 3.4);
  this.ring(x, z, 0xffffff, 2.2);
};
