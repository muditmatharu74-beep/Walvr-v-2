// Run with @electric-sql/pglite available on NODE_PATH. No production database is contacted.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const db = new PGlite();
  const schema = fs.readFileSync(path.join(__dirname, '../supabase/schema.sql'), 'utf8');
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
  `);
  await db.exec(schema);
  await db.exec(`
    alter table profiles add column credits integer default 0;
    alter table profiles disable row level security;
    grant all on profiles, videos to anon, authenticated, service_role;
    insert into auth.users (id, email) values
      ('11111111-1111-4111-8111-111111111111', 'one@example.test'),
      ('22222222-2222-4222-8222-222222222222', 'two@example.test');
  `);
  const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260919030554_render_tracking_and_account_access.sql'), 'utf8');
  await db.exec(migration);
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';`);
  const rows = await db.query('select * from profiles');
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0].email, 'one@example.test');
  await assert.rejects(() => db.exec("update profiles set credits = 999999"), /permission denied/);
  await db.exec(`insert into videos (user_id, title, artist, cap_style, clip_style, template, status)
    values ('11111111-1111-4111-8111-111111111111', 'Song', 'Artist', 'bold-overlay', 'dark-solid', 'template', 'pending')`);
  await assert.rejects(() => db.exec("update videos set render_id = 'forged'"), /permission denied/);
  await assert.rejects(() => db.exec(`insert into videos (user_id, status)
    values ('11111111-1111-4111-8111-111111111111', 'rendering')`), /row-level security/);
  await assert.rejects(() => db.exec(`insert into videos (user_id, status)
    values ('22222222-2222-4222-8222-222222222222', 'pending')`), /row-level security/);
  await db.exec('reset role; set role anon');
  await assert.rejects(() => db.exec('select * from profiles'), /permission denied/);
  await db.exec('reset role; set role service_role');
  await db.exec("update profiles set credits = 300; update videos set render_provider = 'remotion', render_bucket = 'bucket'");
  assert.equal((await db.query('select credits from profiles')).rows.length, 2);
  await db.exec("reset role; set role authenticated; set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222'; delete from videos");
  await db.exec('reset role');
  assert.equal((await db.query('select * from videos')).rows.length, 1);
  await db.exec("set role authenticated; set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111'; delete from videos");
  await db.exec('reset role');
  assert.equal((await db.query('select * from videos')).rows.length, 0);
  await db.close();
  console.log('PASS: profile isolation; protected credits; valid uploads; forged state and cross-owner inserts denied; anonymous reads denied; service writes and owner deletion work.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
