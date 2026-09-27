const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,mocks={}) {
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{module:mod,exports:mod.exports,require:id=>mocks[id]??require(id),process,Buffer,console:{error(){}}});return mod.exports;
}
const now=Date.parse('2026-09-27T00:00:00Z');
const job={id:'video',user_id:'owner',status:'rendering',render_id:'render',render_provider:'creatomate',recovery_next_check:new Date(now-1000).toISOString()};
function setup({video=job,result={status:'done',url:'https://test/video.mp4'},providerError=false,settleError=false}={}){
 const row={...video};const writes=[];const settlements=[];let polls=0;
 const db={from(){let update,filters=[];const q={select(){return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},lte(k,v){filters.push(r=>r[k]<=v);return q},order(){return q},limit(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},update(v){update=v;return q},
 async maybeSingle(){if(!filters.every(f=>f(row)))return {data:null,error:null};Object.assign(row,update);writes.push(update);return {data:{id:row.id},error:null}},
 then(resolve){if(update){if(filters.every(f=>f(row))){Object.assign(row,update);writes.push(update)}return Promise.resolve({error:null}).then(resolve)}return Promise.resolve({data:filters.every(f=>f(row))?[{...row}]:[],error:null}).then(resolve)}};return q},
 async rpc(name,args){settlements.push(args);if(settleError)return {error:Error('db failed')};row.status=args.p_status;return {data:{status:args.p_status},error:null}}};
 const {recoverRenders}=load('src/lib/rendering/recovery.ts',{'./status':{readRenderStatus:async()=>{polls++;if(providerError)throw Error('provider unavailable');return result}}});
 return {row,writes,settlements,get polls(){return polls},run:()=>recoverRenders(db,now)};
}
test('worker completes tracked video without browser and passes owner to settlement',async()=>{const s=setup();const r=await s.run();assert.equal(r.completed,1);assert.equal(s.settlements[0].p_user_id,'owner');assert.equal(s.row.status,'done')});
test('confirmed failure uses one-time settlement RPC',async()=>{const s=setup({result:{status:'error',url:null}});assert.equal((await s.run()).failed,1);await s.run();assert.equal(s.settlements.length,1)});
test('overlapping workers claim a due row once',async()=>{const s=setup();const results=await Promise.all([s.run(),s.run()]);assert.equal(s.polls,1);assert.equal(s.settlements.length,1);assert.equal(results.reduce((n,r)=>n+r.skipped,0),1)});
test('temporary provider and database failures schedule retry, never refund',async()=>{for(const opts of [{providerError:true},{settleError:true}]){const s=setup(opts);assert.equal((await s.run()).retry,1);assert.equal(s.row.status,'rendering');assert.equal(s.row.recovery_reason,'provider_or_settlement_retry');assert.ok(s.row.recovery_next_check>new Date(now).toISOString())}});
test('processing and missing metadata require review without resubmission/refund',async()=>{for(const video of [{...job,status:'processing'},{...job,render_id:null},{...job,render_provider:'remotion'},{...job,render_provider:null,clip_style:'dark-solid'}]){const s=setup({video});assert.equal((await s.run()).review,1);assert.equal(s.polls,0);assert.equal(s.settlements.length,0)}});
test('still-running job is checked later without money movement',async()=>{const s=setup({result:{status:'rendering',url:null}});await s.run();assert.equal(s.settlements.length,0);assert.equal(s.row.status,'rendering')});
test('cron rejects missing configuration and unauthorized callers before database access',async()=>{
 let calls=0;const route=load('src/app/api/cron/recover-renders/route.ts',{'@supabase/supabase-js':{createClient(){calls++;return {}}},'@/lib/rendering/recovery':{recoverRenders:async()=>({checked:0})},'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}}});
 const original=process.env.CRON_SECRET;
 try{delete process.env.CRON_SECRET;assert.equal((await route.GET(new Request('https://test'))).status,503);process.env.CRON_SECRET='test-secret';assert.equal((await route.GET(new Request('https://test'))).status,401);assert.equal(calls,0);assert.equal((await route.GET(new Request('https://test',{headers:{authorization:'Bearer test-secret'}}))).status,200);assert.equal(calls,1)}finally{if(original===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=original}
});
