import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(900);
await page.evaluate(() => window.__qa.start());
await page.waitForTimeout(900);
await page.screenshot({ path: 'qa/shots/bloom_hub.png' });
await page.evaluate(() => window.__qa.stage('w6s3'));
await page.waitForTimeout(800);
for (let i = 0; i < 5; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(190); }
await page.screenshot({ path: 'qa/shots/bloom_skyway.png' });
const perf = await page.evaluate(() => new Promise(res => {
  let n = 0; const t0 = performance.now();
  const loop = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(loop); else res({ fps: n / 2 }); };
  requestAnimationFrame(loop);
}));
console.log('perf with bloom:', JSON.stringify(perf));
await browser.close();
