-- All balance writers lock the profile first. Only the server may call these RPCs.
create table public.credit_ledger (
  operation_key text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  kind text not null,
  created_at timestamptz not null default now()
);
create index credit_ledger_user_created on public.credit_ledger(user_id, created_at);
alter table public.credit_ledger enable row level security;
revoke all on public.credit_ledger from public, anon, authenticated;
grant all on public.credit_ledger to service_role;

-- Do not allow deletion to destroy a running job's refund/reconciliation target.
drop policy if exists "Users can delete own videos" on public.videos;
create policy "Users can delete own videos" on public.videos for delete to authenticated
  using (auth.uid() = user_id and status in ('pending', 'done', 'error'));

create function public.reserve_video_credits(p_user_id uuid, p_video_id uuid, p_cost integer, p_plan text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.profiles%rowtype; v public.videos%rowtype;
begin
  if p_cost not in (100,200,350) then raise exception 'Invalid render cost'; end if;
  select * into p from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Profile not found'; end if;
  select * into v from public.videos where id = p_video_id and user_id = p_user_id for update;
  if not found then raise exception 'Video not found'; end if;
  if v.status <> 'pending' then return jsonb_build_object('status','already_submitted'); end if;
  if p.plan is distinct from p_plan then return jsonb_build_object('status','plan_changed'); end if;
  if coalesce(p.credits,0) < p_cost then return jsonb_build_object('status','insufficient', 'credits',coalesce(p.credits,0)); end if;
  insert into public.credit_ledger values ('render-charge:' || p_video_id, p_user_id, -p_cost, 'render_charge', now());
  update public.profiles set credits = credits - p_cost where id = p_user_id;
  update public.videos set status = 'processing' where id = p_video_id;
  return jsonb_build_object('status','reserved','credits',p.credits-p_cost);
end $$;

create function public.settle_video_credits(p_user_id uuid, p_video_id uuid, p_status text, p_render_id text, p_url text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v public.videos%rowtype; charge integer; inserted integer;
begin
  if p_status not in ('done','error') then raise exception 'Invalid terminal status'; end if;
  perform 1 from public.profiles where id = p_user_id for update;
  select * into v from public.videos where id = p_video_id and user_id = p_user_id for update;
  if not found then raise exception 'Video not found'; end if;
  if v.status in ('done','error') then return jsonb_build_object('status',v.status,'url',v.render_url); end if;
  if v.render_id is distinct from p_render_id or v.status not in ('processing','rendering') then raise exception 'Stale render settlement'; end if;
  if p_status = 'done' and (p_render_id is null or p_url is null) then raise exception 'Missing completed render'; end if;
  if p_status = 'error' then
    select -amount into charge from public.credit_ledger where operation_key = 'render-charge:' || p_video_id and user_id = p_user_id;
    if charge is not null then
      insert into public.credit_ledger values ('render-refund:' || p_video_id,p_user_id,charge,'render_refund',now()) on conflict do nothing;
      get diagnostics inserted = row_count;
      if inserted = 1 then update public.profiles set credits = coalesce(credits,0)+charge where id=p_user_id; end if;
    end if;
  else
    insert into public.usage(user_id,month,count) values (p_user_id,to_char(now() at time zone 'UTC','YYYY-MM'),1)
      on conflict(user_id,month) do update set count=public.usage.count+1;
  end if;
  update public.videos set status=p_status,render_url=p_url where id=p_video_id;
  return jsonb_build_object('status',p_status,'url',p_url);
end $$;


revoke all on function public.reserve_video_credits(uuid,uuid,integer,text) from public,anon,authenticated;
revoke all on function public.settle_video_credits(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_video_credits(uuid,uuid,integer,text) to service_role;
grant execute on function public.settle_video_credits(uuid,uuid,text,text,text) to service_role;
grant all on public.usage to service_role;
