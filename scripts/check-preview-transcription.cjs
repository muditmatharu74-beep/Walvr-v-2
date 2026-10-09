// Explicit preview diagnostic. Results stay in the owner's existing video row;
// neither audio nor transcripts are written to the repository or build logs.
const {validate} = require('./retry-preview-upload.cjs');
const {createClient} = require('@supabase/supabase-js');
async function run(env, args) {
  const [owner, sourceId, filename] = args;
  if (args.length !== 3) throw Error('Expected owner, source video and filename');
  validate(env, [owner, sourceId, sourceId === '00000000-0000-0000-0000-000000000001'
    ? '00000000-0000-0000-0000-000000000002' : '00000000-0000-0000-0000-000000000001', filename]);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const check = r => {if (r.error) throw Error(r.error.message); return r.data;};
  const source = check(await db.from('videos').select('id,created_at,analysis,status').eq('id',sourceId).eq('user_id',owner).single());
  if (source.status !== 'error' || Math.abs(Date.parse(source.created_at)-Number(filename.split('.')[0]))>5000) throw Error('Source/upload mismatch');
  const objects = check(await db.storage.from('uploads').list(owner,{search:filename}));
  if (!objects.some(o=>o.name===filename)) throw Error('Owned audio not found');
  const audioUrl = db.storage.from('uploads').getPublicUrl(`${owner}/${filename}`).data.publicUrl;
  const response = await fetch(audioUrl,{redirect:'error',signal:AbortSignal.timeout(30000)});
  if (!response.ok || Number(response.headers.get('content-length'))>25*1024*1024) throw Error('Audio download failed');
  const audio = await response.arrayBuffer();
  if (!audio.byteLength || audio.byteLength>25*1024*1024) throw Error('Audio size invalid');
  async function transcribe(model, language) {
    const form = new FormData();
    form.append('file',new Blob([audio],{type:'audio/mpeg'}),filename);
    form.append('model',model);
    form.append('response_format',model==='whisper-1'?'verbose_json':'json');
    if (language) form.append('language',language);
    if (model==='whisper-1') {form.append('timestamp_granularities[]','word');form.append('temperature','0');}
    const result = await fetch('https://api.openai.com/v1/audio/transcriptions',{
      method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:form,signal:AbortSignal.timeout(180000),
    });
    if (!result.ok) throw Error(`${model} transcription HTTP ${result.status}`);
    return result.json();
  }
  const results = await Promise.allSettled([transcribe('whisper-1','en'),transcribe('gpt-4o-transcribe')]);
  const diagnostic={checked_at:new Date().toISOString()};
  ['whisper_english','gpt_transcript'].forEach((name,i)=>{
    const result=results[i];
    diagnostic[name]=result.status==='fulfilled'?result.value:{error:result.reason.message};
    console.log(JSON.stringify({check:name,ok:result.status==='fulfilled',words:result.value?.text?.trim().split(/\s+/).length || 0,
      language:result.value?.language || null}));
  });
  check(await db.from('videos').update({analysis:{...source.analysis,transcription_diagnostic:diagnostic}}).eq('id',sourceId).eq('user_id',owner));
}
module.exports={run};
if(require.main===module)run(process.env,process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
