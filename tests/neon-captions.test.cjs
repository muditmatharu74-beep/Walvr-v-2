const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleObject = {exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/rendering/neon-captions.ts','utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{module:moduleObject,exports:moduleObject.exports});
const {layoutNeonCaptions,neonTextElements,creditCost} = moduleObject.exports;
const sample = ['Late','night','ride','home'].map((word,i)=>({word,start:i*0.8,end:(i+1)*0.8}));

test('both neon layouts keep short phrases in the phone safe area and preserve word timings',()=>{
  for(const style of ['clean-neon','pixel-neon']){
    const phrases=layoutNeonCaptions(sample,style);assert.equal(phrases.length,1);
    for(const [i,w] of phrases[0].words.entries()){
      assert.ok(w.x-w.width/2>=108 && w.x+w.width/2<=972);
      assert.ok(w.y>=1100 && w.y<=1520);
      assert.equal(w.start,sample[i].start);assert.equal(w.end,sample[i].end);
    }
    const active=neonTextElements(sample,style).filter(e=>e.name.startsWith('neon-active'));
    for(let i=0;i<active.length;i++){
      assert.equal(active[i].time,sample[i].start);
      assert.equal(active[i].duration,sample[i].end-sample[i].start);
    }
  }
});
test('long words fit, silence breaks phrases, and invalid timestamps do not create render elements',()=>{
  const words=[{word:'extraordinarilylongword',start:0,end:1},{word:'home',start:3,end:4},
    {word:'bad',start:NaN,end:5},{word:'reverse',start:6,end:5}];
  const p=layoutNeonCaptions(words,'pixel-neon');assert.equal(p.length,2);
  assert.ok(p[0].words[0].width<=864);assert.ok(p[0].words[0].fontSize<48);
  assert.ok(p[0].end<3);assert.equal(neonTextElements([], 'clean-neon').length,0);
});
test('caption cost shown in UI matches the standard and premium rules',()=>{
  assert.equal(creditCost('free','dark-solid','bold-overlay'),100);
  for(const style of ['clean-neon','pixel-neon']){
    assert.equal(creditCost('starter','dark-solid',style),200);
    assert.equal(creditCost('starter','neon',style),200);
    assert.equal(creditCost('business','neon',style),350);
  }
});
