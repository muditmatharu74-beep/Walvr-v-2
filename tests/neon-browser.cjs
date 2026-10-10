// Local preview check. No music, paid rendering, account access or database writes.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const edgeCaptions = require('./neon-edge-fixtures.cjs');
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
  // Render the actual shared overlay with edge inputs, using the bundled fonts.
  const load = (file, requireModule) => {
    const moduleObject = {exports:{}};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
    }).outputText,{module:moduleObject,exports:moduleObject.exports,require:requireModule});
    return moduleObject.exports;
  };
  const helpers = load('src/lib/rendering/neon-captions.ts',require);
  const {NeonCaptionOverlay} = load('src/components/NeonCaptionOverlay.tsx',
    name=>name.includes('neon-captions')?helpers:require(name));
  const fonts = [['Montserrat','montserrat','800'],['Press Start 2P','press-start-2p','400']].map(([family,pkg,weight])=>
    `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff;base64,${fs.readFileSync(path.join(root,`node_modules/@fontsource/${pkg}/files/${pkg}-latin-${weight}-normal.woff`)).toString('base64')}) format('woff');}`).join('');
  for(const style of ['clean-neon','pixel-neon']) for(const time of [0.16,0.55,1.2,1.6,2.15,2.55,3.6]) {
    const markup = renderToStaticMarkup(React.createElement(NeonCaptionOverlay,{captions:edgeCaptions,style,time}));
    await page.setContent(`<style>${fonts}body{margin:0;background:#080c15}.frame{position:relative;width:390px;height:693.333px}</style><div class="frame">${markup}</div>`);
    await page.evaluate(()=>Promise.all([document.fonts.load('800 64px "Montserrat"'),document.fonts.load('400 48px "Press Start 2P"')]));
    const spans = await page.locator('span').evaluateAll(words=>words.map(word=>{
      const bounds=word.getBoundingClientRect();const font=getComputedStyle(word);
      const context=document.createElement('canvas').getContext('2d');
      context.font=`${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
      return {text:word.textContent,active:word.dataset.active==='true',left:bounds.left,right:bounds.right,
        glyphWidth:context.measureText(word.textContent).width,slotWidth:bounds.width};
    }));
    assert.equal(spans.filter(w=>w.active).length,[1.2,3.6].includes(time)?0:1,`${style} highlight at ${time}`);
    if(time===3.6) assert.equal(spans.length,0,'pause must be caption-free');
    for(const word of spans){
      assert.ok(word.left>=39-0.1 && word.right<=351+0.1,`${style}: slot outside phone safe area`);
      assert.ok(word.glyphWidth<=word.slotWidth+1,`${style}: ${word.text} glyph width ${word.glyphWidth} exceeds slot ${word.slotWidth}`);
    }
    if(time===2.15) await page.screenshot({path:path.join(dir,style+'-long-word.png')});
  }
  assert.deepEqual(errors, []);
  console.log('PASS: desktop/mobile previews, both fonts, current-word highlight, reduced motion, no page errors. Screenshots: ' + dir);
  console.log('PASS: both overlays with fast/overlapping/tied timestamps, punctuation, wide long words and silence; measured font glyphs fit phone safe slots.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  server.kill();
});
