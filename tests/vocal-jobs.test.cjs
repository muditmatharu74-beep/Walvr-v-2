const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const {createHash} = require('node:crypto');

function load(file, mocks = {}) {
  const mod = {exports: {}};
  const source = ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true},
  }).outputText;
  vm.runInNewContext(source, {module: mod, exports: mod.exports, process, Buffer, URL,
    Request, Response, AbortSignal, Uint8Array, console: {error(){}, info(){}},
    fetch: mocks.fetch ?? (() => {throw Error('Unexpected fetch')}),
    require(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'), mocks);
      return require(id);
    },
  });
  return mod.exports;
}
const origin = 'https://storage.test';
const userId = '11111111-1111-4111-8111-111111111111';
const videoId = '22222222-2222-4222-8222-222222222222';
const url = `${origin}/storage/v1/object/public/uploads/${userId}/song.mp3`;
const hash = createHash('sha256').update('original').digest('hex');
const analysis = {schemaVersion: 1, sourceSha256: hash, songDuration: 10, excerptStart: 0,
  excerptDuration: 10, text: 'test lyric', words: [{word: 'test', start: 1, end: 2, alignmentScore: .8}],
  beats: [1, 2], reviewRequired: false};
function setup({badSource=false, lostSubmission=false, saveFails=false} = {}) {
  const calls = [], renders = [];
  const job = {video_id: videoId, user_id: userId, source_url: url, source_sha256: hash,
    caption_style: 'clean-neon', original_duration: 10, result: analysis};
  const api = load('src/lib/rendering/vocal-jobs.ts', {
    fetch: async (_url, options) => {assert.equal(options.redirect, 'error'); return new Response(badSource ? 'changed' : 'original');},
    './remotion': {assertDarkLyricsConfigured(){}, startDarkLyricsRender: async props => {
      renders.push(props);
      if(lostSubmission) throw Error('response lost');
      return {id:'render',bucketName:'bucket',functionName:'function',region:'region'};
    }},
  });
  const db = {async rpc(name, args) {
    calls.push({name,args});
    if(name==='claim_vocal_render') return {data:job,error:null};
    if(name==='finish_vocal_render' && saveFails) return {data:null,error:Error('tracking write failed')};
    return {data:{status:'ready'},error:null};
  }, from() {const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:job,error:null})};return q;}};
  return {api, db, calls, renders};
}
process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
process.env.VERCEL_ENV = 'preview';
process.env.WALVR_VOCAL_TIMING_ENABLED = 'true';
process.env.WALVR_VOCAL_WORKER_SECRET = 's'.repeat(40);

test('worker auth requires explicit preview enablement and a server-only secret', () => {
  const {api} = setup();
  assert.equal(api.vocalWorkerAuthorized(null),false);
  assert.equal(api.vocalWorkerAuthorized('Bearer wrong'),false);
  assert.equal(api.vocalWorkerAuthorized('Bearer '+process.env.WALVR_VOCAL_WORKER_SECRET),true);
  process.env.VERCEL_ENV='production';
  assert.equal(api.vocalJobsEnabled(),false);
  assert.equal(api.vocalWorkerAuthorized('Bearer '+process.env.WALVR_VOCAL_WORKER_SECRET),false);
  process.env.VERCEL_ENV='preview';
});
test('resume uses aligned absolute clocks, real beats and original full audio', async () => {
  const s=setup(); await s.api.resumeVocalRender(s.db);
  assert.equal(s.renders.length,1);
  const props=s.renders[0];
  assert.equal(props.audioUrl,url); assert.equal(props.songDuration,10);
  assert.equal(props.captions[0].start,1); assert.equal(JSON.stringify(props.beats),'[1,2]');
  assert.equal(s.calls.at(-1).name,'finish_vocal_render');
});
test('changed original refuses a paid submission and requests confirmed-failure settlement',async()=>{
  const s=setup({badSource:true}); await s.api.resumeVocalRender(s.db);
  assert.equal(s.renders.length,0);
  assert.equal(s.calls.at(-1).name,'stop_vocal_render');
  assert.equal(s.calls.at(-1).args.p_uncertain,false);
});
test('lost provider response and tracking write failure preserve reservation for review',async()=>{
  for(const flags of [{lostSubmission:true},{saveFails:true}]){
    const s=setup(flags);await s.api.resumeVocalRender(s.db);
    assert.equal(s.renders.length,1);
    assert.equal(s.calls.at(-1).args.p_uncertain,true);
  }
});
test('empty, flagged and source-mismatched worker results cannot render',async()=>{
  for(const result of [{...analysis,words:[]},{...analysis,reviewRequired:true},{...analysis,sourceSha256:'f'.repeat(64)}]){
    const s=setup();await s.api.completeVocalAnalysis(s.db,{videoId,token:'token',originalDuration:10,result});
    assert.equal(s.renders.length,0);
    assert.equal(s.calls.at(-1).args.p_failure,'lyrics_unusable');
  }
});
test('valid completion persists before any provider call; duplicate/stale reports do nothing',async()=>{
  const s=setup();await s.api.completeVocalAnalysis(s.db,{videoId,token:'token',originalDuration:10,result:analysis});
  assert.equal(s.calls[0].name,'finish_vocal_analysis');assert.equal(s.renders.length,0);
  const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:null,error:null})};
  const stale=await s.api.completeVocalAnalysis({from:()=>q},{videoId,token:'stale',originalDuration:10,result:analysis});
  assert.equal(stale.status,'stale'); assert.equal(s.calls.length,1);
});
test('source download rejects oversize or empty inputs before queue reservation',async()=>{
  for(const response of [new Response('x',{headers:{'content-length':'25000001'}}),new Response('')]){
    const api=load('src/lib/rendering/vocal-jobs.ts',{fetch:async()=>response,'./remotion':{}});
    await assert.rejects(()=>api.enqueueVocalJob({rpc(){assert.fail('must not charge')}},{userId,videoId,fileUrl:url,captionStyle:'clean-neon',cost:200,plan:'free'}));
  }
});
test('internal endpoint rejects browsers before reading a body or accessing private jobs',async()=>{
  const {api}=setup();
  const route=load('src/app/api/internal/vocal-jobs/route.ts',{
    '@/lib/rendering/vocal-jobs':api,
    '@supabase/supabase-js':{createClient:()=>({rpc(){assert.fail('unauthorized DB access')}})},
    'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  });
  assert.equal((await route.POST(new Request('https://app.test/api/internal/vocal-jobs',{method:'POST',body:'invalid'}))).status,401);
});
