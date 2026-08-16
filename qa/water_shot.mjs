import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
const mode = process.argv[2] || '';
await page.goto('http://localhost:8977/?qa=1' + (mode ? '&' + mode + '=1' : ''));
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(900);
// river-heavy view: w1s2 (lily logic)
await page.evaluate(() => window.__qa.stage('w1s2'));
await page.waitForTimeout(600);
await page.evaluate(() => window.__qa.teleport(6, 0));
await page.waitForTimeout(400);
await page.screenshot({ path: 'qa/shots/w' + (mode ? mode : '') + '_river.png' });
// log river: w6s2 chrome currents (logs + pools)
await page.evaluate(() => window.__qa.stage('w6s2'));
await page.waitForTimeout(600);
await page.evaluate(() => window.__qa.teleport(9, 0));
await page.waitForTimeout(400);
await page.screenshot({ path: 'qa/shots/w' + (mode ? mode : '') + '_logs.png' });
// hub pond
await page.evaluate(() => window.__game.enterHub());
await page.waitForTimeout(800);
await page.screenshot({ path: 'qa/shots/w' + (mode ? mode : '') + '_hub.png' });
console.log('done');
await browser.close();
