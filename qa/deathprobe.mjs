import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa);
await page.waitForTimeout(800);
await page.evaluate(() => window.__qa.stage('w1s3'));
await page.waitForTimeout(500);
// run the same planner bot but dump full context at each death
const out = await page.evaluate(async () => {
  const g = window.__game;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const deaths = [];
  const orig = g._die.bind(g);
  g._die = (type) => {
    const row = g.rows.get(g.row);
    deaths.push({
      row: g.row, fx: +g.fx.toFixed(2), type, hopping: g.frog.isHopping,
      rowType: row?.type, speed: row?.speed, len: row?.len,
      ents: row ? row.ents.map(e => +e.x.toFixed(1)) : [],
      frogY: +g.frog.group.position.y.toFixed(2),
    });
    orig(type);
  };
  // mash forward blindly (worst case)
  for (let i = 0; i < 40 && deaths.length < 1; i++) {
    g.onDir(0, 1);
    await sleep(210);
  }
  return deaths;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
