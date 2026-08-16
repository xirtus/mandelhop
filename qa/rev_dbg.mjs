import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(900);
const out = await page.evaluate(async () => {
  const g = window.__game;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  window.__qa.stage('w3s1');
  await sleep(500);
  g.row = 30; for (let r = 0; r <= 75; r++) g._genRow(r);
  let target = null;
  for (const [r, row] of g.rows) if (row.collapse?.length) { target = { r, x: row.collapse[0].x }; break; }
  if (!target) return { skip: true };
  window.__qa.teleport(target.r, target.x);
  await sleep(300);
  const row = g.rows.get(target.r);
  row.collapse[0].state = 'fallen'; row.collapse[0].t = 0;
  row.collapse[0].mesh.visible = false;
  row.collapse[0].mesh.position.y = -1.5;
  const dbg = {
    frogRow: g.row, frogFx: g.fx, targetRow: target.r, tx: target.x,
    dz: Math.abs(-target.r - (-g.row)), dxf: Math.abs(target.x - g.fx),
    meter: g.timemagic.meter, state: g.state,
  };
  g._tryReverse();
  await sleep(700);
  dbg.after = row.collapse[0].state;
  dbg.meshY = row.collapse[0].mesh.position.y;
  return dbg;
});
console.log(JSON.stringify(out));
await browser.close();
