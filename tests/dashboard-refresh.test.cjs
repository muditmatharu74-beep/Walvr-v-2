const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const path=require('node:path');
function setup(replies){
 const state=[]; const callbacks=[]; let index=0;
 const mod={exports:{}};
 const jsx=(type,props)=>({type,props});
 const supabase={from:()=>({select:()=>({eq:()=>({order:async()=>{
   const reply=replies.shift();if(reply instanceof Error)throw reply;return reply;
 }})})})};
 const mocks={
  react:{useState:initial=>{const i=index++;if(state[i]===undefined)state[i]=initial;
   return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]},
   useEffect:()=>{},useCallback:fn=>{callbacks.push(fn);return fn}},
  'react/jsx-runtime':{jsx,jsxs:jsx},
  'next/navigation':{useRouter:()=>({push:()=>{}})},
  'next/link':{default:()=>null},
  '@/lib/supabase/client':{createClient:()=>supabase}
 };
 const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/app/(dashboard)/dashboard/page.tsx'),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{module:mod,exports:mod.exports,require:id=>mocks[id]});
 function render(){index=0;return mod.exports.default()}
 render();
 return{state,load:callbacks[0],render};
}
test('dashboard preserves confirmed videos across returned and thrown refresh errors, then recovers',async()=>{
 const video={id:'v',title:'My song',status:'pending'};
 const s=setup([{data:[video],error:null},{data:null,error:{message:'offline'}},new Error('network'),{data:[],error:null}]);
 await s.load('owner');assert.equal(s.state[2][0].id,'v');
 for(let i=0;i<2;i++){
  await s.load('owner');assert.equal(s.state[2][0].id,'v');
  assert.match(JSON.stringify(s.render()),/Could not refresh your videos/);
 }
 await s.load('owner');assert.equal(s.state[2].length,0);assert.equal(s.state[3],'');
});
test('failed first load is not presented as an empty successful dashboard',async()=>{
 const s=setup([{data:null,error:{message:'offline'}}]);
 await s.load('owner');assert.equal(s.state[4],false);
 assert.match(JSON.stringify(s.render()),/Could not refresh your videos/);
});
test('pending and audio processing have distinct descriptions',async()=>{
 const s=setup([{data:[{id:'a',status:'pending'},{id:'b',status:'processing'}],error:null}]);
 await s.load('owner');
 const text=JSON.stringify(s.render());
 assert.match(text,/Waiting for processing confirmation/);
 assert.match(text,/Processing audio/);
});
