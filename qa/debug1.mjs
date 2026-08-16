import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => console.log('C:', m.text()));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(800);

// completion flow debug
await page.evaluate(() => window.__qa.stage('w1s1'));
await page.waitForTimeout(500);
const r1 = await page.evaluate(() => {
  const g = window.__game;
  window.__qa.teleport(g.stage.length - 1, 0);
  return { portalRow: g.portal?.row, portalLocked: g.portal?.locked, L: g.stage.length };
});
console.log('portal info:', JSON.stringify(r1));
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(400);
const r2 = await page.evaluate(() => ({ state: window.__game.state, row: window.__game.row, fx: window.__game.fx }));
console.log('after hop:', JSON.stringify(r2));
await page.waitForTimeout(2500);
const r3 = await page.evaluate(() => ({
  state: window.__game.state,
  overlayClass: document.getElementById('overlay').className,
  overlayLen: document.getElementById('overlay').innerHTML.length,
}));
console.log('completion state:', JSON.stringify(r3));
await page.screenshot({ path: 'qa/shots/dbg_completion.png' });

// chase debug
await page.evaluate(() => window.__qa.stage('w2s2'));
await page.waitForTimeout(700);
for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200); }
const r4 = await page.evaluate(() => {
  const g = window.__game;
  return {
    row: g.row, chase: g.chase ? { z: g.chase.z.toFixed(1), active: g.chase.active, visible: g.chase.mesh.visible, pos: g.chase.mesh.position.toArray().map(v => +v.toFixed(1)) } : null,
    camZ: window.__game.camera.pos.z.toFixed(1),
  };
});
console.log('chase:', JSON.stringify(r4));
await page.screenshot({ path: 'qa/shots/dbg_chase.png' });

// guardian debug
await page.evaluate(() => window.__qa.stage('w1s4'));
await page.waitForTimeout(600);
for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200); }
await page.waitForTimeout(2600);
const r5 = await page.evaluate(() => {
  const g = window.__game;
  const a = g.guardian.active;
  return { row: g.row, guardian: a ? { state: a.state, pos: a.mesh.position.toArray().map(v => +v.toFixed(1)), visible: a.mesh.visible } : null };
});
console.log('guardian:', JSON.stringify(r5));
await page.screenshot({ path: 'qa/shots/dbg_guardian.png' });
await browser.close();
