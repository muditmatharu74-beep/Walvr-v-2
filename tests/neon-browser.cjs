// Local preview check. No music, paid rendering, account access or database writes.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const root = path.join(__dirname, '..');
const port = 43097;
const url = `http://127.0.0.1:${port}/caption-preview`;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', String(port)], { cwd: root, stdio: 'ignore' });
let browser;
(async () => {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try { const response = await fetch(url); if (response.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Caption preview server did not become ready');
  browser = await chromium.launch({
    ...(process.env.WALVR_BROWSER_EXECUTABLE ? { executablePath: process.env.WALVR_BROWSER_EXECUTABLE } : {}),
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('h2').count(), 2);
  assert.ok(await page.evaluate(() => document.fonts.check('400 48px "Press Start 2P"') && document.fonts.check('800 64px "Montserrat"')));
  assert.equal(await page.locator('[data-active="true"]').count(), 2);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'walvr-neon-'));
  await page.screenshot({ path: path.join(dir, 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(dir, 'mobile.png'), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(150);
  const state = await page.locator('[data-active]').evaluateAll(words => words.map(w => w.dataset.active));
  await page.waitForTimeout(250);
  assert.deepEqual(await page.locator('[data-active]').evaluateAll(words => words.map(w => w.dataset.active)), state);
  assert.deepEqual(errors, []);
  console.log('PASS: desktop/mobile previews, both fonts, current-word highlight, reduced motion, no page errors. Screenshots: ' + dir);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  server.kill();
});
