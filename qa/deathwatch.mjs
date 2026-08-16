// deathwatch: play w1s1, screenshot exactly when the frog dies
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(800);
await page.evaluate(() => window.__qa.stage('w1s1'));
await page.waitForTimeout(500);
// instrument deaths
await page.evaluate(() => {
  const g = window.__game;
  window.__deaths = [];
  const orig = g._die.bind(g);
  g._die = (type) => { window.__deaths.push({ row: g.row, fx: g.fx, type, t: performance.now() }); orig(type); };
});
// simple driver: hold forward with occasional waits (mimic mediocre player)
for (let i = 0; i < 120; i++) {
  const d = await page.evaluate(() => window.__deaths.length);
  if (d > 0) {
    await page.screenshot({ path: `qa/shots/death_${d}.png` });
    const info = await page.evaluate(() => window.__deaths[window.__deaths.length - 1]);
    console.log('death', d, JSON.stringify(info));
    break;
  }
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(210);
}
await browser.close();
