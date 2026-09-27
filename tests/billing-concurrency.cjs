// Destructive setup is allowed ONLY in an empty, local disposable walvr_test database.
const {Pool}=require('pg');
const fs=require('node:fs');
const assert=require('node:assert/strict');
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
  console.log('PASS real PostgreSQL multi-connection: competing spends, repeated video, simultaneous refunds, same purchase with different Stripe events');
 }finally{await pool.end()}
})().catch(e=>{console.error(e);process.exitCode=1});
