-- REVIEW CANDIDATE ONLY. Not an applied migration. Generate a migration after owner approval.
-- Additive tables/functions. Existing commands, public reference and provider evidence are untouched.
create table public.organizer_drafts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 league_id uuid references public.leagues(id), source_league_id uuid references public.leagues(id), revision int not null default 1, base_revision int not null default 0,
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=64000),
 status text not null default 'draft' check(status in ('draft','completed')), updated_at timestamptz not null default now()
);
create index organizer_drafts_owner on public.organizer_drafts(owner_id,updated_at desc);
create table public.league_launch (
 league_id uuid primary key references public.leagues(id), config jsonb not null, setup_revision int not null default 1,
 previous_league_id uuid references public.leagues(id),
 site_draft jsonb not null default '{"theme":"courtside","colour":"#164d3b","accent":"#d5f58c","headline":"A place to play. A season to remember.","about":"","rules":"","contactEmail":"","logo":""}',
 site_revision int not null default 0, published_revision int, site_published boolean not null default false,
 preferred_domain text, updated_at timestamptz not null default now()
);
create table public.launch_site_versions (
 league_id uuid not null references public.leagues(id), revision int not null, config jsonb not null,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),primary key(league_id,revision)
);
create table public.member_invitations (
 id uuid primary key default gen_random_uuid(), league_id uuid not null references public.leagues(id),
 email text not null check(length(email)<=150), role text not null check(role in ('coach','scorekeeper','referee')),
 team_id uuid, previous_coach_id uuid, token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 created_by uuid not null references auth.users(id), expires_at timestamptz not null default now()+interval '72 hours',
 revoked_at timestamptz, accepted_at timestamptz, accepted_by uuid references auth.users(id),
 foreign key(league_id,team_id) references public.teams(league_id,id)
);
create index member_invites_league on public.member_invitations(league_id,expires_at);
alter table public.organizer_drafts enable row level security;
alter table public.league_launch enable row level security;
alter table public.launch_site_versions enable row level security;
alter table public.member_invitations enable row level security;
revoke all on public.organizer_drafts,public.league_launch,public.launch_site_versions,public.member_invitations from public,anon,authenticated;
grant select on public.organizer_drafts,public.league_launch,public.launch_site_versions,public.member_invitations to authenticated;
create policy owner_read on public.organizer_drafts for select to authenticated using(owner_id=(select auth.uid()) and (league_id is null or private.member_role(league_id)='admin'));
create policy admin_read on public.league_launch for select to authenticated using(private.member_role(league_id)='admin');
create policy admin_read on public.launch_site_versions for select to authenticated using(private.member_role(league_id)='admin');
-- Hashes never leave the guarded function; direct invitation reads are denied.
create policy no_direct_invites on public.member_invitations for select to authenticated using(false);

create function private.validate_organizer_setup(p jsonb,complete boolean) returns void language plpgsql set search_path='' as $$
declare k text;d jsonb;c jsonb;v date;begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>64000 then raise exception 'Invalid setup';end if;
 foreach k in array array['name','kind','country','region','city','area','timezone','adminContact','season','start','end','opening','cutoff','registrationDeadline','rosterDeadline','verificationDeadline'] loop
  if jsonb_typeof(p->k) is distinct from 'string' or length(p->>k)>250 then raise exception 'Invalid setup field: %',k;end if;
 end loop;
 if length(p->>'name')>100 or length(p->>'season')>80 or length(p->>'adminContact')>150 or (p->>'adminContact'<>'' and p->>'adminContact' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Invalid name or private contact';end if;
 if p->>'kind' not in ('competitive','recreational','tournament','other') or not exists(select 1 from pg_catalog.pg_timezone_names where name=p->>'timezone') then raise exception 'Invalid league type or timezone';end if;
 foreach k in array array['expectedTeams','minRoster','maxRoster','gamesPerTeam','retentionDays'] loop
  if jsonb_typeof(p->k) is distinct from 'number' or p->>k !~ '^[0-9]+$' then raise exception 'Invalid numeric setting';end if;
 end loop;
 if (p->>'expectedTeams')::int not between 2 and 1000 or (p->>'minRoster')::int not between 1 and 20 or (p->>'maxRoster')::int not between 1 and 30 or (p->>'gamesPerTeam')::int not between 1 and 40 or (p->>'retentionDays')::int not between 1 and 30 then raise exception 'Setting outside supported bounds';end if;
 if jsonb_typeof(p->'allowedDocumentTypes') is distinct from 'array' or jsonb_array_length(p->'allowedDocumentTypes') not between 1 and 3 or not (p->'allowedDocumentTypes'<@'["birth_certificate","passport","government_id"]'::jsonb) then raise exception 'Invalid accepted document types';end if;
 foreach k in array array['start','end','opening','cutoff','registrationDeadline','rosterDeadline','verificationDeadline'] loop
  if p->>k<>'' then if p->>k !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date';end if;v:=(p->>k)::date;end if;
  if complete and p->>k='' then raise exception 'Complete the season dates and deadlines';end if;
 end loop;
 if jsonb_typeof(p->'divisions') is distinct from 'array' or jsonb_array_length(p->'divisions') not between 1 and 24 or jsonb_typeof(p->'courts') is distinct from 'array' or jsonb_array_length(p->'courts')>30 then raise exception 'Invalid divisions or courts';end if;
 for d in select value from jsonb_array_elements(p->'divisions') loop
  if jsonb_typeof(d->'name') is distinct from 'string' or length(d->>'name')>100 or jsonb_typeof(d->'age_category') is distinct from 'string' or length(d->>'age_category')>30 or coalesce(d->>'tier','') !~ '^[1-3]$' or coalesce(d->>'min_age','') !~ '^\d{1,2}$' or coalesce(d->>'max_age','') !~ '^\d{1,2}$' then raise exception 'Invalid division';end if;
  if (d->>'min_age')::int not between 0 and 20 or (d->>'max_age')::int not between 5 and 20 or (d->>'min_age')::int>(d->>'max_age')::int then raise exception 'Invalid age range';end if;
  if complete and (length(trim(d->>'name'))<2 or length(trim(d->>'age_category'))<2) then raise exception 'Name the divisions and age categories';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p->'divisions') as elements(value) group by lower(trim(elements.value->>'age_category')),elements.value->>'tier' having count(*)>1) then raise exception 'Duplicate age category/tier';end if;
 for c in select value from jsonb_array_elements(p->'courts') loop
  if jsonb_typeof(c->'name') is distinct from 'string' or length(c->>'name')>100 or jsonb_typeof(c->'venue') is distinct from 'string' or length(c->>'venue')>180 then raise exception 'Invalid court';end if;
  if complete and (length(trim(c->>'name'))<1 or length(trim(c->>'venue'))<1) then raise exception 'Name each court and its venue/address';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p->'courts') as elements(value) group by lower(trim(elements.value->>'name')) having count(*)>1) then raise exception 'Duplicate court name';end if;
 if complete then
  if length(trim(p->>'name'))<2 or length(trim(p->>'season'))<2 or length(trim(p->>'city'))<1 or length(trim(p->>'country'))<1 then raise exception 'Complete league name, season and location';end if;
  if p->>'end'<p->>'start' or p->>'opening'<p->>'start' or p->>'opening'>p->>'end' or p->>'registrationDeadline'>p->>'rosterDeadline' or p->>'rosterDeadline'>p->>'verificationDeadline' or p->>'verificationDeadline'>p->>'opening' or (p->>'minRoster')::int>(p->>'maxRoster')::int then raise exception 'Check season dates, ordered deadlines and roster bounds';end if;
 end if;
end $$;
revoke all on function private.validate_organizer_setup(jsonb,boolean) from public,anon,authenticated;

create function private.launch_site_data(l uuid,c jsonb) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('config',c,
 'league',jsonb_build_object('id',le.id,'name',le.name,'slug',le.slug,'season',le.season_name,'timezone',le.timezone,'city',la.config->>'city','region',la.config->>'region','country',la.config->>'country','start',la.config->>'start','end',la.config->>'end','cutoff',le.cutoff_date,'registration',ps.registration_status,'registrationDeadline',ps.questionnaire_deadline,'minRoster',ps.min_roster,'maxRoster',ps.max_roster),
 'divisions',(select coalesce(jsonb_agg(jsonb_build_object('name',d.name,'age_category',d.age_category,'tier',d.tier,'min_age',d.min_age,'max_age',d.max_age) order by d.age_category,d.tier),'[]') from public.divisions d where d.league_id=l),
 'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'division_id',t.division_id) order by t.name),'[]') from public.teams t where t.league_id=l and t.status='approved'),
 'venues',(select coalesce(jsonb_agg(jsonb_build_object('name',ct.name,'venue',ct.venue) order by ct.name),'[]') from public.courts ct where ct.league_id=l),
 'fixtures',(select coalesce(jsonb_agg(jsonb_build_object('home',h.name,'away',a.name,'court',ct.name,'venue',ct.venue,'starts_at',f.starts_at,'home_score',g.home_score,'away_score',g.away_score,'status',g.status) order by f.starts_at),'[]') from public.fixtures f join public.schedule_versions sv on sv.id=f.version_id and sv.status='published' join public.games g on g.id=f.game_id join public.teams h on h.id=g.home_team_id and h.status='approved' join public.teams a on a.id=g.away_team_id and a.status='approved' join public.courts ct on ct.id=f.court_id where f.league_id=l),
 'standings',(select coalesce(jsonb_agg(to_jsonb(st) order by st.points desc,st.differential desc,st.name),'[]') from (
 select t.name,count(g.id)::int played,count(g.id) filter(where (g.home_team_id=t.id and g.home_score>g.away_score) or (g.away_team_id=t.id and g.away_score>g.home_score))::int wins,
 count(g.id) filter(where (g.home_team_id=t.id and g.home_score<g.away_score) or (g.away_team_id=t.id and g.away_score<g.home_score))::int losses,
 count(g.id) filter(where g.home_score=g.away_score)::int draws,
 (2*count(g.id) filter(where (g.home_team_id=t.id and g.home_score>g.away_score) or (g.away_team_id=t.id and g.away_score>g.home_score))+count(g.id) filter(where g.home_score=g.away_score))::int points,
 coalesce(sum(case when g.home_team_id=t.id then g.home_score-g.away_score else g.away_score-g.home_score end),0)::int differential
 from public.teams t left join public.games g on g.league_id=l and g.status='confirmed' and t.id in(g.home_team_id,g.away_team_id) where t.league_id=l and t.status='approved' group by t.id,t.name) st))
 from public.leagues le join public.league_launch la on la.league_id=le.id join public.preseason_settings ps on ps.league_id=le.id where le.id=l
$$;
revoke all on function private.launch_site_data(uuid,jsonb) from public,anon,authenticated;

create function private.organizer_command(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();l uuid;d public.organizer_drafts;la public.league_launch;i public.member_invitations;item jsonb;cfg jsonb;res jsonb;le public.leagues;uid uuid;role_now text;email_now text;rev int;begin
 if actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 if action='list' then return jsonb_build_object(
 'drafts',(select coalesce(jsonb_agg(jsonb_build_object('id',od.id,'revision',od.revision,'base_revision',od.base_revision,'data',od.data,'league_id',od.league_id,'updated_at',od.updated_at,'status',od.status) order by od.updated_at desc),'[]') from public.organizer_drafts od where od.owner_id=actor and od.status='draft' and (od.league_id is null or private.member_role(od.league_id)='admin')),
 'sources',(select coalesce(jsonb_agg(jsonb_build_object('id',ownleague.id,'name',ownleague.name,'season',ownleague.season_name) order by ownleague.created_at desc),'[]') from public.leagues ownleague join public.memberships m on m.league_id=ownleague.id where m.user_id=actor and m.role='admin'));
 elsif action='save_draft' then
  perform private.validate_organizer_setup(p->'data',false);
  l:=nullif(p->>'league_id','')::uuid;
  if l is not null then perform 1 from public.leagues where leagues.id=l for update;if private.member_role(l) is distinct from 'admin' then raise exception 'Administrator required' using errcode='42501';end if;end if;
  if nullif(p->>'id','') is null then
   if l is not null and (p->>'base_revision')::int is distinct from coalesce((select setup_revision from public.league_launch where league_id=l),0) then raise exception 'Setup changed. Reload before editing.' using errcode='40001';end if;
   insert into public.organizer_drafts(owner_id,league_id,data,base_revision) values(actor,l,p->'data',coalesce((p->>'base_revision')::int,0)) returning * into d;
  else
   select * into d from public.organizer_drafts where organizer_drafts.id=(p->>'id')::uuid and owner_id=actor for update;
   if d.id is null or d.status<>'draft' then raise exception 'Draft access denied' using errcode='42501';end if;
   if d.league_id is distinct from l or d.revision is distinct from (p->>'revision')::int then raise exception 'Draft changed. Reload before saving.' using errcode='40001';end if;
   update public.organizer_drafts set data=p->'data',revision=revision+1,updated_at=now() where organizer_drafts.id=d.id returning * into d;
  end if;return to_jsonb(d)-'owner_id';
 elsif action='accept_invite' then
  -- Acquire league first, then invitation, matching issuer/revoker lock order.
  select league_id into l from public.member_invitations where token_hash=p->>'hash';
  perform 1 from public.leagues where leagues.id=l for update;
  select * into i from public.member_invitations where token_hash=p->>'hash' for update;
  if i.id is null or i.revoked_at is not null or i.expires_at<=now() or i.accepted_at is not null or private.member_role_for_user(i.league_id,i.created_by) is distinct from 'admin' then raise exception 'Invitation unavailable' using errcode='42501';end if;
  select lower(email) into email_now from auth.users where users.id=actor and email_confirmed_at is not null;
  if email_now is null or email_now<>i.email then raise exception 'Sign in with the invited, confirmed email account' using errcode='42501';end if;
  role_now:=private.member_role(l);
  if role_now is not null and role_now not in (i.role,'admin') then raise exception 'An administrator must review your existing role';end if;
  if i.team_id is not null and not exists(select 1 from public.teams where teams.id=i.team_id and league_id=l and coach_id is not distinct from i.previous_coach_id) then raise exception 'Team assignment changed. Ask for a fresh invitation.';end if;
  insert into public.memberships(league_id,user_id,role) values(l,actor,i.role) on conflict(league_id,user_id) do nothing;
  if i.team_id is not null then
   update public.teams set coach_id=actor,coach_email=email_now,phone=null,sms_consent=false where teams.id=i.team_id and league_id=l;
   update public.notifications set status='suppressed',last_error='Coach reassigned' where team_id=i.team_id and channel in ('email','sms') and status in ('pending','failed');
  end if;
  update public.member_invitations set accepted_at=now(),accepted_by=actor where member_invitations.id=i.id;
  insert into public.audit_events(league_id,actor_id,action,detail) values(l,actor,'member.invitation_accepted',jsonb_build_object('invitation_id',i.id,'team_id',i.team_id));
  return jsonb_build_object('league_id',l);
 elsif action='finish' then
  select * into d from public.organizer_drafts where organizer_drafts.id=(p->>'id')::uuid and owner_id=actor;
  if d.id is null then raise exception 'Draft access denied' using errcode='42501';end if;
  l:=d.league_id;if l is not null then perform 1 from public.leagues where leagues.id=l for update;end if;
  if l is not null and private.member_role(l) is distinct from 'admin' then raise exception 'Administrator required' using errcode='42501';end if;
  select * into d from public.organizer_drafts where organizer_drafts.id=d.id for update;
  if d.status='completed' then return jsonb_build_object('league_id',d.league_id);end if;
  if d.revision is distinct from (p->>'revision')::int then raise exception 'Draft changed. Reload before finishing.' using errcode='40001';end if;
  cfg:=d.data;perform private.validate_organizer_setup(cfg,true);
  if l is not null and d.base_revision is distinct from coalesce((select setup_revision from public.league_launch where league_id=l),0) then raise exception 'Setup changed. Reload before finishing.' using errcode='40001';end if;
  if l is null then
   res:=private.command(null,'create_league',jsonb_build_object('name',cfg->>'name','season',cfg->>'season','cutoff',cfg->>'cutoff'));l:=(res->>'id')::uuid;
   delete from public.divisions where league_id=l;
  elsif private.member_role(l) is distinct from 'admin' then raise exception 'Administrator required' using errcode='42501';end if;
  -- Preserve team/division identities and all history when editing. Removing categories uses existing review tools.
  if exists(select 1 from public.divisions dv where dv.league_id=l and not exists(select 1 from jsonb_array_elements(cfg->'divisions') x where x->>'age_category'=dv.age_category and (x->>'tier')::int=dv.tier)) then raise exception 'Keep existing divisions; manage structural changes in Preseason';end if;
  select * into le from public.leagues where leagues.id=l;
  if exists(select 1 from public.teams where league_id=l) and le.timezone<>cfg->>'timezone' then raise exception 'Keep the existing timezone once teams register';end if;
  update public.leagues set name=trim(cfg->>'name'),timezone=cfg->>'timezone' where leagues.id=l;
  for item in select value from jsonb_array_elements(cfg->'divisions') loop
   if not exists(select 1 from public.divisions dv where dv.league_id=l and dv.name=item->>'name' and dv.age_category=item->>'age_category' and dv.tier=(item->>'tier')::int and dv.min_age=(item->>'min_age')::int and dv.max_age=(item->>'max_age')::int) then perform private.preseason_command(l,'configure_division',item);end if;
  end loop;
  perform private.preseason_command(l,'configure',jsonb_build_object('enabled',true,'season_name',cfg->>'season','season_start',cfg->>'opening','cutoff_date',cfg->>'cutoff','registration_status',(select registration_status from public.preseason_settings where league_id=l),
   'questionnaire_deadline',((cfg->>'registrationDeadline')::date+time '23:59:59') at time zone (cfg->>'timezone'),
   'roster_deadline',((cfg->>'rosterDeadline')::date+time '23:59:59') at time zone (cfg->>'timezone'),
   'verification_deadline',((cfg->>'verificationDeadline')::date+time '23:59:59') at time zone (cfg->>'timezone'),
   'min_roster',(cfg->>'minRoster')::int,'max_roster',(cfg->>'maxRoster')::int,'document_retention_days',(cfg->>'retentionDays')::int,'allowed_document_types',cfg->'allowedDocumentTypes'));
  for item in select value from jsonb_array_elements(cfg->'courts') loop
   if not exists(select 1 from public.courts where league_id=l and name=item->>'name' and venue=item->>'venue') then
    if exists(select 1 from public.courts where league_id=l and name=item->>'name') then raise exception 'An existing court name has a different venue. Keep it or add a new court.';end if;
    perform private.command(l,'add_court',item);
   end if;
  end loop;
  insert into public.league_launch(league_id,config,previous_league_id) values(l,cfg,d.source_league_id) on conflict(league_id) do update set config=excluded.config,setup_revision=public.league_launch.setup_revision+1,updated_at=now();
  update public.organizer_drafts set status='completed',league_id=l,revision=revision+1,updated_at=now() where organizer_drafts.id=d.id;
  insert into public.audit_events(league_id,actor_id,action) values(l,actor,'organizer.setup_finished');return jsonb_build_object('league_id',l);
 end if;
 l:=(p->>'league_id')::uuid;
 perform 1 from public.leagues where leagues.id=l for update;
 if private.member_role(l) is distinct from 'admin' then raise exception 'Administrator required' using errcode='42501';end if;
 select * into la from public.league_launch where league_id=l;
 if action='workspace' then return jsonb_build_object('setup',la.config,'setup_revision',la.setup_revision,'site',la.site_draft,'site_revision',la.site_revision,'site_published',la.site_published and (select is_public from public.leagues where leagues.id=l),'published_revision',la.published_revision,'preferred_domain',la.preferred_domain,
  'invites',(select coalesce(jsonb_agg(jsonb_build_object('id',mi.id,'email',mi.email,'role',mi.role,'team_id',mi.team_id,'expires_at',mi.expires_at,'revoked_at',mi.revoked_at,'accepted_at',mi.accepted_at) order by mi.expires_at desc),'[]') from public.member_invitations mi where mi.league_id=l),
  'preseason',private.preseason_snapshot(l));
 elsif action in ('copy','begin_edit') then
  select * into le from public.leagues where leagues.id=l;
  cfg:=jsonb_build_object('name',le.name,'kind','competitive','country','Canada','region','','city','','area','','timezone',le.timezone,'expectedTeams',greatest(2,(select count(*) from public.teams where league_id=l)),'adminContact','','season','','start','','end','','opening','','cutoff','','registrationDeadline','','rosterDeadline','','verificationDeadline','','minRoster',5,'maxRoster',20,'retentionDays',14,'gamesPerTeam',1)||coalesce(la.config,'{}');
  cfg:=cfg||jsonb_build_object('season','','start','','end','','opening','','cutoff','','registrationDeadline','','rosterDeadline','','verificationDeadline','','adminContact','',
   'divisions',(select coalesce(jsonb_agg(jsonb_build_object('name',dv.name,'age_category',dv.age_category,'tier',dv.tier,'min_age',dv.min_age,'max_age',dv.max_age) order by dv.age_category,dv.tier),'[]') from public.divisions dv where dv.league_id=l),
   'courts',(select coalesce(jsonb_agg(jsonb_build_object('name',cc.name,'venue',cc.venue) order by cc.name),'[]') from public.courts cc where cc.league_id=l),
   'minRoster',(select min_roster from public.preseason_settings where league_id=l),'maxRoster',(select max_roster from public.preseason_settings where league_id=l),'allowedDocumentTypes',(select to_jsonb(allowed_document_types) from public.preseason_settings where league_id=l),'retentionDays',(select document_retention_days from public.preseason_settings where league_id=l));
  if action='begin_edit' then
   cfg:=cfg||jsonb_build_object('season',le.season_name,'start',coalesce(la.config->>'start',(select season_start::text from public.preseason_settings where league_id=l)),
    'end',coalesce(la.config->>'end',''),'opening',(select season_start::text from public.preseason_settings where league_id=l),'cutoff',le.cutoff_date::text,'adminContact',coalesce(la.config->>'adminContact',''),
    'registrationDeadline',(select (questionnaire_deadline at time zone le.timezone)::date::text from public.preseason_settings where league_id=l),
    'rosterDeadline',(select (roster_deadline at time zone le.timezone)::date::text from public.preseason_settings where league_id=l),
    'verificationDeadline',(select (verification_deadline at time zone le.timezone)::date::text from public.preseason_settings where league_id=l));
   perform private.validate_organizer_setup(cfg,false);
   insert into public.organizer_drafts(owner_id,league_id,base_revision,data) values(actor,l,coalesce(la.setup_revision,0),cfg) returning * into d;
  else
   perform private.validate_organizer_setup(cfg,false);insert into public.organizer_drafts(owner_id,source_league_id,data) values(actor,l,cfg) returning * into d;
  end if;return to_jsonb(d)-'owner_id';
 elsif action='open_registration' then
  if la.league_id is null or (la.config->>'registrationDeadline')::date<current_date then raise exception 'Complete setup and choose a future registration deadline';end if;
  update public.preseason_settings set registration_status='open' where league_id=l;
 elsif action='invite' then
  if p->>'role' not in ('coach','scorekeeper','referee') or coalesce(p->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p->>'email')>150 or coalesce(p->>'hash','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invitation';end if;
  if (select count(*) from public.member_invitations where league_id=l and revoked_at is null and accepted_at is null and expires_at>now())>=100 then raise exception 'Review existing invitations before creating more';end if;
  if nullif(p->>'team_id','') is not null then
   if p->>'role'<>'coach' then raise exception 'Only a coach can be assigned a team';end if;
   select coach_id into uid from public.teams where teams.id=(p->>'team_id')::uuid and league_id=l;if not found then raise exception 'Team access denied' using errcode='42501';end if;
  end if;
  update public.member_invitations set revoked_at=now() where league_id=l and email=lower(trim(p->>'email')) and accepted_at is null and revoked_at is null;
  insert into public.member_invitations(league_id,email,role,team_id,previous_coach_id,token_hash,created_by) values(l,lower(trim(p->>'email')),p->>'role',nullif(p->>'team_id','')::uuid,uid,p->>'hash',actor) returning * into i;
  insert into public.audit_events(league_id,actor_id,action,detail) values(l,actor,'member.invitation_created',jsonb_build_object('invitation_id',i.id,'role',i.role));return jsonb_build_object('id',i.id,'expires_at',i.expires_at);
 elsif action='revoke_invite' then
  update public.member_invitations set revoked_at=now() where member_invitations.id=(p->>'id')::uuid and league_id=l and accepted_at is null;if not found then raise exception 'Invitation unavailable';end if;
 elsif action='site_save' then
  if la.league_id is null then raise exception 'Finish league setup first';end if;
  cfg:=p->'site';
  if jsonb_typeof(cfg) is distinct from 'object' or octet_length(cfg::text)>370000 or cfg->>'theme' not in ('courtside','community','arena') or coalesce(cfg->>'colour','') !~ '^#[a-fA-F0-9]{6}$' or coalesce(cfg->>'accent','') !~ '^#[a-fA-F0-9]{6}$' then raise exception 'Invalid website design';end if;
  foreach email_now in array array['headline','about','rules','contactEmail','logo'] loop if jsonb_typeof(cfg->email_now) is distinct from 'string' then raise exception 'Invalid public copy';end if;end loop;
  if length(cfg->>'headline')>120 or length(cfg->>'about')>1800 or length(cfg->>'rules')>1800 or length(cfg->>'contactEmail')>150 or (cfg->>'contactEmail'<>'' and cfg->>'contactEmail' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or (cfg->>'logo'<>'' and (length(cfg->>'logo')>360000 or cfg->>'logo' !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$')) then raise exception 'Public content outside supported limits';end if;
  if la.site_revision is distinct from (p->>'revision')::int then raise exception 'Website changed. Reload before saving.' using errcode='40001';end if;
  -- Whitelist fields even for callers bypassing the HTTP route.
  cfg:=jsonb_build_object('theme',cfg->>'theme','colour',cfg->>'colour','accent',cfg->>'accent','headline',cfg->>'headline','about',cfg->>'about','rules',cfg->>'rules','contactEmail',cfg->>'contactEmail','logo',cfg->>'logo');
  update public.league_launch set site_draft=cfg,site_revision=site_revision+1,updated_at=now() where league_id=l returning site_revision into rev;
  insert into public.audit_events(league_id,actor_id,action,detail) values(l,actor,'launch.site_draft_saved',jsonb_build_object('revision',rev));return jsonb_build_object('revision',rev);
 elsif action='site_publish' then
  if la.league_id is null or la.site_revision<1 or la.site_revision is distinct from (p->>'revision')::int or coalesce((p->>'approved_public')::boolean,false) is not true then raise exception 'Save, review and explicitly approve the current website draft';end if;
  insert into public.launch_site_versions(league_id,revision,config,created_by) values(l,la.site_revision,la.site_draft,actor) on conflict do nothing;
  update public.league_launch set published_revision=site_revision,site_published=true where league_id=l;update public.leagues set is_public=true where leagues.id=l;
 elsif action='site_unpublish' then
  update public.league_launch set site_published=false where league_id=l;update public.leagues set is_public=false where leagues.id=l;
 elsif action='site_preview' then return private.launch_site_data(l,la.site_draft);
 elsif action='domain_save' then
  if coalesce(p->>'domain','') !~ '^[a-z0-9][a-z0-9.-]{1,251}\.[a-z]{2,63}$' then raise exception 'Invalid preferred domain';end if;
  update public.league_launch set preferred_domain=p->>'domain' where league_id=l;
 else raise exception 'Unknown organizer action';end if;
 insert into public.audit_events(league_id,actor_id,action) values(l,actor,'launch.'||action);return jsonb_build_object('ok',true);
end $$;
-- A narrow immutable-membership helper avoids trusting JWT metadata at acceptance.
create function private.member_role_for_user(l uuid,u uuid) returns text language sql stable security definer set search_path='' as $$select role from public.memberships where league_id=l and user_id=u$$;
revoke all on function private.member_role_for_user(uuid,uuid) from public,anon,authenticated;
revoke all on function private.organizer_command(text,jsonb) from public,anon;
grant execute on function private.organizer_command(text,jsonb) to authenticated;
create function public.organizer_command(p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.organizer_command(p_action,p_payload)$$;
revoke all on function public.organizer_command(text,jsonb) from public,anon;
grant execute on function public.organizer_command(text,jsonb) to authenticated;
create function private.public_launch_site(slug_value text) returns jsonb language sql stable security definer set search_path='' as $$
 select private.launch_site_data(le.id,v.config) from public.leagues le join public.league_launch la on la.league_id=le.id and la.site_published join public.launch_site_versions v on v.league_id=le.id and v.revision=la.published_revision where le.slug=slug_value and le.is_public
$$;
revoke all on function private.public_launch_site(text) from public;
grant execute on function private.public_launch_site(text) to anon,authenticated;
create function public.public_launch_site(p_slug text) returns jsonb language sql stable security invoker set search_path='' as $$select private.public_launch_site(p_slug)$$;
revoke all on function public.public_launch_site(text) from public;
grant execute on function public.public_launch_site(text) to anon,authenticated;
