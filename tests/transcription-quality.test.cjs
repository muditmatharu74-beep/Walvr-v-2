const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/lib/rendering/transcription-quality.ts'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports});
const {assertUsableTranscription,TranscriptionQualityError}=mod.exports;
const words=text=>text.map((word,i)=>({word,start:i,end:i+0.5}));
test('music markers and symbolic hallucinations never become lyric captions',()=>{
  for(const text of [['♪♪','♪♪'],['༼','つ','༎','ຶ','༽','༽'],['...', '🎵'],[]]) {
    if(!text.length){assert.doesNotThrow(()=>assertUsableTranscription({words:[]},true));continue;}
    assert.throws(()=>assertUsableTranscription({words:words(text)},true),TranscriptionQualityError);
  }
  assert.throws(()=>assertUsableTranscription({words:words(['hello']).map(w=>({...w,end:NaN}))},true));
  assert.throws(()=>assertUsableTranscription({},true),/lyric timings/);
});
test('Latin lyrics and punctuation retain original timings while unsupported neon scripts fail clearly',()=>{
  const transcription={words:words(['Café','night','!”'])};
  const before=JSON.stringify(transcription);
  assert.doesNotThrow(()=>assertUsableTranscription(transcription,true));
  assert.equal(JSON.stringify(transcription),before);
  assert.throws(()=>assertUsableTranscription({words:words(['प्यार'])},true),/Latin-script/);
  assert.doesNotThrow(()=>assertUsableTranscription({words:words(['प्यार'])},false));
});
