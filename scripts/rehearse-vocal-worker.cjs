// Local end-to-end rehearsal using saved private analysis. No provider/AWS/API calls.
// Requires @electric-sql/pglite on NODE_PATH, Python 3.12 and ffprobe.
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const http=require('node:http');
const crypto=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');

function load(file,mocks){
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,
  {module:mod,exports:mod.exports,process,Buffer,URL,Request,Response,AbortSignal,Blob,FormData,Uint8Array,
   console:{info(){},error(){}},fetch:mocks.fetch,require(id){
    if(Object.hasOwn(mocks,id))return mocks[id];
    if(id.startsWith('@/'))return load('src/'+id.slice(2)+'.ts',mocks);
    if(id.startsWith('.'))return load(path.join(path.dirname(file),id+'.ts'),mocks);
    return require(id);
   }});
 return mod.exports;
}
async function main(){
 const [audioArg,analysisArg]=process.argv.slice(2);
 if(!audioArg||!analysisArg)throw Error('Use: node scripts/rehearse-vocal-worker.cjs original-audio saved-analysis');
 const audio=path.resolve(audioArg),analysisFile=path.resolve(analysisArg);
 const source=fs.readFileSync(audio),analysis=JSON.parse(fs.readFileSync(analysisFile,'utf8'));
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),analysis.sourceSha256,'Source does not match analysis');
 const duration=Number(JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',audio],{encoding:'utf8'})).format.duration);
 // These are disposable identities/configuration only, never account credentials.
 const user='11111111-1111-4111-8111-111111111111',video='22222222-2222-4222-8222-222222222222';
 const origin='https://storage.example.test',url=`${origin}/storage/v1/object/public/uploads/${user}/song.mp3`;
 Object.assign(process.env,{VERCEL_ENV:'preview',WALVR_VOCAL_TIMING_ENABLED:'true',
  WALVR_VOCAL_WORKER_SECRET:crypto.randomBytes(32).toString('hex'),NEXT_PUBLIC_SUPABASE_URL:origin});
 const db=new PGlite(); let server;
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema public,auth to anon,authenticated,service_role;`);
  await db.exec(fs.readFileSync(path.join(root,'supabase/schema.sql'),'utf8'));
  await db.exec('alter table profiles add column credits integer default 0;alter table profiles add column credits_reset_date timestamptz');
  for(const name of fs.readdirSync(path.join(root,'supabase/migrations')).sort())await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'));
  await db.query('insert into auth.users values($1,$2)',[user,'rehearsal@example.test']);
  await db.query("update profiles set plan='starter',credits=500 where id=$1",[user]);
  await db.query('insert into videos(id,user_id) values($1,$2)',[video,user]);
  await db.exec('set role service_role');
  const rpcArgs={enqueue_vocal_job:['p_user_id','p_video_id','p_url','p_sha256','p_caption_style','p_cost','p_plan'],
   claim_vocal_analysis:[],claim_vocal_render:[],heartbeat_vocal_analysis:['p_video_id','p_token'],
   finish_vocal_analysis:['p_video_id','p_token','p_result','p_duration','p_failure'],fail_vocal_analysis:['p_video_id','p_token','p_reason'],
   finish_vocal_render:['p_video_id','p_render_id','p_bucket','p_function','p_region'],stop_vocal_render:['p_video_id','p_uncertain']};
  const client={async rpc(name,args={}){
   assert.ok(Object.hasOwn(rpcArgs,name),'Unexpected RPC');
   const values=rpcArgs[name].map(k=>args[k]);
   try{return {data:(await db.query(`select ${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) result`,values)).rows[0].result,error:null}}
   catch(error){return {data:null,error}}
  },from(table){
   assert.ok(['videos','profiles','templates','vocal_jobs'].includes(table));
   const where=[];const values=[];
   const q={select(){return q},eq(k,v){assert.match(k,/^[a-z_]+$/);where.push(`${k}=$${values.push(v)}`);return q},
    async maybeSingle(){return q.single()},async single(){
     if(table==='templates')return {data:{active:true,background_type:'dark-solid',plan_required:'free'},error:null};
     const result=await db.query(`select * from ${table}${where.length?' where '+where.join(' and '):''}`,values);
     return {data:result.rows[0]??null,error:null};
    }};return q;
  }};
  const renders=[];
  const mocks={fetch:async requested=>{assert.equal(String(requested),url);return new Response(source)},
   '@supabase/supabase-js':{createClient:()=>client},
   '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:user}},error:null})}})},
   'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
   '@anthropic-ai/sdk':class{},
   '@/lib/rendering/remotion':{assertDarkLyricsConfigured(){},async startDarkLyricsRender(props){renders.push(props);return {id:'rehearsal-render',bucketName:'bucket',functionName:'function',region:'region'}}},
  };
  mocks['./remotion']=mocks['@/lib/rendering/remotion'];
  const route=load('src/app/api/internal/vocal-jobs/route.ts',mocks);
  const created=await load('src/app/api/process/route.ts',mocks).POST(new Request('https://app.example.test/api/process',{
   method:'POST',body:JSON.stringify({videoId:video,templateId:'33333333-3333-4333-8333-333333333333',title:'Rehearsal',artist:'',captionStyle:'clean-neon',fileUrl:url})}));
  assert.equal(created.status,202);
  await load('src/lib/rendering/submission-response.ts',mocks).confirmSubmission(created);
  assert.equal(renders.length,0,'Create must not render before vocal analysis');
  server=http.createServer(async(req,res)=>{
   try{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const response=await route.POST(new Request('https://app.example.test/api/internal/vocal-jobs',{method:'POST',headers:req.headers,body:Buffer.concat(chunks)}));
    res.writeHead(response.status,{'Content-Type':'application/json'});res.end(await response.text());
   }catch{res.writeHead(500);res.end('{}')}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const endpoint=`http://127.0.0.1:${server.address().port}/api/internal/vocal-jobs`;
  // Test transport is loopback only. Reuse reviewed ML output to test orchestration;
  // speech-model accuracy is evaluated separately by pipeline.py + human review.
  const python=`import sys,json,shutil,urllib.request\nsys.path.insert(0,sys.argv[1])\nfrom worker import Client,NoRedirect,run_once\nc=object.__new__(Client)\nc.endpoint=sys.argv[2]\nc.headers={'Authorization':'Bearer '+sys.argv[3],'Content-Type':'application/json'}\nc.opener=urllib.request.build_opener(NoRedirect())\nc.download=lambda job,target:shutil.copyfile(sys.argv[4],target)\ndef saved(audio,result,log):\n return json.load(open(sys.argv[5])),float(sys.argv[6])\nrun_once(c,saved)\n`;
  const child=spawn(process.env.WALVR_PYTHON??'python',['-c',python,path.join(root,'experiments/vocal-timing'),endpoint,process.env.WALVR_VOCAL_WORKER_SECRET,audio,analysisFile,String(duration)],{stdio:['ignore','pipe','pipe']});
  let error='';child.stderr.on('data',chunk=>{error+=chunk});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)});
  assert.equal(code,0,'Python worker failed (private log suppressed)');
  await route.POST(new Request('https://app.example.test/api/internal/vocal-jobs',{method:'POST',headers:{authorization:'Bearer '+process.env.WALVR_VOCAL_WORKER_SECRET},body:JSON.stringify({action:'claim'})}));
  const row=(await db.query('select status,render_id from videos where id=$1',[video])).rows[0];
  const credits=(await db.query('select credits from profiles where id=$1',[user])).rows[0].credits;
  if(analysis.words.length && !analysis.reviewRequired){
   assert.equal(row.status,'rendering');assert.equal(credits,300);assert.equal(renders.length,1);
   assert.equal(renders[0].audioUrl,url);assert.equal(renders[0].captions.length,analysis.words.length);
   assert.equal(renders[0].songDuration,duration);
  }else{assert.equal(row.status,'error');assert.equal(credits,500);assert.equal(renders.length,0)}
  console.log(JSON.stringify({rehearsed:true,status:row.status,words:analysis.words.length,renderSubmissions:renders.length,credits,provider:'mock',analysis:'saved'}));
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  await db.close();
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
