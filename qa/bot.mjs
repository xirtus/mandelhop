// MANDELHOP QA — the PLAYER AGENTS.
// node qa/bot.mjs <stageId> <skill: new|pro> [trial]
// Drives the real game with a heuristic hopper; reports deaths, time,
// completion, and whether any death was "unfair" (camera/system fault).
import { chromium } from 'playwright';
const stageId = process.argv[2] || 'w1s1';
const skill = process.argv[3] || 'pro';
const trial = process.argv[4] === 'trial';

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(800);

// grant all powers for stages that need them
await page.evaluate(() => window.__qa.grantAll());
await page.evaluate(([id, tr]) => window.__qa.stage(id, tr), [stageId, trial]);
await page.waitForTimeout(600);

const result = await page.evaluate(async ([skill]) => {
  const g = window.__game;
  const rowToZ = (r) => -r;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const stats = { hops: 0, deaths: 0, startLives: g.lives, completed: false, t0: performance.now(), maxRow: 0, deathRows: [] };
  window.__traceBot = true; window.__botLog = [];
  const origDie = g._die.bind(g);
  g._die = (type) => { stats.deathRows.push({ row: g.row, fx: +g.fx.toFixed(1), type }); origDie(type); };

  // predict vehicle x at +dtAhead seconds
  function vehXAt(e, row, dtA) {
    const span = row.total;
    let x = e.x + row.dir * row.speed * (row.pulseMul || 1) * dtA;
    // wrap into [minX, minX+total)
    const m = span;
    x = row.minX + (((x - row.minX) % m) + m) % m;
    return x;
  }
  function dangerAt(row, x, dtA) {
    if (!row) return 'void';
    if (row.type === 'road') {
      for (const e of row.ents) {
        const ex = vehXAt(e, row, dtA);
        if (Math.abs(ex - x) < e.len / 2 + 0.55) return 'traffic';
      }
      return null;
    }
    if (row.type === 'river') {
      if (row.phaseFrozen) return null;
      for (const e of row.ents) {
        const ex = vehXAt(e, row, dtA);
        if (Math.abs(ex - x) < e.len / 2 + 0.2) {
          // will the platform carry us off the world or sink?
          if (!row.wrap && Math.abs(ex + row.dir * row.speed * 0.7) > 5.6) continue;
          if (row.sinker) continue;
          return null;
        }
      }
      return 'water';
    }
    if (row.chompers) for (const c of row.chompers) if (Math.abs(c.x - x) < 0.5) return 'chomper-maybe';
    if (row.snake) { /* snakes move slow; ignore for pro, avoid for new */ if (skill === 'new') { const sx = Math.sin((g.worldT + row.snake.ph) * row.snake.sp) * 5.2; if (Math.abs(sx - x) < 0.8) return 'snake'; } }
    return null;
  }

  const think = skill === 'new' ? 290 : 120;
  let guard = 0, stalls = 0;
  while (guard++ < 1200) {
    await sleep(think);
    if (g.state === 'complete' || g.state === 'gameover') break;
    if (g.state !== 'play' || g.frog.isHopping || g.frog.dying) continue;
    const row = g.rows.get(g.row);
    if (!row) continue;

    // dragonfly telegraph/dash → evade the row NOW
    const df = g.df;
    if (df && (df.state === 'telegraph' || (df.state === 'dash' && Math.abs(df.x - g.fx) < 7)) && df.targetRow === g.row) {
      const opts = [];
      for (const [dx, dy] of [[0, 1], [1, 1], [-1, 1], [0, -1]]) {   // must change ROW
        const rw = g.rows.get(g.row + dy);
        if (!rw) continue;
        const tx = Math.max(-6, Math.min(6, g.fx + dx));
        const t1 = ttd(rw, tx, 1.2);
        if (t1 > 0.3) opts.push({ dx, dy, t1 });
      }
      if (opts.length) {
        opts.sort((a, b) => b.t1 - a.t1);
        g.onDir(opts[0].dx, opts[0].dy);
        stats.hops++;
        continue;
      }
    }

    // time until danger at (row, x)
    function ttd(rw, x, maxT = 2.2) {
      for (let dtA = 0.05; dtA <= maxT; dtA += 0.1) {
        if (dangerAt(rw, x, dtA)) return dtA;
      }
      return maxT;
    }
    // rivers: time until a RIDEABLE window opens (platform present & persists)
    function riverWindow(rw, x, maxT = 1.6) {
      if (rw.phaseFrozen) return 0;
      for (let dtA = 0.08; dtA <= Math.min(maxT, 0.34); dtA += 0.06) {
        let plat = null;
        for (const e of rw.ents) {
          const ex = vehXAt(e, rw, dtA);
          if (Math.abs(ex - x) < e.len / 2 + 0.15) { plat = e; break; }
        }
        if (!plat) continue;
        // window must persist through landing + next decision
        let ok = true;
        for (let d2 = dtA + 0.2; d2 < dtA + 1.0; d2 += 0.15) {
          const ex = vehXAt(plat, rw, d2);
          if (Math.abs(ex - x) > plat.len / 2 + 0.1) { ok = false; break; }
          if (!rw.wrap && Math.abs(ex) > 6.2) { ok = false; break; }
        }
        if (rw.sinker) ok = false;
        if (ok) return dtA;
      }
      return Infinity;
    }
    const moves = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]];
    const SAFE = skill === 'new' ? 1.1 : 0.45;
    // oscillation detector → human-style commitment
    if (!window.__osc) { window.__osc = { lastRows: [], yolo: 0 }; }
    const osc = window.__osc;
    osc.lastRows.push(g.row);
    if (osc.lastRows.length > 40) osc.lastRows.shift();
    const stuck = osc.lastRows.length >= 40 && (Math.max(...osc.lastRows) - Math.min(...osc.lastRows) <= 2);
    const effSAFE = stuck ? 0.28 : SAFE;
    let best = null;
    for (const [dx, dy] of moves) {
      const tx = Math.max(-6, Math.min(6, g.fx + dx));
      const rw = g.rows.get(g.row + dy);
      if (!rw) continue;
      let t1 = ttd(rw, tx, 2.2);
      if (dy !== 0 && rw.type === 'river') {
        // safe iff a platform is there at the landing instant (~0.17s) and persists
        t1 = (riverWindow(rw, tx) !== Infinity) ? 2.2 : 0;
      }
      if (t1 < effSAFE) continue;               // need landing + exit window
      if (dy > 0) {
        const rw2 = g.rows.get(g.row + 2);
        if (false) { /* river chain handled by riverWindow */ }
        if (rw2 && rw2.type === 'river') {
          // chain rule: a log must arrive near our landing lane soon
          let ok = false;
          for (const ox of [-1, 0, 1]) {
            for (const dtA of [0.5, 0.8, 1.1]) {
              if (!dangerAt(rw2, tx + ox, dtA)) { ok = true; break; }
            }
            if (ok) break;
          }
          if (!ok) continue;
        } else if (rw2 && dangerAt(rw2, tx, 0.9)) {
          continue;
        }
      }
      const score = (dy > 0 ? 2 : 0) + t1 * 0.1 - Math.abs(tx) * 0.02 + (dx === 0 && dy === 1 ? 0.1 : 0);
      if (!best || score > best.score) best = { dx, dy, score };
    }
    if (window.__traceBot) {
      const dbg = { row: g.row, fx: +g.fx.toFixed(1), pick: best ? [best.dx, best.dy] : null, wt: +g.worldT.toFixed(2) };
      window.__botLog.push(dbg);
    }
    if (!best) {
      // no clean hop — stay if safe, else panic to max-ttd tile
      if (ttd(row, g.fx, 1.0) >= 1.0) { stalls++; stats.hops++; await sleep(think); continue; }
      let pan = null;
      for (const [dx, dy] of moves) {
        const rw = g.rows.get(g.row + dy);
        if (!rw) continue;
        const tx = Math.max(-6, Math.min(6, g.fx + dx));
        const t1 = ttd(rw, tx, 2.2);
        if (!pan || t1 > pan.t1) pan = { dx, dy, t1 };
      }
      if (pan) { g.onDir(pan.dx, pan.dy); stats.hops++; stats.maxRow = Math.max(stats.maxRow, g.row); }
      continue;
    }
    stats.hops++;
    if (window.__traceBot) {
      const dbg = { row: g.row, fx: +g.fx.toFixed(1), pick: best ? [best.dx, best.dy] : null, wt: +g.worldT.toFixed(2) };
      window.__botLog.push(dbg);
    }
    if (!best) { stalls++; continue; }
    g.onDir(best.dx, best.dy);
    stats.maxRow = Math.max(stats.maxRow, g.row);
  }
  stats.stalls = stalls;
  stats.log = window.__botLog.slice(-24);
  stats.completed = g.state === 'complete';
  stats.deaths = g.deaths;
  stats.lives = g.lives;
  stats.timeS = ((performance.now() - stats.t0) / 1000).toFixed(1);
  stats.state = g.state;
  return stats;
}, [skill]);

console.log(`BOT[${skill}] ${stageId}${trial ? ' TRIAL' : ''}:`, JSON.stringify(result));
await page.screenshot({ path: `qa/shots/bot_${stageId}_${skill}.png` });
await browser.close();
