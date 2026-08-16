// THE MASTER E2E: title → hub → w1s1 → complete → hub → guardian → power → portal
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(900);
const S = async () => JSON.stringify(await page.evaluate(() => ({ st: window.__game.state, mode: window.__game.mode, powers: window.__game.progress.data.powers.length })));
console.log('boot:', await S());
await page.keyboard.press('Space'); await page.waitForTimeout(400);
console.log('after space (hub):', await S());
// enter stage via gate (simulate standing on world 1 gate)
await page.evaluate(() => { window.__qa.teleport(3, -4); });
await page.waitForTimeout(300);
await page.keyboard.press('Space'); await page.waitForTimeout(500);
console.log('gate confirm → stage select overlay visible:', await page.evaluate(() => document.getElementById('overlay').className));
// click first stage row
await page.evaluate(() => { document.querySelector('[data-stage="w1s1"]').click(); });
await page.waitForTimeout(700);
console.log('stage entered:', await S());
// complete via teleport
await page.evaluate(() => { const g = window.__game; window.__qa.teleport(g.stage.length - 1, 0); });
await page.waitForTimeout(300);
await page.keyboard.press('ArrowUp'); await page.waitForTimeout(2800);
await page.keyboard.press('Space'); await page.waitForTimeout(600);
console.log('after completion (hub):', await S());
// guardian: enter, fight via force hits during tired windows
await page.evaluate(() => window.__qa.stage('w1s4'));
await page.waitForTimeout(500);
for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(190); }
const fight = await page.evaluate(async () => {
  const g = window.__game;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const t0 = performance.now();
  while (performance.now() - t0 < 90000) {
    const a = g.guardian.active;
    if (!a) break;
    if (a.state === 'gone') break;
    if (a.state === 'telegraph' && g.row === a.swoopRow && !g.frog.isHopping) g.onDir(0, -1);
    if (a.state === 'swoop' && g.row === a.swoopRow && !g.frog.isHopping) g.onDir(0, -1);
    if (a.state === 'tired') g.guardian.tryHit(a.mesh.position.x, a.mesh.position.z, 2.0, 'spin');
    if (g.state === 'dying') { /* let it resolve */ }
    await sleep(60);
  }
  return { bossState: g.guardian.active?.state, lives: g.lives };
});
console.log('fight:', JSON.stringify(fight));
await page.waitForTimeout(2200);
// ceremony dismiss
await page.keyboard.press('Space'); await page.waitForTimeout(700);
const prog = await page.evaluate(() => ({ powers: window.__game.progress.data.powers, locked: window.__game.portal?.locked }));
console.log('post-ceremony:', JSON.stringify(prog));
// walk portal
await page.evaluate(() => window.__qa.teleport(9, 0));
await page.waitForTimeout(300);
await page.keyboard.press('ArrowUp'); await page.waitForTimeout(2600);
await page.keyboard.press('Space'); await page.waitForTimeout(600);
const fin = await page.evaluate(() => ({ st: window.__game.state, mode: window.__game.mode, w1s4done: window.__game.progress.data.stages['w1s4']?.done, w2unlocked: window.__game.progress.worldUnlocked(2) }));
console.log('FINAL:', JSON.stringify(fin));
// perf telemetry
await page.evaluate(() => window.__qa.stage('w5s2'));
await page.waitForTimeout(1200);
const perf = await page.evaluate(() => new Promise(res => {
  let frames = 0; const t0 = performance.now();
  const loop = () => { frames++; if (performance.now() - t0 < 2000) requestAnimationFrame(loop); else res({ fps: frames / 2 }); };
  requestAnimationFrame(loop);
}));
console.log('perf:', JSON.stringify(perf));
await browser.close();
