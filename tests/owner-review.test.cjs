const test=require('node:test');
const assert=require('node:assert/strict');
const {run,validate}=require('../scripts/render-owner-review.cjs');
const owner='11111111-1111-4111-8111-111111111111',sourceId='22222222-2222-4222-8222-222222222222',reviewId='33333333-3333-4333-8333-333333333333';
const filename='1791566227752.mp3',sha='a'.repeat(64),duration=10;
const args=[owner,sourceId,reviewId,filename,'pixel-neon',sha,String(duration)];
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/neon-captions',
 VERCEL_PROJECT_ID:'prj_kY2qEWWysNEfqRKzI7irzqRYs7eg',WALVR_NEON_BACKGROUND_STYLE:'pixel-ride'};
function setup(flags={}) {
 const source={id:sourceId,user_id:owner,status:'done',render_url:'https://output.test/old.mp4',
  created_at:new Date(Number(filename.split('.')[0])).toISOString(),clip_style:'dark-solid',
  cap_style:'pixel-neon',template:'template',title:'Original',artist:'Artist',
  captions:[{word:'hello',start:1,end:2}],...flags.source};
 let video=flags.video||null;
 const submissions=[],rpc=[],filters=[];
 const db={storage:{from:()=>({list:async()=>({data:[{name:filename}],error:null}),
   getPublicUrl:()=>({data:{publicUrl:'https://storage.test/original.mp3'}})})},
  from(table) {
   let id,insert,update;const query={
    select(){return query},eq(key,value){filters.push([table,key,value]);if(key==='id')id=value;return query},
    insert(value){insert=value;return query},update(value){update=value;return query},
    async single(){if(insert)video={...insert};return {data:table==='profiles'?{plan:'free',credits:1000}:id===sourceId?source:video,error:null}},
    async maybeSingle(){return {data:video,error:null}},
    then(resolve){if(update&&!flags.saveFails)video={...video,...update};
      return Promise.resolve({error:update&&flags.saveFails?Error('tracking failed'):null}).then(resolve)},
   };return query;
  },
  async rpc(name,input){rpc.push({name,input});if(name==='reserve_video_credits'){
    video.status='processing';return {data:{status:'reserved'},error:null};}
    if(name==='settle_video_credits'){video.status=input.p_status;video.render_url=input.p_url;}
    return {data:{status:input.p_status},error:null};
  }};
 const deps={db,hashSource:async()=>flags.badHash?'f'.repeat(64):sha,wait:async()=>{},
  render:{assertDarkLyricsConfigured(){},async startDarkLyricsRender(props){submissions.push(props);
    if(flags.lostResponse)throw Error('lost');return {id:'render',bucketName:'bucket',functionName:'fn',region:'us-east-1'}}},
  readStatus:async()=>({status:'done',url:'https://output.test/new.mp4'})};
 return {deps,submissions,rpc,filters,getVideo:()=>video};
}
test('saved-caption review refuses production, other branches, wrong files and unsupported identities',()=>{
 for(const override of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},
  {VERCEL_PROJECT_ID:'other'},{WALVR_NEON_BACKGROUND_STYLE:''}])assert.throws(()=>validate({...env,...override},args));
 for(const values of [args.slice(0,6),[...args.slice(0,5),'bad','10'],[...args.slice(0,6),'NaN']])assert.throws(()=>validate(env,values));
});
test('owner review preserves saved timings and audio, reserves once, tracks and settles the new render',async()=>{
 const s=setup();await run(env,args,s.deps);
 assert.equal(s.submissions.length,1);
 assert.equal(JSON.stringify(s.submissions[0].captions),'[{"word":"hello","start":1,"end":2}]');
 assert.equal(s.submissions[0].audioUrl,'https://storage.test/original.mp3');
 assert.equal(s.submissions[0].songDuration,10);
 assert.deepEqual(s.rpc.map(c=>c.name),['reserve_video_credits','settle_video_credits']);
 assert.equal(s.rpc[0].input.p_cost,200);
 assert.equal(s.getVideo().render_url,'https://output.test/new.mp4');
 assert.ok(s.filters.some(([table,key,value])=>table==='videos'&&key==='user_id'&&value===owner));
 await run(env,args,s.deps);
 assert.equal(s.submissions.length,1,'Repeating the fixed review must not submit or charge again');
 assert.equal(s.rpc.length,2);
});
test('changed audio and invalid saved timings stop before credits or provider submission',async()=>{
 for(const flags of [{badHash:true},{source:{captions:[]}},{source:{captions:[{word:'bad',start:9,end:11}]}},
  {source:{created_at:'invalid'}},{source:{status:'processing'}}]){
  const s=setup(flags);await assert.rejects(()=>run(env,args,s.deps));
  assert.equal(s.rpc.length,0);assert.equal(s.submissions.length,0);
 }
});
test('lost review submission and tracking writes never refund or submit twice',async()=>{
 for(const flags of [{lostResponse:true},{saveFails:true}]){
  const s=setup(flags);await assert.rejects(()=>run(env,args,s.deps),/uncertain/);
  assert.equal(s.submissions.length,1);assert.equal(s.rpc.length,1);
  await assert.rejects(()=>run(env,args,s.deps),/reconciliation/);
  assert.equal(s.submissions.length,1);assert.equal(s.rpc.length,1);
 }
});

test('saved zero-duration entries remain unchanged and are explicitly marked for listening review',async()=>{
 const captions=[{word:'hello',start:1,end:2},{word:'untimed',start:3,end:3}];
 const s=setup({source:{captions}});await run(env,args,s.deps);
 assert.deepEqual(s.submissions[0].captions,captions);
 assert.equal(s.getVideo().analysis.review_render.zero_duration_captions,1);
 assert.equal(s.getVideo().analysis.review_render.human_verified,false);
 assert.equal(s.getVideo().analysis.review_render.timing_review_required,true);
});
