import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage();
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.evaluate(() => window.__qa.stage('w1s2'));
await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  const g = window.__game;
  const out = [];
  for (let r = 5; r <= 10; r++) {
    const row = g.rows.get(r);
    if (!row) continue;
    out.push({
      r, type: row.type, dir: row.dir, speed: +row.speed.toFixed(2), len: row.len,
      gap: +row.gap.toFixed(2), spacing: +row.spacing.toFixed(2), kind: row.kind,
      sinker: !!row.sinker, nEnts: row.ents.length,
      xs: row.ents.map(e => +e.x.toFixed(1)),
    });
  }
  return out;
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
