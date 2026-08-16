// full journey: guardian fight → ceremony → trial ghost → bonus → death gate
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(900);
const shot = async (n) => { await page.screenshot({ path: `qa/shots/j_${n}.png` }); console.log('shot:', n); };
const key = async (k, ms = 70) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };

// === GUARDIAN FIGHT ===
await page.evaluate(() => window.__qa.stage('w1s4'));
await page.waitForTimeout(500);
// walk into arena
for (let i = 0; i < 4; i++) { await key('ArrowUp'); await page.waitForTimeout(190); }
await page.waitForTimeout(2800);
await shot('boss_intro');
// fight loop: dodge rows, when tired → approach & spin
const fight = await page.evaluate(async () => {
  const g = window.__game;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let spins = 0;
  const t0 = performance.now();
  while (g.guardian.isActive && performance.now() - t0 < 60000) {
    const a = g.guardian.active;
    if (!a) break;
    if (a.state === 'telegraph' || a.state === 'swoop') {
      // dodge: hop backward off the swoop row
      if (g.row === a.swoopRow && !g.frog.isHopping) g.onDir(0, -1);
    } else if (a.state === 'tired') {
      // approach boss z then spin
      const bz = a.mesh.position.z;
      const targetRow = Math.round(-bz);
      while (g.row < targetRow && !g.frog.isHopping && g.state === 'play') {
        g.onDir(0, 1); await sleep(190);
      }
      await sleep(120);
      g.onAction('spin');
      spins++;
      await sleep(600);
    }
    await sleep(90);
  }
  return { spins, state: g.state, bossGone: g.guardian.active?.state };
});
console.log('fight:', JSON.stringify(fight));
await page.waitForTimeout(2200);
await shot('ceremony');
// dismiss ceremony
await key('Space'); await page.waitForTimeout(600);
await shot('post_ceremony');
const prog = await page.evaluate(() => ({ powers: window.__game.progress.data.powers, w1s4done: !!window.__game.progress.data.stages['w1s4']?.done }));
console.log('progress:', JSON.stringify(prog));
// walk to portal & complete guardian stage
await page.evaluate(() => { const g = window.__game; window.__qa.teleport(9, 0); });
await page.waitForTimeout(300);
await key('ArrowUp'); await page.waitForTimeout(2400);
await shot('guardian_complete');
await key('Space'); await page.waitForTimeout(600);   // back to hub
const hubState = await page.evaluate(() => ({ state: window.__game.state, mode: window.__game.mode }));
console.log('after completion:', JSON.stringify(hubState));
await shot('hub_awakened');

// === TIME TRIAL with ghost ===
await page.evaluate(() => window.__qa.stage('w1s1', false));
await page.waitForTimeout(500);
// complete it fast via teleport to create a ghost
await page.evaluate(() => { const g = window.__game; window.__qa.teleport(g.stage.length - 1, 0); });
await key('ArrowUp'); await page.waitForTimeout(2400); await key('Space'); await page.waitForTimeout(400);
await page.evaluate(() => window.__qa.stage('w1s1', true));   // TIME RUN
await page.waitForTimeout(700);
for (let i = 0; i < 6; i++) { await key('ArrowUp'); await page.waitForTimeout(170); }
await shot('trial_ghost');
const trialInfo = await page.evaluate(() => ({
  trial: window.__game.trial.active, t: window.__game.trial.t.toFixed(1),
  ghost: !!window.__game.trial.ghost, ghostVisible: window.__game.trial.ghostMesh.visible,
}));
console.log('trial:', JSON.stringify(trialInfo));
await browser.close();
