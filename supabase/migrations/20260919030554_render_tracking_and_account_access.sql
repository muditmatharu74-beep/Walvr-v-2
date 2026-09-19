-- Apply before deploying the render-lifecycle application branch.
begin;

alter table public.videos
  add column if not exists render_provider text,
  add column if not exists render_bucket text,
  add column if not exists render_function text,
  add column if not exists render_region text;

-- Profile plan, credits and Stripe IDs are server-owned.
-- The app only reads profiles in the browser; all writes use the service role.
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

-- Prevent clients from forging render IDs, AWS metadata, or processing states.
alter table public.videos enable row level security;
revoke all on public.videos from anon, authenticated;
grant select, delete on public.videos to authenticated;
grant insert (user_id, title, artist, cap_style, clip_style, template, status)
  on public.videos to authenticated;
grant all on public.videos to service_role;
drop policy if exists "Users can update own videos" on public.videos;
drop policy if exists "Users can insert own videos" on public.videos;
create policy "Users can insert own videos" on public.videos
  for insert to authenticated with check (
    (select auth.uid()) = user_id and status = 'pending'
  );
drop policy if exists "Users can delete own videos" on public.videos;
create policy "Users can delete own videos" on public.videos
  for delete to authenticated using ((select auth.uid()) = user_id);

commit;
