// powers montage: verify every power + time power visually
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(900);
const shot = async (n) => { await page.screenshot({ path: `qa/shots/pw_${n}.png` }); console.log('shot:', n); };
const key = async (k, ms = 70) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };

// hub (post-fix)
await key('Space'); await page.waitForTimeout(400);
await page.evaluate(() => window.__qa.start());
await page.waitForTimeout(900);
await shot('hub');
// stage select overlay
await page.evaluate(() => window.__game._hubConfirm());
await page.waitForTimeout(400);
await shot('hub') // hub first
// move frog to world-1 gate: gates at col (w%3-1)*4, row 3+floor(w/3)*3 → w1 = (-4, 3)
await page.evaluate(() => { const g = window.__game; window.__qa.teleport(3, -4); g.row = 3; g.fx = -4; });
await page.waitForTimeout(300);
await key('Space'); await page.waitForTimeout(500);
await shot('stageselect');
await page.keyboard.press('Escape').catch(()=>{});
// stage with all powers
await page.evaluate(() => window.__qa.grantAll());
await page.evaluate(() => window.__qa.stage('w3s2'));   // phase stage
await page.waitForTimeout(700);
await shot('phase_now');
await key('ArrowUp'); await page.waitForTimeout(200);
await key('KeyG'); await page.waitForTimeout(350);     // phase shift
await shot('phase_then');
await key('KeyG'); await page.waitForTimeout(200);
// spin
await key('KeyJ'); await page.waitForTimeout(150); await shot('spin');
// double jump: hop then dir mid-air
await key('ArrowUp'); await page.waitForTimeout(60); await key('ArrowUp'); await page.waitForTimeout(80); await shot('doublejump');
await page.waitForTimeout(300);
// slam
await key('KeyK'); await page.waitForTimeout(180); await shot('slam');
await page.waitForTimeout(300);
// slide
await key('KeyL'); await page.waitForTimeout(160); await shot('slide');
await page.waitForTimeout(300);
// seed
await key('KeyI'); await page.waitForTimeout(200); await shot('seed');
await page.waitForTimeout(400);
// dash
await key('KeyH'); await page.waitForTimeout(120); await shot('dash');
await page.waitForTimeout(300);
// freeze
await key('KeyF'); await page.waitForTimeout(350); await shot('freeze');
await page.waitForTimeout(2400);
// flow state: chain perfect hops
await page.evaluate(() => { const g = window.__game; g.flow.count = 12; g.flow.state = true; g.flow.flow01 = 1; });
await page.waitForTimeout(400);
await shot('flowstate');
console.log('done');
await browser.close();
