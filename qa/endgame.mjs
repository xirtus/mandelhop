import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
process.on('unhandledRejection', e => { console.log('REJECTION:', e.message); process.exit(1); });
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(900);
const shot = async (n) => { await page.screenshot({ path: `qa/shots/e_${n}.png` }); console.log('shot:', n); };
const key = async (k) => { await page.keyboard.down(k); await page.waitForTimeout(70); await page.keyboard.up(k); };

// complete w1s1 normally once (records ghost), then TIME RUN and watch ghost
await page.evaluate(() => window.__qa.stage('w1s1'));
await page.waitForTimeout(600);
// simulate a real-ish run: hop forward 10 rows so ghost has motion
for (let i = 0; i < 8; i++) { await key('ArrowUp'); await page.waitForTimeout(240); }
await page.evaluate(() => { const g = window.__game; window.__qa.teleport(g.stage.length - 1, 0); });
await page.waitForTimeout(300);
await key('ArrowUp'); await page.waitForTimeout(2600);
await key('Space'); await page.waitForTimeout(500);
const preState = await page.evaluate(() => ({ state: window.__game.state, mode: window.__game.mode, row: window.__game.row, ov: document.getElementById('overlay').className, stages: Object.keys(window.__game.progress.data.stages) }));
console.log('pre-ghost state:', JSON.stringify(preState));
const ghostSaved = await page.evaluate(() => ((window.__game.progress.data.stages['w1s1'] || {}).ghost || []).length);
console.log('ghost samples saved:', ghostSaved);
// TIME RUN
await page.evaluate(() => window.__qa.stage('w1s1', true));
await page.waitForTimeout(700);
for (let i = 0; i < 5; i++) { await key('ArrowUp'); await page.waitForTimeout(200); }
await page.waitForTimeout(400);
const ghostState = await page.evaluate(() => ({
  has: !!window.__game.trial.ghost, visible: window.__game.trial.ghostMesh.visible,
  ghostPos: window.__game.trial.ghostMesh.position.toArray().map(v => +v.toFixed(1)),
}));
console.log('ghost in trial:', JSON.stringify(ghostState));
await shot('ghost_replay');
// complete trial → relic
await page.evaluate(() => { const g = window.__game; window.__qa.teleport(g.stage.length - 1, 0); });
await page.waitForTimeout(300);
await key('ArrowUp'); await page.waitForTimeout(2600);
const relic = await page.evaluate(() => {
  const st = window.__game.progress.data.stages['w1s1'];
  return { relic: st.relic, bestTime: st.bestTime };
});
console.log('trial result:', JSON.stringify(relic));
await shot('trial_complete');

// hub awakening: force-complete world 1 guardian record, refresh hub
await page.evaluate(() => {
  const g = window.__game;
  g.progress.recordCompletion('w1s4', { pollen: 0, pods: 0, shards: [], blooms: [], relic: null, bestTime: null, ghost: null, secrets: 0 });
  g.enterHub();
});
await page.waitForTimeout(900);
await key('ArrowUp'); await page.waitForTimeout(300);
await shot('hub_tier1');

// chase escape at portal
await page.evaluate(() => window.__qa.stage('w2s2'));
await page.waitForTimeout(700);
await page.evaluate(() => { const g = window.__game; window.__qa.teleport(g.stage.length - 3, 0); });
await page.waitForTimeout(300);
await key('ArrowUp'); await page.waitForTimeout(300);
await shot('chase_end');
const chase = await page.evaluate(() => ({ active: window.__game.chase?.active, state: window.__game.state }));
console.log('chase at end:', JSON.stringify(chase));
await browser.close();
