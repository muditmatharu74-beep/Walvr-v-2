-- Staged only: apply to a disposable preview DB before enabling vocal timing.
-- Lyrics and lease credentials must never be exposed to browser roles.
create table public.vocal_jobs (
  video_id uuid primary key references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_url text not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  caption_style text not null check (caption_style in ('bold-overlay','word-highlight','frosted','minimal','karaoke','clean-neon','pixel-neon')),
  state text not null default 'queued' check (state in ('queued','analyzing','ready','submitting','submitted','failed','review')),
  attempts integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  result jsonb,
  original_duration double precision,
  reason text,
  created_at timestamptz not null default now(),
  check (state<>'analyzing' or (lease_token is not null and lease_until is not null)),
  check (state not in ('ready','submitting','submitted') or (result is not null and original_duration>0 and original_duration<=600))
);
create index vocal_jobs_due on public.vocal_jobs(created_at) where state in ('queued','analyzing','ready');
alter table public.vocal_jobs enable row level security;
revoke all on public.vocal_jobs from public,anon,authenticated;
grant all on public.vocal_jobs to service_role;

create function public.enqueue_vocal_job(p_user_id uuid, p_video_id uuid, p_url text,
  p_sha256 text, p_caption_style text, p_cost integer, p_plan text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare reservation jsonb;
begin
  reservation := public.reserve_video_credits(p_user_id,p_video_id,p_cost,p_plan);
  if reservation->>'status' <> 'reserved' then return reservation; end if;
  insert into public.vocal_jobs(video_id,user_id,source_url,source_sha256,caption_style)
    values(p_video_id,p_user_id,p_url,p_sha256,p_caption_style);
  return reservation;
end $$;

create function public.claim_vocal_analysis() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare job public.vocal_jobs%rowtype;
begin
  select j.* into job from public.vocal_jobs j join public.videos v on v.id=j.video_id
    where v.status='processing' and (j.state='queued' or (j.state='analyzing' and j.lease_until<now()))
    order by j.created_at for update of j skip locked limit 1;
  if not found then return null; end if;
  if job.attempts >= 3 then
    perform public.settle_video_credits(job.user_id,job.video_id,'error',null,null);
    update public.vocal_jobs set state='failed',reason='analysis_retries_exhausted',lease_token=null,lease_until=null
      where video_id=job.video_id;
    return null;
  end if;
  update public.vocal_jobs set state='analyzing',attempts=attempts+1,lease_token=gen_random_uuid(),
    lease_until=now()+interval '20 minutes' where video_id=job.video_id returning * into job;
  return jsonb_build_object('videoId',job.video_id,'userId',job.user_id,'sourceUrl',job.source_url,
    'sourceSha256',job.source_sha256,'token',job.lease_token);
end $$;

create function public.heartbeat_vocal_analysis(p_video_id uuid,p_token uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  update public.vocal_jobs set lease_until=now()+interval '20 minutes'
    where video_id=p_video_id and state='analyzing' and lease_token=p_token and lease_until>now();
  if not found then return jsonb_build_object('status','stale'); end if;
  return jsonb_build_object('status','analyzing');
end $$;

create function public.finish_vocal_analysis(p_video_id uuid,p_token uuid,p_result jsonb,
  p_duration double precision,p_failure text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare job public.vocal_jobs%rowtype;
begin
  select * into job from public.vocal_jobs where video_id=p_video_id for update;
  if not found or job.state<>'analyzing' or job.lease_token is distinct from p_token or job.lease_until<=now()
    then return jsonb_build_object('status','stale'); end if;
  if p_failure is not null then
    perform public.settle_video_credits(job.user_id,job.video_id,'error',null,null);
    update public.vocal_jobs set state='failed',reason=p_failure,lease_token=null,lease_until=null where video_id=p_video_id;
    return jsonb_build_object('status','failed');
  end if;
  if p_result is null or p_duration is null or p_duration<=0 or p_duration>600 then raise exception 'Invalid vocal result'; end if;
  update public.vocal_jobs set state='ready',result=p_result,original_duration=p_duration,
    lease_token=null,lease_until=null where video_id=p_video_id;
  return jsonb_build_object('status','ready');
end $$;

create function public.fail_vocal_analysis(p_video_id uuid,p_token uuid,p_reason text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare job public.vocal_jobs%rowtype;
begin
  select * into job from public.vocal_jobs where video_id=p_video_id for update;
  if not found or job.state<>'analyzing' or job.lease_token is distinct from p_token or job.lease_until<=now()
    then return jsonb_build_object('status','stale'); end if;
  if p_reason not in ('input_invalid','analysis_failed') then raise exception 'Invalid worker failure'; end if;
  if p_reason='input_invalid' or job.attempts>=3 then
    return public.finish_vocal_analysis(p_video_id,p_token,null,null,p_reason);
  end if;
  update public.vocal_jobs set state='queued',reason=p_reason,lease_token=null,lease_until=null where video_id=p_video_id;
  return jsonb_build_object('status','queued');
end $$;

-- Submission has no expiring lease: once claimed, an uncertain provider call
-- must never be retried automatically. Ready analysis, in contrast, is durable.
create function public.claim_vocal_render() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare job public.vocal_jobs%rowtype;
begin
  select j.* into job from public.vocal_jobs j join public.videos v on v.id=j.video_id
    where j.state='ready' and v.status='processing' order by j.created_at
    for update of j skip locked limit 1;
  if not found then return null; end if;
  update public.vocal_jobs set state='submitting' where video_id=job.video_id;
  return to_jsonb(job);
end $$;

create function public.finish_vocal_render(p_video_id uuid,p_render_id text,p_bucket text,p_function text,p_region text)
returns void language plpgsql security invoker set search_path = '' as $$
declare job public.vocal_jobs%rowtype;
begin
  select * into job from public.vocal_jobs where video_id=p_video_id for update;
  if not found or job.state<>'submitting' then raise exception 'Stale vocal submission'; end if;
  if nullif(p_render_id,'') is null or nullif(p_bucket,'') is null or nullif(p_function,'') is null or nullif(p_region,'') is null
    then raise exception 'Missing renderer tracking'; end if;
  update public.videos set render_id=p_render_id,render_provider='remotion',render_bucket=p_bucket,
    render_function=p_function,render_region=p_region,status='rendering',captions=job.result->'words',
    analysis=jsonb_build_object('timingPipeline','vocal-timing','humanVerified',false)
    where id=p_video_id and user_id=job.user_id and status='processing' and render_id is null;
  if not found then raise exception 'Video no longer processing'; end if;
  update public.vocal_jobs set state='submitted' where video_id=p_video_id;
end $$;

create function public.stop_vocal_render(p_video_id uuid,p_uncertain boolean) returns void
language plpgsql security invoker set search_path = '' as $$
declare job public.vocal_jobs%rowtype;
begin
  select * into job from public.vocal_jobs where video_id=p_video_id for update;
  if not found or job.state<>'submitting' then return; end if;
  if p_uncertain then
    update public.vocal_jobs set state='review',reason='submission_uncertain' where video_id=p_video_id;
  else
    perform public.settle_video_credits(job.user_id,job.video_id,'error',null,null);
    update public.vocal_jobs set state='failed',reason='invalid_render_input' where video_id=p_video_id;
  end if;
end $$;

revoke all on function public.enqueue_vocal_job(uuid,uuid,text,text,text,integer,text),
  public.claim_vocal_analysis(),public.heartbeat_vocal_analysis(uuid,uuid),
  public.finish_vocal_analysis(uuid,uuid,jsonb,double precision,text),public.fail_vocal_analysis(uuid,uuid,text),
  public.claim_vocal_render(),public.finish_vocal_render(uuid,text,text,text,text),public.stop_vocal_render(uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.enqueue_vocal_job(uuid,uuid,text,text,text,integer,text),
  public.claim_vocal_analysis(),public.heartbeat_vocal_analysis(uuid,uuid),
  public.finish_vocal_analysis(uuid,uuid,jsonb,double precision,text),public.fail_vocal_analysis(uuid,uuid,text),
  public.claim_vocal_render(),public.finish_vocal_render(uuid,text,text,text,text),public.stop_vocal_render(uuid,boolean)
  to service_role;
