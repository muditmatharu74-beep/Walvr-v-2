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
  await db.close();
  console.log('PASS billing SQL: repeat charges, overspend, refunds, stale results, legacy jobs, event/object dedup, rollback/retry, invoice ordering, RPC permissions, running-job deletion. PGlite serializes queries; this is not a multi-connection concurrency test.');
})().catch(e=>{console.error(e);process.exitCode=1});
