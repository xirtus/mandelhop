import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.evaluate(() => window.__qa.stage('w1s1'));
await page.waitForTimeout(500);
const r = await page.evaluate(() => {
  try {
    const g = window.__game;
    window.__qa.teleport(g.stage.length - 1, 0);
    return { ok: true, row: g.row };
  } catch (e) { return { err: e.message }; }
});
console.log(JSON.stringify(r));
await browser.close();
