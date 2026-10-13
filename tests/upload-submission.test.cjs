const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,mocks,globals={}){
 const mod={exports:{}};
 const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{module:mod,exports:mod.exports,require:id=>{if(!(id in mocks))throw Error(id);return mocks[id]},...globals});
 return mod.exports;
}
const responses=load('src/lib/rendering/submission-response.ts',{});
function setup(reply){
 const state=['caption',{name:'song.mp3'},'Song','',[],{id:'template',background_type:'dark-solid'},'clean-neon',false,false,'','pro',10000];
 const refs=[];let index=0,refIndex=0;
 const calls={uploads:0,rows:0,requests:0,navigation:[]};
 const react={useState:initial=>{const i=index++;if(state[i]===undefined)state[i]=initial;return[state[i],value=>state[i]=value]},
  useRef:initial=>{const i=refIndex++;return refs[i]??(refs[i]={current:initial})},useEffect:()=>{}};
 const supabase={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},storage:{from:()=>({upload:async()=>{calls.uploads++;return{error:null}},getPublicUrl:()=>({data:{publicUrl:'https://audio.test/song.mp3'}})})},
  from:()=>({insert:()=>({select:()=>({single:async()=>{calls.rows++;return{data:{id:'video'},error:null}}})})})};
 const jsx=(type,props)=>({type,props});
 const page=load('src/app/(dashboard)/upload/page.tsx',{
  react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useRouter:()=>({push:url=>calls.navigation.push(url)})},
  '@/lib/supabase/client':{createClient:()=>supabase},'@/lib/rendering/upload':{MAX_UPLOAD_BYTES:25000000,AUDIO_EXTENSIONS:['mp3']},
  '@/lib/rendering/submission-response':responses,'@/components/NeonCaptionPreview':{NeonCaptionPreview:()=>null},
  '@/lib/rendering/neon-captions':{creditCost:()=>200,isNeonStyle:()=>true},
 },{fetch:async()=>{calls.requests++;return reply()}}).default;
 function render(){index=0;refIndex=0;return page()}
 function button(tree,label){if(!tree||typeof tree!=='object')return;if(tree.type==='button'&&tree.props.children===label)return tree;
  for(const child of [tree.props?.children].flat(Infinity)){const result=button(child,label);if(result)return result}}
 return{render,button,calls};
}
test('the real upload page replaces Create with Dashboard after a lost response',async()=>{
 for(const reply of [()=>{throw new TypeError('Failed to fetch')},()=>Response.json({error:'Processing failed'},{status:500})]){
  const s=setup(reply);await s.button(s.render(),'Create Video →').props.onClick();
  const next=s.render();assert.equal(s.button(next,'Create Video →'),undefined);
  s.button(next,'Check Dashboard →').props.onClick();
  assert.equal(s.calls.uploads,1);assert.equal(s.calls.rows,1);assert.equal(s.calls.requests,1);
  assert.deepEqual(s.calls.navigation,['/dashboard']);
 }
});
test('the upload page still allows correcting a clear pre-submission rejection',async()=>{
 const s=setup(()=>Response.json({error:'Not enough credits'},{status:403}));
 await s.button(s.render(),'Create Video →').props.onClick();
 assert.ok(s.button(s.render(),'Create Video →'));assert.equal(s.calls.navigation.length,0);
});
