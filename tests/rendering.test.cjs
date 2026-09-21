const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real route with mocked external services, without credentials or charges.
function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports,
    require: (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id),
    console: { error() {}, info() {} }, process, URL, Response, Request, Blob, FormData, Uint8Array,
    fetch: mocks.fetch ?? (() => { throw new Error('Unexpected network request'); }),
  }, { filename: file });
  return mod.exports;
}
const timing = load('src/lib/rendering/timing.ts');
const upload = load('src/lib/rendering/upload.ts');
const userId = '9e87c63d-2535-4a00-be94-6dae6899a4ab';
const videoId = '93a4e653-ae1f-4b67-9dc6-1dde9ed3f238';
const origin = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_URL = origin;

test('duration uses full audio including an instrumental outro', () => {
  assert.equal(timing.songDuration(125.1, [{ end: 110 }]), 125.1);
  assert.equal(timing.durationInFrames(125.1), 3753);
  assert.equal(timing.durationInFrames(15.01), 451);
  assert.equal(timing.songDuration(undefined, [{ end: 17 }]), 18);
  for (const value of [NaN, Infinity, 0, -1]) assert.throws(() => timing.durationInFrames(value));
});

test('upload URL rejects other users, external hosts, traversal and signed query injection', () => {
  const own = `${origin}/storage/v1/object/public/uploads/${userId}/song.mp3`;
  assert.equal(upload.ownedUploadUrl(own, userId, origin).href, own);
  for (const bad of [own.replace(userId, 'another-user'), own.replace(origin, 'https://attacker.test'),
    own.replace('song.mp3', '../song.mp3'), own.replace('song.mp3', 'nested%2fsong.mp3'),
    own + '?redirect=https://attacker.test', own.replace('song.mp3', 'file.exe')]) {
    assert.throws(() => upload.ownedUploadUrl(bad, userId, origin));
  }
});

function setup({ user = { id: userId }, video = null, progress = {}, progressError = false, fetchResult } = {}) {
  const calls = []; const writes = []; const providerCalls = [];
  const db = { async rpc(name, args) {
    assert.equal(name, 'settle_video_credits');
    assert.equal(args.p_user_id, userId);
    assert.equal(args.p_render_id, 'stored-render');
    writes.push({ status: args.p_status, render_url: args.p_url });
    return { data: { status: args.p_status, url: args.p_url }, error: null };
  }, from(table) {
    const query = {
      select() { return query; }, eq(key, value) { calls.push([table, key, value]); return query; },
      update(value) { writes.push(value); return query; },
      maybeSingle: async () => ({ data: video, error: null }),
      then(resolve) { return Promise.resolve({ error: null }).then(resolve); },
    }; return query;
  } };
  const mocks = {
    '@supabase/supabase-js': { createClient: () => db },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) },
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/rendering/remotion': { darkLyricsProgress: async (job) => {
      providerCalls.push(job);
      if (progressError) throw new Error('Temporary AWS problem');
      return progress;
    }, startDarkLyricsRender: () => { throw new Error('Unexpected render submission'); } },
    '@/lib/rendering/timing': timing,
    '@/lib/rendering/upload': upload,
    '@anthropic-ai/sdk': class { constructor() {} },
    fetch: async (url) => { providerCalls.push(url); return Response.json(fetchResult); },
  };
  return { mocks, calls, writes, providerCalls };
}
const request = (body) => new Request('https://walvr.test/api/check-render', { method: 'POST', body: JSON.stringify(body) });
const renderVideo = { id: videoId, user_id: userId, status: 'rendering', render_id: 'stored-render',
  render_provider: 'remotion', render_bucket: 'stored-bucket', render_function: 'stored-function', render_region: 'us-east-1' };

test('unauthenticated polling and submission cannot reach the database or renderer', async () => {
  for (const route of ['check-render', 'process']) {
    const state = setup({ user: null });
    const response = await load(`src/app/api/${route}/route.ts`, state.mocks).POST(request({ videoId }));
    assert.equal(response.status, 401);
    assert.equal(state.calls.length, 0);
    assert.equal(state.providerCalls.length, 0);
  }
});

test('polling returns 404 for an inaccessible video and queries by authenticated owner', async () => {
  const state = setup();
  const response = await load('src/app/api/check-render/route.ts', state.mocks).POST(request({ videoId }));
  assert.equal(response.status, 404);
  assert.ok(state.calls.some(([, key, value]) => key === 'user_id' && value === userId));
  assert.equal(state.writes.length, 0);
});

test('Remotion completion uses saved identifiers, ignoring forged browser values', async () => {
  const state = setup({ video: renderVideo, progress: { done: true, outputFile: 'https://output.test/video.mp4' } });
  const response = await load('src/app/api/check-render/route.ts', state.mocks).POST(request({ videoId, renderId: 'forged', bucketName: 'forged' }));
  assert.equal((await response.json()).status, 'done');
  assert.equal(state.providerCalls[0].render_id, 'stored-render');
  assert.equal(state.writes[0].render_url, 'https://output.test/video.mp4');
});

test('fatal render errors stop polling; transient lookup errors preserve rendering state', async () => {
  const failed = setup({ video: renderVideo, progress: { fatalErrorEncountered: true, errors: ['bad media'] } });
  const response = await load('src/app/api/check-render/route.ts', failed.mocks).POST(request({ videoId }));
  assert.equal((await response.json()).status, 'error');
  assert.equal(failed.writes[0].status, 'error');
  const transient = setup({ video: renderVideo, progressError: true });
  const retry = await load('src/app/api/check-render/route.ts', transient.mocks).POST(request({ videoId }));
  assert.equal(retry.status, 500);
  assert.equal(transient.writes.length, 0);
});

test('legacy Creatomate videos still complete; legacy Dark Lyrics never queries Creatomate', async () => {
  const state = setup({ video: { ...renderVideo, render_provider: null, clip_style: 'color-block' }, fetchResult: { status: 'succeeded', url: 'https://output.test/old.mp4' } });
  const response = await load('src/app/api/check-render/route.ts', state.mocks).POST(request({ videoId }));
  assert.equal((await response.json()).status, 'done');
  assert.match(state.providerCalls[0], /creatomate/);
  const legacy = setup({ video: { ...renderVideo, render_provider: null, clip_style: 'dark-solid' } });
  assert.equal((await load('src/app/api/check-render/route.ts', legacy.mocks).POST(request({ videoId }))).status, 409);
  assert.equal(legacy.providerCalls.length, 0);
});

test('completed videos skip external polling', async () => {
  const state = setup({ video: { ...renderVideo, status: 'done', render_url: 'https://output.test/video.mp4' } });
  const response = await load('src/app/api/check-render/route.ts', state.mocks).POST(request({ videoId }));
  assert.equal((await response.json()).status, 'done');
  assert.equal(state.providerCalls.length, 0);
});

test('legacy submission endpoint cannot start an unbilled render', async () => {
  const state = setup();
  const response = await load('src/app/api/render-remotion/route.ts', state.mocks).POST();
  assert.equal(response.status, 410);
  assert.equal(state.providerCalls.length, 0);
});

test('submission rejects another owner and already-submitted videos before paid work', async () => {
  const body = { videoId, templateId: '13c51a59-7ad1-4669-a519-aa694f1b047f',
    title: 'Song', artist: 'Artist', captionStyle: 'bold-overlay', userId: 'forged-user',
    fileUrl: `${origin}/storage/v1/object/public/uploads/${userId}/song.mp3` };
  const missing = setup();
  assert.equal((await load('src/app/api/process/route.ts', missing.mocks).POST(request(body))).status, 404);
  assert.ok(missing.calls.some(([, key, value]) => key === 'user_id' && value === userId));
  const running = setup({ video: renderVideo });
  assert.equal((await load('src/app/api/process/route.ts', running.mocks).POST(request(body))).status, 409);
  assert.equal(running.writes.length, 0);
  assert.equal(running.providerCalls.length, 0);
});

function submission({ reservation='reserved', transcriptionFails=false, trackingFails=false }={}) {
  const state=setup(); const rpc=[]; const renders=[];
  const db={
    async rpc(name,args){rpc.push({name,args});return {data:name==='reserve_video_credits'?{status:reservation,credits:400}:{status:'error'},error:null}},
    from(table){let update;
      const data=table==='videos'?{id:videoId,status:'pending'}:table==='profiles'?{plan:'free',credits:500}:{active:true,plan_required:'free',background_type:'dark-solid'};
      const q={select(){return q},eq(){return q},update(value){update=value;return q},maybeSingle:async()=>({data,error:null}),single:async()=>({data,error:null}),
        then(resolve){return Promise.resolve({error:trackingFails&&update?.render_id?new Error('tracking unavailable'):null}).then(resolve)}};return q;
    },
  };
  state.mocks['@supabase/supabase-js']={createClient:()=>db};
  state.mocks['@anthropic-ai/sdk']=class{constructor(){this.messages={create:async()=>({content:[{type:'text',text:'{"mood":"dark","energy":"low"}'}]})}}};
  state.mocks['@/lib/rendering/remotion']={startDarkLyricsRender:async()=>{renders.push('job');return {id:'job',bucketName:'bucket',functionName:'function',region:'us-east-1'}}};
  state.mocks.fetch=async(url)=>{
    if(transcriptionFails) return new Response('failure',{status:500});
    if(String(url).includes('transcriptions'))return Response.json({text:'lyrics',duration:10,words:[{word:'hello',start:0,end:1}]});
    return new Response('audio',{headers:{'content-type':'audio/mpeg'}});
  };
  const body={videoId,templateId:'13c51a59-7ad1-4669-a519-aa694f1b047f',title:'Song',artist:'Artist',captionStyle:'bold-overlay',fileUrl:`${origin}/storage/v1/object/public/uploads/${userId}/song.mp3`};
  return {rpc,renders,run:()=>load('src/app/api/process/route.ts',state.mocks).POST(request(body))};
}
test('reservation rejection stops submission before renderer work',async()=>{
  const s=submission({reservation:'already_submitted'});assert.equal((await s.run()).status,409);assert.equal(s.renders.length,0);assert.equal(s.rpc.length,1);
});
test('pre-render processing failure uses the atomic refund transaction',async()=>{
  const s=submission({transcriptionFails:true});assert.equal((await s.run()).status,500);assert.equal(s.rpc[1].name,'settle_video_credits');assert.equal(s.rpc[1].args.p_render_id,null);assert.equal(s.renders.length,0);
});
test('successful submission uses reservation balance without a second debit',async()=>{
  const s=submission();const r=await s.run();assert.equal(r.status,200);assert.equal((await r.json()).creditsRemaining,400);assert.equal(s.rpc.length,1);assert.equal(s.renders.length,1);
});
test('tracking failure after a job starts preserves charge for reconciliation',async()=>{
  const s=submission({trackingFails:true});assert.equal((await s.run()).status,500);assert.equal(s.renders.length,1);assert.equal(s.rpc.length,1);
});
