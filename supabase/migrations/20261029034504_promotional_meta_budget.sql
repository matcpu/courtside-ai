-- Single global ledger: service-only, durable BEFORE dispatch, serialized reservations.
create table private.meta_credit_budget(
 id boolean primary key default true check(id), approved_credit_units numeric not null default 120 check(approved_credit_units<=120),
 observed_remaining numeric not null default 0, observed_at timestamptz,
 credit_safety_multiplier numeric not null default 2 check(credit_safety_multiplier>=2),
 paused boolean not null default true
);
insert into private.meta_credit_budget(id) values(true);
create table private.meta_authorized_scopes(league_id uuid not null references public.leagues(id),actor_id uuid not null references auth.users(id),primary key(league_id,actor_id));
create table private.meta_evaluation_cases(
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),actor_id uuid not null references auth.users(id),
 case_key text not null unique,feature text not null check(feature in ('evaluation_scoresheet','evaluation_placement','synthetic_document_screening')),
 input_digest text not null check(input_digest~'^[a-f0-9]{64}$'),label text not null,synthetic boolean not null check(synthetic),created_at timestamptz not null default now()
);
create table private.meta_spend_ledger(
 id uuid primary key default gen_random_uuid(),request_key text not null unique,league_id uuid not null references public.leagues(id),actor_id uuid not null references auth.users(id),
 feature text not null,case_id uuid references private.meta_evaluation_cases(id),request_digest text not null check(request_digest~'^[a-f0-9]{64}$'),
 status text not null check(status in ('reserved','completed','uncertain')),max_output_tokens int not null check(max_output_tokens between 1 and 8000),
 reserved_credit_units numeric not null default 3,charged_credit_units numeric,estimated_usd numeric,usage jsonb,response_id text unique,response_summary jsonb,
 created_at timestamptz not null default now(),completed_at timestamptz
);
create index meta_spend_league on private.meta_spend_ledger(league_id);
create index meta_spend_actor on private.meta_spend_ledger(actor_id);
create index meta_spend_case on private.meta_spend_ledger(case_id);
alter table private.meta_credit_budget enable row level security;
alter table private.meta_authorized_scopes enable row level security;
alter table private.meta_evaluation_cases enable row level security;
alter table private.meta_spend_ledger enable row level security;
revoke all on private.meta_credit_budget,private.meta_authorized_scopes,private.meta_evaluation_cases,private.meta_spend_ledger from public,anon,authenticated;
-- Preserve every previous genuine request in cumulative accounting.
insert into private.meta_authorized_scopes select distinct league_id,initiated_by from public.meta_evidence on conflict do nothing;
insert into private.meta_spend_ledger(request_key,league_id,actor_id,feature,request_digest,status,max_output_tokens,reserved_credit_units,charged_credit_units,estimated_usd,usage,response_id,response_summary,created_at,completed_at)
select 'legacy:'||response_id,league_id,initiated_by,feature,request_digest,'completed',case when feature='operations' then 2500 else 4000 end,0,
 2*((response#>>'{_provider,usage,input_tokens}')::numeric*1.25+(response#>>'{_provider,usage,output_tokens}')::numeric*4.25)/1000000,
 ((response#>>'{_provider,usage,input_tokens}')::numeric*1.25+(response#>>'{_provider,usage,output_tokens}')::numeric*4.25)/1000000,
 response#>'{_provider,usage}',response_id,response,created_at,created_at from public.meta_evidence where response#>'{_provider,usage}' is not null;

create function private.meta_finance(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg private.meta_credit_budget; entry private.meta_spend_ledger; c private.meta_evaluation_cases;spent numeric;hold numeric;u jsonb;cost numeric;actor uuid;league uuid;feature text;result jsonb;
begin
 select * into cfg from private.meta_credit_budget where id=true for update;
 select coalesce(sum(coalesce(charged_credit_units,reserved_credit_units)),0),coalesce(sum(reserved_credit_units) filter(where status<>'completed'),0) into spent,hold from private.meta_spend_ledger;
 if action='observe_credits' then
  if (p->>'remaining')::numeric not between 30 and 150 or length(coalesce(p->>'source',''))<15 then raise exception 'Verified promotional balance and source required';end if;
  update private.meta_credit_budget set observed_remaining=(p->>'remaining')::numeric,observed_at=now(),paused=coalesce((p->>'paused')::boolean,false) where id=true;
  return jsonb_build_object('observed',true,'remaining',(p->>'remaining')::numeric);
 elsif action='pause' then
  update private.meta_credit_budget set paused=true where id=true;return '{"paused":true}'::jsonb;
 elsif action='summary' then
  return jsonb_build_object('requests',(select count(*) from private.meta_spend_ledger),'reportedUsage',(select coalesce(jsonb_agg(jsonb_build_object('feature',ml.feature,'status',ml.status,'responseId',ml.response_id,'usage',ml.usage,'estimatedUSD',ml.estimated_usd)), '[]') from private.meta_spend_ledger ml), 'reservedAndChargedGuardUnits',spent,'approvedGuardUnits',cfg.approved_credit_units,'observedCredits',cfg.observed_remaining,'observedAt',cfg.observed_at,'paused',cfg.paused,'uncertainRequests',(select count(*) from private.meta_spend_ledger where status='uncertain'),'creditSafetyMultiplier',cfg.credit_safety_multiplier);
 elsif action in ('register_case','authorize_scope','reserve') then
  actor:=(p->>'actor')::uuid;league:=(p->>'league')::uuid;feature:=p->>'feature';
  if not exists(select 1 from public.leagues where id=league and not is_public) or not exists(select 1 from public.memberships where league_id=league and user_id=actor and (role='admin' or feature='placement' and role='coach')) then raise exception 'Private synthetic operator scope required' using errcode='42501';end if;
  if action='authorize_scope' then insert into private.meta_authorized_scopes values(league,actor) on conflict do nothing;return '{"authorized":true}'::jsonb;end if;
  if not exists(select 1 from private.meta_authorized_scopes where league_id=league and actor_id=actor) then raise exception 'Operator not in authorized synthetic scope' using errcode='42501';end if;
  if action='register_case' then
   if coalesce((p->>'synthetic')::boolean,false) is distinct from true or length(p->>'case_key') not between 8 and 200 or length(p->>'label') not between 3 and 200 then raise exception 'Explicit generated synthetic case required';end if;
   insert into private.meta_evaluation_cases(league_id,actor_id,case_key,feature,input_digest,label,synthetic) values(league,actor,p->>'case_key',feature,p->>'input_digest',p->>'label',true) on conflict(case_key) do nothing;
   select * into c from private.meta_evaluation_cases where case_key=p->>'case_key';
   if c.input_digest<>p->>'input_digest' or c.actor_id<>actor or c.league_id<>league or c.feature<>feature then raise exception 'Synthetic case changed; preserve immutable input';end if;
   return jsonb_build_object('id',c.id);
  end if;
  if cfg.paused or cfg.observed_at is null or cfg.observed_at<now()-interval '60 minutes' then raise exception 'Inference paused: verify available promotional credits';end if;
  if exists(select 1 from private.meta_spend_ledger where status='uncertain' or status='reserved' and created_at<now()-interval '2 minutes') then raise exception 'Uncertain provider usage blocks further inference';end if;
  if spent+3>cfg.approved_credit_units or cfg.observed_remaining-spent-3<30 then raise exception 'Promotional safety allowance exhausted; card spending is not authorized';end if;
  if p->>'model' is distinct from 'muse-spark-1.3' or (p->>'max_output_tokens')::int not between 1 and 8000 or length(p->>'request_key') not between 8 and 250 then raise exception 'Invalid bounded model request';end if;
  if feature not in ('placement','scoresheet','operations','evaluation_scoresheet','evaluation_placement','synthetic_document_screening') then raise exception 'Unsupported inference feature';end if;
  if feature in ('evaluation_scoresheet','evaluation_placement','synthetic_document_screening') then
   select * into c from private.meta_evaluation_cases ec where ec.id=(p->>'case_id')::uuid and ec.league_id=league and ec.actor_id=actor and ec.feature=p->>'feature';
   if c.id is null then raise exception 'Registered synthetic evaluation case required';end if;
  end if;
  if exists(select 1 from private.meta_spend_ledger ml where ml.request_key=p->>'request_key' or ml.league_id=league and ml.actor_id=actor and ml.feature=p->>'feature' and ml.request_digest=p->>'request_digest') then raise exception 'This exact request was already attempted; inspect its evidence rather than repeat inference';end if;
  insert into private.meta_spend_ledger(request_key,league_id,actor_id,feature,case_id,request_digest,status,max_output_tokens) values(p->>'request_key',league,actor,feature,c.id,p->>'request_digest','reserved',(p->>'max_output_tokens')::int) returning * into entry;
  return jsonb_build_object('id',entry.id,'reservedGuardUnits',3,'spentAndReservedGuardUnits',spent+3);
 elsif action in ('settle','uncertain') then
  select * into entry from private.meta_spend_ledger where id=(p->>'id')::uuid for update;
  if entry.id is null or entry.status<>'reserved' then raise exception 'Unknown or already settled provider reservation';end if;
  if action='uncertain' then update private.meta_spend_ledger set status='uncertain',response_summary=p->'summary' where id=entry.id;update private.meta_credit_budget set paused=true where id=true;return '{"stopped":true}'::jsonb;end if;
  u:=p->'usage';
  if jsonb_typeof(u->'input_tokens') is distinct from 'number' or jsonb_typeof(u->'output_tokens') is distinct from 'number' or (u->>'input_tokens')::numeric not between 0 and 1048576 or (u->>'output_tokens')::numeric not between 0 and entry.max_output_tokens or (u->>'input_tokens')::numeric<>trunc((u->>'input_tokens')::numeric) or (u->>'output_tokens')::numeric<>trunc((u->>'output_tokens')::numeric) or length(coalesce(p->>'response_id',''))<3 then raise exception 'Unverifiable provider usage';end if;
  -- Conservatively bill all input at uncached standard price for the safety ledger.
  cost:=((u->>'input_tokens')::numeric*1.25+(u->>'output_tokens')::numeric*4.25)/1000000;
  update private.meta_spend_ledger set status='completed',estimated_usd=cost,charged_credit_units=cost*cfg.credit_safety_multiplier,usage=u,response_id=p->>'response_id',response_summary=p->'summary',completed_at=now() where id=entry.id;
  if (u->>'input_tokens')::numeric>100000 then update private.meta_credit_budget set paused=true where id=true;end if;
  return jsonb_build_object('settled',true,'conservativeUSD',cost,'guardUnits',cost*cfg.credit_safety_multiplier);
 else raise exception 'Unsupported finance action';end if;
end$$;
revoke all on function private.meta_finance(text,jsonb) from public,anon,authenticated;
grant execute on function private.meta_finance(text,jsonb) to service_role;
create function public.meta_finance(p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.meta_finance(p_action,p_payload)$$;
revoke all on function public.meta_finance(text,jsonb) from public,anon,authenticated;
grant execute on function public.meta_finance(text,jsonb) to service_role;
