const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const path=require('node:path');
function setup(replies, profiles=[], deletion={data:[]}, approved=true){
 const state=[]; const callbacks=[]; let index=0;
 const mod={exports:{}};
 const jsx=(type,props)=>({type,props});
 const supabase={from:()=>({delete:()=>({eq:()=>({select:async()=>{if(deletion instanceof Error)throw deletion;return deletion}})}),select:()=>({eq:()=>({abortSignal:()=>({single:async()=>{const r=profiles.shift();if(r instanceof Error)throw r;return r}}),order:()=>({abortSignal:async()=>{
   const reply=replies.shift();if(reply instanceof Error)throw reply;return reply;
 }})})})})};
 const mocks={
  react:{useState:initial=>{const i=index++;if(state[i]===undefined)state[i]=initial;
   return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]},
   useEffect:()=>{},useCallback:fn=>{callbacks.push(fn);return fn}},
  'react/jsx-runtime':{jsx,jsxs:jsx},
  'next/navigation':{useRouter:()=>({push:()=>{}})},
  '@/lib/rendering/poll':{startPolling:()=>()=>{}},
  'next/link':{default:()=>null},
  '@/lib/supabase/client':{createClient:()=>supabase}
 };
 const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/app/(dashboard)/dashboard/page.tsx'),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{module:mod,exports:mod.exports,require:id=>mocks[id],confirm:()=>approved,AbortSignal});
 function render(){index=0;return mod.exports.default()}
 render();
 return{state,load:callbacks[0],loadProfile:callbacks[1],render};
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

test('credit refresh reflects charges and refunds without replacing failures with zero',async()=>{
 const s=setup([],[{data:{credits:300,plan:'free'}},{data:{credits:100,plan:'free'}},
  {data:null,error:{message:'offline'}},new Error('network'),{data:{credits:300,plan:'free'}}]);
 for(const expected of [300,100,100,100,300]){
  await s.loadProfile('owner');assert.equal(s.state[1].credits,expected);
 }
 assert.equal(s.state[5],'');
});
test('an unavailable initial balance is unknown, while a confirmed zero remains zero',async()=>{
 const s=setup([],[{data:null,error:{message:'offline'}},{data:{credits:0,plan:'free'}}]);
 await s.loadProfile('owner');
 assert.equal(s.state[1],null);
 assert.match(JSON.stringify(s.render()),/Could not refresh your credit balance/);
 await s.loadProfile('owner');assert.equal(s.state[1].credits,0);assert.equal(s.state[5],'');
});

function findDelete(node){
 if(!node || typeof node!=='object')return;
 if(node.type==='button' && node.props.children==='Delete')return node;
 for(const child of [node.props?.children].flat(Infinity)){const found=findDelete(child);if(found)return found}
}
test('a rejected, unmatched, or interrupted delete preserves the video with an error',async()=>{
 for(const deletion of [{data:null,error:{message:'denied'}},{data:[]},new Error('lost response')]){
  const s=setup([{data:[{id:'v',status:'done',render_url:'https://media.test/v.mp4'}]}],[],deletion);
  await s.load('owner');
  await findDelete(s.render()).props.onClick();
  assert.equal(s.state[2].length,1);
  assert.match(JSON.stringify(s.render()),/Could not confirm deletion/);
 }
});
test('only a confirmed delete removes a video; cancelling keeps it',async()=>{
 for(const approved of [false,true]){
  const s=setup([{data:[{id:'v',status:'done',render_url:'https://media.test/v.mp4'}]}],[],{data:[{id:'v'}]},approved);
  await s.load('owner');await findDelete(s.render()).props.onClick();
  assert.equal(s.state[2].length,approved?0:1);
 }
});
