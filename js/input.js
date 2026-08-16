// =============================================================================
// MANDELHOP — input.js  (timewarp)
// Keyboard / touch / gamepad. Directions = hop. Powers & time on letter keys.
//   J spin · K slam · L slide · I seed · U grapple · H dash
//   T hold = slow · F freeze · G phase · R retry · Q exit to hub
// =============================================================================
export class Input {
  constructor(cb) {
    this.cb = cb;
    this.held = new Set();
    this.lastDir = null;
    this.gpPrev = { x: 0, y: 0, buttons: [] };
    this.touch = null;

    const keyDir = {
      ArrowUp: [0, 1], KeyW: [0, 1],
      ArrowDown: [0, -1], KeyS: [0, -1],
      ArrowLeft: [-1, 0], KeyA: [-1, 0],
      ArrowRight: [1, 0], KeyD: [1, 0],
    };
    const keyAct = {
      Space: 'confirm', Enter: 'confirm',
      KeyP: 'pause', Escape: 'pause',
      KeyM: 'mute', KeyC: 'camera', KeyR: 'restart', F3: 'fps',
      KeyQ: 'exit',
      KeyJ: 'spin', KeyX: 'spin',
      KeyK: 'slam',
      KeyL: 'slide', ShiftLeft: 'slide',
      KeyI: 'seed',
      KeyU: 'grapple',
      KeyH: 'dash',
      KeyF: 'freeze', KeyG: 'phase',
      KeyB: 'reverse', KeyN: 'accelerate',
    };
    const keyDownOnly = new Set(['spin']);   // edge + hold tracking
    const holdAct = { KeyT: 'slow', KeyJ: 'spinHold' };

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const d = keyDir[e.code];
      if (d) {
        e.preventDefault();
        const k = d[0] + ',' + d[1];
        if (!this.held.has(k)) {
          this.held.add(k);
          this.lastDir = d;
          this.cb.onDir(d[0], d[1]);
        }
        return;
      }
      if (e.code === 'KeyT' && !e.repeat) { this.cb.onAction('slow'); return; }
      if (e.code === 'KeyJ' || e.code === 'KeyX') {
        if (!e.repeat) this.cb.onAction('spin');
        return;
      }
      const a = keyAct[e.code];
      if (a && !e.repeat) { e.preventDefault(); this.cb.onAction(a); }
    });
    window.addEventListener('keyup', (e) => {
      const d = keyDir[e.code];
      if (d) this.held.delete(d[0] + ',' + d[1]);
      if (e.code === 'KeyT') this.cb.onAction('slowUp');
      if (e.code === 'KeyJ' || e.code === 'KeyX') this.cb.onAction('spinUp');
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.cb.onAction('slowUp');
      this.cb.onAction('spinUp');
    });

    // --- touch: swipe = hop, tap = confirm, two-finger tap = spin ---
    const el = document.body;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      this.touch = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    }, { passive: false });
    el.addEventListener('pointermove', (e) => {
      if (!this.touch || this.touch.moved) return;
      const dx = e.clientX - this.touch.x, dy = e.clientY - this.touch.y;
      if (Math.hypot(dx, dy) > 28) {
        this.touch.moved = true;
        if (Math.abs(dx) > Math.abs(dy)) this.cb.onDir(Math.sign(dx), 0);
        else this.cb.onDir(0, dy < 0 ? 1 : -1);
      }
    }, { passive: false });
    el.addEventListener('pointerup', (e) => {
      if (this.touch && !this.touch.moved && performance.now() - this.touch.t < 400) {
        this.cb.onAction('confirm');
      }
      this.touch = null;
    });
  }

  heldDir() {
    if (this.lastDir && this.held.has(this.lastDir[0] + ',' + this.lastDir[1])) return this.lastDir;
    for (const k of this.held) { const [x, y] = k.split(',').map(Number); return [x, y]; }
    return null;
  }

  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      let x = 0, y = 0;
      const dz = 0.5;
      const dpad = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      if (ax < -dz || dpad(14)) x = -1; else if (ax > dz || dpad(15)) x = 1;
      if (ay < -dz || dpad(12)) y = 1; else if (ay > dz || dpad(13)) y = -1;
      if ((x || y) && (x !== this.gpPrev.x || y !== this.gpPrev.y)) {
        if (Math.abs(ax) > Math.abs(ay) || (x && !y)) this.cb.onDir(x, 0);
        else if (y) this.cb.onDir(0, y);
      }
      this.gpPrev.x = x; this.gpPrev.y = y;
      const btn = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      const prev = this.gpPrev.buttons;
      const edge = (i, act) => { if (btn(i) && !prev[i]) this.cb.onAction(act); };
      edge(0, 'confirm');
      edge(9, 'pause');
      edge(2, 'spin');
      edge(1, 'slam');
      edge(3, 'seed');
      edge(4, 'slide');
      edge(5, 'dash');
      edge(8, 'phase');
      if (btn(6)) this.cb.onAction('slow'); else if (prev[6]) this.cb.onAction('slowUp');
      edge(7, 'freeze');
      this.gpPrev.buttons = gp.buttons.map(b => b.pressed);
      break;
    }
  }
}
