-- Local-only review candidate. League memberships remain the authority for
-- private operations and Storage; organization membership never inherits them.
create table public.saas_plans (
 code text primary key check(code in ('free','starter','pro')), name text not null,
 limits jsonb not null check(jsonb_typeof(limits)='object'), revision int not null default 1
);
insert into public.saas_plans(code,name,limits) values
 ('free','Free','{"programs":3,"seasons":3,"members":3}'),
 ('starter','Starter','{"programs":20,"seasons":20,"members":15}'),
 ('pro','Pro','{"programs":100,"seasons":100,"members":100}');
create table public.organizations (
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 2 and 100),
 status text not null default 'active' check(status in ('active','unclaimed')),
 personal_owner_id uuid unique references auth.users(id), effective_plan text not null default 'free' references public.saas_plans(code),
 capacity_floor jsonb not null default '{}',revision int not null default 1,created_at timestamptz not null default now()
);
create table public.organization_members (
 organization_id uuid not null references public.organizations(id),user_id uuid not null references auth.users(id),
 role text not null check(role in ('owner','admin','member')),created_at timestamptz not null default now(),primary key(organization_id,user_id)
);
create unique index one_organization_owner on public.organization_members(organization_id) where role='owner';
create index organization_members_user on public.organization_members(user_id,organization_id);
create table public.league_programs (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 name text not null check(length(trim(name)) between 2 and 100),legacy_league_id uuid unique references public.leagues(id),
 created_at timestamptz not null default now(),unique(organization_id,id)
);
alter table public.leagues add column organization_id uuid references public.organizations(id);
alter table public.leagues add column program_id uuid;
alter table public.leagues add constraint league_program_tenant foreign key(organization_id,program_id) references public.league_programs(organization_id,id);
alter table public.leagues add constraint leagues_organization_identity unique(organization_id,id);
create index leagues_organization on public.leagues(organization_id,program_id);
create table public.organization_invitations (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 email text not null check(length(email)<=150),role text not null check(role in ('admin','member')),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),created_by uuid not null references auth.users(id),
 expires_at timestamptz not null default now()+interval '72 hours',revoked_at timestamptz,accepted_at timestamptz,accepted_by uuid references auth.users(id)
);
create index org_invite_pending on public.organization_invitations(organization_id,expires_at);
create table public.organization_audit (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 actor_id uuid references auth.users(id),action text not null,detail jsonb not null default '{}',created_at timestamptz not null default now()
);
create table public.organization_league_grants (
 organization_id uuid not null,league_id uuid not null,user_id uuid not null references auth.users(id),
 role text not null check(role in ('admin','coach','scorekeeper','referee')),previous_role text,
 primary key(league_id,user_id),foreign key(organization_id,league_id) references public.leagues(organization_id,id)
);
create table public.platform_administrators(user_id uuid primary key references auth.users(id),created_at timestamptz not null default now());
alter table public.platform_administrators enable row level security;
revoke all on public.platform_administrators from public,anon,authenticated;
create function private.organization_role(o uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.organization_members where organization_id=o and user_id=(select auth.uid())
$$;
create function private.platform_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.platform_administrators where user_id=(select auth.uid()))
$$;
revoke all on function private.organization_role(uuid),private.platform_admin() from public,anon;
grant execute on function private.organization_role(uuid),private.platform_admin() to authenticated;
do $$declare t text;begin
 foreach t in array array['saas_plans','organizations','organization_members','league_programs','organization_invitations','organization_audit','organization_league_grants'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy signed_in_read on public.saas_plans for select to authenticated using((select auth.uid()) is not null);
create policy member_read on public.organizations for select to authenticated using(private.organization_role(id) is not null);
create policy role_read on public.organization_members for select to authenticated using(user_id=(select auth.uid()) or private.organization_role(organization_id) in ('owner','admin'));
create policy member_read on public.league_programs for select to authenticated using(private.organization_role(organization_id) is not null);
create policy no_direct_invites on public.organization_invitations for select to authenticated using(false);
create policy manager_read on public.organization_audit for select to authenticated using(private.organization_role(organization_id) in ('owner','admin'));
create policy manager_read on public.organization_league_grants for select to authenticated using(private.organization_role(organization_id) in ('owner','admin'));

-- One personal organization per ACTIVE legacy owner. A revoked/stale owner or
-- ownerless reference league is quarantined, never assigned by guesswork.
do $$declare own uuid;o uuid;le record;pr uuid;begin
 for own in select distinct l.owner_id from public.leagues l where l.owner_id is not null and exists(select 1 from public.memberships m where m.league_id=l.id and m.user_id=l.owner_id and m.role='admin') loop
  insert into public.organizations(name,personal_owner_id) values('My league organization',own) returning id into o;
  insert into public.organization_members values(o,own,'owner',now());
  for le in select * from public.leagues l where l.owner_id=own and exists(select 1 from public.memberships m where m.league_id=l.id and m.user_id=own and m.role='admin') loop
   insert into public.league_programs(organization_id,name,legacy_league_id) values(o,le.name,le.id) returning id into pr;
   update public.leagues set organization_id=o,program_id=pr where id=le.id;
  end loop;
  update public.organizations set capacity_floor=jsonb_build_object('seasons',(select count(*) from public.leagues where organization_id=o),'programs',(select count(*) from public.league_programs where organization_id=o)) where id=o;
  insert into public.organization_audit(organization_id,actor_id,action) values(o,own,'legacy.owner_imported');
 end loop;
 for le in select * from public.leagues where organization_id is null loop
  insert into public.organizations(name,status) values('Unclaimed legacy organization','unclaimed') returning id into o;
  insert into public.league_programs(organization_id,name,legacy_league_id) values(o,le.name,le.id) returning id into pr;
  update public.leagues set organization_id=o,program_id=pr where id=le.id;
  insert into public.organization_audit(organization_id,action) values(o,'legacy.owner_review_required');
 end loop;
end $$;
alter table public.leagues alter column organization_id set not null;
alter table public.leagues alter column program_id set not null;

create function private.organization_owner_invariant() returns trigger language plpgsql security definer set search_path='' as $$
declare o uuid:=coalesce(new.organization_id,old.organization_id);begin
 if exists(select 1 from public.organizations where id=o and status='active') and not exists(select 1 from public.organization_members where organization_id=o and role='owner') then raise exception 'An active organization must retain an owner' using errcode='23514';end if;
 return null;
end $$;
create constraint trigger organization_owner_required after insert or update or delete on public.organization_members deferrable initially deferred for each row execute function private.organization_owner_invariant();
revoke all on function private.organization_owner_invariant() from public,anon,authenticated;

create function private.personal_organization(actor uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o uuid;begin
 if actor is null or actor is distinct from auth.uid() then raise exception 'Authentication required' using errcode='42501';end if;
 -- Same-user concurrent first league creation must not create duplicate orgs.
 perform 1 from auth.users where id=actor for no key update;
 select id into o from public.organizations where personal_owner_id=actor;
 if o is null then
  insert into public.organizations(name,personal_owner_id) values('My league organization',actor) returning id into o;
  insert into public.organization_members values(o,actor,'owner',now());
  insert into public.organization_audit(organization_id,actor_id,action) values(o,actor,'organization.created');
 end if;
 return o;
end $$;
revoke all on function private.personal_organization(uuid) from public,anon,authenticated;
create function private.organization_limits(o uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('programs',greatest((p.limits->>'programs')::int,coalesce((o.capacity_floor->>'programs')::int,0)),
 'seasons',greatest((p.limits->>'seasons')::int,coalesce((o.capacity_floor->>'seasons')::int,0)),
 'members',greatest((p.limits->>'members')::int,coalesce((o.capacity_floor->>'members')::int,0))) from public.organizations o join public.saas_plans p on p.code=o.effective_plan where o.id=$1
$$;
create function private.organization_usage(o uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('programs',(select count(*) from public.league_programs where organization_id=o),'seasons',(select count(*) from public.leagues where organization_id=o),
 'members',(select count(*) from public.organization_members where organization_id=o),'pending_invitations',(select count(*) from public.organization_invitations where organization_id=o and revoked_at is null and accepted_at is null and expires_at>now()))
$$;
revoke all on function private.organization_limits(uuid),private.organization_usage(uuid) from public,anon,authenticated;

create function private.assign_league_organization() returns trigger language plpgsql security definer set search_path='' as $$
declare o uuid;pr uuid;cap jsonb;begin
 if tg_op='UPDATE' then
  if new.organization_id is distinct from old.organization_id or new.program_id is distinct from old.program_id then raise exception 'League organization is immutable; an approved transfer workflow is required' using errcode='42501';end if;
  return new;
 end if;
 if auth.uid() is null then raise exception 'Authenticated league creation required' using errcode='42501';end if;
 o:=coalesce(new.organization_id,nullif(current_setting('courtside.organization',true),'')::uuid);
 if o is null then o:=private.personal_organization(auth.uid());end if;
 perform 1 from public.organizations where id=o for update;
 if private.organization_role(o) not in ('owner','admin') or private.organization_role(o) is null or not exists(select 1 from public.organizations where id=o and status='active') then raise exception 'Organization manager required' using errcode='42501';end if;
 cap:=private.organization_limits(o);
 if (select count(*) from public.leagues where organization_id=o)>=(cap->>'seasons')::int then raise exception 'Season limit reached. Existing seasons remain available; review your plan.' using errcode='PT409';end if;
 pr:=coalesce(new.program_id,nullif(current_setting('courtside.program',true),'')::uuid);
 if pr is null then
  if (select count(*) from public.league_programs where organization_id=o)>=(cap->>'programs')::int then raise exception 'League limit reached. Existing leagues remain available; review your plan.' using errcode='PT409';end if;
  insert into public.league_programs(organization_id,name) values(o,new.name) returning id into pr;
 elsif not exists(select 1 from public.league_programs where id=pr and organization_id=o) then raise exception 'League program access denied' using errcode='42501';end if;
 new.organization_id:=o;new.program_id:=pr;return new;
end $$;
create trigger league_organization_guard before insert or update on public.leagues for each row execute function private.assign_league_organization();
revoke all on function private.assign_league_organization() from public,anon,authenticated;

-- Preserve existing commands, roles, atomic league writes and approval checks.
alter function private.command(uuid,text,jsonb) rename to sport_command;
revoke all on function private.sport_command(uuid,text,jsonb) from public,anon,authenticated;
create function private.command(l uuid,action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if action='create_league' then
  if p ? 'organization_id' then perform set_config('courtside.organization',coalesce(p->>'organization_id',''),true);end if;
  if p ? 'program_id' then perform set_config('courtside.program',coalesce(p->>'program_id',''),true);end if;
 end if;
 return private.sport_command(l,action,p);
end $$;
revoke all on function private.command(uuid,text,jsonb) from public,anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;
alter function private.organizer_command(text,jsonb) rename to sport_organizer_command;
revoke all on function private.sport_organizer_command(text,jsonb) from public,anon,authenticated;
create function private.organizer_command(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.organizer_drafts;le public.leagues;res jsonb;o uuid;begin
 if action='finish' then
  select * into d from public.organizer_drafts where id=(p->>'id')::uuid and owner_id=auth.uid();
  if d.id is null then raise exception 'Draft access denied' using errcode='42501';end if;
  if d.league_id is null then
   o:=coalesce(nullif(d.data->>'organization_id','')::uuid,private.personal_organization(auth.uid()));
   perform 1 from public.organizations where id=o for update;
   perform set_config('courtside.organization',o::text,true);perform set_config('courtside.program',coalesce(d.data->>'program_id',''),true);
  end if;
 end if;
 res:=private.sport_organizer_command(action,p);
 if action in ('copy','begin_edit') then
  select * into le from public.leagues where id=(p->>'league_id')::uuid;
  update public.organizer_drafts set data=data||jsonb_build_object('organization_id',le.organization_id,'program_id',le.program_id) where id=(res->>'id')::uuid returning * into d;
  return to_jsonb(d)-'owner_id';
 end if;return res;
end $$;
revoke all on function private.organizer_command(text,jsonb) from public,anon;
grant execute on function private.organizer_command(text,jsonb) to authenticated;
alter function private.snapshot(uuid,boolean) rename to sport_snapshot;
revoke all on function private.sport_snapshot(uuid,boolean) from public,anon,authenticated;
create function private.snapshot(l uuid,public_only boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare res jsonb;begin
 res:=private.sport_snapshot(l,public_only);
 if public_only then return res;end if;
 return jsonb_set(res,'{league}',res->'league'||(select jsonb_build_object('organization_id',organization_id,'program_id',program_id) from public.leagues where id=l));
end $$;
revoke all on function private.snapshot(uuid,boolean) from public;
grant execute on function private.snapshot(uuid,boolean) to anon,authenticated;

create function private.organization_snapshot(o uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r text:=private.organization_role(o);res jsonb;begin
 if auth.uid() is null or r is null then raise exception 'Organization access denied' using errcode='42501';end if;
 select jsonb_build_object('id',id,'name',name,'role',r,'revision',revision,'plan',effective_plan,'limits',private.organization_limits(o),'usage',private.organization_usage(o),
 'programs',(select coalesce(jsonb_agg(jsonb_build_object('id',pr.id,'name',pr.name,'seasons',(select coalesce(jsonb_agg(jsonb_build_object('id',le.id,'name',le.name,'season',le.season_name,'sport',le.sport,'role',private.member_role(le.id)) order by le.created_at desc),'[]') from public.leagues le where le.program_id=pr.id and le.organization_id=o)) order by pr.created_at),'[]') from public.league_programs pr where pr.organization_id=o),
 'members',case when r in ('owner','admin') then (select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'role',role)),'[]') from public.organization_members where organization_id=o) else '[]'::jsonb end,
 'invitations',case when r in ('owner','admin') then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'expires_at',expires_at,'revoked_at',revoked_at,'accepted_at',accepted_at) order by expires_at desc),'[]') from public.organization_invitations where organization_id=o) else '[]'::jsonb end) into res from public.organizations where id=o;
 return res;
end $$;
revoke all on function private.organization_snapshot(uuid) from public,anon,authenticated;

create function private.organization_command(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();o uuid;r text;target uuid;target_role text;inv public.organization_invitations;cap jsonb;pr uuid;g record;le uuid;previous text;begin
 if actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 if action='list' then return jsonb_build_object('organizations',(select coalesce(jsonb_agg(private.organization_snapshot(id) order by created_at),'[]') from public.organizations where private.organization_role(id) is not null),'plans',(select jsonb_agg(to_jsonb(sp) order by code) from public.saas_plans sp),'platform_admin',private.platform_admin());end if;
 if action='personal' then o:=private.personal_organization(actor);return private.organization_snapshot(o);end if;
 if action='create' then
  if length(trim(coalesce(p->>'name',''))) not between 2 and 100 then raise exception 'Organization name must contain 2–100 characters';end if;
  perform 1 from auth.users where id=actor for no key update;
  if (select count(*) from public.organization_members where user_id=actor and role='owner')>=20 then raise exception 'Organization creation limit reached' using errcode='PT409';end if;
  insert into public.organizations(name) values(trim(p->>'name')) returning id into o;insert into public.organization_members values(o,actor,'owner',now());
  insert into public.organization_audit(organization_id,actor_id,action) values(o,actor,'organization.created');return private.organization_snapshot(o);
 end if;
 if action='accept' then select organization_id into o from public.organization_invitations where token_hash=p->>'hash';else o:=(p->>'organization_id')::uuid;end if;
 perform 1 from public.organizations where id=o for update;
 if action='accept' then
  select * into inv from public.organization_invitations where token_hash=p->>'hash' for update;
  if inv.id is null or inv.revoked_at is not null or inv.expires_at<=now() or private.organization_role(o)='owner' then raise exception 'Invitation unavailable' using errcode='42501';end if;
  if inv.accepted_at is not null then
   if inv.accepted_by=actor and private.organization_role(o) is not null then return jsonb_build_object('organization_id',o,'duplicate',true);end if;
   raise exception 'Invitation unavailable' using errcode='42501';end if;
  if not exists(select 1 from public.organization_members where organization_id=o and user_id=inv.created_by and (role='owner' or(role='admin' and inv.role='member'))) or not exists(select 1 from auth.users where id=actor and lower(email)=inv.email and email_confirmed_at is not null) then raise exception 'Sign in with the invited confirmed account' using errcode='42501';end if;
  if private.organization_role(o) is null and (select count(*) from public.organization_members where organization_id=o)>=(private.organization_limits(o)->>'members')::int then raise exception 'Member limit reached; ask the owner to review the plan' using errcode='PT409';end if;
  insert into public.organization_members values(o,actor,inv.role,now()) on conflict do nothing;
  update public.organization_invitations set accepted_at=now(),accepted_by=actor where id=inv.id;
  insert into public.organization_audit(organization_id,actor_id,action,detail) values(o,actor,'invitation.accepted',jsonb_build_object('invitation_id',inv.id));return jsonb_build_object('organization_id',o);
 end if;
 r:=private.organization_role(o);if r is null then raise exception 'Organization access denied' using errcode='42501';end if;
 if action='get' then return private.organization_snapshot(o);end if;
 if r not in ('owner','admin') then raise exception 'Organization manager required' using errcode='42501';end if;
 case action
 when 'rename' then
  if (p->>'revision')::int is distinct from (select revision from public.organizations where id=o) then raise exception 'Organization changed. Reload and review.' using errcode='PT409';end if;
  if length(trim(coalesce(p->>'name',''))) not between 2 and 100 then raise exception 'Invalid organization name';end if;
  update public.organizations set name=trim(p->>'name'),revision=revision+1 where id=o;
 when 'create_program' then
  if (select count(*) from public.league_programs where organization_id=o)>=(private.organization_limits(o)->>'programs')::int then raise exception 'League limit reached; review your plan' using errcode='PT409';end if;
  insert into public.league_programs(organization_id,name) values(o,trim(p->>'name')) returning id into pr;
 when 'invite' then
  if p->>'role' not in ('admin','member') or(r='admin' and p->>'role'<>'member') then raise exception 'Only the owner can appoint organization administrators' using errcode='42501';end if;
  if coalesce(p->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p->>'email')>150 or coalesce(p->>'hash','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invitation';end if;
  if exists(select 1 from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=o and lower(u.email)=lower(p->>'email')) then raise exception 'Account is already an organization member' using errcode='PT409';end if;
  update public.organization_invitations set revoked_at=now() where organization_id=o and email=lower(p->>'email') and accepted_at is null and revoked_at is null;
  cap:=private.organization_limits(o);
  if ((private.organization_usage(o)->>'members')::int+(private.organization_usage(o)->>'pending_invitations')::int)>=(cap->>'members')::int then raise exception 'Member and pending-invitation limit reached' using errcode='PT409';end if;
  insert into public.organization_invitations(organization_id,email,role,token_hash,created_by) values(o,lower(p->>'email'),p->>'role',p->>'hash',actor) returning * into inv;
 when 'revoke_invite' then
  update public.organization_invitations set revoked_at=now() where id=(p->>'invitation_id')::uuid and organization_id=o and accepted_at is null and (r='owner' or role='member');
 when 'set_role','remove_member','transfer_owner' then
  target:=(p->>'user_id')::uuid;select role into target_role from public.organization_members where organization_id=o and user_id=target;
  if target_role is null or target=actor or (r='admin' and target_role<>'member') or target_role='owner' then raise exception 'Owner authorization required; the last owner cannot be removed' using errcode='42501';end if;
  if action='transfer_owner' then
   if r<>'owner' then raise exception 'Owner required' using errcode='42501';end if;
   update public.organization_members set role='admin' where organization_id=o and user_id=actor;
   update public.organization_members set role='owner' where organization_id=o and user_id=target;
  elsif action='set_role' then
   if r<>'owner' or p->>'role' not in ('admin','member') then raise exception 'Owner required' using errcode='42501';end if;
   update public.organization_members set role=p->>'role' where organization_id=o and user_id=target;
  else
   for g in select * from public.organization_league_grants where organization_id=o and user_id=target order by league_id loop
    perform 1 from public.leagues where id=g.league_id for update;
    if g.role='admin' and g.previous_role is distinct from 'admin' and (select count(*) from public.memberships where league_id=g.league_id and role='admin')<=1 then raise exception 'Assign another league administrator before removing this member' using errcode='PT409';end if;
    if g.previous_role is null then delete from public.memberships where league_id=g.league_id and user_id=target and role=g.role;
    else update public.memberships set role=g.previous_role where league_id=g.league_id and user_id=target and role=g.role;end if;
    insert into public.audit_events(league_id,actor_id,action,detail) values(g.league_id,actor,'organization.league_grant_revoked',jsonb_build_object('user_id',target,'restored_role',g.previous_role));
   end loop;
   delete from public.organization_league_grants where organization_id=o and user_id=target;
   delete from public.organization_members where organization_id=o and user_id=target;
  end if;
 when 'grant_league_role' then
  le:=(p->>'league_id')::uuid;target:=(p->>'user_id')::uuid;
  perform 1 from public.leagues where id=le and organization_id=o for update;
  if not found or private.member_role(le) is distinct from 'admin' or not exists(select 1 from public.organization_members where organization_id=o and user_id=target) or p->>'role' not in ('admin','coach','scorekeeper','referee') then raise exception 'Current league administrator and organization membership required' using errcode='42501';end if;
  select role into previous from public.memberships where league_id=le and user_id=target;
  if previous is distinct from p->>'role' then
   if previous='admin' and (select count(*) from public.memberships where league_id=le and role='admin')<=1 then raise exception 'Keep a league administrator' using errcode='PT409';end if;
   insert into public.organization_league_grants values(o,le,target,p->>'role',previous) on conflict(league_id,user_id) do update set role=excluded.role;
   insert into public.memberships values(le,target,p->>'role') on conflict(league_id,user_id) do update set role=excluded.role;
   insert into public.audit_events(league_id,actor_id,action,detail) values(le,actor,'organization.league_role_granted',jsonb_build_object('user_id',target,'role',p->>'role'));
  end if;
 else raise exception 'Unknown organization action';end case;
 insert into public.organization_audit(organization_id,actor_id,action,detail) values(o,actor,'organization.'||action,jsonb_build_object('user_id',target,'program_id',pr,'invitation_id',inv.id,'league_id',le));
 return jsonb_build_object('ok',true,'organization_id',o,'program_id',pr,'invitation_id',inv.id);
end $$;
revoke all on function private.organization_command(text,jsonb) from public,anon;
grant execute on function private.organization_command(text,jsonb) to authenticated;
create function public.organization_command(p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.organization_command(p_action,p_payload)$$;
revoke all on function public.organization_command(text,jsonb) from public,anon;
grant execute on function public.organization_command(text,jsonb) to authenticated;
create function public.saas_capabilities() returns jsonb language sql immutable security invoker set search_path='' as $$select '{"version":1}'::jsonb$$;
revoke all on function public.saas_capabilities() from public,anon;
grant execute on function public.saas_capabilities() to authenticated;
