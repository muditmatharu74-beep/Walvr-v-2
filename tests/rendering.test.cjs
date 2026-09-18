const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Transpile the real route modules, replacing only network/service boundaries.
function load(file, mocks = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  }}).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    return require(name);
  }, module, module.exports);
  return module.exports;
}
const settings = load('src/lib/render-settings.ts');
process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-secret';
const signatures = load('src/lib/render-signature.ts');
const json = { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
const request = body => ({ json: async () => body });
function dbFixture(records = {}) {
  const calls = [];
  return { calls, from(table) {
    const op = { table, filters: [], update: null };
    calls.push(op);
    const query = {
      select() { return query; },
      update(values) { op.update = values; return query; },
      insert(values) { op.insert = values; return query; },
      eq(key,value) { op.filters.push([key,value]); return query; },
      single: async () => ({ data: records[table] ?? null, error: null }),
      maybeSingle: async () => ({ data: records.claim === false ? null : { id: 'video-1' }, error: null }),
      then(resolve,reject) { return Promise.resolve({ data: null, error: records.updateError ?? null }).then(resolve,reject); },
    };
    return query;
  }};
}
function session(user = { id: 'owner' }) {
  return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) };
}
const video = { id: 'video-1', status: 'rendering', render_id: 'stored-render', clip_style: 'dark-solid',
  analysis: { render: { provider: 'remotion', bucketName: 'stored-bucket', functionName: 'stored-function', region: 'us-east-1' } } };
video.analysis.render.signature=signatures.signRenderMetadata({videoId:video.id,userId:'owner',renderId:video.render_id},video.analysis.render);
function statusRoute(record, progress, user) {
  const db = dbFixture({ videos: record });
  const polls = [];
  const route = load('src/app/api/check-render/route.ts', {
    '@supabase/supabase-js': { createClient: () => db },
    '@/lib/render-signature': signatures,
    '@/lib/supabase/server': session(user), 'next/server': json,
    '@remotion/lambda/client': { getRegions: () => ['us-east-1'], getRenderProgress: async args => { polls.push(args); return progress; } },
  });
  return { ...route, db, polls };
}
test('duration preserves 190-second audio and rounds fractional frames up', () => {
  assert.equal(settings.getDurationInFrames(190),5700);
  assert.equal(settings.getDurationInFrames(15.01),451);
  assert.equal(settings.getDurationInFrames(0.001),1);
  for(const n of [0,-1,NaN,Infinity,undefined,'190']) assert.throws(() => settings.getDurationInFrames(n));
});
test('plan resolution is correct', () => {
  assert.deepEqual(settings.getRenderSize('free'),{width:1080,height:1920});
  assert.deepEqual(settings.getRenderSize('business'),{width:2160,height:3840});
});
test('audio must be in the signed-in user upload folder', () => {
  const base='https://example.supabase.co';
  settings.validateUploadUrl(base+'/storage/v1/object/public/uploads/owner/song.mp3',base,'owner');
  for(const url of [base+'/storage/v1/object/public/uploads/other/song.mp3', 'https://evil.test/song.mp3',base+'/storage/v1/object/public/uploads/owner/../other/song.mp3']) {
    assert.throws(() => settings.validateUploadUrl(url,base,'owner'));
  }
});
test('Remotion completion saves output and ignores request renderId', async () => {
  const r=statusRoute(video,{done:true,outputFile:'https://output.test/video.mp4'});
  const res=await r.POST(request({videoId:'video-1',renderId:'attacker-render'}));
  assert.equal(res.body.status,'done');
  assert.equal(r.polls[0].renderId,'stored-render');
  assert.equal(r.polls[0].bucketName,'stored-bucket');
  assert.equal(r.db.calls[1].update.render_url,'https://output.test/video.mp4');
  assert.deepEqual(r.db.calls[0].filters,[['id','video-1'],['user_id','owner']]);
});
test('in-progress render is not prematurely completed', async () => {
  const r=statusRoute(video,{done:false,fatalErrorEncountered:false});
  assert.equal((await r.POST(request({videoId:'video-1'}))).body.status,'rendering');
  assert.equal(r.db.calls.length,1);
});
test('fatal Remotion error persists error state', async () => {
  const r=statusRoute(video,{done:false,fatalErrorEncountered:true,errors:['render failed']});
  assert.equal((await r.POST(request({videoId:'video-1'}))).body.status,'error');
  assert.equal(r.db.calls[1].update.status,'error');
});
test('missing user cannot poll', async () => {
  const r=statusRoute(video,{},null);
  assert.equal((await r.POST(request({videoId:'video-1'}))).status,401);
  assert.equal(r.polls.length,0);
  assert.equal(r.db.calls.length,0);
});
test('unowned video cannot be polled or updated', async () => {
  const r=statusRoute(null,{});
  assert.equal((await r.POST(request({videoId:'other-video'}))).status,404);
  assert.equal(r.polls.length,0);
  assert.equal(r.db.calls.length,1);
});
test('legacy Dark Lyrics job without bucket does not poll Creatomate', async () => {
  const r=statusRoute({...video,analysis:{}},{});
  assert.equal((await r.POST(request({videoId:'video-1'}))).body.status,'error');
  assert.equal(r.polls.length,0);
});
test('completed video does not invoke Lambda again', async () => {
  const r=statusRoute({...video,status:'done',render_url:'https://output.test/video.mp4'},{});
  assert.equal((await r.POST(request({videoId:'video-1'}))).body.url,'https://output.test/video.mp4');
  assert.equal(r.polls.length,0);
});
test('completion without output is not saved as successful', async () => {
  const r=statusRoute(video,{done:true,outputFile:null});
  assert.equal((await r.POST(request({videoId:'video-1'}))).status,500);
  assert.equal(r.db.calls.length,1);
});
test('legacy Creatomate success remains supported', async () => {
  const original=global.fetch;
  global.fetch=async () => ({ok:true,json:async()=>({status:'succeeded',url:'https://output.test/legacy.mp4'})});
  try {
    const r=statusRoute({...video,clip_style:'color-block',analysis:{}},{});
    assert.equal((await r.POST(request({videoId:'video-1'}))).body.status,'done');
    assert.equal(r.polls.length,0);
  } finally { global.fetch=original; }
});
function processRoute({user, owned = {id:'video-1',status:'pending'}, claim=true, failRender=false} = {}) {
  const db=dbFixture({videos:owned,profiles:{plan:'free',credits:300},templates:{plan_required:'free',background_type:'dark-solid'},claim});
  const renders=[];
  const route=load('src/app/api/process/route.ts',{
    '@supabase/supabase-js':{createClient:()=>db},'next/server':json,
    '@/lib/render-signature': signatures,
    '@/lib/supabase/server':session(user), '@/lib/render-settings':settings,
    '@anthropic-ai/sdk':class { messages={create:async()=>({content:[{type:'text',text:JSON.stringify({mood:'dark',genre:'pop'})}]})}; },
    '@/lib/remotion':{startRemotionRender:async props=>{renders.push(props); if(failRender) throw new Error('AWS test failure'); return {id:'new-render',metadata:video.analysis.render};}},
  });
  return {...route,db,renders};
}
const body={videoId:'video-1',userId:'spoofed',fileUrl:'https://example.supabase.co/storage/v1/object/public/uploads/owner/song.mp3',captionStyle:'bold-overlay',templateId:'template-1'};
test('processing preserves full audio duration, saves tracking and uses authenticated owner',async()=>{
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';
  const original=global.fetch;
  global.fetch=async url=>url.includes('/audio/transcriptions')
    ? {ok:true,json:async()=>({duration:190,text:'hello',words:[{word:'hello',start:0,end:2}]})}
    : {ok:true,arrayBuffer:async()=>new ArrayBuffer(10),headers:new Headers({'content-type':'audio/mpeg'})};
  try {
    const r=processRoute(); const result=await r.POST(request(body));
    assert.equal(result.status,200);
    assert.equal(r.renders[0].songDuration,190);
    const save=r.db.calls.find(c=>c.update?.render_id);
    assert.equal(save.update.analysis.render.bucketName,'stored-bucket');
    assert.ok(r.db.calls.filter(c=>c.table==='profiles').every(c=>c.filters.some(([k,v])=>k==='id'&&v==='owner')));
  } finally {global.fetch=original;}
});
test('render failure does not deduct credits',async()=>{
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';
  const original=global.fetch;
  global.fetch=async url=>url.includes('/audio/transcriptions')
    ? {ok:true,json:async()=>({duration:190,text:'hello',words:[]})}
    : {ok:true,arrayBuffer:async()=>new ArrayBuffer(10),headers:new Headers()};
  try {
    const r=processRoute({failRender:true});
    assert.equal((await r.POST(request(body))).status,500);
    assert.equal(r.db.calls.some(c=>c.table==='profiles'&&c.update),false);
    assert.equal(r.db.calls.at(-1).update.status,'error');
  } finally {global.fetch=original;}
});
test('duplicate processing request never starts another render',async()=>{
  const r=processRoute({claim:false});
  assert.equal((await r.POST(request(body))).status,409);
  assert.equal(r.renders.length,0);
});
test('processing rejects another users video without updating it',async()=>{
  const r=processRoute({owned:null});
  assert.equal((await r.POST(request(body))).status,404);
  assert.equal(r.db.calls.some(c=>c.update),false);
});

test('tampered render metadata never reaches AWS',async()=>{
  const r=statusRoute({...video,render_id:'different-render'},{});
  assert.equal((await r.POST(request({videoId:'video-1'}))).status,500);
  assert.equal(r.polls.length,0);
});
test('tracking signature is bound to owner and video',()=>{
  const identity={videoId:video.id,userId:'owner',renderId:video.render_id};
  assert.equal(signatures.verifyRenderMetadata(identity,video.analysis.render),true);
  assert.equal(signatures.verifyRenderMetadata({...identity,userId:'other'},video.analysis.render),false);
  assert.equal(signatures.verifyRenderMetadata({...identity,videoId:'other'},video.analysis.render),false);
});
