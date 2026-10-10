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
    console: { error() {}, info() {} }, process, URL, Response, Request, Blob, FormData, Uint8Array, AbortSignal,
    fetch: mocks.fetch ?? (() => { throw new Error('Unexpected network request'); }),
  }, { filename: file });
  return mod.exports;
}
const timing = load('src/lib/rendering/timing.ts');
const upload = load('src/lib/rendering/upload.ts');
const neonCaptions = load('src/lib/rendering/neon-captions.ts');
const transcriptionQuality = load('src/lib/rendering/transcription-quality.ts');
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
    '@/lib/rendering/neon-captions': neonCaptions,
    '@/lib/rendering/transcription-quality': transcriptionQuality,
    '@anthropic-ai/sdk': class { constructor() {} },
    fetch: async (url) => { providerCalls.push(url); return Response.json(fetchResult); },
  };
  mocks["@/lib/rendering/status"] = load("src/lib/rendering/status.ts", { "./remotion": mocks["@/lib/rendering/remotion"], fetch: mocks.fetch });
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

function submission({ reservation='reserved', transcriptionFails=false, trackingFails=false, submissionFails=false, rendererConfigured=true, captionStyle='bold-overlay', backgroundType='dark-solid', plan='free', duration=10, words=[{word:'hello',start:0,end:1}], clips=[], analysis={mood:'dark',energy:'low'} }={}) {
  const state=setup(); const rpc=[]; const renders=[];
  const db={
    async rpc(name,args){rpc.push({name,args});return {data:name==='reserve_video_credits'?{status:reservation,credits:400}:{status:'error'},error:null}},
    from(table){let update;
      const data=table==='videos'?{id:videoId,status:'pending'}:table==='profiles'?{plan,credits:500}:{active:true,plan_required:'free',background_type:backgroundType};
      const q={select(){return q},eq(){return q},limit(){return q},update(value){update=value;return q},maybeSingle:async()=>({data,error:null}),single:async()=>({data,error:null}),
        then(resolve){return Promise.resolve({data: table==='clips'?clips:data,error:trackingFails&&update?.render_id?new Error('tracking unavailable'):null}).then(resolve)}};return q;
    },
  };
  state.mocks['@supabase/supabase-js']={createClient:()=>db};
  state.mocks['@anthropic-ai/sdk']=class{constructor(){this.messages={create:async()=>({content:[{type:'text',text:JSON.stringify(analysis)}]})}}};
  state.mocks['@/lib/rendering/remotion']={assertDarkLyricsConfigured:()=>{if(!rendererConfigured)throw Error('Missing render configuration')},startDarkLyricsRender:async(props)=>{renders.push(props);if(submissionFails)throw Error('submission response lost');return {id:'job',bucketName:'bucket',functionName:'function',region:'us-east-1'}}};
  state.mocks.fetch=async(url,options)=>{
    if(String(url).includes('creatomate.com')){renders.push(JSON.parse(options.body).source);return Response.json([{id:'job'}])}
    if(transcriptionFails) return new Response('failure',{status:500});
    if(String(url).includes('transcriptions'))return Response.json({text:'lyrics',duration,words});
    return new Response('audio',{headers:{'content-type':'audio/mpeg'}});
  };
  const body={videoId,templateId:'13c51a59-7ad1-4669-a519-aa694f1b047f',title:'Song',artist:'Artist',captionStyle,fileUrl:`${origin}/storage/v1/object/public/uploads/${userId}/song.mp3`};
  return {rpc,renders,run:()=>load('src/app/api/process/route.ts',state.mocks).POST(request(body))};
}

for(const captionStyle of ['clean-neon','pixel-neon']) {
  test(`${captionStyle}: clip and color payloads retain exact audio duration, including empty lyrics`,async()=>{
    for(const backgroundType of ['color-block','neon']) for(const words of [[],[{word:'ending',start:9.95,end:11.5}]]){
      const s=submission({captionStyle,backgroundType,duration:10.01,words,clips:[{url:'https://footage.test/clip.mp4'}]});
      assert.equal((await s.run()).status,200);
      const source=s.renders[0];assert.equal(source.duration,10.01);
      const backgrounds=source.elements.filter(e=>e.name.startsWith('bg-')||e.name.startsWith('clip-'));
      assert.ok(backgrounds.length>0);
      for(const element of backgrounds){
        assert.ok(element.duration>0);
        assert.ok(element.time+element.duration<=10.01+1e-9);
      }
      const last=backgrounds[backgrounds.length-1];
      assert.ok(Math.abs(last.time+last.duration-10.01)<1e-9);
      assert.equal(source.elements.find(e=>e.name==='audio').duration,10.01);
    }
  });
  test(`${captionStyle}: standard and premium output scale captions consistently`,async()=>{
    let standard;
    for(const plan of ['free','business','studio']){
      const s=submission({captionStyle,backgroundType:'color-block',plan});
      assert.equal((await s.run()).status,200);
      const source=s.renders[0];const premium=plan!=='free';
      assert.equal(source.width,premium?2160:1080);assert.equal(source.height,premium?3840:1920);
      assert.equal(s.rpc[0].args.p_cost,premium?350:200);
      const captions=source.elements.filter(e=>e.name.startsWith('neon'));
      const serialized=JSON.stringify(captions);
      if(standard) assert.equal(serialized,standard);else standard=serialized;
      for(const element of captions){
        assert.match(element.font_size,/ vmin$/);
        assert.match(element.width,/%$/);assert.match(element.x,/%$/);assert.match(element.y,/%$/);
        assert.equal(element.font_family,source.fonts[0].family);
        assert.equal(element.font_weight,source.fonts[0].weight);
      }
      assert.equal(source.elements.filter(e=>e.name==='watermark').length,premium?0:1);
    }
  });
}

test('fractional cuts never round a beat beyond the audio endpoint',async()=>{
  for(const backgroundType of ['color-block','neon','dark-solid']){
    const s=submission({captionStyle:'clean-neon',backgroundType,duration:0.677,words:[],
      analysis:{mood:'dark',cutInterval:0.675},clips:[{url:'https://footage.test/clip.mp4'}]});
    assert.equal((await s.run()).status,200);
    if(backgroundType==='dark-solid'){
      assert.ok(s.renders[0].beats.every(beat=>beat>=0&&beat<0.677));
    } else {
      for(const element of s.renders[0].elements.filter(e=>e.name.startsWith('bg-')||e.name.startsWith('clip-'))){
        assert.ok(element.duration>0);assert.ok(element.time<0.677);
      }
    }
  }
});
test('reservation rejection stops submission before renderer work',async()=>{
  const s=submission({reservation:'already_submitted'});assert.equal((await s.run()).status,409);assert.equal(s.renders.length,0);assert.equal(s.rpc.length,1);
});
test('missing renderer configuration stops before charging credits or submitting a job',async()=>{
  for(const captionStyle of ['clean-neon','pixel-neon']){
    const s=submission({captionStyle,rendererConfigured:false});const response=await s.run();
    assert.equal(response.status,503);const body=await response.json();
    assert.equal(body.code,'RENDERER_NOT_CONFIGURED');assert.match(body.error,/not been charged/);
    assert.equal(s.rpc.length,0);assert.equal(s.renders.length,0);
  }
  const other=submission({backgroundType:'color-block',rendererConfigured:false});
  assert.equal((await other.run()).status,200);
});
test('pre-render processing failure uses the atomic refund transaction',async()=>{
  const s=submission({transcriptionFails:true});assert.equal((await s.run()).status,500);assert.equal(s.rpc[1].name,'settle_video_credits');assert.equal(s.rpc[1].args.p_render_id,null);assert.equal(s.renders.length,0);
});
test('symbol-only transcripts stop before rendering and return the reserved credits',async()=>{
  const s=submission({captionStyle:'clean-neon',words:[{word:'♪♪',start:0,end:1}]});
  const response=await s.run();assert.equal(response.status,422);
  const body=await response.json();assert.equal(body.code,'TRANSCRIPTION_UNUSABLE');assert.equal(body.creditsRefunded,true);
  assert.equal(s.renders.length,0);assert.equal(s.rpc.length,2);assert.equal(s.rpc[1].name,'settle_video_credits');
});
test('successful submission uses reservation balance without a second debit',async()=>{
  const s=submission();const r=await s.run();assert.equal(r.status,200);assert.equal((await r.json()).creditsRemaining,400);assert.equal(s.rpc.length,1);assert.equal(s.renders.length,1);
});
test('tracking failure after a job starts preserves charge for reconciliation',async()=>{
  const s=submission({trackingFails:true});assert.equal((await s.run()).status,500);assert.equal(s.renders.length,1);assert.equal(s.rpc.length,1);
});

test('lost submission response is not treated as proof of render failure',async()=>{
  const s=submission({submissionFails:true});assert.equal((await s.run()).status,500);assert.equal(s.renders.length,1);assert.equal(s.rpc.length,1);
});

for (const captionStyle of ['clean-neon', 'pixel-neon']) {
  test(`${captionStyle} is accepted and forwarded to the billed Remotion render`, async () => {
    const s=submission({captionStyle});assert.equal((await s.run()).status,200);
    assert.equal(s.renders[0].captionStyle,captionStyle);assert.equal(s.rpc[0].args.p_cost,200);
  });
  test(`${captionStyle} builds an explicit-font Creatomate payload with cyan word sync`, async () => {
    const s=submission({captionStyle,backgroundType:'color-block'});assert.equal((await s.run()).status,200);
    const source=s.renders[0];assert.equal(source.fonts[0].family,captionStyle==='pixel-neon'?'Press Start 2P':'Montserrat');
    assert.match(source.fonts[0].source,/\.woff$/);
    const text=source.elements.filter(e=>e.name?.startsWith('neon'));
    assert.equal(text.length,2);assert.equal(text[1].fill_color,'#63edff');
    assert.equal(text[1].time,0);assert.equal(text[1].duration,1);
    assert.equal(text[0].text,captionStyle==='pixel-neon'?'HELLO':'hello');
  });
}
