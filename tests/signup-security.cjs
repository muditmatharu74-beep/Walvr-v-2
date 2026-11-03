// Disposable local database only: no Supabase credentials or customer accounts.
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');

(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated;
   create role service_role bypassrls; create role supabase_auth_admin;
   create schema auth; create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as
    $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema public,auth to anon,authenticated,service_role,supabase_auth_admin;
   grant insert on auth.users to supabase_auth_admin;`);
  await db.exec(fs.readFileSync(path.join(root,'supabase/schema.sql'),'utf8'));
  await db.exec('alter table public.profiles add column credits integer default 0');
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20260919030554_render_tracking_and_account_access.sql'),'utf8'));

  // Reproduce the inspected legacy function's 300-credit behavior. The migration
  // must change permissions/settings, never replace this body with an older one.
  await db.exec(`create or replace function public.handle_new_user() returns trigger
   language plpgsql security definer set statement_timeout='5s' as $$
   begin
    insert into public.profiles(id,email,credits) values(new.id,new.email,300);
    return new;
   end;$$;
   alter function public.handle_new_user() reset search_path;
   grant execute on function public.handle_new_user() to public,anon,authenticated,service_role;
   insert into auth.users values('11111111-1111-4111-8111-111111111111','before@example.test');
   update public.profiles set credits=125;`);
  const state=async()=> (await db.query(`select oid,prosrc,proowner,prosecdef,proconfig,
   has_function_privilege('anon',oid,'EXECUTE') as anon_execute,
   has_function_privilege('authenticated',oid,'EXECUTE') as authenticated_execute,
   has_function_privilege('service_role',oid,'EXECUTE') as service_execute
   from pg_proc where oid='public.handle_new_user()'::regprocedure`)).rows[0];
  const before=await state();
  assert.equal(before.anon_execute,true);
  assert.equal(before.authenticated_execute,true);
  const files=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('_harden_signup_trigger.sql'));
  assert.equal(files.length,1,'Expected the reviewed signup hardening migration');
  const migration=fs.readFileSync(path.join(root,'supabase/migrations',files[0]),'utf8');
  await db.exec(migration);
  await db.exec(migration); // Reapplying must not recreate the function or grant credits.
  const after=await state();
  for(const key of ['oid','prosrc','proowner','prosecdef','service_execute'])assert.equal(after[key],before[key],key+' changed');
  assert.equal(after.prosecdef,true);
  assert.equal(after.anon_execute,false);
  assert.equal(after.authenticated_execute,false);
  assert.ok(after.proconfig.some(v=>/^search_path=(""|)$/.test(v)),'Search path must be pinned empty');
  assert.ok(after.proconfig.includes('statement_timeout=5s'),'Unrelated function settings must survive');
  const trigger=(await db.query(`select tgfoid from pg_trigger where tgname='on_auth_user_created'`)).rows[0];
  assert.equal(trigger.tgfoid,before.oid,'Signup trigger was rebound');
  assert.equal((await db.query('select credits from public.profiles')).rows[0].credits,125,'Existing balance changed');

  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   await assert.rejects(()=>db.query('select public.handle_new_user()'),/permission denied/);
   await db.exec('reset role');
  }
  assert.equal((await db.query("select has_function_privilege('supabase_auth_admin','public.handle_new_user()','EXECUTE') as allowed")).rows[0].allowed,false);
  // Auth inserts still fire the existing trigger despite direct EXECUTE being
  // denied. A caller-controlled search path must not redirect the profile write.
  await db.exec(`create temp table profiles(id uuid,email text,credits integer);
   set role supabase_auth_admin; set search_path=pg_temp,public;
   insert into auth.users values('22222222-2222-4222-8222-222222222222','after@example.test');
   reset role; reset search_path;`);
  assert.equal((await db.query('select count(*)::integer as count from pg_temp.profiles')).rows[0].count,0);
  const created=(await db.query("select email,credits from public.profiles where id='22222222-2222-4222-8222-222222222222'")).rows[0];
  assert.deepEqual(created,{email:'after@example.test',credits:300});
  await db.exec('set role supabase_auth_admin');
  await assert.rejects(()=>db.exec("insert into auth.users values('22222222-2222-4222-8222-222222222222','after@example.test')"),/duplicate key/);
  await db.exec('reset role');
  assert.equal((await db.query("select credits from public.profiles where id='22222222-2222-4222-8222-222222222222'")).rows[0].credits,300);
  assert.equal((await db.query('select count(*)::integer as count from public.profiles')).rows[0].count,2);
  console.log('PASS signup security: browser execution denied; empty search path; preserved function/owner/settings/trigger; signup still grants 300 once; existing credits unchanged; temporary schema cannot redirect writes.');
 }finally{await db.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
