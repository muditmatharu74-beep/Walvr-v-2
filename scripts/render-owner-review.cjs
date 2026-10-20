// Explicit owner-authorized preview render from saved captions.
// Never part of the normal build, a public API, or a production deployment.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const {validate:validateRetry}=require('./retry-preview-upload.cjs');

function validate(env,args) {
  if(args.length!==7) throw Error('Expected owner, source, fixed review ID, file, style, source hash and duration');
  const input=validateRetry(env,args.slice(0,5));
  const sha256=args[5],duration=Number(args[6]);
  if(!/^[a-f0-9]{64}$/.test(sha256)||!Number.isFinite(duration)||duration<=0||duration>600)
    throw Error('Invalid verified audio identity');
  if(env.WALVR_NEON_BACKGROUND_STYLE!=='pixel-ride') throw Error('Original pixel ride is not enabled');
  return {...input,sha256,duration};
}
function loader() {
  const cache=new Map();
  function load(file) {
    file=path.resolve(__dirname,'..',file);
    if(cache.has(file)) return cache.get(file).exports;
    const mod={exports:{}};cache.set(file,mod);
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{
      module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
    }}).outputText;
    vm.runInNewContext(code,{module:mod,exports:mod.exports,
      require:id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id+'.ts')):require(id),
      process,URL,Buffer,Response,Request,Blob,FormData,Uint8Array,AbortSignal,fetch,crypto,
      console:{info(){},error(){}}},{filename:file});
    return mod.exports;
  }
  return load;
}
async function run(env,args,deps={}) {
  const input=validate(env,args);
  const {owner,sourceId,retryId,filename,captionOverride:style,sha256,duration}=input;
  const db=deps.db||require('@supabase/supabase-js').createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
  const load=loader();
  const render=deps.render||load('src/lib/rendering/remotion.ts');
  const hashSource=deps.hashSource||load('src/lib/rendering/vocal-jobs.ts').originalUploadHash;
  const readStatus=deps.readStatus||load('src/lib/rendering/status.ts').readRenderStatus;
  const wait=deps.wait||(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
  const check=r=>{if(r.error)throw Error(r.error.message);return r.data;};
  render.assertDarkLyricsConfigured();
  const source=check(await db.from('videos').select('*').eq('id',sourceId).eq('user_id',owner).single());
  if(!Number.isFinite(Date.parse(source.created_at))||source.status!=='done'||!source.render_url||source.clip_style!=='dark-solid'||
    Math.abs(Date.parse(source.created_at)-Number(filename.split('.')[0]))>5000)
    throw Error('Saved video does not match the original upload');
  const words=source.captions;
  if(!Array.isArray(words)||!words.length||words.some(w=>!w||typeof w.word!=='string'||!w.word.trim()||
    !Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<0||w.end<w.start||w.end>duration))
    throw Error('Saved captions do not fit the verified original audio');
  if(!words.some(w=>w.end>w.start)) throw Error('Saved captions have no visible intervals');
  // Keep saved clocks unchanged. Existing layout skips zero-duration entries;
  // record them explicitly for this listening review rather than invent timing.
  const zeroDuration=words.filter(w=>w.end===w.start).length;
  load('src/lib/rendering/transcription-quality.ts').assertUsableTranscription({words},true);
  const objects=check(await db.storage.from('uploads').list(owner,{search:filename}));
  if(!objects.some(o=>o.name===filename)) throw Error('Owned audio not found');
  const audioUrl=db.storage.from('uploads').getPublicUrl(owner+'/'+filename).data.publicUrl;
  if(await hashSource(audioUrl,owner)!==sha256) throw Error('Original audio identity changed');
  let video=check(await db.from('videos').select('*').eq('id',retryId).eq('user_id',owner).maybeSingle());
  if(!video) {
    video=check(await db.from('videos').insert({id:retryId,user_id:owner,
      title:source.title,artist:source.artist,cap_style:style,clip_style:'dark-solid',template:source.template,
      status:'pending',captions:words,analysis:{review_render:{source_video_id:sourceId,
        source_sha256:sha256,duration,background:'pixel-ride',human_verified:false,
        timing_review_required:true,zero_duration_captions:zeroDuration}}}).select().single());
  }
  const identity=video.analysis?.review_render;
  if(video.cap_style!==style||video.template!==source.template||identity?.source_video_id!==sourceId||
    identity?.source_sha256!==sha256||identity?.duration!==duration||identity?.background!=='pixel-ride')
    throw Error('Existing review identity mismatch; no render submitted');
  if(video.status==='pending') {
    const profile=check(await db.from('profiles').select('plan,credits').eq('id',owner).single());
    const plan=profile.plan||'free';
    const cost=load('src/lib/rendering/neon-captions.ts').creditCost(plan,'dark-solid',style);
    const receipt=check(await db.rpc('reserve_video_credits',{p_user_id:owner,p_video_id:retryId,p_cost:cost,p_plan:plan}));
    if(receipt?.status!=='reserved') throw Error('Reservation not confirmed; no render submitted');
    // After this call starts, any lost response is uncertain. Never retry it.
    let result;
    try {
      result=await render.startDarkLyricsRender({captions:words,beats:[],songDuration:duration,audioUrl,captionStyle:style});
      check(await db.from('videos').update({render_id:result.id,status:'rendering',render_provider:'remotion',
        render_bucket:result.bucketName,render_function:result.functionName,render_region:result.region})
        .eq('id',retryId).eq('user_id',owner));
    } catch {
      throw Error('Render receipt uncertain; inspect the fixed review ID instead of resubmitting');
    }
  }
  for(let attempt=0;attempt<120;attempt++) {
    video=check(await db.from('videos').select('*').eq('id',retryId).eq('user_id',owner).single());
    if(video.status==='done'&&video.render_url) {console.log(JSON.stringify({videoId:retryId,status:'done'}));return;}
    if(video.status!=='rendering'||!video.render_id) throw Error('Review needs reconciliation; no resubmission performed');
    let progress;
    try {progress=await readStatus(video);} catch { /* Preserve active jobs on transient status failures. */ }
    if(progress&&['done','error'].includes(progress.status)) {
      check(await db.rpc('settle_video_credits',{p_user_id:owner,p_video_id:retryId,
        p_status:progress.status,p_render_id:video.render_id,p_url:progress.url}));
      if(progress.status==='error') throw Error('Review render failed; credits settled');
    }
    if(attempt%6===0)console.log(JSON.stringify({videoId:retryId,status:progress?.status||'retrying-status'}));
    await wait(5000);
  }
  throw Error('Review remains active; inspect its fixed ID rather than submitting again');
}
module.exports={validate,run};
if(require.main===module)run(process.env,process.argv.slice(2)).catch(error=>{
  console.error(error.message);process.exitCode=1;
});
