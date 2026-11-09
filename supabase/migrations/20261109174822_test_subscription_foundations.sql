-- Test-mode billing only. No prices, products, customer PII or raw webhook body
-- are stored. Ordinary clients cannot write any subscription/entitlement state.
create table public.organization_billing (
 organization_id uuid primary key references public.organizations(id),customer_id text unique check(customer_id ~ '^cus_[A-Za-z0-9]+$'),
 subscription_id text unique,status text not null default 'none',cancel_at_period_end boolean not null default false,period_end timestamptz,
 sync_version bigint not null default 0,synced_at timestamptz,lease_id uuid,lease_until timestamptz,issue_code text,risk_flag boolean not null default false
);
insert into public.organization_billing(organization_id) select id from public.organizations;
create function private.initialize_organization_billing() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.organization_billing(organization_id) values(new.id);return new;
end $$;
create trigger organization_billing_init after insert on public.organizations for each row execute function private.initialize_organization_billing();
revoke all on function private.initialize_organization_billing() from public,anon,authenticated;
create table public.billing_checkout_attempts (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),actor_id uuid not null references auth.users(id),
 plan text not null check(plan in ('starter','pro')),status text not null default 'reserved' check(status in ('reserved','ready','completed','expired')),
 session_id text unique,request_hash text check(request_hash ~ '^[a-f0-9]{64}$'),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '1 hour'
);
create unique index one_pending_checkout on public.billing_checkout_attempts(organization_id) where status in ('reserved','ready');
create table public.billing_events (
 id text primary key check(length(id)<=150),organization_id uuid references public.organizations(id),type text not null check(length(type)<=100),
 payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),event_created bigint not null,
 status text not null check(status in ('processing','applied','failed','ignored')),lease_id uuid,issue_code text,
 received_at timestamptz not null default now(),processed_at timestamptz
);
create index billing_events_org on public.billing_events(organization_id,received_at desc);
do $$declare t text;begin
 foreach t in array array['organization_billing','billing_checkout_attempts','billing_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

create function private.billing_access(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o uuid:=(p->>'organization_id')::uuid;b public.organization_billing;a public.billing_checkout_attempts;begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 perform 1 from public.organizations where id=o for update;
 if private.organization_role(o) is distinct from 'owner' then raise exception 'Organization owner required for billing' using errcode='42501';end if;
 select * into b from public.organization_billing where organization_id=o for update;
 if action='context' then return jsonb_build_object('organization_id',o,'customer_id',b.customer_id,'status',b.status);end if;
 if action<>'checkout' or p->>'plan' not in ('starter','pro') or p->>'plan' is null then raise exception 'Unsupported billing request';end if;
 if b.status in ('active','trialing','past_due','unpaid','paused','incomplete') and b.subscription_id is not null then raise exception 'Manage the existing subscription in the customer portal' using errcode='PT409';end if;
 if b.lease_until>now() then raise exception 'Billing reconciliation is in progress. Retry later.' using errcode='PT409';end if;
 select * into a from public.billing_checkout_attempts where organization_id=o and status in ('reserved','ready') for update;
 if a.id is not null then
  if a.plan<>p->>'plan' then raise exception 'A different checkout is pending. Finish or expire it before switching plans.' using errcode='PT409';end if;
  -- Never mint a second Checkout after a crash/timeout: resume the same provider
  -- idempotency key until the server confirms that its session expired.
 else
  insert into public.billing_checkout_attempts(organization_id,actor_id,plan) values(o,auth.uid(),p->>'plan') returning * into a;
 end if;
 return jsonb_build_object('organization_id',o,'attempt_id',a.id,'plan',a.plan,'customer_id',b.customer_id,'session_id',a.session_id,'expires_at',a.expires_at);
end $$;
revoke all on function private.billing_access(text,jsonb) from public,anon;
grant execute on function private.billing_access(text,jsonb) to authenticated;
create function public.billing_access(p_action text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.billing_access(p_action,p_payload)$$;
revoke all on function public.billing_access(text,jsonb) from public,anon;
grant execute on function public.billing_access(text,jsonb) to authenticated;

create function private.billing_service(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o uuid;b public.organization_billing;a public.billing_checkout_attempts;e public.billing_events;lease uuid;new_plan text;new_status text;begin
 if coalesce((p->>'livemode')::boolean,true) then raise exception 'Only test-mode billing is supported' using errcode='42501';end if;
 if action in ('attach_customer','bind_checkout','save_checkout','expire_checkout') then
  select organization_id into o from public.billing_checkout_attempts where id=(p->>'attempt_id')::uuid;
  perform 1 from public.organizations where id=o for update;
  select * into a from public.billing_checkout_attempts where id=(p->>'attempt_id')::uuid for update;
  if a.id is null or a.status not in ('reserved','ready') then raise exception 'Checkout reservation unavailable' using errcode='PT409';end if;
  select * into b from public.organization_billing where organization_id=o for update;
  if action='attach_customer' then
   if coalesce(p->>'customer_id','') !~ '^cus_[A-Za-z0-9]+$' or (b.customer_id is not null and b.customer_id<>p->>'customer_id') then raise exception 'Customer binding conflict' using errcode='PT409';end if;
   update public.organization_billing set customer_id=p->>'customer_id' where organization_id=o;
  elsif action='bind_checkout' then
   if b.customer_id is distinct from p->>'customer_id' or coalesce(p->>'hash','') !~ '^[a-f0-9]{64}$' or(a.request_hash is not null and a.request_hash<>p->>'hash') then raise exception 'Checkout configuration changed; review the pending attempt' using errcode='PT409';end if;
   update public.billing_checkout_attempts set request_hash=p->>'hash' where id=a.id;
  elsif action='save_checkout' then
   if b.customer_id is null or b.customer_id is distinct from p->>'customer_id' or coalesce(p->>'session_id','') !~ '^cs_test_[A-Za-z0-9]+$' or (a.session_id is not null and a.session_id<>p->>'session_id') then raise exception 'Checkout binding conflict' using errcode='PT409';end if;
   update public.billing_checkout_attempts set session_id=p->>'session_id',status='ready' where id=a.id;
  else update public.billing_checkout_attempts set status='expired' where id=a.id;end if;
  return jsonb_build_object('ok',true);
 end if;
 if action='begin' then
  if coalesce(p->>'id','') !~ '^(evt_|reconcile_)[A-Za-z0-9_-]+$' or length(p->>'id')>150 or coalesce(p->>'hash','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid event envelope';end if;
  select organization_id into o from public.organization_billing where customer_id=p->>'customer_id';
  if o is null then
   select * into e from public.billing_events where id=p->>'id' for update;
   if e.id is not null and (e.payload_hash is distinct from p->>'hash' or e.organization_id is not null) then raise exception 'Event identity conflict' using errcode='PT409';end if;
   insert into public.billing_events(id,type,payload_hash,event_created,status,issue_code,processed_at) values(p->>'id',p->>'type',p->>'hash',(p->>'created')::bigint,'ignored','unmapped_customer',now()) on conflict do nothing;
   return jsonb_build_object('ignored',true);
  end if;
  perform 1 from public.organizations where id=o for update;
  select * into b from public.organization_billing where organization_id=o for update;
  select * into e from public.billing_events where id=p->>'id' for update;
  if e.id is not null and (e.payload_hash is distinct from p->>'hash' or e.organization_id is distinct from o) then raise exception 'Event identity conflict' using errcode='PT409';end if;
  if e.status in ('applied','ignored') then return jsonb_build_object('duplicate',true);end if;
  if b.lease_until>now() then raise exception 'Billing reconciliation busy' using errcode='PT409';end if;
  update public.billing_events set status='failed',issue_code='lease_expired',processed_at=now() where lease_id=b.lease_id and status='processing';
  lease:=gen_random_uuid();
  insert into public.billing_events(id,organization_id,type,payload_hash,event_created,status,lease_id) values(p->>'id',o,p->>'type',p->>'hash',(p->>'created')::bigint,'processing',lease)
  on conflict(id) do update set status='processing',lease_id=excluded.lease_id,issue_code=null;
  update public.organization_billing set lease_id=lease,lease_until=now()+interval '2 minutes' where organization_id=o;
  return jsonb_build_object('organization_id',o,'lease',lease,'customer_id',b.customer_id);
 elsif action in ('apply','fail') then
  select organization_id into o from public.billing_events where id=p->>'id';
  perform 1 from public.organizations where id=o for update;
  select * into b from public.organization_billing where organization_id=o for update;
  select * into e from public.billing_events where id=p->>'id' for update;
  if e.id is null or e.status<>'processing' or b.lease_id is distinct from (p->>'lease')::uuid or e.lease_id is distinct from b.lease_id or b.lease_until<=now() then raise exception 'Stale reconciliation lease' using errcode='PT409';end if;
  if action='fail' then
   update public.billing_events set status='failed',issue_code='provider_unavailable',processed_at=now() where id=e.id;
   update public.organization_billing set lease_id=null,lease_until=null,issue_code='provider_unavailable' where organization_id=o;
   return jsonb_build_object('ok',true);
  end if;
  if p->>'customer_id' is distinct from b.customer_id then raise exception 'Customer binding conflict' using errcode='PT409';end if;
  new_status:=p->>'status';new_plan:=p->>'plan';
  if new_status is null or new_status not in ('none','active','trialing','past_due','unpaid','incomplete','incomplete_expired','canceled','paused') or new_plan is null or new_plan not in ('free','starter','pro') or (p->>'issue_code' is not null and p->>'issue_code' not in ('unknown_price','multiple_subscriptions','subscription_not_active','risk_review')) then raise exception 'Invalid normalized subscription state';end if;
  if new_status not in ('active','trialing') or p->>'issue_code' in ('unknown_price','multiple_subscriptions','subscription_not_active') then new_plan:='free';end if;
  update public.organization_billing set subscription_id=nullif(p->>'subscription_id',''),status=new_status,cancel_at_period_end=coalesce((p->>'cancel_at_period_end')::boolean,false),period_end=nullif(p->>'period_end','')::timestamptz,
   sync_version=sync_version+1,synced_at=now(),lease_id=null,lease_until=null,issue_code=p->>'issue_code',risk_flag=risk_flag or coalesce(p->>'issue_code'='risk_review',false) where organization_id=o;
  update public.organizations set effective_plan=new_plan,revision=revision+1 where id=o;
  update public.billing_events set status='applied',processed_at=now(),issue_code=p->>'issue_code' where id=e.id;
  update public.billing_checkout_attempts set status='completed' where organization_id=o and status in ('reserved','ready') and new_status in ('active','trialing');
  if p->>'event_session_id' is not null and p->>'event_type'='checkout.session.expired' then update public.billing_checkout_attempts set status='expired' where organization_id=o and session_id=p->>'event_session_id' and status in ('reserved','ready');end if;
  insert into public.organization_audit(organization_id,action,detail) values(o,'billing.reconciled',jsonb_build_object('event_id',e.id,'status',new_status,'plan',new_plan,'issue_code',p->>'issue_code'));
  return jsonb_build_object('ok',true,'plan',new_plan);
 end if;
 raise exception 'Unknown billing service action';
end $$;
revoke all on function private.billing_service(text,jsonb) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.billing_service(text,jsonb) to service_role;
create function public.billing_service(p_action text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.billing_service(p_action,p_payload)$$;
revoke all on function public.billing_service(text,jsonb) from public,anon,authenticated;
grant execute on function public.billing_service(text,jsonb) to service_role;

alter function private.organization_snapshot(uuid) rename to basic_organization_snapshot;
revoke all on function private.basic_organization_snapshot(uuid) from public,anon,authenticated;
create function private.organization_snapshot(o uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare res jsonb;begin
 res:=private.basic_organization_snapshot(o);
 return res||jsonb_build_object('billing',(select jsonb_build_object('status',status,'cancel_at_period_end',cancel_at_period_end,'period_end',period_end,'synced_at',synced_at,'issue_code',case when risk_flag then 'risk_review' else issue_code end) from public.organization_billing where organization_id=o));
end $$;
revoke all on function private.organization_snapshot(uuid) from public,anon,authenticated;
create function private.platform_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.platform_admin() then raise exception 'Platform administrator required' using errcode='42501';end if;
 return jsonb_build_object('organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'status',o.status,'plan',o.effective_plan,'limits',private.organization_limits(o.id),'usage',private.organization_usage(o.id),
 'billing_status',b.status,'synced_at',b.synced_at,'issue_code',case when b.risk_flag then 'risk_review' else b.issue_code end,'pending_webhooks',(select count(*) from public.billing_events e where e.organization_id=o.id and e.status in ('processing','failed')),
 'over_limit',((private.organization_usage(o.id)->>'seasons')::int>(private.organization_limits(o.id)->>'seasons')::int or(private.organization_usage(o.id)->>'members')::int>(private.organization_limits(o.id)->>'members')::int),
 'leagues',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'season',l.season_name,'sport',l.sport)),'[]') from public.leagues l where l.organization_id=o.id)) order by o.created_at desc),'[]') from public.organizations o join public.organization_billing b on b.organization_id=o.id),
 'unmapped_events',(select count(*) from public.billing_events where organization_id is null),'plans',(select jsonb_agg(to_jsonb(sp) order by code) from public.saas_plans sp));
end $$;
revoke all on function private.platform_overview() from public,anon;
grant execute on function private.platform_overview() to authenticated;
create function public.platform_overview() returns jsonb language sql security invoker set search_path='' as $$select private.platform_overview()$$;
revoke all on function public.platform_overview() from public,anon;
grant execute on function public.platform_overview() to authenticated;
