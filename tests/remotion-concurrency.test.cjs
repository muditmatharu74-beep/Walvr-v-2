const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function load(file, mocks, env = {}) {
  const mod = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code, {module:mod,exports:mod.exports,require:id=>mocks[id],
    process:{env:{REMOTION_FUNCTION_NAME:'function',REMOTION_SERVE_URL:'https://site.test',...env}},URL,crypto:require('node:crypto')});
  return mod.exports;
}
const timing = load('src/lib/rendering/timing.ts', {});
const backgrounds = load('src/lib/rendering/neon-background.ts', {}, {});
test('real Remotion submission keeps full songs below the 200-function provider limit', async () => {
  const calls=[];
  const renderer=load('src/lib/rendering/remotion.ts', {'./timing':timing,'./neon-background':backgrounds,'@remotion/lambda/client':{
    renderMediaOnLambda:async args=>{calls.push(args);return {renderId:'job',bucketName:'bucket'}},
  }});
  for(const songDuration of [4, 133.333, 133.334, 180.1, 190.1, 600.1]) {
    const props={songDuration,captions:[],beats:[],audioUrl:'https://audio.test/song.mp3',captionStyle:'clean-neon'};
    const job=await renderer.startDarkLyricsRender(props);
    const args=calls.at(-1);
    assert.ok(Math.ceil(timing.durationInFrames(songDuration)/args.framesPerLambda)<=200);
    assert.equal(args.inputProps,props);
    assert.equal(job.id,'job');
    if(songDuration===4) assert.equal(args.framesPerLambda,20);
    if(songDuration===190.1) assert.equal(args.framesPerLambda,29);
  }
});
test('configured account cap reduces concurrency and invalid caps stop before submission', async () => {
  const calls=[];
  const mocks={'./timing':timing,'./neon-background':backgrounds,'@remotion/lambda/client':{renderMediaOnLambda:async args=>{calls.push(args);return {renderId:'job',bucketName:'bucket'}}}};
  const limited=load('src/lib/rendering/remotion.ts',mocks,{REMOTION_MAX_CONCURRENCY:'5'});
  await limited.startDarkLyricsRender({songDuration:190.1,captions:[],beats:[],audioUrl:'https://audio.test/song.mp3'});
  assert.equal(calls[0].framesPerLambda,1141);
  assert.equal(Math.ceil(timing.durationInFrames(190.1)/calls[0].framesPerLambda),5);
  for(const value of ['0','1','201','5.5','garbage','']) {
    const renderer=load('src/lib/rendering/remotion.ts',mocks,{REMOTION_MAX_CONCURRENCY:value});
    assert.throws(()=>renderer.assertDarkLyricsConfigured(),/integer from 2 to 200/);
  }
  assert.equal(calls.length,1);
});

test('configured preview background preserves the original audio and song clock',async()=>{
 const calls=[];
 const renderer=load('src/lib/rendering/remotion.ts',{'./timing':timing,'./neon-background':backgrounds,
  '@remotion/lambda/client':{renderMediaOnLambda:async args=>{calls.push(args);return {renderId:'job',bucketName:'bucket'}}}},
  {VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/neon-captions',WALVR_NEON_BACKGROUND_URL:'https://assets.test/neon.mp4',WALVR_NEON_BACKGROUND_DURATION:'7.5'});
 const props={songDuration:190.1,captions:[{word:'hello',start:15,end:16}],beats:[4],audioUrl:'https://audio.test/original.mp3'};
 await renderer.startDarkLyricsRender(props);
 assert.equal(calls[0].inputProps.backgroundVideo.src,'https://assets.test/neon.mp4');
 assert.equal(calls[0].inputProps.backgroundVideo.duration,7.5);
 assert.equal(calls[0].offthreadVideoCacheSizeInBytes,256*1024*1024);
 assert.equal(calls[0].offthreadVideoThreads,1);
 assert.equal(calls[0].inputProps.audioUrl,props.audioUrl);
 assert.equal(calls[0].inputProps.songDuration,190.1);
 assert.equal(calls[0].inputProps.captions,props.captions);
 assert.equal(props.backgroundVideo,undefined);
});

test('background config is preview-only and rejects incomplete sources',()=>{
 const enabled={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/neon-captions'};
 assert.equal(backgrounds.previewNeonBackground({...enabled,VERCEL_ENV:'production',WALVR_NEON_BACKGROUND_URL:'https://assets.test/neon.mp4',WALVR_NEON_BACKGROUND_DURATION:'5'}),undefined);
 for(const vars of [{WALVR_NEON_BACKGROUND_URL:'https://assets.test/neon.mp4'},
  {WALVR_NEON_BACKGROUND_URL:'http://assets.test/neon.mp4',WALVR_NEON_BACKGROUND_DURATION:'5'},
  {WALVR_NEON_BACKGROUND_URL:'https://assets.test/neon.mp4',WALVR_NEON_BACKGROUND_DURATION:'NaN'},
  {WALVR_NEON_BACKGROUND_URL:'https://assets.test/neon.mp4',WALVR_NEON_BACKGROUND_DURATION:'0'}]){
  assert.throws(()=>backgrounds.previewNeonBackground({...enabled,...vars}));
 }
});
