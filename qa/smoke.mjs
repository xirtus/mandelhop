// smoke test: load page, report console errors, walk through modes
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
await page.goto('http://localhost:8977/?qa=1');
await page.waitForFunction(() => window.__game && window.__qa, null, { timeout: 15000 }).catch(() => errs.push('NO __game/__qa'));
await page.waitForTimeout(1500);
const probe = async (label, fn) => {
  try { await fn(); await page.waitForTimeout(700); }
  catch (e) { errs.push(`${label}: ${e.message}`); }
  const st = await page.evaluate(() => window.__qa?.state?.());
  console.log(label, JSON.stringify(st));
};
await probe('title', () => page.keyboard.press('Space'));
await probe('hub', () => page.evaluate(() => window.__qa.start()));
await probe('stage-w1s1', () => page.evaluate(() => window.__qa.stage('w1s1')));
await probe('hop', async () => { for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(220); } });
await probe('guardian-w1s4', () => page.evaluate(() => window.__qa.stage('w1s4')));
await probe('endless', () => page.evaluate(() => window.__qa.endless()));
console.log(errs.length ? '\n❌ ERRORS:\n' + errs.join('\n') : '\n✅ no errors');
await browser.close();
