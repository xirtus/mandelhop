// =============================================================================
// MANDELHOP — collect.js  ★ CHRONOPODS · TIME POLLEN · SHARDS · GLYPHS
// Chronopods are breakable temporal seed-containers (crate equivalents).
// Pollen: hundreds of instanced motes that spiral into the frog.
// Shards: 5 hidden per stage. Glyphs: secret lore. All counts feed the
// completion bloom screen.
// =============================================================================
import * as THREE from 'three';
import { colToX, rowToZ, COLS, HALF } from './config.js';
import {
  buildChronopod, buildShard, buildGlyph, buildHourglass,
} from './entities.js';

const MAX_POLLEN = 420;

export class Collectibles {
  constructor(ctx) {
    Object.assign(this, ctx);   // scene, effects, audio, ui
    this.pods = [];             // {x,z,row,col,variant,mesh,alive,phase}
    this.shards = [];
    this.glyphs = [];
    this.hourglasses = [];
    this.grapples = [];         // grapple points (read by powers)
    this.switches = [];         // seed-shot switches
    this._pollenPoolInit();

    // stage totals & live counts
    this.tot = { pollen: 0, pods: 0, shards: 0, glyphs: 0 };
    this.got = { pollen: 0, pods: 0, shards: 0, glyphs: 0 };
    this.shardsFound = [];
  }

  reset() {
    for (const p of this.pods) this._freeMesh(p.mesh);
    for (const s of this.shards) this._freeMesh(s.mesh);
    for (const g of this.glyphs) this._freeMesh(g.mesh);
    for (const h of this.hourglasses) this._freeMesh(h.mesh);
    for (const gr of this.grapples) this._freeMesh(gr.mesh);
    for (const sw of this.switches) this._freeMesh(sw.mesh);
    this.pods = []; this.shards = []; this.glyphs = []; this.hourglasses = [];
    this.grapples = []; this.switches = [];
    this.tot = { pollen: 0, pods: 0, shards: 0, glyphs: 0 };
    this.got = { pollen: 0, pods: 0, shards: 0, glyphs: 0 };
    this.shardsFound = [];
    this._pollenAlive = 0;
    this.pollenMesh.count = 0;
  }

  _freeMesh(m) {
    this.scene.remove(m);
    m.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(mm => mm.dispose()); });
  }

  // ------------------------------------------------ pollen (instanced motes)
  _pollenPoolInit() {
    const geo = new THREE.IcosahedronGeometry(0.05, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95 });
    this.pollenMesh = new THREE.InstancedMesh(geo, mat, MAX_POLLEN);
    this.pollenMesh.frustumCulled = false;
    this.pollenMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.pollenMesh);
    this._pollen = [];          // {x,y,z,vx,vy,vz,state:'idle'|'fly',t,slot}
    for (let i = 0; i < MAX_POLLEN; i++) this._pollen.push({ x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, state: 'idle', t: 0, slot: i });
    this._pollenAlive = 0;
    this._m4 = new THREE.Matrix4();
  }

  addPollen(x, y, z) {
    if (this._pollenAlive >= MAX_POLLEN) return;
    const p = this._pollen[this._pollenAlive++];
    p.x = x; p.y = y; p.z = z; p.state = 'idle'; p.t = Math.random() * 6;
  }

  // burst of free-flying pollen (pod breaks, flowers) — collectible!
  sprayPollen(x, y, z, n = 6) {
    for (let i = 0; i < n; i++) {
      if (this._pollenAlive >= MAX_POLLEN) return;
      const p = this._pollen[this._pollenAlive++];
      const a = Math.random() * Math.PI * 2;
      p.x = x; p.y = y + 0.3; p.z = z;
      p.vx = Math.cos(a) * (0.6 + Math.random()); p.vy = 1.5 + Math.random() * 1.5; p.vz = Math.sin(a) * (0.6 + Math.random());
      p.state = 'burst'; p.t = 0;
    }
  }

  // ------------------------------------------------ placement
  addPod(variant, col, row, phase = 0) {
    const mesh = buildChronopod(variant, this._theme(), Math.random);
    mesh.scale.setScalar(1.22);
    mesh.position.set(colToX(col + HALF), 0, rowToZ(row));
    this.scene.add(mesh);
    this.pods.push({ x: colToX(col + HALF), z: rowToZ(row), row, col, variant, mesh, alive: true, phase });
    this.tot.pods++;
  }
  addShard(idx, col, row) {
    const mesh = buildShard(this._theme());
    mesh.position.set(colToX(col + HALF), 0, rowToZ(row));
    this.scene.add(mesh);
    this.shards.push({ idx, x: colToX(col + HALF), z: rowToZ(row), row, col, mesh, alive: true });
    this.tot.shards++;
  }
  addGlyph(idx, col, row, text) {
    const mesh = buildGlyph(this._theme());
    mesh.position.set(colToX(col + HALF), 0, rowToZ(row));
    this.scene.add(mesh);
    this.glyphs.push({ idx, x: colToX(col + HALF), z: rowToZ(row), row, col, mesh, alive: true, text });
    this.tot.glyphs++;
  }
  addHourglass(kind, col, row) {
    const mesh = buildHourglass(kind);
    mesh.position.set(colToX(col + HALF), 0, rowToZ(row));
    this.scene.add(mesh);
    this.hourglasses.push({ kind, x: colToX(col + HALF), z: rowToZ(row), row, col, mesh, alive: true });
  }
  addGrapple(mesh, col, row) {
    mesh.position.set(colToX(col + HALF), 0, rowToZ(row));
    this.scene.add(mesh);
    this.grapples.push({ x: colToX(col + HALF), z: rowToZ(row), row, col, mesh });
  }
  addSwitch(mesh, col, row, target) {
    mesh.position.set(colToX(col + HALF), 0, rowToZ(row));
    this.scene.add(mesh);
    this.switches.push({ x: colToX(col + HALF), z: rowToZ(row), row, col, mesh, hit: false, target });
  }

  _theme() { return this._themeFn ? this._themeFn() : { flowerHue: 0.85, vegHue: 0.3, accent: 0xffe066 }; }

  // ------------------------------------------------ gameplay queries
  // break pods near (x,z) — how: 'spin'|'slam'|'seed'|'superspin'|'touch'
  breakNear(x, z, radius, how) {
    let broke = 0;
    for (const p of this.pods) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d > radius) continue;
      if (!this._canBreak(p.variant, how)) continue;
      this._breakPod(p, how);
      broke++;
    }
    return broke;
  }

  _canBreak(variant, how) {
    switch (variant) {
      case 'armored': return how === 'slam' || how === 'superspin';
      case 'heavy': return how === 'superspin';
      case 'quantum': return how !== 'touch';   // any real attack
      case 'phase': return true;
      default: return true;
    }
  }

  _breakPod(p, how) {
    p.alive = false;
    p.mesh.visible = false;
    this.got.pods++;
    const col = { normal: 0xffe066, time: 0x9fd8ff, bounce: 0x7dffb0, armored: 0xaaccff, spore: 0xff5533, countdown: 0xcc99ff, phase: 0x66f2ff, quantum: 0xee99ff, musical: 0x66ffd0, heavy: 0xff8888, grapple: 0xffcc66, dash: 0x99ccff, seedTarget: 0xaaff66 }[p.variant] || 0xffe066;
    this.effects.podBurst?.(p.x, 0.35, p.z, col, p.variant);
    this.audio?.podBreak?.(p.variant);
    this.sprayPollen(p.x, 0.2, p.z, p.variant === 'musical' ? 10 : 5);
    this.ui?.bumpPods?.(this.got.pods, this.tot.pods);
    if (p.variant === 'time' || p.variant === 'countdown') this.onTimePod?.(p.variant);
    if (p.variant === 'spore') this.effects?.splash?.(p.x, p.z, 0xff5533);
  }

  // frog touched position — pollen magnet + pickups; returns events
  gather(fx, fz, fy, dt, t) {
    const ev = [];
    // shards / glyphs / hourglasses
    for (const s of this.shards) {
      if (!s.alive) continue;
      if (Math.abs(s.x - fx) < 0.55 && Math.abs(s.z - fz) < 0.6) {
        s.alive = false; s.mesh.visible = false;
        this.got.shards++; this.shardsFound.push(s.idx);
        ev.push({ type: 'shard', x: s.x, z: s.z });
      }
    }
    for (const g of this.glyphs) {
      if (!g.alive) continue;
      if (Math.abs(g.x - fx) < 0.6 && Math.abs(g.z - fz) < 0.6) {
        g.alive = false; g.mesh.visible = false;
        this.got.glyphs++;
        ev.push({ type: 'glyph', x: g.x, z: g.z, text: g.text });
      }
    }
    for (const h of this.hourglasses) {
      if (!h.alive) continue;
      if (Math.abs(h.x - fx) < 0.55 && Math.abs(h.z - fz) < 0.6) {
        h.alive = false; h.mesh.visible = false;
        ev.push({ type: 'hourglass', kind: h.kind, x: h.x, z: h.z });
      }
    }
    return ev;
  }

  nearestGrapple(x, z, maxDist = 3.2) {
    let best = null, bd = maxDist;
    for (const g of this.grapples) {
      const d = Math.hypot(g.x - x, g.z - z);
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }

  // pod at exact tile (for landing interactions: bounce pods etc.)
  podAt(x, z) {
    for (const p of this.pods) {
      if (p.alive && Math.abs(p.x - x) < 0.5 && Math.abs(p.z - z) < 0.5) return p;
    }
    return null;
  }

  // ------------------------------------------------ frame
  update(t, dt, frogPos, magnetR) {
    // pollen sim
    let count = 0;
    const fr = magnetR ?? 1.6;
    for (let i = 0; i < this._pollenAlive; i++) {
      const p = this._pollen[i];
      if (p.state === 'burst') {
        p.t += dt;
        p.vy -= 4.5 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.15) { p.y = 0.15; p.vy *= -0.4; p.vx *= 0.7; p.vz *= 0.7; }
        if (p.t > 0.7) p.state = 'idle';
      } else {
        // gentle bob
        p.y += Math.sin(t * 2 + p.t) * 0.0015;
      }
      const dx = frogPos.x - p.x, dy = (frogPos.y + 0.3) - p.y, dz = frogPos.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 0.5) {
        // absorb!
        p.state = 'dead';
        this.got.pollen++;
        this.ui?.bumpPollen?.(this.got.pollen, this.tot.pollen);
        this.audio?.pollen?.(this.got.pollen);
        this.effects?.pollenMote?.(frogPos.x, frogPos.y + 0.4, frogPos.z);
        // swap-remove: move last alive into slot i
        this._pollenAlive--;
        const last = this._pollen[this._pollenAlive];
        this._pollen[this._pollenAlive] = p;
        this._pollen[i] = last;
        i--;
        continue;
      } else if (d < fr) {
        const pull = (1 - d / fr) * 14 * dt;
        p.x += dx / d * pull; p.y += dy / d * pull; p.z += dz / d * pull;
      }
      this._m4.makeScale(1, 1, 1);
      this._m4.setPosition(p.x, p.y + Math.sin(t * 2.5 + i) * 0.04, p.z);
      this.pollenMesh.setMatrixAt(count++, this._m4);
    }
    this.pollenMesh.count = count;
    this.pollenMesh.instanceMatrix.needsUpdate = true;

    // shards / glyphs spin
    for (const s of this.shards) if (s.alive) {
      s.mesh.userData.core.rotation.y = t * 1.8;
      s.mesh.userData.ring.rotation.y = t * 1.1;
      s.mesh.userData.ring.rotation.x = Math.sin(t * 0.8) * 0.5;
      s.mesh.position.y = Math.sin(t * 1.6 + s.x) * 0.08;
    }
    for (const g of this.glyphs) if (g.alive) {
      g.mesh.userData.plate.rotation.z = t * 0.8;
      g.mesh.position.y = Math.sin(t * 1.2 + g.x) * 0.06;
    }
    for (const h of this.hourglasses) if (h.alive) {
      h.mesh.userData.halo.rotation.z = t * 2;
      h.mesh.position.y = Math.sin(t * 2.2 + h.x) * 0.06;
    }
    // idle pod wobble + beacon pulse
    for (const p of this.pods) if (p.alive) {
      p.mesh.userData.body.rotation.y = Math.sin(t * 1.2 + p.x * 3) * 0.12;
      p.mesh.userData.sprout.rotation.z = Math.sin(t * 2 + p.z) * 0.2;
      p.mesh.userData.seam.material.opacity = 0.65 + Math.sin(t * 3 + p.x) * 0.3;
      p.mesh.userData.seam.material.transparent = true;
      p.mesh.position.y = Math.sin(t * 1.8 + p.z * 2) * 0.05;
    }
    for (const gr of this.grapples) {
      gr.mesh.userData.ring.rotation.z = t * 1.2;
    }
  }
}
