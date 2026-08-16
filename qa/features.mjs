import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(900);
const shot = async (n) => { await page.screenshot({ path: `qa/shots/f_${n}.png` }); console.log('shot:', n); };
const key = async (k) => { await page.keyboard.down(k); await page.waitForTimeout(70); await page.keyboard.up(k); };

await page.evaluate(() => window.__qa.grantAll());
await page.evaluate(() => window.__qa.stage('w1s3'));
await page.waitForTimeout(600);
// find the bonus portal row & death gate row from the plan
const loc = await page.evaluate(() => {
  const g = window.__game;
  let bonus = null, dg = null, grapple = null;
  for (const [r, row] of g.rows) {
    if (row.bonusPortal && !bonus) bonus = { r, x: row.bonusPortal.x };
    if (row.deathGate && !dg) dg = { r, x: row.deathGate.x };
  }
  return { bonus, dg, L: g.stage.length };
});
console.log('features:', JSON.stringify(loc));
// BONUS: teleport next to portal, hop in
if (loc.bonus) {
  await page.evaluate(([r, x]) => window.__qa.teleport(r, x), [loc.bonus.r - 1, loc.bonus.x]);
  await page.waitForTimeout(300);
  await key('ArrowUp'); await page.waitForTimeout(1200);
  const mode = await page.evaluate(() => ({ mode: window.__game.mode, row: window.__game.row }));
  console.log('bonus mode:', JSON.stringify(mode));
  await shot('bonus');
  // complete the pocket: teleport to its portal
  await page.evaluate(() => window.__qa.teleport(11, 0));
  await page.waitForTimeout(200);
  await key('ArrowUp'); await page.waitForTimeout(900);
  const back = await page.evaluate(() => ({ mode: window.__game.mode, row: window.__game.row, state: window.__game.state }));
  console.log('after bonus:', JSON.stringify(back));
  await shot('bonus_return');
}
// DEATH GATE: hop onto it with 0 deaths
if (loc.dg) {
  await page.evaluate(([r, x]) => window.__qa.teleport(r, x), [loc.dg.r - 1, loc.dg.x]);
  await page.waitForTimeout(300);
  await key('ArrowUp'); await page.waitForTimeout(700);
  await shot('deathgate');
  const dg = await page.evaluate(() => ({ secrets: window.__game.secretsFound }));
  console.log('deathgate:', JSON.stringify(dg));
}
// GRAPPLE: w6s3 has grapple rings — teleport before one, press U
await page.evaluate(() => window.__qa.stage('w6s3'));
await page.waitForTimeout(700);
const gr = await page.evaluate(() => {
  const g = window.__game;
  for (const gr of g.collect.grapples) return { row: gr.row, x: gr.x };
  return null;
});
console.log('grapple at:', JSON.stringify(gr));
if (gr) {
  await page.evaluate(([r, x]) => window.__qa.teleport(r, x), [gr.row - 2, gr.x]);
  await page.waitForTimeout(300);
  await key('ArrowUp'); await page.waitForTimeout(200);
  await key('KeyU'); await page.waitForTimeout(260);
  await shot('grapple');
  const st = await page.evaluate(() => ({ row: window.__game.row, swing: !!window.__game.powers.swing, tongue: window.__game.powers.tongue.visible }));
  console.log('grapple state:', JSON.stringify(st));
}
// SLIDE GATE: w6s1 vine bars
await page.evaluate(() => window.__qa.stage('w6s1'));
await page.waitForTimeout(700);
const vb = await page.evaluate(() => {
  const g = window.__game;
  for (const [r, row] of g.rows) if (row.vineBar) return { r };
  return null;
});
console.log('vinebar:', JSON.stringify(vb));
if (vb) {
  await page.evaluate(([r]) => window.__qa.teleport(r, 0), [vb.r - 1]);
  await page.waitForTimeout(300);
  await shot('slidegate_approach');
  await key('KeyL');   // slide under
  await page.waitForTimeout(300);
  await shot('slidegate');
  const st = await page.evaluate(() => ({ row: window.__game.row, sliding: window.__game.powers.sliding, lives: window.__game.lives }));
  console.log('slide state:', JSON.stringify(st));
}
await browser.close();
