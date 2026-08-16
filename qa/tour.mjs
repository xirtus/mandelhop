// Full visual tour: hub → stage → collectibles → powers → time powers → guardian → completion
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('qa/shots', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa, null, { timeout: 15000 });
await page.waitForTimeout(1000);
const shot = async (n) => { await page.screenshot({ path: `qa/shots/t1_${n}.png` }); console.log('shot:', n); };
const key = async (k, ms = 70) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
const hopN = async (n, gap = 230) => { for (let i = 0; i < n; i++) { await key('ArrowUp'); await page.waitForTimeout(gap); } };

// 1. title
await shot('title');
// 2. hub
await key('Space'); await page.waitForTimeout(600);
await page.evaluate(() => window.__qa.start());
await page.waitForTimeout(800);
await shot('hub');
// hub gates view — hop forward a few
await hopN(3, 260); await shot('hub_gates');
// 3. stage w1s1
await page.evaluate(() => window.__qa.stage('w1s1'));
await page.waitForTimeout(900);
await shot('stage_start');
await hopN(6);
await shot('stage_hop');
// spin (grant power first)
await page.evaluate(() => { window.__qa.grant('SPIN'); window.__qa.grant('DOUBLE'); });
await key('KeyJ'); await page.waitForTimeout(120);
await shot('spin');
// slow time
await page.keyboard.down('KeyT'); await page.waitForTimeout(500);
await shot('timeslow');
await page.keyboard.up('KeyT');
// freeze
await key('KeyF'); await page.waitForTimeout(300);
await shot('freeze');
// 4. guardian
await page.evaluate(() => window.__qa.stage('w1s4'));
await page.waitForTimeout(600);
await hopN(4, 200);
await page.waitForTimeout(2500);
await shot('guardian');
// 5. chase stage w2s2
await page.evaluate(() => window.__qa.stage('w2s2'));
await page.waitForTimeout(800);
await hopN(5, 190);
await shot('chase');
// 6. completion screen — cheat: teleport to portal row of w1s1
await page.evaluate(() => window.__qa.stage('w1s1'));
await page.waitForTimeout(500);
await page.evaluate(() => { const g = window.__game; window.__qa.teleport(g.stage.length - 1, 0); });
await page.waitForTimeout(400);
await key('ArrowUp'); await page.waitForTimeout(300);
await key('ArrowUp'); await page.waitForTimeout(2200);
await shot('completion');
console.log('done');
await browser.close();
