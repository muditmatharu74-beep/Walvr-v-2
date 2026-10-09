// Explicit administrator diagnostic, never part of npm run build or a public API.
// Run only for an authorized owner's failed upload, with a fixed retry UUID.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function validate(env, args) {
  if (env.VERCEL_ENV !== 'preview' || env.VERCEL_GIT_COMMIT_REF !== 'feature/neon-captions' ||
      env.VERCEL_PROJECT_ID !== 'prj_kY2qEWWysNEfqRKzI7irzqRYs7eg') throw Error('Preview diagnostic scope mismatch');
  const [owner, sourceId, retryId, filename] = args;
  const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
  if (args.length !== 4 || ![owner, sourceId, retryId].every(v => uuid.test(v || '')) ||
      sourceId === retryId || !/^\d+\.mp3$/.test(filename || '')) throw Error('Invalid retry identifiers');
  return {owner, sourceId, retryId, filename};
}

async function run(env, args) {
  const {owner, sourceId, retryId, filename} = validate(env, args);
  const {createClient} = require('@supabase/supabase-js');
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const check = result => { if (result.error) throw Error(result.error.message); return result.data; };
  const source = check(await db.from('videos').select('*').eq('id', sourceId).eq('user_id', owner).single());
  if (source.status !== 'error' || source.render_id || source.clip_style !== 'dark-solid') throw Error('Source is not a confirmed failed Dark Lyrics upload');
  if (!['clean-neon', 'pixel-neon'].includes(source.cap_style)) throw Error('Unsupported retry caption style');
  const uploadedAt = Number(filename.split('.')[0]);
  if (Math.abs(Date.parse(source.created_at) - uploadedAt) > 5000) throw Error('Upload does not match the failed attempt');
  const objects = check(await db.storage.from('uploads').list(owner, {search: filename}));
  if (!objects.some(object => object.name === filename)) throw Error('Owned upload not found');
  const fileUrl = db.storage.from('uploads').getPublicUrl(`${owner}/${filename}`).data.publicUrl;
  let video = check(await db.from('videos').select('*').eq('id', retryId).eq('user_id', owner).maybeSingle());
  if (!video) video = check(await db.from('videos').insert({id: retryId, user_id: owner,
    title: source.title, artist: source.artist, cap_style: source.cap_style, clip_style: source.clip_style,
    template: source.template, status: 'pending'}).select().single());
  if (video.template !== source.template || video.cap_style !== source.cap_style) throw Error('Retry metadata mismatch');

  const cache = new Map();
  function load(file) {
    file = path.resolve(__dirname, '..', file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = {exports: {}}; cache.set(file, mod);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    }}).outputText;
    const scopedRequire = id => {
      // Administrator-authorized operation: inject this verified owner only in
      // the offline diagnostic. Normal API authentication is unchanged.
      if (id === '@/lib/supabase/server') return {createClient: async () => ({auth: {
        getUser: async () => ({data: {user: {id: owner}}, error: null}),
      }})};
      if (id === 'next/server') return {NextResponse: {json: (data, init) => Response.json(data, init)}};
      if (id.startsWith('@/')) return load('src/' + id.slice(2) + '.ts');
      if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'));
      return require(id);
    };
    vm.runInNewContext(code, {module: mod, exports: mod.exports, require: scopedRequire,
      process, URL, Response, Request, Blob, FormData, Uint8Array, AbortSignal, fetch, crypto,
      console: {info: (label) => console.log(label), error: (label, error) => console.error(label,
        Array.isArray(error) ? JSON.stringify(error.map(e => typeof e === 'string' ? e : e?.message || e?.name || 'provider error')) : error?.message || 'diagnostic error')},
    }, {filename: file});
    return mod.exports;
  }
  if (video.status === 'pending') {
    const response = await load('src/app/api/process/route.ts').POST(new Request('https://preview.invalid/api/process', {
      method: 'POST', body: JSON.stringify({videoId: retryId, templateId: source.template,
        fileUrl, title: source.title, artist: source.artist || '', captionStyle: source.cap_style}),
    }));
    const result = await response.json();
    if (!response.ok) throw Error(`Retry submission HTTP ${response.status}: ${result.error}`);
  }
  const {readRenderStatus} = load('src/lib/rendering/status.ts');
  for (let attempt = 0; attempt < 120; attempt++) {
    video = check(await db.from('videos').select('*').eq('id', retryId).eq('user_id', owner).single());
    if (video.status === 'done') { console.log(JSON.stringify({videoId: retryId, status: 'done'})); return; }
    if (video.status === 'error') {
      if (video.render_id) await readRenderStatus(video);
      throw Error('Retry render failed; credits settled by the standard transaction');
    }
    if (video.status !== 'rendering' || !video.render_id) throw Error('Retry needs reconciliation; no resubmission performed');
    let progress;
    try { progress = await readRenderStatus(video); }
    catch { console.log('Temporary provider polling error; preserving the active job'); }
    if (progress && progress.status !== 'rendering') {
      check(await db.rpc('settle_video_credits', {p_user_id: owner, p_video_id: retryId,
        p_status: progress.status, p_render_id: video.render_id, p_url: progress.url}));
    }
    if (attempt % 6 === 0) console.log(JSON.stringify({videoId: retryId, status: progress?.status || 'retrying-status'}));
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw Error('Render remains active; check the saved job rather than submit again');
}
module.exports = {validate, run};
if (require.main === module) run(process.env, process.argv.slice(2)).catch(error => {
  console.error(error.message); process.exitCode = 1;
});
