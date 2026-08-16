// =============================================================================
// MANDELHOP — powers.js  ★ PROGRESSIVE MOVESET (the Crash backbone)
// CYCLONE SPIN → DOUBLE JUMP → SLAM → SEED SHOT → SLIDE → GRAPPLE →
// SUPER SPIN → TIME DASH. Every power is a multiplier on the hop engine:
// multi-tile trajectories are expressed as extended hops, so all existing
// landing logic (rivers, traffic, pods) stays authoritative.
// =============================================================================
import * as THREE from 'three';
import { HOP_DUR, HOP_H, rowToZ, colToX, HALF, COLS } from './config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Powers {
  constructor(ctx) {
    Object.assign(this, ctx);    // scene, frog, effects, audio, ui, collect
    this.unlocked = new Set();
    this.spinT = 0;              // >0 while spinning
    this.spinHeld = false;
    this.spinCd = 0;
    this.slamCd = 0;
    this.dashCd = 0;
    this.grappleCd = 0;
    this.usedDouble = false;     // reset on landing
    this.sliding = 0;
    this.ammo = 3; this.ammoT = 0;
    this.seeds = [];             // live projectiles
    this.afterimages = [];
    this.swing = null;           // active grapple swing
    this._buildFrogVisuals();
    this._seedGeo = new THREE.SphereGeometry(0.09, 8, 6);
    this._ghostGeo = new THREE.SphereGeometry(0.3, 12, 10);
  }

  has(p) { return this.unlocked.has(p); }
  grant(p) {
    this.unlocked.add(p);
    this._evolveFrog(p);
  }
  grantAll(list) { for (const p of list) this.grant(p); }

  // ---------------------------------------------------------- frog evolution
  _buildFrogVisuals() {
    const inner = this.frog.inner;
    // spin disc — psychic pollen vortex that appears while spinning
    this.spinDisc = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.05, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xd8f6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.spinDisc.rotation.x = Math.PI / 2;
    this.spinDisc.position.y = 0.28;
    inner.add(this.spinDisc);
    // tongue (grapple / interaction) — stretched cylinder from mouth
    this.tongue = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.03, 1, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff9ad8, transparent: true, opacity: 0.9 }));
    this.tongue.visible = false;
    this.scene.add(this.tongue);
    // evolution markings group (hidden until powers granted)
    this.marks = {};
    const mkSpiral = () => {
      const pts = [];
      for (let i = 0; i < 40; i++) {
        const a = i * 0.45, r = 0.02 + i * 0.004;
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0.485, Math.sin(a) * r));
      }
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.008, 5, false);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x66f2ff }));
      m.visible = false; inner.add(m); return m;
    };
    this.marks.SPIN = mkSpiral();
    const legGlow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
    legGlow.position.set(0, 0.12, 0.16); legGlow.scale.set(1.9, 0.8, 1.4);
    legGlow.visible = false; inner.add(legGlow);
    this.marks.DOUBLE = legGlow;
    const throat = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xaaff66, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
    throat.position.set(0, 0.32, -0.3); throat.visible = false; inner.add(throat);
    this.marks.SEED = throat;
    const dashMarks = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const shard = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.14),
        new THREE.MeshBasicMaterial({ color: 0x99ccff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      shard.position.set((i - 1.5) * 0.09, 0.46, 0.05 - i * 0.03);
      shard.rotation.z = (i - 1.5) * 0.4;
      dashMarks.add(shard);
    }
    dashMarks.visible = false; inner.add(dashMarks);
    this.marks.DASH = dashMarks;
  }

  _evolveFrog(p) {
    const m = this.marks[p];
    if (m) {
      m.visible = true;
      if (m.material) m.material.opacity = 0.0;   // fades in during ceremony
    }
    if (p === 'GRAPPLE') this.tongue.material.color.setHex(0xd49aff);
  }

  // ---------------------------------------------------------- SPIN
  trySpin(game) {
    if (!this.has('SPIN') || this.spinCd > 0 || this.sliding > 0) return false;
    const super_ = this.has('SUPERSPIN') && this.spinHeld;
    this.spinT = super_ ? 0.85 : 0.4;
    this.spinCd = super_ ? 0.7 : 0.42;
    this._spinSuper = super_;
    this.audio.spin(super_);
    const r = super_ ? 1.6 : 1.2;
    const broke = this.collect.breakNear(game.fx, rowToZ(game.row), r, super_ ? 'superspin' : 'spin');
    if (broke > 0) game.addScore(15 * broke, true);
    game.enemyHit?.(game.fx, rowToZ(game.row), r, 'spin');
    // mid-hop: spin preserves & slightly extends flight
    if (this.frog.hop) { this.frog.hop.dur += super_ ? 0.22 : 0.1; }
    return true;
  }

  // ---------------------------------------------------------- SLAM
  trySlam(game) {
    if (!this.has('SLAM') || this.slamCd > 0) return false;
    this.slamCd = 0.55;
    const z = rowToZ(game.row);
    // if mid-hop: cancel into vertical drop at current position
    if (this.frog.hop) {
      const h = this.frog.hop;
      const cur = this.frog.group.position.clone();
      this.frog.hop = null;
      game.fx = cur.x;
      const to = new THREE.Vector3(cur.x, 0, cur.z);
      const rowB = game.rows.get(game.row);
      if (rowB && rowB.type === 'river') to.y = rowB.kind === 'log' ? 0.42 : 0.14;
      this.frog.startHop(cur, to, 0.12, () => this._slamLand(game));
    } else {
      this.frog.inner.scale.set(1.3, 0.4, 1.3);
      this._slamLand(game);
    }
    return true;
  }
  _slamLand(game) {
    const z = rowToZ(game.row);
    this.audio.slam();
    this.camera.shake(0.35);
    this.effects.shockwave(game.fx, z, 0xaef2ff);
    const row = game.rows.get(game.row);
    if (row && row.type === 'river') {
      this.water?.addRipple?.(game.fx, z, 2.2);
      this.effects.splash(game.fx, z, 0xaef2ff);
    }
    const broke = this.collect.breakNear(game.fx, z, 1.35, 'slam');
    if (broke) game.addScore(15 * broke, true);
    game.enemyHit?.(game.fx, z, 1.5, 'slam');
    game.slamCracks?.(game.fx, z);
  }

  // ---------------------------------------------------------- SEED SHOT
  trySeed(game) {
    if (!this.has('SEED') || this.ammo < 1) return false;
    this.ammo--;
    this.audio.seedSpit();
    const from = this.frog.group.position.clone(); from.y += 0.4;
    // aim: nearest pod/switch/enemy within 5 in facing cone, else straight ahead
    const yaw = this.frog.group.rotation.y;
    const dir = new THREE.Vector3(-Math.sin(yaw), 0.12, -Math.cos(yaw)).normalize();
    let target = null, bd = 6;
    const consider = (x, z, obj) => {
      const d = Math.hypot(x - game.fx, z - rowToZ(game.row));
      if (d < bd) { bd = d; target = { x, z, obj }; }
    };
    for (const p of this.collect.pods) if (p.alive && p.z < rowToZ(game.row) + 0.5) consider(p.x, p.z, p);
    for (const s of this.collect.switches) if (!s.hit) consider(s.x, s.z, s);
    if (target) dir.set(target.x - from.x, 0.15, target.z - from.z).normalize();
    const mesh = new THREE.Mesh(this._seedGeo, new THREE.MeshBasicMaterial({ color: 0xaaff66 }));
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.seeds.push({ mesh, vel: dir.multiplyScalar(11), t: 0, game });
    this.effects.sparkle(from.x, from.z, 0xaaff66);
    return true;
  }

  // ---------------------------------------------------------- SLIDE
  trySlide(game) {
    if (!this.has('SLIDE') || this.frog.isHopping || this.sliding > 0 || game.state !== 'play') return false;
    // slide 2 tiles in facing direction (forward only — readability)
    const dir = this._facingDir();
    this.sliding = 0.34;
    this._slideDir = dir;
    this.audio.slide();
    this.frog.inner.scale.set(1.25, 0.45, 1.1);
    game.slideMove?.(dir[0], dir[1], 2);
    return true;
  }
  _facingDir() {
    const yaw = this.frog.group.rotation.y;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    if (Math.abs(fx) > Math.abs(fz)) return [Math.round(Math.sign(fx)), 0];
    return [0, fz < 0 ? 1 : -1];   // -z (into screen) = +1 row
  }

  // ---------------------------------------------------------- GRAPPLE
  tryGrapple(game) {
    if (!this.has('GRAPPLE') || this.grappleCd > 0 || this.swing) return false;
    const g = this.collect.nearestGrapple(game.fx, rowToZ(game.row), 3.6);
    if (!g) return false;
    this.grappleCd = 0.5;
    const from = this.frog.group.position.clone();
    // swing landing: one tile beyond the grapple ring
    const to = new THREE.Vector3(g.x, 0, g.z - 1);
    const tRow = game.row + 1;   // forward-only for readability
    if (game.rows.get(tRow) === undefined) return false;
    this.swing = { g, t: 0, dur: 0.5 };
    this.tongue.visible = true;
    if (this.frog.hop) this.frog.hop = null;
    this.audio.grapple();
    // move frog logically to target row/col
    game.fx = g.x;
    game.row = Math.round(-to.z);
    game.row = Math.max(0, game.row);
    const apex = new THREE.Vector3((from.x + to.x) / 2, 2.4, (from.z + to.z) / 2);
    this.frog.startHop(from, to, 0.55, () => { game._onLand(); this.tongue.visible = false; this.swing = null; });
    this.frog.hop.apex = apex;   // custom arc
    this._swingTarget = new THREE.Vector3(g.x, 1.6, g.z);
    return true;
  }

  // ---------------------------------------------------------- TIME DASH
  tryDash(game) {
    if (!this.has('DASH') || this.dashCd > 0 || game.state !== 'play') return false;
    this.dashCd = 1.1;
    this.audio.timeDash();
    const dir = this.frog.isHopping ? [0, 1] : this._facingDir();
    game.dashMove?.(dir[0], dir[1], 3, this);
    return true;
  }

  spawnAfterimage(pos, yaw) {
    const m = new THREE.Mesh(this._ghostGeo, new THREE.MeshBasicMaterial({
      color: 0x99ccff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos); m.position.y += 0.26;
    m.scale.set(1.2, 0.95, 1.35);
    m.rotation.y = yaw;
    this.scene.add(m);
    this.afterimages.push({ mesh: m, t: 0 });
  }

  onLanded() { this.usedDouble = false; }

  // ---------------------------------------------------------- frame
  update(t, dt, game) {
    this.spinCd = Math.max(0, this.spinCd - dt);
    this.slamCd = Math.max(0, this.slamCd - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.grappleCd = Math.max(0, this.grappleCd - dt);
    // ammo regen
    this.ammoT += dt;
    if (this.ammoT > 2.4 && this.ammo < 3) { this.ammo++; this.ammoT = 0; this.ui?.bumpAmmo?.(this.ammo); }
    // spinning visual
    if (this.spinT > 0) {
      this.spinT -= dt;
      this.frog.inner.rotation.y += dt * (this._spinSuper ? 34 : 26);
      const k = Math.min(1, this.spinT * 6);
      this.spinDisc.material.opacity = 0.55 * k;
      this.spinDisc.scale.setScalar(1 + Math.sin(t * 30) * 0.12 + (this._spinSuper ? 0.5 : 0));
      this.spinDisc.rotation.z = t * 9;
      if (this._spinSuper) this.effects.spiral(game.fx, this.frog.group.position.y + 0.3, rowToZ(game.row), 0x66f2ff);
      if (this.spinT <= 0) { this.frog.inner.rotation.y = 0; this.spinDisc.material.opacity = 0; }
    } else {
      this.spinDisc.material.opacity *= 0.8;
    }
    // slide recovery
    if (this.sliding > 0) {
      this.sliding -= dt;
      if (this.sliding <= 0 && !this.frog.isHopping) this.frog.inner.scale.set(1, 1, 1);
    }
    // tongue track
    if (this.tongue.visible && this._swingTarget) {
      const mouth = this.frog.group.position.clone(); mouth.y += 0.42;
      const mid = mouth.clone().add(this._swingTarget).multiplyScalar(0.5);
      this.tongue.position.copy(mid);
      const d = mouth.distanceTo(this._swingTarget);
      this.tongue.scale.set(1, d, 1);
      this.tongue.lookAt(this._swingTarget);
      this.tongue.rotateX(Math.PI / 2);
    }
    // seed projectiles
    for (let i = this.seeds.length - 1; i >= 0; i--) {
      const s = this.seeds[i];
      s.t += dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      const hit = this.collect.breakNear(s.mesh.position.x, s.mesh.position.z, 0.45, 'seed');
      let dead = hit > 0 || s.t > 1.2;
      for (const sw of this.collect.switches) {
        if (!sw.hit && Math.abs(sw.x - s.mesh.position.x) < 0.5 && Math.abs(sw.z - s.mesh.position.z) < 0.5) {
          sw.hit = true;
          this.audio.secret();
          this.effects.goalBurst(sw.x, sw.z, 0xaaff66);
          sw.target?.();
          dead = true;
        }
      }
      if (game.enemyHit?.(s.mesh.position.x, s.mesh.position.z, 0.5, 'seed')) dead = true;
      if (dead) {
        this.effects.sparkle(s.mesh.position.x, s.mesh.position.z, 0xaaff66);
        this.scene.remove(s.mesh);
        this.seeds.splice(i, 1);
      }
    }
    // afterimages fade
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const a = this.afterimages[i];
      a.t += dt;
      a.mesh.material.opacity = 0.5 * (1 - a.t / 0.4);
      if (a.t > 0.4) { this.scene.remove(a.mesh); a.mesh.material.dispose(); this.afterimages.splice(i, 1); }
    }
  }
}
