const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const mod={exports:{}};
vm.runInNewContext(ts.transpile(fs.readFileSync(require.resolve('../src/lib/rendering/clip-timeline.ts'),'utf8'),
  {module:ts.ModuleKind.CommonJS}),{exports:mod.exports});
const {clipTimelines}=mod.exports;
const source={songDuration:100,captions:[{word:'lead',start:9,end:11},{word:'tail',start:29,end:31},{word:'after',start:30,end:32}],beats:[9,10,29,30]};
test('rebases and clips words and beats to the selected section',()=>{
 const [clip]=clipTimelines(source,[{startMs:10000,endMs:30000}]);
 assert.deepEqual(JSON.parse(JSON.stringify(clip.captions)),[{word:'lead',start:0,end:1},{word:'tail',start:19,end:20}]);
 assert.deepEqual(Array.from(clip.beats),[0,19]);
 assert.equal(source.captions[0].start,9);
});
test('supports three sections and a lyric-free selection',()=>{
 const c=clipTimelines(source,[{startMs:0,endMs:20000},{startMs:10000,endMs:40000},{startMs:65000,endMs:100000}]);
 assert.deepEqual(Array.from(c,x=>x.songDuration),[20,30,35]);
 assert.equal(c[2].captions.length,0);
});
test('rejects duplicates and out-of-bounds, fractional or invalid lengths',()=>{
 const good={startMs:0,endMs:20000};
 for(const ranges of [[],[good,good],[good,good,good,good],...[[-1,20000],[0,19999],[0,35001],[80000,100001],[0.5,20001],[NaN,20000]].map(([startMs,endMs])=>[{startMs,endMs}])]){
  assert.throws(()=>clipTimelines(source,ranges),{name:'RangeError'});
 }
});

test('WAV export contains only the selected samples at the original sample rate',()=>{
 const wav={};
 vm.runInNewContext(ts.transpile(fs.readFileSync(require.resolve('../src/lib/rendering/clip-audio.ts'),'utf8'),
  {module:ts.ModuleKind.CommonJS}),{exports:wav,require:id=>id==='./clip-timeline'?mod.exports:{MAX_UPLOAD_BYTES:25_000_000}});
 const samples=new Float32Array(40000);
 samples[11999]=1;samples[12000]=0.5;samples[31999]=-0.5;samples[32000]=1;
 const bytes=wav.encodeClipWav({duration:40,sampleRate:1000,numberOfChannels:1,getChannelData:()=>samples},{startMs:12000,endMs:32000});
 const view=new DataView(bytes);
 assert.equal(view.getUint32(24,true),1000);
 assert.equal(view.getUint32(40,true),40000);
 assert.equal(view.getInt16(44,true),16384);
 assert.equal(view.getInt16(bytes.byteLength-2,true),-16384);
});
