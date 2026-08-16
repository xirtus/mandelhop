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
// force 3 hits during tired windows
const res = await page.evaluate(async () => {
  const g = window.__game;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const t0 = performance.now();
  while (performance.now() - t0 < 45000) {
    const a = g.guardian.active;
    if (!a) return { done: true, state: g.state };
    if (a.state === 'tired') g.guardian.tryHit(a.mesh.position.x, a.mesh.position.z, 2.0, 'spin');
    if (a.state === 'gone') return { done: true, state: g.state, hits: a.hits };
    await sleep(60);
  }
  return { done: false, state: g.state, bossState: g.guardian.active?.state };
});
console.log('kill:', JSON.stringify(res));
await page.waitForTimeout(2000);
await page.screenshot({ path: 'qa/shots/kill_ceremony.png' });
console.log('shot: ceremony');
await page.keyboard.press('Space');
await page.waitForTimeout(700);
const prog = await page.evaluate(() => ({
  powers: window.__game.progress.data.powers,
  portalLocked: window.__game.portal?.locked,
  overlay: document.getElementById('overlay').className,
}));
console.log('progress:', JSON.stringify(prog));
await page.screenshot({ path: 'qa/shots/kill_after.png' });
// now walk to portal
await page.evaluate(() => window.__qa.teleport(9, 0));
await page.waitForTimeout(300);
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(2500);
const fin = await page.evaluate(() => ({ state: window.__game.state, w1s4: window.__game.progress.data.stages['w1s4'] }));
console.log('final:', JSON.stringify(fin));
await page.screenshot({ path: 'qa/shots/kill_complete.png' });
await browser.close();
