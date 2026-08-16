import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(900);
await page.evaluate(() => window.__qa.stage('w1s4'));
await page.waitForTimeout(500);
for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(190); }
await page.waitForTimeout(2600);
const diag = await page.evaluate(async () => {
  const g = window.__game;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const log = [];
  const t0 = performance.now();
  while (g.guardian.isActive && performance.now() - t0 < 30000) {
    const a = g.guardian.active;
    if (!a) break;
    if (a.state === 'tired') {
      const bz = a.mesh.position.z, bx = a.mesh.position.x;
      const targetRow = Math.round(-bz);
      log.push({ ev: 'tired', bossRow: targetRow, bx: +bx.toFixed(1), frogRow: g.row, fx: +g.fx.toFixed(1) });
      // direct spin in range — bypass approach
      const hit = g.guardian.tryHit(bx, bz, 2.0, 'spin');
      log.push({ ev: 'forceHit', hit, hits: a.hits });
      if (a.hits >= 3) break;
      await sleep(400);
    }
    await sleep(80);
  }
  return { log: log.slice(0, 12), state: g.state, bossState: g.guardian.active?.state, hits: g.guardian.active?.hits };
});
console.log(JSON.stringify(diag, null, 1));
await page.screenshot({ path: 'qa/shots/diag_boss.png' });
await browser.close();
