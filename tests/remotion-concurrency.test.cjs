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
    process:{env:{REMOTION_FUNCTION_NAME:'function',REMOTION_SERVE_URL:'https://site.test',...env}},crypto:require('node:crypto')});
  return mod.exports;
}
const timing = load('src/lib/rendering/timing.ts', {});
test('real Remotion submission keeps full songs below the 200-function provider limit', async () => {
  const calls=[];
  const renderer=load('src/lib/rendering/remotion.ts', {'./timing':timing,'@remotion/lambda/client':{
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
  const mocks={'./timing':timing,'@remotion/lambda/client':{renderMediaOnLambda:async args=>{calls.push(args);return {renderId:'job',bucketName:'bucket'}}}};
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
