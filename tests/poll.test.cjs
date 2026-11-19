const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
function setup(task){
 const timers=new Map();let id=0;const mod={exports:{}};
 const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/rendering/poll.ts'),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{module:mod,exports:mod.exports,
 setTimeout:fn=>{timers.set(++id,fn);return id},clearTimeout:id=>timers.delete(id)});
 return{timers,stop:mod.exports.startPolling(task)};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('polling never overlaps slow work and stops scheduling after cleanup',async()=>{
 let calls=0,finish;
 const s=setup(()=>{calls++;return new Promise(resolve=>finish=resolve)});
 assert.equal(calls,1);assert.equal(s.timers.size,0);
 await flush();assert.equal(calls,1);assert.equal(s.timers.size,0);
 finish();await flush();assert.equal(s.timers.size,1);
 const [id,fn]=[...s.timers][0];s.timers.delete(id);fn();
 assert.equal(calls,2);assert.equal(s.timers.size,0);
 s.stop();finish();await flush();assert.equal(s.timers.size,0);
});
test('a failed refresh schedules recovery; cleanup cancels a scheduled retry',async()=>{
 const s=setup(async()=>{throw Error('offline')});
 await flush();assert.equal(s.timers.size,1);
 s.stop();assert.equal(s.timers.size,0);
});
