// Destructive setup is allowed ONLY in an empty, local disposable walvr_test database.
const {Pool}=require('pg');
const fs=require('node:fs');
const assert=require('node:assert/strict');

async function checkMultipleAccounts(pool){
 const owners=['33333333-3333-4333-8333-333333333331','33333333-3333-4333-8333-333333333332'];
 const videos=['44444444-4444-4444-8444-444444444441','44444444-4444-4444-8444-444444444442'];
 const sources=owners.map(owner=>`https://storage.example.test/storage/v1/object/public/uploads/${owner}/song.mp3`);
 const hashes=['1'.repeat(64),'2'.repeat(64)];
 for(let i=0;i<owners.length;i++){
  await pool.query('insert into auth.users values($1,$2)',[owners[i],`queue-${i}@example.test`]);
  await pool.query('update profiles set credits=$2 where id=$1',[owners[i],i===0?300:700]);
  await pool.query('insert into videos(id,user_id) values($1,$2)',[videos[i],owners[i]]);
 }
 const balances=async()=> (await pool.query('select id,credits from profiles where id=any($1::uuid[]) order by id',[owners])).rows.map(row=>row.credits);
 const otherBefore=(await pool.query('select id,credits from profiles where id<>all($1::uuid[]) order by id',[owners])).rows;
 const a=await pool.connect(),b=await pool.connect();
 try{
  await a.query('set role service_role');
  await b.query('set role service_role');
  await b.query("set lock_timeout='2s'; set statement_timeout='5s'");
  const enqueue='select enqueue_vocal_job($1,$2,$3,$4,\'pixel-neon\',200,\'free\') result';
  // Keep account A's reservation uncommitted. Account B must still be able to
  // reserve and enqueue without waiting for A's profile/video locks.
  await a.query('begin');
  assert.equal((await a.query(enqueue,[owners[0],videos[0],sources[0],hashes[0]])).rows[0].result.status,'reserved');
  assert.equal((await b.query(enqueue,[owners[1],videos[1],sources[1],hashes[1]])).rows[0].result.status,'reserved');
  await a.query('commit');
  assert.deepEqual(await balances(),[100,500]);
  for(let i=0;i<owners.length;i++){
   assert.equal((await b.query(enqueue,[owners[i],videos[i],sources[i],hashes[i]])).rows[0].result.status,'already_submitted');
  }
  assert.deepEqual(await balances(),[100,500],'Duplicate Create charged an account again');

  // Two workers must receive different jobs while one claim transaction is open.
  await a.query('begin');
  const first=(await a.query('select claim_vocal_analysis() result')).rows[0].result;
  const second=(await b.query('select claim_vocal_analysis() result')).rows[0].result;
  assert.ok(first&&second,'Both customer jobs must be claimable');
  assert.deepEqual(new Set([first.videoId,second.videoId]),new Set(videos));
  const leases=new Map([first,second].map(job=>[job.videoId,job]));
  for(let i=0;i<owners.length;i++){
   const job=leases.get(videos[i]);
   assert.equal(job.userId,owners[i]);
   assert.equal(job.sourceUrl,sources[i]);
   assert.equal(job.sourceSha256,hashes[i]);
  }
  await a.query('commit');
  assert.equal((await b.query('select claim_vocal_analysis() result')).rows[0].result,null);
  const complete='select finish_vocal_analysis($1,$2,$3,10,null) result';
  const words=[{word:'sample',start:1,end:2}];
  const rejected=(await b.query(complete,[videos[0],leases.get(videos[1]).token,{words}])).rows[0].result;
  assert.equal(rejected.status,'stale','A lease for B must not complete A');
  assert.equal((await b.query('select heartbeat_vocal_analysis($1,$2) result',[videos[0],leases.get(videos[1]).token])).rows[0].result.status,'stale');
  assert.equal((await b.query('select result from vocal_jobs where video_id=$1',[videos[0]])).rows[0].result,null);

  // A fails/refunds; B succeeds. Neither outcome may change the other balance.
  const fail='select fail_vocal_analysis($1,$2,\'input_invalid\') result';
  assert.equal((await b.query(fail,[videos[0],leases.get(videos[0]).token])).rows[0].result.status,'failed');
  assert.equal((await b.query(fail,[videos[0],leases.get(videos[0]).token])).rows[0].result.status,'stale');
  assert.deepEqual(await balances(),[300,500]);
  assert.equal((await b.query(complete,[videos[1],leases.get(videos[1]).token,{words}])).rows[0].result.status,'ready');
  assert.equal((await b.query('select claim_vocal_render() result')).rows[0].result.video_id,videos[1]);
  assert.equal((await a.query('select claim_vocal_render() result')).rows[0].result,null);
  await b.query('select finish_vocal_render($1,$2,$3,$4,$5)',[videos[1],'two-account-render','mock-bucket','mock-function','mock-region']);
  const settle='select settle_video_credits($1,$2,$3,$4,$5) result';
  await assert.rejects(()=>b.query(settle,[owners[0],videos[1],'error','two-account-render',null]),/Video not found/);
  for(let i=0;i<2;i++){
   assert.equal((await b.query(settle,[owners[1],videos[1],'done','two-account-render','https://output.example.test/customer-b.mp4'])).rows[0].result.status,'done');
  }
  assert.deepEqual(await balances(),[300,500]);
  assert.deepEqual((await pool.query('select id,credits from profiles where id<>all($1::uuid[]) order by id',[owners])).rows,otherBefore);
  const ledger=(await pool.query('select user_id,kind,count(*)::integer as count,sum(amount)::integer as amount from credit_ledger where user_id=any($1::uuid[]) group by user_id,kind order by user_id,kind',[owners])).rows;
  assert.deepEqual(ledger,[
   {user_id:owners[0],kind:'render_charge',count:1,amount:-200},
   {user_id:owners[0],kind:'render_refund',count:1,amount:200},
   {user_id:owners[1],kind:'render_charge',count:1,amount:-200},
  ]);
  assert.equal((await pool.query('select count from usage where user_id=$1',[owners[1]])).rows[0].count,1);
  assert.equal((await pool.query('select count from usage where user_id=$1',[owners[0]])).rows.length,0);

  // Browser-facing database reads must not reveal the other customer's row,
  // captions or download URL. Object-storage access is a separate hosted test.
  await a.query('set role authenticated');
  for(let i=0;i<owners.length;i++){
   await a.query("select set_config('request.jwt.claim.sub',$1,false)",[owners[i]]);
   const visible=(await a.query('select id,user_id,status,captions,render_url from videos')).rows;
   assert.equal(visible.length,1);
   assert.equal(visible[0].id,videos[i]);
   assert.equal(visible[0].user_id,owners[i]);
   assert.equal(visible[0].status,i===0?'error':'done');
   const visibleProfiles=(await a.query('select id,credits from profiles')).rows;
   assert.deepEqual(visibleProfiles,[{id:owners[i],credits:i===0?300:500}]);
   assert.equal((await a.query('select id from videos where id=$1',[videos[1-i]])).rows.length,0);
   await assert.rejects(()=>a.query('select * from vocal_jobs'),/permission denied/);
   await assert.rejects(()=>a.query('select * from credit_ledger'),/permission denied/);
   await assert.rejects(()=>a.query('update profiles set credits=999999'),/permission denied/);
   if(i===1){assert.deepEqual(visible[0].captions,words);assert.equal(visible[0].render_url,'https://output.example.test/customer-b.mp4')}
   else{assert.equal(visible[0].captions,null);assert.equal(visible[0].render_url,null)}
  }
  console.log('PASS two-account queue: independent reservations; two exclusive worker leases; crossed leases rejected; isolated results, charges and one-time refunds; owner-only database reads. Renderer and media are synthetic.');
 }finally{
  try{await a.query('rollback')}
  finally{a.release(true);b.release(true)} // Never return a browser-role session to the pool.
 }
}

(async()=>{
 const url=new URL(process.env.WALVR_TEST_DATABASE_URL??'');
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/walvr_test','Use a local disposable walvr_test database only');
 const pool=new Pool({connectionString:url.href,max:4});
 try{
  assert.equal((await pool.query("select to_regclass('public.profiles') as existing")).rows[0].existing,null,'Refusing to modify a populated database');
  await pool.query(`create role anon; create role authenticated; create role service_role bypassrls;
   create schema auth; create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema public,auth to anon,authenticated,service_role;`);
  await pool.query(fs.readFileSync('supabase/schema.sql','utf8'));
  await pool.query('alter table profiles add column credits integer default 0; alter table profiles add column credits_reset_date timestamptz');
  for(const file of fs.readdirSync('supabase/migrations').sort())await pool.query(fs.readFileSync(`supabase/migrations/${file}`,'utf8'));
  const user='11111111-1111-4111-8111-111111111111';
  const videos=[1,2,3].map(n=>`22222222-2222-4222-8222-22222222222${n}`);
  await pool.query('insert into auth.users values($1,$2)',[user,'concurrency@example.test']);
  for(const id of videos)await pool.query('insert into videos(id,user_id) values($1,$2)',[id,user]);
  await pool.query('update profiles set credits=150 where id=$1',[user]);
  // Keep the first transaction open so the second connection MUST contend on its row lock.
  async function overlap(sqlA,argsA,sqlB,argsB){
   const a=await pool.connect(),b=await pool.connect();
   try{
    await a.query('begin');await a.query('set local role service_role');await b.query('set role service_role');
    const first=await a.query(sqlA,argsA);
    const second=b.query(sqlB,argsB);
    let blocked=false;
    for(let i=0;i<100&&!blocked;i++){
      const activity=await pool.query('select wait_event_type from pg_stat_activity where pid=$1',[b.processID]);
      blocked=activity.rows[0]?.wait_event_type==='Lock';
    }
    assert.ok(blocked,'Second connection must wait on the first transaction lock');
    await a.query('commit');return [first,await second];
   }finally{await a.query('rollback');await b.query('reset role');a.release();b.release()}
  }
  const reserve='select reserve_video_credits($1,$2,100,\'free\') as result';
  const r=await overlap(reserve,[user,videos[0]],reserve,[user,videos[1]]);
  assert.equal(r[0].rows[0].result.status,'reserved');assert.equal(r[1].rows[0].result.status,'insufficient');
  const refund="select settle_video_credits($1,$2,'error',null,null)";
  await overlap(refund,[user,videos[0]],refund,[user,videos[0]]);
  assert.equal((await pool.query('select credits from profiles where id=$1',[user])).rows[0].credits,150);
  const same=await overlap(reserve,[user,videos[2]],reserve,[user,videos[2]]);
  assert.equal(same[0].rows[0].result.status,'reserved');assert.equal(same[1].rows[0].result.status,'already_submitted');
  const stripe="select apply_stripe_credit_event($1,'checkout:same',$2,'cus_test','topup',500,'free',null,1,0) as result";
  const payments=await overlap(stripe,['evt_a',user],stripe,['evt_b',user]);
  assert.equal(payments[1].rows[0].result,'duplicate_operation');
  assert.equal((await pool.query('select credits from profiles where id=$1',[user])).rows[0].credits,550);
  const vocal='22222222-2222-4222-8222-222222222224';
  await pool.query('insert into videos(id,user_id) values($1,$2)',[vocal,user]);
  await pool.query("select enqueue_vocal_job($1,$2,'https://storage.test/song.mp3',$3,'clean-neon',100,'free')",[user,vocal,'a'.repeat(64)]);
  // SKIP LOCKED must return immediately on another connection, never double claim.
  const a=await pool.connect(),b=await pool.connect();
  try{
    await a.query('begin');await a.query('set local role service_role');await b.query('set role service_role');
    const claimed=(await a.query('select claim_vocal_analysis() result')).rows[0].result;
    assert.equal(claimed.videoId,vocal);
    assert.equal((await b.query('select claim_vocal_analysis() result')).rows[0].result,null);
    await a.query('commit');
    await a.query("select finish_vocal_analysis($1,$2,$3,10,null)",[vocal,claimed.token,{words:[]}]);
    await a.query('begin');
    assert.equal((await a.query('select claim_vocal_render() result')).rows[0].result.video_id,vocal);
    assert.equal((await b.query('select claim_vocal_render() result')).rows[0].result,null);
    await a.query('commit');
  }finally{await a.query('rollback');await b.query('reset role');a.release();b.release()}
  await checkMultipleAccounts(pool);
  console.log('PASS real PostgreSQL multi-connection: competing spends, repeated video, simultaneous refunds, duplicate purchase, exclusive vocal analysis/render claims');
 }finally{await pool.end()}
})().catch(e=>{console.error(e);process.exitCode=1});
