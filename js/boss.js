// =============================================================================
// MANDELHOP — boss.js  ★ TEMPORAL GUARDIANS
// One traversal-tested encounter template, re-skinned per world: a colossal
// heron-deity. Pattern: circle → telegraph → swoop across a row (dodge!) →
// exhausted landing (HIT IT with spin/slam) → escalate. 3 hits → Temporal
// Gene → power ceremony. Pure pattern-recognition platforming, no health bar
// slog: the boss IS the level.
// =============================================================================
import * as THREE from 'three';
import { rowToZ, colToX, COLS, HALF } from './config.js';
import { buildGuardian, animateGuardian, buildGene } from './entities.js';

export class Guardian {
  constructor(ctx) {
    Object.assign(this, ctx);   // scene, audio, effects, ui, camera
    this.active = null;
  }

  // arena: rows [baseRow-1 .. baseRow+3] are safe; frog fights there
  start(game, worldIdx, theme) {
    const mesh = buildGuardian(theme, 2.1 + worldIdx * 0.12);
    const z = rowToZ(game.row) - 3.2;
    mesh.position.set(0, 1.6, z);
    mesh.rotation.y = Math.PI;   // face the frog
    this.scene.add(mesh);
    this.active = {
      mesh, worldIdx, hits: 0, state: 'intro', t: 0,
      home: new THREE.Vector3(0, 1.2, z), x: 0, z,
      swoopRow: 0, dir: 1, hp: 3,
      speedScale: 1 + worldIdx * 0.12,
    };
    this.audio.bossRoar?.();
    return this.active;
  }

  get isActive() { return !!this.active; }

  _setState(s, t = 0) { const a = this.active; a.state = s; a.t = t; }

  // powers call this through game.enemyHit
  tryHit(x, z, r, how) {
    const a = this.active;
    if (!a || a.state !== 'tired') return false;
    if (how !== 'spin' && how !== 'slam' && how !== 'superspin' && how !== 'seed') return false;
    const d = Math.hypot(a.mesh.position.x - x, a.mesh.position.z - z);
    if (d > r + 1.6) return false;
    a.hits++;
    this.audio.bossHit?.(a.hits);
    this.effects.goalBurst(a.mesh.position.x, a.mesh.position.z, 0xffe066);
    this.camera.shake(0.5);
    a.mesh.userData.glowMat.color.setHex(0xffffff);
    if (a.hits >= 3) {
      this._setState('dying', 0);
    } else {
      this._setState('recover', 0);
    }
    return true;
  }

  update(t, dt, game) {
    const a = this.active;
    if (!a) return;
    a.t += dt;
    const m = a.mesh;
    const frogZ = rowToZ(game.row);

    switch (a.state) {
      case 'intro': {
        // descend into arena
        m.position.y += (0.9 - m.position.y) * dt * 2.2;
        m.position.z += (frogZ - 3.2 - m.position.z) * dt * 2.0;
        m.rotation.x = 0.3;   // belly toward camera — readable bird
        animateGuardian(m, t, 'fly');
        if (a.t > 2.4) { this._setState('circle'); this.ui.banner('THE GUARDIAN STIRS', 'dodge the swoop — strike when it tires', 2400); }
        break;
      }
      case 'circle': {
        const R = 4.2;
        const ang = a.t * 0.9 * a.speedScale;
        m.position.set(Math.sin(ang) * R, 2.5 + Math.sin(t * 1.3) * 0.35, frogZ - 3.6 + Math.cos(ang) * 1.4);
        m.rotation.y = ang + Math.PI / 2;
        m.rotation.x = 0.25;
        animateGuardian(m, t, 'fly');
        if (a.t > 3.2 / a.speedScale) {
          this._setState('telegraph');
          a.swoopRow = game.row;   // target the frog's current row
          this.audio.telegraph();
        }
        break;
      }
      case 'telegraph': {
        m.rotation.y = Math.PI;   // square up to the frog before the swoop
        m.position.y += (2.2 - m.position.y) * dt * 3;
        m.position.x += (0 - m.position.x) * dt * 2;
        m.position.z += (rowToZ(a.swoopRow) - 0.2 - m.position.z) * dt * 4;
        m.position.x += (Math.random() - 0.5) * 0.1;
        m.userData.glowMat.color.setHex(0xff2255);
        animateGuardian(m, t, 'idle');
        if (a.t > 0.95) {
          this._setState('swoop');
          a.dir = Math.random() < 0.5 ? 1 : -1;
          m.position.x = -a.dir * 10;
          m.rotation.y = a.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        break;
      }
      case 'swoop': {
        const spd = 9.5 * a.speedScale;
        m.position.x += a.dir * spd * dt;
        m.position.y = 0.9;
        m.rotation.y = a.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        animateGuardian(m, t, 'fly');
        // kill grounded frog on that row
        if (game.state === 'play' && !game.frog.isHopping && !game.frog.dying
          && game.row === a.swoopRow && Math.abs(game.fx - m.position.x) < 1.1
          && game.powers.sliding <= 0) {
          game._die('squash');
        }
        if (Math.abs(m.position.x) > 10.5) { this._setState('land'); }
        break;
      }
      case 'land': {
        m.position.x += (0 - m.position.x) * dt * 2.5;
        m.position.z += (frogZ - 2.5 - m.position.z) * dt * 2.5;
        m.position.y += (0.4 - m.position.y) * dt * 3;
        let ry = Math.PI - m.rotation.y;
        while (ry > Math.PI) ry -= Math.PI * 2;
        while (ry < -Math.PI) ry += Math.PI * 2;
        m.rotation.y += ry * dt * 3;
        animateGuardian(m, t, 'idle');
        if (a.t > 1.0) { this._setState('tired'); this.audio.bossTired?.(); }
        break;
      }
      case 'tired': {
        animateGuardian(m, t, 'tired');
        m.userData.glowMat.color.setHSL(0.13, 1, 0.5 + Math.sin(t * 6) * 0.2);
        if (a.t > Math.max(1.9, 3.2 - a.worldIdx * 0.15)) { this._setState('recover'); }
        break;
      }
      case 'recover': {
        m.position.y += (3.6 - m.position.y) * dt * 2;
        m.userData.glowMat.color.setHex(0xff2255);
        animateGuardian(m, t, 'fly');
        if (a.t > 1.2) this._setState('circle');
        break;
      }
      case 'dying': {
        m.rotation.z += dt * 2.2;
        m.position.y += dt * 3;
        m.scale.multiplyScalar(1 - dt * 0.4);
        animateGuardian(m, t, 'fly');
        this.effects.spiral(m.position.x, m.position.y, m.position.z, 0xffe066);
        if (a.t > 1.6) {
          this._setState('gone');
          m.visible = false;
          // release the Temporal Gene
          const gene = buildGene(this._theme?.() ?? { flowerHue: 0.85 });
          gene.position.copy(m.position);
          gene.position.y = 1.2;
          this.scene.add(gene);
          a.gene = gene;
          this.audio.bossDown?.();
          game.onGuardianDown?.();
        }
        break;
      }
      case 'gone': {
        if (a.gene) {
          a.gene.rotation.y = t * 2;
          a.gene.position.y = 1.2 + Math.sin(t * 2) * 0.15;
        }
        break;
      }
    }
  }

  cleanup() {
    if (!this.active) return;
    const m = this.active.mesh;
    this.scene.remove(m);
    if (this.active.gene) this.scene.remove(this.active.gene);
    this.active = null;
  }
}
