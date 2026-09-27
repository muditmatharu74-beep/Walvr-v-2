-- Server-only recovery bookkeeping; existing column grants do not allow client writes.
alter table public.videos
  add column recovery_next_check timestamptz not null default (now() + interval '30 minutes'),
  add column recovery_reason text;
create index videos_recovery_due on public.videos(recovery_next_check)
  where status in ('processing','rendering');

create function public.schedule_render_recovery() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    new.recovery_reason := null;
    if new.status = 'processing' then
      new.recovery_next_check := now() + interval '30 minutes';
    elsif new.status = 'rendering' then
      new.recovery_next_check := now() + interval '5 minutes';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.schedule_render_recovery() from public,anon,authenticated;
grant execute on function public.schedule_render_recovery() to service_role;
create trigger schedule_render_recovery before update of status on public.videos
for each row execute function public.schedule_render_recovery();
