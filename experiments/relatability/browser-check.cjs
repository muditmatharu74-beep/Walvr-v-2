// Browser smoke test with a generated color-card fixture, not a creative sample.
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'walvr-visual-'));
 const fixture=path.join(dir,'fixture.mp4');
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=0x151015:s=180x320:r=30','-t','20','-c:v','libx264','-pix_fmt','yuv420p',fixture]);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  await page.click('#start');assert.match(await page.locator('#message').textContent(),/confirmation/);
  await page.check('#matched');await page.click('#start');assert.match(await page.locator('#message').textContent(),/three finished/);
  for(const id of ['dark','scenery','everyday'])await page.setInputFiles('#'+id,fixture);
  await page.screenshot({path:path.join(dir,'setup.png'),fullPage:true});
  await page.click('#start');await page.locator('#study').waitFor({state:'visible'});
  assert.equal(await page.locator('#setup').isVisible(),false);
  assert.equal(await page.locator('#next').isDisabled(),true);
  for(let i=0;i<3;i++){
   assert.equal(await page.locator('#heading').textContent(),`Video ${i+1} of 3`);
   await page.waitForFunction(()=>document.querySelector('#player').readyState>=2);
   await page.locator('#player').evaluate(async v=>{v.muted=true;v.currentTime=19.8;await v.play()});
   await page.waitForFunction(()=>!document.querySelector('#next').disabled);
   await page.fill('#association','A quiet ride home, "after work"');
   await page.selectOption('#connection','4');await page.selectOption('#readability','5');
   if(i===0){await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(dir,'viewer-mobile.png'),fullPage:true})}
   await page.click('#next');
  }
  await page.selectOption('#favorite','2');await page.click('#complete');
  await page.locator('#thanks').waitFor({state:'visible'});
  const downloadPromise=page.waitForEvent('download');await page.click('#exportNow');const download=await downloadPromise;
  const file=path.join(dir,'results.csv');await download.saveAs(file);const csv=fs.readFileSync(file,'utf8');
  assert.equal(csv.split('\r\n').length,4);assert.ok(csv.includes('missing-someone-pilot-01'));assert.ok(csv.includes('"scenery"'));assert.ok(csv.includes('"after work""'));
  await page.click('#another');assert.equal(await page.inputValue('#participant'),'2');
  assert.equal(await page.locator('#setup').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS browser: local media metadata, neutral viewing flow, completion gate, responsive layout, CSV download, next participant; screenshots in '+dir);
 }finally{await browser.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
