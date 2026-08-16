import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(900);
await page.evaluate(() => window.__qa.stage('w6s2'));   // CHROME CURRENTS (swim)
await page.waitForTimeout(700);
// find a pool row
const pool = await page.evaluate(() => {
  const g = window.__game;
  for (const [r, row] of g.rows) {
    if (row.pool) {
      const prev = g.rows.get(r - 1);
      if (prev && prev.type === 'safe') return { r, prevType: prev.type };
    }
  }
  // none with safe predecessor — dump what's there
  return { none: true, rows: [...g.rows.values()].filter(r => r.type === 'river').map(r => ({ r: r.r, pool: r.pool })) };
});
console.log('pool at:', JSON.stringify(pool));
if (pool) {
  // find open-water x on the pool row
  const wx = await page.evaluate(([r]) => {
    const g = window.__game;
    const row = g.rows.get(r);
    for (let x = -5; x <= 5; x++) {
      let clear = true;
      for (const e of row.ents) if (Math.abs(e.x - x) < e.len / 2 + 0.6) { clear = false; break; }
      if (clear) return x;
    }
    return 0;
  }, [pool.r]);
  console.log('open water x:', wx);
  await page.evaluate(([r, x]) => window.__qa.teleport(r - 1, x), [pool.r, wx]);
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(300);
  const st1 = await page.evaluate(() => ({ swim: window.__game.swim, state: window.__game.state, y: +window.__game.frog.group.position.y.toFixed(2) }));
  console.log('in water:', JSON.stringify(st1));
  await page.screenshot({ path: 'qa/shots/swim.png' });
  // paddle forward twice
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(260);
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(260);
  const st2 = await page.evaluate(() => ({ swim: +window.__game.swim.toFixed(1), state: window.__game.state, row: window.__game.row, lives: window.__game.lives }));
  console.log('paddled:', JSON.stringify(st2));
  await page.screenshot({ path: 'qa/shots/swim2.png' });
  // wait for air to run out → should drown
  await page.waitForTimeout(4500);
  const st3 = await page.evaluate(() => ({ swim: +window.__game.swim.toFixed(1), lives: window.__game.lives, state: window.__game.state }));
  console.log('after air out:', JSON.stringify(st3));
}
await browser.close();
