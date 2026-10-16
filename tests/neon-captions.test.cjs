const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleObject = {exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/rendering/neon-captions.ts','utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{module:moduleObject,exports:moduleObject.exports});
const {layoutNeonCaptions,layoutSingleWordCaptions,neonTextElements,creditCost,captionOpacity,neonDesign} = moduleObject.exports;
const sample = ['Late','night','ride','home'].map((word,i)=>({word,start:i*0.8,end:(i+1)*0.8}));

test('single-word captions center each token, switch on time and clear real pauses',()=>{
  for(const style of ['clean-neon','pixel-neon']){
    const input=[{word:'first',start:1,end:1.8},{word:'next',start:1.5,end:1.7},
      {word:'last',start:3,end:4}];
    const before=JSON.stringify(input);
    const displays=layoutSingleWordCaptions(input,style);
    assert.equal(displays.length,3);
    for(const display of displays){
      assert.equal(display.words.length,1);
      assert.equal(display.words[0].x,540);assert.equal(display.words[0].y,1320);
    }
    assert.equal(displays[0].end,1.5,'previous word must clear at the next onset');
    const at=t=>displays.filter(p=>t>=p.start&&t<p.end);
    assert.equal(at(1.51)[0].words[0].text.toLowerCase(),'next');
    assert.equal(at(2).length,0,'do not display future lyrics across silence');
    assert.equal(at(3.1).length,1);
    assert.equal(JSON.stringify(input),before);
    const bases=neonTextElements(input,style).filter(e=>e.track===2);
    assert.deepEqual(Array.from(bases,e=>e.time),[1,1.5,3]);
  }
});

test('fades stay inside phrase boundaries and leave fast lyrics readable',()=>{
  assert.equal(captionOpacity(.99,1,2),0);
  assert.equal(captionOpacity(1,1,2),0);
  assert.ok(captionOpacity(1.04,1,2)>0 && captionOpacity(1.04,1,2)<1);
  assert.equal(captionOpacity(1.1,1,2),1);
  assert.ok(captionOpacity(1.95,1,2)>0 && captionOpacity(1.95,1,2)<1);
  assert.equal(captionOpacity(2,1,2),0);
  assert.equal(captionOpacity(2.01,1,2),0);
  assert.equal(captionOpacity(1.04,1,1.08),1,'an 80ms phrase must reach full opacity');
  for(const args of [[NaN,0,1],[0,0,0],[0,1,0],[0,0,Infinity]]) assert.equal(captionOpacity(...args),0);
  assert.equal(neonDesign('clean-neon').weight,900);
  assert.ok(neonDesign('clean-neon').fontSize>64 && neonDesign('pixel-neon').fontSize>48);
});

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

for (const style of ['clean-neon', 'pixel-neon']) {
  test(`${style}: tied timestamps keep all text visible with a single shared highlight`, () => {
    const input = ['one', 'two', 'three', 'four', 'five', 'six'].map(word => ({word,start:1,end:2}));
    const before = JSON.stringify(input);
    const phrases = layoutNeonCaptions(input, style);
    assert.equal(phrases.length, 1);
    assert.equal(phrases[0].words[0].text.toLowerCase(), 'one two three four five six');
    const active = neonTextElements(input, style).filter(e => e.track === 3);
    assert.equal(active.length, 1); assert.equal(active[0].time, 1); assert.equal(active[0].duration, 1);
    assert.equal(JSON.stringify(input), before, 'normalization must not mutate source timings');
  });

  test(`${style}: overlap clips highlights and preserves the longest phrase end`, () => {
    const words = [{word:'first',start:0,end:2},{word:'second',start:0.2,end:0.4}];
    const phrase = layoutNeonCaptions(words,style)[0];
    assert.equal(phrase.end, 2.1);
    const active = neonTextElements(words,style).filter(e => e.track === 3);
    assert.equal(active[0].duration, 0.2); assert.equal(active[1].duration, 0.2);
    const across = [...words,{word:'third.',start:0.5,end:0.7},{word:'next',start:0.8,end:1}];
    const phrases = layoutNeonCaptions(across,style);
    assert.equal(phrases[0].end, phrases[1].start);
    for(const element of neonTextElements(across,style)) assert.ok(element.duration > 0);
  });

  test(`${style}: fast lyrics, real pauses, punctuation and boundary times stay deterministic`, () => {
    const fast = Array.from({length:24},(_,i)=>({word:'go',start:i*0.08,end:(i+1)*0.08}));
    const active = neonTextElements(fast,style).filter(e=>e.track===3);
    assert.equal(active.length,24);
    active.forEach((element,i)=>{
      assert.equal(element.time,fast[i].start);
      assert.ok(Math.abs(element.duration-0.08)<1e-10);
      if(i) assert.ok(active[i-1].time+active[i-1].duration<=element.time+1e-10);
    });
    const punctuation = [{word:'home',start:0,end:0.5},{word:'."',start:0.5,end:0.6},
      {word:'  next\nword  ',start:0.6,end:1},{word:'after',start:4,end:5}];
    const phrases = layoutNeonCaptions(punctuation,style);
    assert.equal(phrases.length,3);
    assert.equal(phrases[0].words[0].text.toLowerCase(),'home."');
    assert.equal(phrases[1].words[0].text.toLowerCase(),'next word');
    assert.ok(phrases[1].end<4,'silence must not retain a previous phrase');
    const at = time => phrases.find(p=>time>=p.start&&time<p.end);
    assert.equal(at(-0.01),undefined); assert.equal(at(0),phrases[0]);
    assert.equal(at(0.6),phrases[1]); assert.equal(at(2),undefined); assert.equal(at(5.1),undefined);
  });

  test(`${style}: malformed inputs and long wide capitals produce finite safe elements`, () => {
    const input = [null,{word:undefined,start:0,end:1},{word:' ',start:0,end:1},
      {word:'bad',start:-1,end:1},{word:'bad',start:0,end:Infinity},
      {word:'zero',start:1,end:1},{word:'backwards',start:2,end:1},
      {word:'W'.repeat(40),start:3,end:4},{word:'ß'.repeat(20),start:5,end:6}];
    const phrases = layoutNeonCaptions(input,style);
    assert.equal(phrases.length,2);
    for(const phrase of phrases) for(const word of phrase.words){
      assert.ok(word.x-word.width/2>=108 && word.x+word.width/2<=972);
      assert.ok(Number.isFinite(word.fontSize) && word.fontSize>0);
      assert.ok(word.fontSize<64);
    }
    for(const element of neonTextElements(input,style)){
      assert.ok(Number.isFinite(element.time) && Number.isFinite(element.duration));
      assert.ok(element.duration>0);
    }
  });
}
