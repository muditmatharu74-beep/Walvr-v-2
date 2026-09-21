-- All balance writers lock the profile first. Only the server may call these RPCs.
create table public.credit_ledger (
  operation_key text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  kind text not null,
  created_at timestamptz not null default now()
);
create index credit_ledger_user_created on public.credit_ledger(user_id, created_at);
create table public.stripe_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);
alter table public.credit_ledger enable row level security;
alter table public.stripe_events enable row level security;
revoke all on public.credit_ledger, public.stripe_events from public, anon, authenticated;
grant all on public.credit_ledger, public.stripe_events to service_role;
alter table public.profiles add column billing_event_created bigint not null default 0;
alter table public.profiles add column credit_period_start bigint not null default 0;

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

-- Receipt, business-object deduplication and balance update commit or roll back together.
create function public.apply_stripe_credit_event(p_event_id text, p_key text, p_user_id uuid,
  p_customer text, p_action text, p_amount integer, p_plan text, p_subscription text,
  p_created bigint, p_period bigint)
returns text language plpgsql security invoker set search_path = '' as $$
declare p public.profiles%rowtype; inserted integer; delta integer := 0;
begin
  select * into p from public.profiles where id=p_user_id for update;
  if not found then raise exception 'Profile not found'; end if;
  if p_action <> 'topup' and p.stripe_customer_id is not null and p_customer is distinct from p.stripe_customer_id then raise exception 'Customer mismatch'; end if;
  insert into public.stripe_events(event_id) values(p_event_id) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted=0 then return 'duplicate_event'; end if;
  if p_action not in ('topup','renew','plan','cancel','link') then raise exception 'Invalid billing action'; end if;
  if p_action in ('topup','renew') and (p_amount is null or p_amount<=0) then raise exception 'Invalid credit grant'; end if;
  insert into public.credit_ledger values(p_key,p_user_id,0,p_action,now()) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted=0 then return 'duplicate_operation'; end if;
  update public.profiles set stripe_customer_id=coalesce(stripe_customer_id,p_customer) where id=p_user_id;
  if p_action='topup' then
    delta := p_amount;
    update public.profiles set credits=coalesce(credits,0)+p_amount where id=p_user_id;
  elsif p_action='renew' and p_period>p.credit_period_start then
    delta := p_amount-coalesce(p.credits,0);
    update public.profiles set credits=p_amount,credit_period_start=p_period,credits_reset_date=now() where id=p_user_id;
  end if;
  -- Subscription changes never grant credits; only a paid invoice can refill them.
  if p_action in ('plan','renew','cancel') and p_created>=p.billing_event_created then
    if p_action <> 'cancel' or p.stripe_subscription_id=p_subscription then
      update public.profiles set plan=p_plan,
        stripe_subscription_id=case when p_action='cancel' then null else p_subscription end,
        billing_event_created=p_created where id=p_user_id;
    end if;
  end if;
  update public.credit_ledger set amount=delta where operation_key=p_key;
  return 'applied';
end $$;

revoke all on function public.reserve_video_credits(uuid,uuid,integer,text) from public,anon,authenticated;
revoke all on function public.settle_video_credits(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.apply_stripe_credit_event(text,text,uuid,text,text,integer,text,text,bigint,bigint) from public,anon,authenticated;
grant execute on function public.reserve_video_credits(uuid,uuid,integer,text) to service_role;
grant execute on function public.settle_video_credits(uuid,uuid,text,text,text) to service_role;
grant execute on function public.apply_stripe_credit_event(text,text,uuid,text,text,integer,text,text,bigint,bigint) to service_role;
grant all on public.usage to service_role;
