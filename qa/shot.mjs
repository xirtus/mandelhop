// MANDELHOP QA — screenshot harness.
// Usage: node qa/shot.mjs [scriptName] [outPrefix]
// Drives the real game in headless Chromium via window.__game hooks.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const script = process.argv[2] || 'tour';
const prefix = process.argv[3] || script;
mkdirSync('qa/shots', { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game, null, { timeout: 15000 });
await page.waitForTimeout(1200);

const G = (fn, ...args) => page.evaluate(([f, a]) => {
  const g = window.__game;
  const parts = f.split('.');
  let o = g; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  return o[parts[parts.length - 1]](...a);
}, [fn, args]);
const E = (fn) => page.evaluate(fn);
const shot = async (name) => { await page.screenshot({ path: `qa/shots/${prefix}_${name}.png` }); console.log('shot:', name); };

// keyboard helpers
const key = (k, ms = 70) => page.keyboard.down(k).then(() => page.waitForTimeout(ms)).then(() => page.keyboard.up(k));
const hopSeq = async (seq, gap = 200) => { for (const k of seq) { await key(k); await page.waitForTimeout(gap); } };

const scripts = {
  // baseline: title + early gameplay
  async tour() {
    await shot('title');
    await key('Space'); await page.waitForTimeout(700);
    await shot('start');
    await hopSeq(['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp'], 240);
    await shot('hop5');
    await hopSeq(['ArrowUp', 'ArrowLeft', 'ArrowUp', 'ArrowUp', 'ArrowRight', 'ArrowUp', 'ArrowUp'], 220);
    await shot('hop12');
    // fps overlay stats
    const stats = await E(() => window.__game ? { state: window.__game.state, row: window.__game.row } : null);
    console.log('stats:', JSON.stringify(stats));
  },
};
await scripts[script]();
await browser.close();
