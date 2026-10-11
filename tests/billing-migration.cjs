// Requires @electric-sql/pglite on NODE_PATH. Runs locally, with no paid services.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));
  await db.exec(`alter table profiles add column credits integer default 0;
    alter table profiles add column credits_reset_date timestamptz;`);
  for (const file of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync(`supabase/migrations/${file}`,'utf8'));
  const user = '11111111-1111-4111-8111-111111111111';
  const videos = [1,2,3,4].map(n => `22222222-2222-4222-8222-22222222222${n}`);
  await db.query('insert into auth.users values ($1,$2)',[user,'test@example.test']);
  await db.query('update profiles set credits=150 where id=$1',[user]);
  for(const id of videos) await db.query('insert into videos(id,user_id) values($1,$2)',[id,user]);
  const reserve = (id,cost=100) => db.query('select reserve_video_credits($1,$2,$3,$4) result',[user,id,cost,'free']).then(r=>r.rows[0].result);
  const settle = (id,status='error',render=null,url=null) => db.query('select settle_video_credits($1,$2,$3,$4,$5) result',[user,id,status,render,url]).then(r=>r.rows[0].result);
  const balance = () => db.query('select credits from profiles where id=$1',[user]).then(r=>r.rows[0].credits);
  await db.exec('set role service_role');
  assert.equal((await reserve(videos[0])).status,'reserved');
  assert.equal((await reserve(videos[0])).status,'already_submitted');
  assert.equal((await reserve(videos[1])).status,'insufficient');
  assert.equal(await balance(),50);
  await settle(videos[0]); await settle(videos[0]);
  assert.equal(await balance(),150);
  await reserve(videos[1]);
  await db.query("update videos set status='rendering',render_id='job' where id=$1",[videos[1]]);
  await assert.rejects(()=>settle(videos[1],'error','wrong'),/Stale/);
  await settle(videos[1],'done','job','https://output.test/video.mp4');
  assert.equal((await settle(videos[1],'error','job')).status,'done');
  assert.equal(await balance(),50);
  // Legacy videos without a charge record can fail, but cannot mint refunds.
  await db.query("update videos set status='processing' where id=$1",[videos[2]]);
  await settle(videos[2]); assert.equal(await balance(),50);
  const apply = (event,key,action='topup',amount=500,period=0,customer='cus_test') => db.query(
    'select apply_stripe_credit_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result',
    [event,key,user,customer,action,amount,'starter','sub_test',100,period]).then(r=>r.rows[0].result);
  assert.equal(await apply('evt_1','checkout:1'),'applied');
  assert.equal(await apply('evt_1','checkout:1'),'duplicate_event');
  assert.equal(await apply('evt_2','checkout:1'),'duplicate_operation');
  assert.equal(await balance(),550);
  await assert.rejects(()=>apply('evt_bad','checkout:bad','topup',-1),/Invalid credit grant/);
  assert.equal((await db.query("select * from stripe_events where event_id='evt_bad'")).rows.length,0);
  assert.equal(await apply('evt_bad','checkout:bad'),'applied'); // Retry after rolled-back failure.
  await apply('evt_plan','plan:1','plan',0); assert.equal(await balance(),1050);
  await apply('evt_invoice','invoice:1','renew',1500,1000); assert.equal(await balance(),1500);
  await apply('evt_invoice_duplicate','invoice:1','renew',1500,1000);
  await apply('evt_old_invoice','invoice:old','renew',3000,900); assert.equal(await balance(),1500);
  // Running videos cannot be deleted, and clients cannot invoke money RPCs.
  await db.exec('reset role');
  await db.query("update videos set status='processing' where id=$1",[videos[3]]);
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${user}'`);
  await assert.rejects(()=>reserve(videos[3]),/permission denied/);
  await assert.rejects(()=>apply('forged','forged'),/permission denied/);
  await assert.rejects(()=>db.query('select * from credit_ledger'),/permission denied/);
  await db.query('delete from videos where id=$1',[videos[3]]);
  assert.equal((await db.query('select id from videos where id=$1',[videos[3]])).rows.length,1);
  await db.exec('reset role');
  // Durable vocal jobs: queue/credit atomicity, fenced retries and uncertain renders.
  await db.query('update profiles set credits=1000 where id=$1',[user]);
  const vocal=[5,6,7,8].map(n=>`22222222-2222-4222-8222-22222222222${n}`);
  for(const id of vocal) await db.query('insert into videos(id,user_id) values($1,$2)',[id,user]);
  await db.exec('set role service_role');
  const enqueue=(id,hash='a'.repeat(64))=>db.query('select enqueue_vocal_job($1,$2,$3,$4,$5,100,$6) result',
    [user,id,`https://storage.test/storage/v1/object/public/uploads/${user}/song.mp3`,hash,'clean-neon','starter']).then(r=>r.rows[0].result);
  await assert.rejects(()=>enqueue(vocal[0],'invalid'),/check constraint/);
  assert.equal(await balance(),1000);
  assert.equal((await db.query('select status from videos where id=$1',[vocal[0]])).rows[0].status,'pending');
  assert.equal((await enqueue(vocal[0])).status,'reserved');
  assert.equal((await enqueue(vocal[0])).status,'already_submitted');
  assert.equal(await balance(),900);
  const claim=()=>db.query('select claim_vocal_analysis() result').then(r=>r.rows[0].result);
  const first=await claim();
  assert.equal(await claim(),null);
  await db.query("update vocal_jobs set lease_until=now()-interval '1 second' where video_id=$1",[vocal[0]]);
  const again=await claim();
  assert.notEqual(again.token,first.token);
  const finish=(job,failure=null)=>db.query('select finish_vocal_analysis($1,$2,$3,10,$4) result',
    [job.videoId,job.token,{words:[{word:'test',start:1,end:2}]},failure]).then(r=>r.rows[0].result);
  assert.equal((await finish(first)).status,'stale');
  assert.equal((await finish(again)).status,'ready');
  assert.equal((await finish(again)).status,'stale');
  const renderClaim=()=>db.query('select claim_vocal_render() result').then(r=>r.rows[0].result);
  assert.equal((await renderClaim()).video_id,vocal[0]);
  assert.equal(await renderClaim(),null);
  await db.query('select stop_vocal_render($1,true)',[vocal[0]]);
  assert.equal(await balance(),900); // Uncertain submission neither resubmits nor refunds.
  assert.equal(await renderClaim(),null);
  await enqueue(vocal[1]);
  const unusable=await claim();
  assert.equal((await finish(unusable,'lyrics_unusable')).status,'failed');
  assert.equal((await finish(unusable,'lyrics_unusable')).status,'stale');
  assert.equal(await balance(),900); // Exactly one refund.
  await enqueue(vocal[2]);
  for(let attempt=0;attempt<3;attempt++){
    const job=await claim();
    await db.query('select fail_vocal_analysis($1,$2,$3)',[job.videoId,job.token,'analysis_failed']);
  }
  assert.equal(await claim(),null);
  assert.equal(await balance(),900);
  await enqueue(vocal[3]);
  await finish(await claim());
  await renderClaim();
  await db.query('select finish_vocal_render($1,$2,$3,$4,$5)',[vocal[3],'vocal-render','bucket','function','region']);
  assert.equal((await db.query('select status,render_id from videos where id=$1',[vocal[3]])).rows[0].render_id,'vocal-render');
  assert.equal(await renderClaim(),null);
  await db.exec('reset role');
  const safety=await db.query("select relrowsecurity from pg_class where oid='public.vocal_jobs'::regclass");
  assert.equal(safety.rows[0].relrowsecurity,true);
  await db.exec('set role authenticated');
  await assert.rejects(()=>claim(),/permission denied/);
  await assert.rejects(()=>db.query('select * from vocal_jobs'),/permission denied/);
  await db.close();
  console.log('PASS billing and vocal-job SQL: atomic queue/charge, lease fencing, bounded retries, durable result, one-time refund, exclusive submission, uncertain submission, private RPC/table permissions. PGlite serializes queries; this is not a multi-connection concurrency test.');
})().catch(e=>{console.error(e);process.exitCode=1});
