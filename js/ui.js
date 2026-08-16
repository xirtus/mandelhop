// =============================================================================
// MANDELHOP — ui.js (timewarp)
// HUD: score · pollen · pods · shards · flow · chrono · lives · stopwatch.
// Overlays: title / stage select / pause / completion bloom / power ceremony.
// Completion is a garden, not a spreadsheet: every stat blooms as a flower.
// =============================================================================
import * as THREE from 'three';
import { POWERS, RELIC_LABEL } from './stages.js';

export class UI {
  constructor() {
    this.$ = (id) => document.getElementById(id);
    this.hud = this.$('hud');
    this.overlay = this.$('overlay');
    this.bannerEl = this.$('banner');
    this.popups = this.$('popups');
    this.fpsEl = this.$('fps');
    this._bannerT = null;
    this._popupPool = [];
    this._v = new THREE.Vector3();
  }

  bind(actions) {
    this.actions = actions;
    this.overlay.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b && this.actions[b.dataset.act]) this.actions[b.dataset.act](b.dataset.arg, b.dataset.arg2);
    });
  }

  // --- HUD ---
  setScore(v) { this.$('score').textContent = String(v).padStart(6, '0'); }
  setBest(v) { this.$('best').textContent = String(v).padStart(6, '0'); }
  setBiome(name) { this.$('biome').textContent = name; }
  setDist(d) { this.$('dist').textContent = `DEPTH ${String(d).padStart(4, '0')}`; }
  setLives(n) {
    this.$('lives').innerHTML = Array.from({ length: Math.max(0, n) },
      () => '<span class="life">🐸</span>').join('');
  }
  setTime(f) {
    const el = this.$('timefill');
    el.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`;
    el.style.background = f < 0.25 ? '#ff4d6d' : '';
  }
  flash() {
    if (this.reduced) return;
    const f = this.$('flash');
    f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  }
  get reduced() { try { return localStorage.getItem('mandelhop_reduced') === '1'; } catch (e) { return false; } }
  setReduced(v) { try { localStorage.setItem('mandelhop_reduced', v ? '1' : '0'); } catch (e) { } }
  setFps(txt) { this.fpsEl.textContent = txt; }
  showFps(b) { this.fpsEl.style.display = b ? 'block' : 'none'; }

  // mode-specific HUD chrome
  showHud(mode, opts = {}) {
    const collect = this.$('collect-hud');
    const chrono = this.$('chrono-hud');
    const flow = this.$('flow-hud');
    const timebar = this.$('timebar');
    const dist = this.$('dist');
    if (mode === 'stage') {
      collect.style.display = 'flex';
      chrono.style.display = 'block';
      flow.style.display = 'block';
      timebar.style.display = 'none';
      dist.style.display = 'none';
      this.bumpPollen(0, opts.stage ? (opts.stage.pollen || 0) : 0);
      this.bumpPods(0, 0);
      this.bumpShards(0, opts.stage ? (opts.stage.shards || 5) : 5);
      this.showStopwatch(opts.trial);
      this.$('trial-badge').style.display = opts.trial ? 'block' : 'none';
      this.renderPowerBar(opts.progress);
    } else if (mode === 'endless') {
      collect.style.display = 'none';
      chrono.style.display = 'block';
      flow.style.display = 'block';
      timebar.style.display = 'block';
      dist.style.display = 'block';
      this.showStopwatch(false);
      this.$('trial-badge').style.display = 'none';
      this.renderPowerBar(opts.progress);
    } else { // hub
      collect.style.display = 'none';
      chrono.style.display = 'none';
      flow.style.display = 'none';
      timebar.style.display = 'none';
      dist.style.display = 'none';
      this.showStopwatch(false);
      this.$('trial-badge').style.display = 'none';
      this.$('power-bar').innerHTML = '';
    }
  }

  renderPowerBar(progress) {
    const bar = this.$('power-bar');
    if (!progress) { bar.innerHTML = ''; return; }
    bar.innerHTML = Object.entries(POWERS).map(([id, p]) =>
      `<span class="pw ${progress.hasPower(id) ? 'on' : ''}" title="${p.name} (${p.key})">${p.icon}</span>`
    ).join('');
  }

  bumpPollen(got, tot) {
    this.$('pollen-count').textContent = `✦ ${got}`;
    const el = this.$('pollen-count');
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
  bumpPods(got, tot) {
    this.$('pods-count').textContent = `⬡ ${got}/${tot}`;
    const el = this.$('pods-count');
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
  bumpShards(got, tot) {
    this.$('shards-count').textContent = `◆ ${got}/${tot}`;
    const el = this.$('shards-count');
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
  bumpAmmo(n) { /* subtle — ammo shown as seed dots near chrono */ }

  setChrono(f, slowing, frozen) {
    const el = this.$('chronofill');
    if (!el) return;
    el.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`;
    el.style.background = frozen ? '#9fd8ff' : slowing ? '#66f2ff' : '';
    this.$('chrono-hud').classList.toggle('active', slowing || frozen);
  }

  setFlow(f, state) {
    const el = this.$('flowfill');
    if (!el) return;
    el.style.transform = `scaleX(${f})`;
    this.$('flow-hud').classList.toggle('flowstate', state);
  }

  showAir(on) {
    let el = this.$('airbar');
    if (!el) {
      el = document.createElement('div');
      el.id = 'airbar';
      el.innerHTML = '<div id="airfill"></div>';
      this.$('hud').appendChild(el);
    }
    el.style.display = on ? 'block' : 'none';
  }
  setAir(f) {
    const el = this.$('airfill');
    if (el) {
      el.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`;
      el.style.background = f < 0.3 ? '#ff4d6d' : '';
    }
  }

  showStopwatch(on) {
    this.$('stopwatch').style.display = on ? 'block' : 'none';
  }
  setStopwatch(t, frozen) {
    const el = this.$('stopwatch');
    el.textContent = fmtTime(t);
    el.classList.toggle('frozen', !!frozen);
  }

  hint(txt) {
    const el = this.$('hint');
    el.textContent = txt;
    el.classList.toggle('on', !!txt);
  }

  // --- overlays ---
  showTitle(best, opts) {
    this.overlay.innerHTML = `
      <div class="panel title-panel">
        <div class="logo">MANDEL<span>HOP</span></div>
        <div class="tagline">TIMEWARP — a psychedelic platforming odyssey</div>
        <div class="best">BEST ${String(best).padStart(6, '0')}</div>
        <div class="press blink">${navigator.maxTouchPoints > 0 ? 'TAP TO BEGIN' : 'PRESS SPACE TO BEGIN'}</div>
        <div class="controls">
          ${navigator.maxTouchPoints > 0
            ? 'swipe to hop · tap to start'
            : '←↑↓→/WASD hop · J spin · K slam · L slide · I seed · U grapple · H dash<br>T hold = slow time · F freeze · G phase · R retry · Q hub · C camera'}
        </div>
        <div class="opts">
          <button data-act="sound">SOUND: ${opts.sound ? 'ON' : 'OFF'}</button>
          <button data-act="camera">CAMERA: ${opts.camera.toUpperCase()}</button>
          <button data-act="reduced">FLASH/MOTION: ${this.reduced ? 'REDUCED' : 'FULL'}</button>
        </div>
      </div>`;
    this.overlay.className = 'show';
  }

  showStageSelect(world, stages, progress, cb) {
    this._stageCb = cb;
    const rows = stages.map(s => {
      const st = progress.stage(s.id);
      const unlocked = progress.stageUnlocked(s);
      const isGuardian = !!s.guardian;
      const stars = st.done ? '✦' : '';
      const relic = st.relic ? `<span class="relic relic-${st.relic}">${RELIC_LABEL[st.relic]}</span>` : '';
      const best = st.bestTime != null ? `<span class="stime">${fmtTime(st.bestTime)}</span>` : '';
      const req = (s.requiredAbilities || []).filter(a => !progress.hasPower(a));
      const lockTxt = !unlocked ? '🔒' : (req.length ? `⚠ needs ${req.join(',')}` : '');
      return `
        <button class="stage-row ${unlocked ? '' : 'locked'} ${isGuardian ? 'guardian' : ''}"
          data-stage="${s.id}" ${unlocked ? '' : 'disabled'}>
          <span class="sname">${isGuardian ? '👑 ' : ''}${s.name} ${stars}</span>
          <span class="smeta">${relic}${best}${lockTxt}</span>
          ${unlocked && st.done && !isGuardian ? `<span class="strial" data-trial="${s.id}">⏱ TIME RUN</span>` : ''}
        </button>`;
    }).join('');
    this.overlay.innerHTML = `
      <div class="panel select-panel">
        <div class="big">${world.name}</div>
        <div class="sub">${world.blurb}</div>
        <div class="stage-list">${rows}</div>
        <div class="opts"><button data-stage="">← BACK TO THE POND</button></div>
      </div>`;
    this.overlay.className = 'show';
    this.overlay.querySelectorAll('[data-stage]').forEach(b => {
      b.addEventListener('click', (e) => {
        if (e.target.dataset.trial) return;
        const id = b.dataset.stage;
        this._stageCb(id || null, false);
      });
    });
    this.overlay.querySelectorAll('[data-trial]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this._stageCb(b.dataset.trial, true);
      });
    });
  }

  showPause() {
    this.overlay.innerHTML = `
      <div class="panel">
        <div class="big">PAUSED</div>
        <div class="press blink">PRESS P TO RESUME</div>
        <div class="opts">
          <button data-act="sound">SOUND</button>
          <button data-act="camera">CAMERA</button>
          <button data-act="restart">RETRY STAGE</button>
          <button data-act="exit">RETURN TO POND</button>
        </div>
      </div>`;
    this.overlay.className = 'show';
  }

  showGameOver(score, depth, best, bestDepth, isNew, cb) {
    this.overlay.innerHTML = `
      <div class="panel">
        <div class="big glitch">THE BETWEEN TAKES YOU</div>
        ${isNew ? '<div class="newbest">✦ NEW BEST ✦</div>' : ''}
        <div class="final">${String(score).padStart(6, '0')}</div>
        <div class="best">DEPTH ${depth} · BEST ${String(best).padStart(6, '0')} · DEEPEST ${bestDepth}</div>
        <div class="press blink">PRESS SPACE — RETURN TO THE POND</div>
      </div>`;
    this.overlay.className = 'show';
  }

  showStageFail(stage, retryCb, hubCb) {
    this.overlay.innerHTML = `
      <div class="panel">
        <div class="big glitch">THE TIMELINE REJECTS YOU</div>
        <div class="sub">${stage.name}</div>
        <div class="opts">
          <button data-act="restart">↻ TRY AGAIN (R)</button>
          <button data-act="exit">RETURN TO POND (Q)</button>
        </div>
      </div>`;
    this.overlay.className = 'show';
  }

  // ---- COMPLETION — stats bloom as flowers -----------------------------------
  showCompletion(stage, res, relicLabel, doneCb) {
    const petal = (ok, label, val, delay) => `
      <div class="bloom-stat ${ok ? 'ok' : 'dim'}" style="animation-delay:${delay}s">
        <div class="bloom"><div class="petals"></div></div>
        <div class="blabel">${label}</div>
        <div class="bval">${val}</div>
      </div>`;
    const blooms = res.blooms.map((b, i) => `<div class="award" style="animation-delay:${1 + i * 0.2}s">❀ ${b}</div>`).join('');
    const relic = res.relic ? `<div class="award relic relic-${res.relic}" style="animation-delay:1.4s">⏳ ${relicLabel[res.relic]}</div>` : '';
    this.overlay.innerHTML = `
      <div class="panel complete-panel">
        <div class="big bloom-title">${stage.name} — COMPLETE</div>
        <div class="bloom-row">
          ${petal(true, 'TIME POLLEN', `${res.pollen} / ${res.pollenTot}`, 0.1)}
          ${petal(res.pods >= res.podsTot, 'CHRONOPODS', `${res.pods} / ${res.podsTot}`, 0.25)}
          ${petal(res.shards.length >= res.shardsTot, 'SHARDS', `${res.shards.length} / ${res.shardsTot}`, 0.4)}
          ${petal(res.secrets >= res.secretsTot, 'SECRETS', `${res.secrets} / ${res.secretsTot}`, 0.55)}
          ${petal(res.deaths === 0, 'DEATHS', `${res.deaths}`, 0.7)}
          ${res.time != null ? petal(!!res.relic, 'TIME', fmtTime(res.time), 0.85) : ''}
        </div>
        <div class="awards">${blooms}${relic}</div>
        <div class="press blink">PRESS SPACE — THE POND AWAITS</div>
      </div>`;
    this.overlay.className = 'show';
    this._completeCb = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        removeEventListener('keydown', this._completeCb);
        doneCb();
      }
    };
    addEventListener('keydown', this._completeCb);
    this.overlay.addEventListener('click', function h() {
      removeEventListener('keydown', this._completeCb);
      doneCb();
    }, { once: true });
  }

  // ---- POWER CEREMONY ---------------------------------------------------------
  showCeremony(power, doneCb) {
    this.overlay.innerHTML = `
      <div class="ceremony">
        <div class="gene-ring"></div>
        <div class="cera-icon">${power.icon}</div>
        <div class="cera-name">${power.name}</div>
        <div class="cera-desc">${power.desc}</div>
        <div class="cera-key">◈ ${power.key} ◈</div>
        <div class="press blink">PRESS SPACE — EVOLVE</div>
      </div>`;
    this.overlay.className = 'show cera';
    const done = (e) => {
      if (e.type === 'click' || e.code === 'Space' || e.code === 'Enter') {
        removeEventListener('keydown', done);
        this.overlay.className = '';
        this.audio?.uiClick?.();
        doneCb();
      }
    };
    addEventListener('keydown', done);
    this.overlay.addEventListener('click', done, { once: true });
  }

  hideOverlay() { this.overlay.className = ''; }
  clearBanner() {
    clearTimeout(this._bannerT);
    this.bannerEl.classList.remove('on');
  }

  banner(title, sub = '', dur = 2200) {
    this.bannerEl.innerHTML = `<div class="b-title">${title}</div><div class="b-sub">${sub}</div>`;
    this.bannerEl.classList.remove('on'); void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('on');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => this.bannerEl.classList.remove('on'), dur);
  }

  popup(text, worldPos, color = '#ffe066') {
    let el = this._popupPool.find(p => !p.busy);
    if (!el) {
      el = { div: document.createElement('div'), busy: false };
      el.div.className = 'pop';
      this.popups.appendChild(el.div);
      this._popupPool.push(el);
    }
    el.busy = true;
    el.div.textContent = text;
    el.div.style.color = color;
    el.world = worldPos.clone();
    el.t = 0;
    el.div.style.opacity = '1';
  }

  update(dt, camera) {
    const w = window.innerWidth, h = window.innerHeight;
    for (const p of this._popupPool) {
      if (!p.busy) continue;
      p.t += dt;
      if (p.t > 1.2) { p.busy = false; p.div.style.opacity = '0'; continue; }
      this._v.copy(p.world);
      this._v.y += 0.8 + p.t * 0.9;
      this._v.project(camera);
      p.div.style.transform = `translate(${(this._v.x * 0.5 + 0.5) * w}px, ${(-this._v.y * 0.5 + 0.5) * h}px)`;
      p.div.style.opacity = String(1 - Math.max(0, p.t - 0.6) / 0.6);
    }
  }
}

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), ms = Math.floor((t % 1) * 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}
