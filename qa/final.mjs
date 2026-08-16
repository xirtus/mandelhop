// FINAL MONTAGE — the AAA bar review
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(900);
const shot = async (n) => { await page.screenshot({ path: `qa/shots/fin_${n}.png` }); console.log('shot:', n); };
const key = async (k, ms = 70) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };

await shot('title');
await key('Space'); await page.waitForTimeout(400);
await page.evaluate(() => window.__qa.start()); await page.waitForTimeout(900);
await shot('hub');
await page.evaluate(() => window.__qa.grantAll());
await page.evaluate(() => window.__qa.stage('w5s2'));  // ELECTRIC EDEN — the hum
await page.waitForTimeout(800);
for (let i = 0; i < 6; i++) { await key('ArrowUp'); await page.waitForTimeout(200); }
await shot('eden');
await key('KeyJ'); await page.waitForTimeout(140); await shot('spin');
await page.waitForTimeout(400);
await key('KeyF'); await page.waitForTimeout(320); await shot('freeze');
await page.waitForTimeout(2500);
await page.evaluate(() => window.__qa.stage('w3s2'));
await page.waitForTimeout(700);
for (let i = 0; i < 5; i++) { await key('ArrowUp'); await page.waitForTimeout(190); }
await key('KeyG'); await page.waitForTimeout(240); await shot('phaseflash');
await page.waitForTimeout(300); await shot('phase_then');
// guardian mid-fight
await page.evaluate(() => window.__qa.stage('w1s4'));
await page.waitForTimeout(600);
for (let i = 0; i < 4; i++) { await key('ArrowUp'); await page.waitForTimeout(190); }
await page.waitForTimeout(3400); await shot('boss_fly');
// force to tired for the money shot
await page.evaluate(async () => {
  const g = window.__game;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const t0 = performance.now();
  while (performance.now() - t0 < 30000) {
    const a = g.guardian.active;
    if (a && a.state === 'tired') return;
    await sleep(60);
  }
});
await shot('boss_tired');
console.log('done');
await browser.close();
