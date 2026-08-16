import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.evaluate(() => window.__qa.stage('w1s3'));
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const g = window.__game;
  const out = [];
  for (let r = 27; r <= 33; r++) {
    const row = g.rows.get(r);
    if (!row) continue;
    out.push({ r, type: row.type, dir: row.dir, speed: +row.speed.toFixed(2), len: row.len, gap: +row.gap.toFixed(1), xs: row.ents.map(e => +e.x.toFixed(1)).slice(0, 8), snake: !!row.snake, chompers: !!row.chompers });
  }
  return out;
});
for (const r of info) console.log(JSON.stringify(r));
// watch death
/*await page.evaluate(() => {
  const g = window.__game;
  window.__d = [];
  const o = g._die.bind(g);
  g._die = (t) => { window.__d.push({ row: g.row, fx: g.fx, t, wt: g.worldT }); o(t); };
});
for (let i = 0; i < 10; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(190); }
await page.waitForTimeout(4000);
const d = await page.evaluate(() => window.__d);
*/
console.log('done');
await browser.close();
