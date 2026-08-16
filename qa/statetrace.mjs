import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(900);
await page.evaluate(() => window.__qa.stage('w1s4'));
await page.waitForTimeout(400);
for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(190); }
const trace = await page.evaluate(async () => {
  const g = window.__game;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const states = [];
  let last = '';
  const t0 = performance.now();
  while (performance.now() - t0 < 14000) {
    const a = g.guardian.active;
    if (!a) { states.push(['null']); break; }
    const s = `${a.state}@${a.t.toFixed(1)} x=${a.mesh.position.x.toFixed(1)} y=${a.mesh.position.y.toFixed(1)} gs=${g.state} wt=${g.worldT.toFixed(1)}`;
    states.push(s);
    last = a.state;
    await sleep(120);
  }
  const head = states.filter((v, i) => i === 0 || states[i - 1].split('@')[0] !== v.split('@')[0]);
  return { changes: head, last: states.slice(-10) };
});
console.log('CHANGES:'); console.log((trace.changes || []).join('\n'));
console.log('LAST POLLS:'); console.log((trace.last || []).join('\n'));
await browser.close();
