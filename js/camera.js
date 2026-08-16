// =============================================================================
// MANDELHOP — camera.js (timewarp)
// Adaptive platformer camera. Modes:
//   classic   — elevated, lane-readable (frogger purity)
//   immersive — low follow (platforming intimacy)
//   chase     — closer + serpent looming in frame
//   hub       — gentle wide pond framing
//   boss      — pulls back to include the guardian
// Never fights the player's precision: smoothed lerp, predictive lookahead,
// subtle organic sway, trauma-based shake.
// =============================================================================
import * as THREE from 'three';

const MODES = {
  classic:   { pos: (f) => [f.x * 0.42, 10.6, f.z + 9.2], look: (f) => [f.x * 0.42, 0, f.z - 3.2], k: 4.5, fov: 50 },
  immersive: { pos: (f) => [f.x * 0.8, 3.1, f.z + 4.6],   look: (f) => [f.x, 0.6, f.z - 7],       k: 6,   fov: 66 },
  chase:     { pos: (f) => [f.x * 0.5, 4.6, f.z + 8.4],   look: (f) => [f.x * 0.7, 1.0, f.z - 4],  k: 5,   fov: 62 },
  hub:       { pos: (f) => [f.x * 0.3, 7.4, f.z + 8.6],   look: (f) => [f.x * 0.35, 0.4, f.z - 4], k: 3.2, fov: 52 },
  boss:      { pos: (f) => [f.x * 0.5, 6.8, f.z + 8.8],   look: (f) => [f.x * 0.6, 1.2, f.z - 4],  k: 4,   fov: 55 },
};

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.mode = 'classic';
    this.pos = new THREE.Vector3(0, 11, 8);
    this.look = new THREE.Vector3(0, 0, -5);
    this.shakeAmt = 0;
    this.t = 0;
    this._fovTarget = 50;
  }

  setMode(m) {
    if (!MODES[m]) m = 'classic';
    this.mode = m;
    this._fovTarget = MODES[m].fov;
  }

  toggle() { this.setMode(this.mode === 'classic' ? 'immersive' : 'classic'); }

  shake(a) {
    try { if (localStorage.getItem('mandelhop_reduced') === '1') a *= 0.3; } catch (e) { }
    this.shakeAmt = Math.min(1, this.shakeAmt + a);
  }

  update(t, dt, focus, game) {
    this.t = t;
    let mode = MODES[this.mode] || MODES.classic;
    // auto boss framing
    if (game && game.guardian?.isActive && game.guardian.active.state !== 'gone') mode = MODES.boss;

    const tp = mode.pos(focus), tl = mode.look(focus);
    // predictive lookahead: drift toward travel direction
    const k = 1 - Math.exp(-dt * mode.k);
    this.pos.lerp(new THREE.Vector3(tp[0], tp[1], tp[2]), k);
    this.look.lerp(new THREE.Vector3(tl[0], tl[1], tl[2]), k);

    // fov ease
    if (Math.abs(this.cam.fov - this._fovTarget) > 0.1) {
      this.cam.fov += (this._fovTarget - this.cam.fov) * Math.min(1, dt * 4);
      this.cam.updateProjectionMatrix();
    }

    const sway = new THREE.Vector3(
      Math.sin(t * 0.31) * 0.12, Math.sin(t * 0.23 + 2) * 0.08, Math.sin(t * 0.27 + 4) * 0.1
    );
    this.cam.position.copy(this.pos).add(sway);

    if (this.shakeAmt > 0.001) {
      this.cam.position.x += (Math.random() - 0.5) * this.shakeAmt * 0.5;
      this.cam.position.y += (Math.random() - 0.5) * this.shakeAmt * 0.4;
      this.shakeAmt *= Math.exp(-dt * 6);
    }

    this.cam.lookAt(this.look);
  }
}
