// =============================================================================
// MANDELHOP — manual.js
// Ambient spore canvas, scroll-spy nav, animated counters, content renderers
// (biomes / hazards / bends / tech / archetypes), kbd flash, and a fully
// playable micro-frogger so the manual teaches the verb itself.
// =============================================================================

/* ---------------- ambient spores ---------------- */
(() => {
  const c = document.getElementById('spores');
  const x = c.getContext('2d');
  let w, h, P = [];
  const resize = () => {
    w = c.width = innerWidth; h = c.height = innerHeight;
    P = Array.from({ length: Math.min(90, w / 16) }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: 0.6 + Math.random() * 2.2, s: 0.15 + Math.random() * 0.4,
      p: Math.random() * Math.PI * 2,
      hue: [168, 320, 46, 270][Math.floor(Math.random() * 4)],
    }));
  };
  resize(); addEventListener('resize', resize);
  (function loop(t) {
    requestAnimationFrame(loop);
    x.clearRect(0, 0, w, h);
    const g = x.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h * 0.3, Math.max(w, h));
    g.addColorStop(0, 'rgba(40,16,80,0.35)'); g.addColorStop(1, 'rgba(7,3,15,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (const p of P) {
      p.y -= p.s; p.x += Math.sin(t / 2000 + p.p) * 0.3;
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      const a = 0.25 + 0.35 * Math.sin(t / 900 + p.p);
      x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7);
      x.fillStyle = `hsla(${p.hue}, 95%, 70%, ${a})`;
      x.shadowBlur = 12; x.shadowColor = `hsla(${p.hue},95%,65%,0.8)`;
      x.fill(); x.shadowBlur = 0;
    }
  })(0);
})();

/* ---------------- scroll progress + spy ---------------- */
(() => {
  const bar = document.getElementById('progress');
  const links = [...document.querySelectorAll('#side a[data-spy]')];
  const secs = links.map(a => document.querySelector(a.getAttribute('href')));
  addEventListener('scroll', () => {
    const d = document.documentElement;
    bar.style.width = (scrollY / (d.scrollHeight - innerHeight) * 100) + '%';
    let cur = 0;
    secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.4) cur = i; });
    links.forEach((a, i) => a.classList.toggle('active', i === cur));
  }, { passive: true });
})();

/* ---------------- animated counters ---------------- */
(() => {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const el = e.target, end = +el.dataset.count, t0 = performance.now();
    (function tick(t) {
      const k = Math.min(1, (t - t0) / 1200);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }), { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach(el => io.observe(el));
})();

/* ---------------- content: biomes ---------------- */
const BIOMES = [
  ['NEON GARDEN', 'rows 0+', '#12082b,#4a1e6e,#ff7ecb', 'The onboarding dream. Cars, logs, lilies — the grammar of hopping, taught in neon.'],
  ['DUSK HIGHWAY', 'rows 30+', '#0b0620,#34125e,#ff9a3d', 'Traffic-dense. Long vehicle chains, thin medians. Learn to read two lanes ahead.'],
  ['SAPPHIRE RIVER', 'rows 60+', '#03182b,#0b3a5c,#39d0ff', 'Water dominates. Long rides, platform chains, and the dragonflies begin to hunt.'],
  ['JADE WETLAND', 'rows 90+', '#0a2018,#1d5c3a,#ffd76e', 'Sinking lilies and the first portal rows. The edges stop being edges.'],
  ['PSYCHEDELIC RAINFOREST', 'rows 120+', '#06170e,#14532d,#ff4fa3', 'Sheared space: rows slide sideways. Caterpillars own the road.'],
  ['ALIEN JUNGLE', 'rows 150+', '#150530,#3d0f6e,#2ef2ff', 'Mirror zones and patrolling snakes. Your hands will lie to you; trust the frog.'],
  ['FRACTAL OCEAN', 'rows 180+', '#020a1e,#0a2350,#59f2e6', 'Almost all water. Orbs drift where cars used to be. Breathe between waves.'],
  ['MANDELBROT TEMPLE', 'rows 210+', '#0a0214,#2b0a4a,#ffb347', 'The Pulse wakes — lanes breathe with orbit-trap rhythms. Gold over black.'],
  ['RECURSIVE COSMOS', 'rows 240+', '#050214,#1c0f45,#b44dff', 'Chompers, mantas, everything at once — then the cycle returns, faster.'],
];
document.getElementById('biomes').innerHTML = BIOMES.map(([n, r, pal, d]) => `
  <div class="card biome">
    <div class="swatch" style="background:linear-gradient(135deg,${pal.split(',')})"></div>
    <h4>${n}</h4><div class="rows">${r}</div><p>${d}</p>
  </div>`).join('');

/* ---------------- content: hazards ---------------- */
const HAZARDS = [
  ['🪰', 'DRAGONFLY HUNTER', 'depth 40', 'Stalks you from behind, trembles and glissandos, then dashes across your row. The telegraph is the warning — never be where you were.'],
  ['🪷', 'SINKING LILY', 'depth 60', 'Red-veined pads dip after ~1.4 s underfoot. Beautiful, damp, treacherous. Hop on, hop off.'],
  ['🐍', 'GARDEN SNAKE', 'depth 150', 'Patrols safe rows on a sine path. Its rhythm is slow; your greed is the hazard.'],
  ['🌸', 'CHOMPER BLOOM', 'depth 250', 'Opens slowly, snaps fast. Deadly only in the snap window — cross while it yawns.'],
  ['🚗', 'LIVING TRAFFIC', 'always', 'Cars → beetles → caterpillars → orbs → mantas as biomes shift. Silhouettes stay honest; speed rises with depth.'],
  ['⏳', 'BLOOM ENERGY', 'always', 'Your quiet timer. Pollen orbs feed it (+3s), mandalas refill it. Stillness kills.'],
];
document.getElementById('hazards').innerHTML = HAZARDS.map(([i, n, dep, d]) => `
  <div class="card hazard"><div class="icon">${i}</div>
  <div><h4>${n} <span class="depth">· ${dep}</span></h4><p>${d}</p></div></div>`).join('');

/* ---------------- content: bent space ---------------- */
const BENDS = [
  ['PORTAL ROWS', 'depth 90 · green pillars', 'The track becomes a torus. Hop off the right edge, arrive at the left — and a log leaving one side will carry you clean through to the other. Toroidal collision: the math matches the myth.'],
  ['SHEARED SPACE', 'depth 120', 'Adjacent rows slide ±½ tile. Vertical hops land between columns; the garden rearranges itself under your feet.'],
  ['MIRROR ZONES', 'depth 150 · violet pillars', 'Left becomes right while you stand in the violet light. One row of wrong-handedness is plenty.'],
  ['WORMHOLE PAIRS', 'depth 90', 'Twin swirling rings on safe rows. Step in one, step out the other, with a swoop and a burst of pollen.'],
];
document.getElementById('bends').innerHTML = BENDS.map(([n, dep, d]) => `
  <div class="card bend"><h4>${n}</h4><div class="depth">${dep}</div><p>${d}</p></div>`).join('');

/* ---------------- content: tech ---------------- */
const TECH = [
  ['water as a hero', 'Analytic spectral waves (JONSWAP-inspired, adapted from poseidon/MIT), Fresnel, subsurface scatter, glitter, caustic webs, ripple rings from every frog impact. Render-only: gameplay stays deterministic.'],
  ['an ecosystem, not assets', 'Instanced ribbon grass with sway-factor wind (adapted from gaia/MIT), genomes per chunk, flowers that bloom in waves from your hops, blades that part around the frog.'],
  ['the sky is the set', 'A kaleidoscopic Julia/Mandelbrot dome; its seed morphs between biomes so the sky descends with you. Orbit-trap pulses drive deep-zone traffic.'],
  ['generative music', 'Web Audio only: lookahead sequencer at 96 BPM, pentatonic hop ladder, drones, generated-IR reverb, tempo delay. Gameplay composes the soundtrack.'],
  ['infinite engine', 'Rows generated 45 ahead, pooled and recycled 25 behind; vegetation in biome-keyed chunks; one world-anchored water plane masked per row.'],
  ['discipline', '~120 fps on Apple Silicon. Instancing, pooling, blob shadows, zero per-frame allocation in hot loops, fps/draw-call HUD on F.'],
];
document.getElementById('techgrid').innerHTML = TECH.map(([n, d]) => `
  <div class="card mini"><h4>${n}</h4><p>${d}</p></div>`).join('');

/* ---------------- content: warped archetypes ---------------- */
const ARCH = [
  ['THE PATH', 'classic · all biomes', 'Pure Descent segments, hand-seeded: curated gauntlets with a beginning, an end, and a mean streak. The bread of the warp room.'],
  ['RAPIDS RIDE', 'water · forward-scrolling', 'Continuous log-surfing down an endless falls — the camera scrolls, you steer. Lily ramps, whirlpool wormholes, dive gates.'],
  ['THE CHASE', 'pursuit · reverse camera', 'The Dragonfly Matriarch floods the lanes behind you. Hop toward the camera through oncoming traffic. Crash DNA, verbatim.'],
  ['BEETLE-BACK', 'riding · locked mount', 'Straddle a giant jewel beetle: faster, wider, no mid-lane idle. Steer streams of traffic like a slalom.'],
  ['TEMPLE TRIALS', 'puzzle · bent space', 'Short, cruel compositions of portals, mirrors and shear. Small boards, huge thoughts.'],
  ['GUARDIAN BLOOMS', 'boss · arena', 'Mother Chomper, the Matriarch, the Mandelcore. Lane mechanics weaponized. Beat them, take their moves.'],
];
document.getElementById('archetypes').innerHTML = ARCH.map(([n, v, d]) => `
  <div class="card arch"><h4>${n}</h4><div class="verb">${v}</div><p>${d}</p></div>`).join('');

/* ---------------- kbd flash on real keypress ---------------- */
addEventListener('keydown', (e) => {
  const map = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', Space: 'Space' };
  const ch = map[e.code];
  if (!ch) return;
  document.querySelectorAll('kbd').forEach(k => {
    if (k.textContent === ch) { k.classList.add('hit'); setTimeout(() => k.classList.remove('hit'), 130); }
  });
});

/* ---------------- MICRO-FROGGER ---------------- */
(() => {
  const W = 7, H = 7;
  const board = document.getElementById('mg-board');
  const msg = document.getElementById('mg-msg');
  const cells = [];
  for (let i = 0; i < W * H; i++) {
    const d = document.createElement('div');
    d.className = 'mg-cell';
    board.appendChild(d); cells.push(d);
  }
  const lanes = [ // rows 1..5 are roads
    { dir: 1, sp: 3.2, cars: [0, 4] },
    { dir: -1, sp: 2.4, cars: [2, 6] },
    { dir: 1, sp: 4.2, cars: [3] },
    { dir: -1, sp: 2.8, cars: [1, 5] },
    { dir: 1, sp: 3.6, cars: [2, 6] },
  ];
  let fx, fy, dead, won;
  const reset = () => { fx = 3; fy = 6; dead = false; won = false; msg.textContent = 'reach the top ✦ row'; };
  reset();
  const hop = (dx, dy) => {
    if (dead || won) reset();
    fx = Math.max(0, Math.min(W - 1, fx + dx));
    fy = Math.max(0, Math.min(H - 1, fy + dy));
  };
  addEventListener('keydown', (e) => {
    const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] }[e.code];
    if (!m) return;
    const r = board.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) { hop(m[0], m[1]); e.preventDefault(); }
  });
  document.querySelectorAll('#mg-pad button').forEach(b =>
    b.addEventListener('click', () => { const [dx, dy] = b.dataset.d.split(',').map(Number); hop(dx, dy); }));
  let last = 0;
  (function loop(t) {
    requestAnimationFrame(loop);
    if (t - last < 33) return; last = t;
    for (const l of lanes) l.cars = l.cars.map(x => (x + l.dir * l.sp * 0.033 + W) % W);
    // collision
    if (!dead && !won && fy >= 1 && fy <= 5) {
      const l = lanes[fy - 1];
      if (l.cars.some(cx => Math.abs(cx - fx) < 0.6)) { dead = true; msg.textContent = 'squashed — hop to retry'; }
    }
    if (!won && fy === 0) { won = true; msg.textContent = '✦ +10 — the real garden awaits ✦'; }
    // draw
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = cells[y * W + x];
      c.className = 'mg-cell' + (y === 0 ? ' goal' : y >= 1 && y <= 5 ? ' road' : '');
      c.textContent = '';
    }
    for (let li = 0; li < lanes.length; li++) {
      for (const cx of lanes[li].cars) {
        const xi = Math.round(cx);
        if (xi >= 0 && xi < W) { cells[(li + 1) * W + xi].classList.add('car'); cells[(li + 1) * W + xi].textContent = ''; }
      }
    }
    const fc = cells[fy * W + fx];
    fc.classList.add('frog');
    fc.textContent = dead ? '💥' : won ? '🌸' : '🐸';
  })(0);
})();
