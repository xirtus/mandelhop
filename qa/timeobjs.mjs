import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(900);
await page.evaluate(() => { window.__qa.grantAll(); window.__qa.stage('w2s1'); });
await page.waitForTimeout(700);
// find a growth seed
const seed = await page.evaluate(() => {
  const g = window.__game;
  for (const [r, row] of g.rows) if (row.seedSpot) return { r, x: row.seedSpot.x };
  return null;
});
console.log('seed at:', JSON.stringify(seed));
if (seed) {
  await page.evaluate(([r, x]) => window.__qa.teleport(r, x), [seed.r - 1, seed.x]);
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(300);
  await page.keyboard.press('KeyN'); await page.waitForTimeout(600);
  const grown = await page.evaluate(() => {
    const g = window.__game;
    const row = g.rows.get(g.row);
    return { grown: row?.seedSpot?.grown > 0, hasM: !!row?.seedSpot?.mushroom, meter: window.__game.timemagic.meter };
  });
  console.log('accelerate:', JSON.stringify(grown));
  await page.screenshot({ path: 'qa/shots/t_mushroom.png' });
  // bounce on it
  await page.evaluate(([r, x]) => window.__qa.teleport(r, x), [seed.r - 1, seed.x]);
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(120);
  await page.screenshot({ path: 'qa/shots/t_bounce.png' });
  const st = await page.evaluate(() => ({ row: window.__game.row, y: window.__game.frog.group.position.y }));
  console.log('after bounce:', JSON.stringify(st));
}
// reverse: collapse a pad then reverse it
await page.evaluate(() => window.__qa.stage('w3s1'));
await page.waitForTimeout(600);
const rev = await page.evaluate(async () => {
  const g = window.__game;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // find collapse row (generate deep first)
  g.row = 30; for (let r = 0; r <= 75; r++) g._genRow(r);
  let target = null;
  for (const [r, row] of g.rows) if (row.collapse?.length) { target = { r, x: row.collapse[0].x }; break; }
  if (!target) return { skip: true, rows: [...g.rows.keys()].length };
  window.__qa.teleport(target.r, target.x);
  await sleep(200);
  const row = g.rows.get(target.r);
  row.collapse[0].state = 'shaking'; row.collapse[0].t = 0.8;   // force the fall
  await sleep(900);
  const fellState = row.collapse[0].state;
  g.onAction('reverse');
  await sleep(700);
  return { fellState, after: row.collapse[0].state, y: row.collapse[0].mesh.position.y };
});
console.log('reverse:', JSON.stringify(rev));
await browser.close();
