-- Courtside AI. New hackathon work: 2026-10-28. Only synthetic demo data.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;

create table public.leagues (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 100),
 slug text unique not null, season_name text not null default 'Fall 2026', cutoff_date date not null default '2026-09-01',
 timezone text not null default 'America/Toronto', owner_id uuid references auth.users(id),
 revision integer not null default 0, data_revision integer not null default 0,
 is_public boolean not null default false, is_demo boolean not null default false, created_at timestamptz not null default now()
);
create table public.memberships (
 league_id uuid not null references public.leagues(id), user_id uuid not null references auth.users(id),
 role text not null check(role in ('admin','coach','scorekeeper','referee')), primary key(league_id,user_id)
);
create index memberships_user on public.memberships(user_id,league_id);
create table public.divisions (
 id uuid primary key default gen_random_uuid(), league_id uuid not null references public.leagues(id),
 name text not null, tier int not null check(tier between 1 and 3), max_age int not null default 13 check(max_age between 5 and 20),
 unique(league_id,tier), unique(league_id,id)
);
create table public.teams (
 id uuid primary key default gen_random_uuid(), league_id uuid not null references public.leagues(id), name text not null check(length(name) between 2 and 100),
 coach_id uuid references auth.users(id), coach_email text not null, phone text, sms_consent boolean not null default false,
 division_id uuid, recommended_division int not null check(recommended_division between 1 and 3),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 assessment jsonb not null, assessment_explanation text, initial_rating int not null, rating int not null,
 created_at timestamptz not null default now(), unique(league_id,id), unique(league_id,name),
 foreign key(league_id,division_id) references public.divisions(league_id,id),
 check(not sms_consent or phone ~ '^\+[1-9][0-9]{7,14}$')
);
create index teams_league on public.teams(league_id,status);
create table public.players (
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),team_id uuid not null,
 display_name text not null,jersey text not null check(length(jersey) between 1 and 4),birth_date date not null,
 guardian_consent boolean not null default false,eligibility_status text not null default 'pending' check(eligibility_status in ('pending','verified','ineligible')),
 unique(league_id,id),unique(team_id,jersey),foreign key(league_id,team_id) references public.teams(league_id,id)
);
create index players_league on public.players(league_id,team_id);
create table public.courts (
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),name text not null,venue text not null,
 unique(league_id,id),unique(league_id,name)
);
create table public.availability (
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),court_id uuid not null,
 starts_at timestamptz not null,ends_at timestamptz not null,confirmed boolean not null default true,
 foreign key(league_id,court_id) references public.courts(league_id,id),check(ends_at>starts_at),unique(court_id,starts_at,ends_at)
);
create index availability_league on public.availability(league_id,court_id,starts_at);
create table public.games (
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),home_team_id uuid not null,away_team_id uuid not null,
 status text not null default 'scheduled' check(status in ('scheduled','confirmed','cancelled')),
 home_score int check(home_score between 0 and 300),away_score int check(away_score between 0 and 300),played_at timestamptz,
 unique(league_id,id),foreign key(league_id,home_team_id) references public.teams(league_id,id),foreign key(league_id,away_team_id) references public.teams(league_id,id),
 check(home_team_id<>away_team_id),check((status='confirmed' and home_score is not null and away_score is not null and played_at is not null) or (status<>'confirmed' and home_score is null and away_score is null))
);
create index games_league on public.games(league_id,status);
create table public.schedule_versions (
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),number int not null,
 status text not null default 'draft' check(status in ('draft','published','superseded','rejected')),
 base_revision int not null,data_revision int not null,explanation text not null,created_by uuid references auth.users(id),approved_by uuid references auth.users(id),
 created_at timestamptz not null default now(),unique(league_id,id),unique(league_id,number)
);
create unique index one_published_schedule on public.schedule_versions(league_id) where status='published';
create table public.fixtures (
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),version_id uuid not null,game_id uuid not null,court_id uuid not null,
 starts_at timestamptz not null,ends_at timestamptz not null,unique(version_id,game_id),check(ends_at>starts_at),
 foreign key(league_id,version_id) references public.schedule_versions(league_id,id),foreign key(league_id,game_id) references public.games(league_id,id),foreign key(league_id,court_id) references public.courts(league_id,id)
);
create index fixtures_league on public.fixtures(league_id,version_id,starts_at);
create table public.scoresheets (
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),game_id uuid not null,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),storage_path text not null,extraction jsonb not null,
 source text not null check(source in ('meta','manual')),status text not null default 'review' check(status in ('review','confirmed','rejected','superseded')),
 submitted_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 foreign key(league_id,game_id) references public.games(league_id,id),unique(league_id,sha256),unique(league_id,id)
);
create index scoresheets_league on public.scoresheets(league_id,status);
create table public.player_statistics (
 league_id uuid not null references public.leagues(id),game_id uuid not null,team_id uuid not null,jersey text not null,
 points int check(points between 0 and 200),rebounds int check(rebounds between 0 and 100),assists int check(assists between 0 and 100),
 primary key(game_id,team_id,jersey),foreign key(league_id,game_id) references public.games(league_id,id),foreign key(league_id,team_id) references public.teams(league_id,id)
);
create table public.division_proposals (
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),team_id uuid not null,
 from_division_id uuid not null,to_division_id uuid not null,reason text not null,evidence jsonb not null,data_revision int not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected','stale')),created_at timestamptz not null default now(),
 foreign key(league_id,team_id) references public.teams(league_id,id),foreign key(league_id,from_division_id) references public.divisions(league_id,id),foreign key(league_id,to_division_id) references public.divisions(league_id,id),check(from_division_id<>to_division_id)
);
create unique index one_pending_proposal on public.division_proposals(league_id,team_id) where status='pending';
create table public.notifications (
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),team_id uuid not null,
 channel text not null check(channel in ('email','sms')),destination text not null,subject text not null,body text not null,
 status text not null default 'pending' check(status in ('pending','processing','accepted','delivered','failed','suppressed')),
 attempts int not null default 0,next_attempt_at timestamptz not null default now(),last_error text,provider_id text,lease_id uuid,lease_until timestamptz,
 created_at timestamptz not null default now(),idempotency_key text unique not null,foreign key(league_id,team_id) references public.teams(league_id,id)
);
create index notifications_queue on public.notifications(league_id,status,next_attempt_at);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),actor_id uuid references auth.users(id),action text not null,detail jsonb not null default '{}',created_at timestamptz not null default now()
);
create index audit_league on public.audit_events(league_id,created_at desc);
create table public.workflow_runs (
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),actor_id uuid not null references auth.users(id),
 status text not null check(status in ('running','awaiting_approval','completed','failed')),steps jsonb not null default '[]',created_at timestamptz not null default now()
);

create function private.member_role(l uuid) returns text language sql stable security definer set search_path='' as $$
 select m.role from public.memberships m where m.league_id=l and m.user_id=(select auth.uid())
$$;
revoke all on function private.member_role(uuid) from public;
grant execute on function private.member_role(uuid) to authenticated;

-- No direct write grants. Mutations go through guarded, audited transactions below.
do $$ declare t text; begin
 foreach t in array array['leagues','memberships','divisions','teams','players','courts','availability','games','schedule_versions','fixtures','scoresheets','player_statistics','division_proposals','notifications','audit_events','workflow_runs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 if t='leagues' then execute 'create policy member_read on public.leagues for select to authenticated using (private.member_role(id) is not null)';
 elsif t='memberships' then execute 'create policy member_read on public.memberships for select to authenticated using (user_id=(select auth.uid()) or private.member_role(league_id)=''admin'')';
 elsif t in ('players','teams') then
   if t='teams' then execute 'create policy member_read on public.teams for select to authenticated using (private.member_role(league_id) in (''admin'',''scorekeeper'') or coach_id=(select auth.uid()))';
   else execute 'create policy member_read on public.players for select to authenticated using (private.member_role(league_id)=''admin'' or exists(select 1 from public.teams t where t.id=team_id and t.coach_id=(select auth.uid())))'; end if;
 elsif t in ('notifications','audit_events','workflow_runs','division_proposals') then execute format('create policy member_read on public.%I for select to authenticated using (private.member_role(league_id)=''admin'')',t);
 elsif t='scoresheets' then execute 'create policy member_read on public.scoresheets for select to authenticated using (private.member_role(league_id) in (''admin'',''scorekeeper'') or submitted_by=(select auth.uid()))';
 else execute format('create policy member_read on public.%I for select to authenticated using (private.member_role(league_id) is not null)',t); end if;
 end loop;
end $$;

create function private.recalculate(l uuid) returns void language plpgsql security definer set search_path='' as $$
declare g record; hr int; ar int; delta int; outcome numeric;
begin
 update public.teams set rating=initial_rating where league_id=l;
 for g in select * from public.games where league_id=l and status='confirmed' order by played_at,id loop
 select rating into hr from public.teams where id=g.home_team_id;
 select rating into ar from public.teams where id=g.away_team_id;
 outcome:=case when g.home_score>g.away_score then 1 when g.home_score=g.away_score then .5 else 0 end;
 delta:=round(32*(outcome-1/(1+power(10::numeric,(ar-hr)::numeric/400))));
 update public.teams set rating=hr+delta where id=g.home_team_id;
 update public.teams set rating=ar-delta where id=g.away_team_id;
 end loop;
end $$;
revoke all on function private.recalculate(uuid) from public,anon,authenticated;

create function private.validate_schedule(l uuid,v uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.fixtures where version_id=v and league_id=l) then raise exception 'Schedule contains no fixtures'; end if;
 if exists(select 1 from public.fixtures f join public.games g on g.id=f.game_id join public.teams h on h.id=g.home_team_id join public.teams a on a.id=g.away_team_id
 where f.version_id=v and (h.status<>'approved' or a.status<>'approved' or (g.status<>'confirmed' and h.division_id is distinct from a.division_id))) then raise exception 'Teams must be approved and in the same division'; end if;
 if exists(select 1 from public.fixtures f where f.version_id=v and not exists(select 1 from public.availability a where a.league_id=l and a.court_id=f.court_id and a.confirmed and a.starts_at<=f.starts_at and a.ends_at>=f.ends_at)) then raise exception 'Outside confirmed gym availability'; end if;
 if exists(select 1 from public.fixtures a join public.fixtures b on a.version_id=b.version_id and a.id<b.id join public.games ga on ga.id=a.game_id join public.games gb on gb.id=b.game_id
 where a.version_id=v and ((a.court_id=b.court_id and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')) or
 (array[ga.home_team_id,ga.away_team_id] && array[gb.home_team_id,gb.away_team_id] and tstzrange(a.starts_at,a.ends_at+interval '30 minutes','[)') && tstzrange(b.starts_at,b.ends_at+interval '30 minutes','[)')))) then raise exception 'Court or team conflict / minimum rest violation'; end if;
 -- Every confirmed game stays at its original time and court, even across revisions.
 if exists(select 1 from public.fixtures old join public.schedule_versions ov on ov.id=old.version_id join public.games g on g.id=old.game_id
 where ov.league_id=l and ov.status='published' and g.status='confirmed' and not exists(select 1 from public.fixtures n where n.version_id=v and n.game_id=old.game_id and n.court_id=old.court_id and n.starts_at=old.starts_at and n.ends_at=old.ends_at)) then raise exception 'Completed fixtures cannot be changed or removed'; end if;
 if exists(select 1 from public.fixtures f join public.games g on g.id=f.game_id where f.version_id=v and g.status<>'confirmed' and f.starts_at<now()) then raise exception 'Unplayed fixtures must be in the future'; end if;
end $$;
revoke all on function private.validate_schedule(uuid,uuid) from public,anon,authenticated;

create function private.command(l uuid,action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); r text; id uuid; tid uuid; div_id uuid; v record; le record; t record; g record; item jsonb; stat jsonb;
 rating_value int; tier_value int; n int; hs int; aws int; target int; margin numeric; played int; wins int; losses int;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if action='create_league' then
 insert into public.leagues(name,slug,season_name,cutoff_date,owner_id,is_demo) values (p->>'name', 'league-'||gen_random_uuid()::text,coalesce(p->>'season','Fall 2026'),coalesce((p->>'cutoff')::date,'2026-09-01'),actor,coalesce((p->>'demo')::boolean,false)) returning * into le;
 l:=le.id;insert into public.memberships values(l,actor,'admin');
 insert into public.divisions(league_id,name,tier) values(l,'U14 · Premier',1),(l,'U14 · Competitive',2),(l,'U14 · Development',3);
 insert into public.audit_events(league_id,actor_id,action) values(l,actor,'league.created');return jsonb_build_object('id',l);
 end if;
 select * into le from public.leagues where leagues.id=l for update;
 if not found then raise exception 'League not found'; end if;
 r:=private.member_role(l);
 if action='register_team' then
 if r is null then
 if not le.is_public or le.is_demo then raise exception 'Registration is closed' using errcode='42501';end if;
 insert into public.memberships values(l,actor,'coach'); r:='coach'; end if;
 if r not in ('admin','coach') then raise exception 'Coach or administrator required' using errcode='42501';end if;
 if coalesce((p#>>'{assessment,experience}')::int,0) not between 1 and 5 or coalesce((p#>>'{assessment,yearsTogether}')::int,-1) not between 0 and 15 or coalesce((p#>>'{assessment,practicesPerWeek}')::int,-1) not between 0 and 7 then raise exception 'Invalid questionnaire';end if;
 rating_value:=800+(p#>>'{assessment,experience}')::int*75+least((p#>>'{assessment,yearsTogether}')::int,4)*25+least((p#>>'{assessment,practicesPerWeek}')::int,4)*15;
 tier_value:=case when rating_value>=1150 then 1 when rating_value>=950 then 2 else 3 end;
 insert into public.teams(league_id,name,coach_id,coach_email,phone,sms_consent,recommended_division,assessment,assessment_explanation,initial_rating,rating)
 values(l,p->>'name',actor,(select email from auth.users where auth.users.id=actor),nullif(p->>'phone',''),coalesce((p->>'sms_consent')::boolean,false),tier_value,p->'assessment',left(p->>'explanation',4000),rating_value,rating_value) returning teams.id into id;
 elsif action='set_sms_consent' then
 select * into t from public.teams where teams.id=(p->>'team_id')::uuid and league_id=l;
 if t.coach_id is distinct from actor then raise exception 'Only the coach can change SMS consent' using errcode='42501';end if;
 update public.teams set sms_consent=(p->>'consent')::boolean,phone=nullif(p->>'phone','') where teams.id=t.id;
 update public.notifications set status='suppressed',last_error='Coach opted out' where team_id=t.id and channel='sms' and status in ('pending','failed');
 elsif action='add_player' then
 select * into t from public.teams where teams.id=(p->>'team_id')::uuid and league_id=l;
 if t.id is null or (r is distinct from 'admin' and t.coach_id is distinct from actor) then raise exception 'Roster access denied' using errcode='42501';end if;
 if (p->>'birth_date')::date>le.cutoff_date or (p->>'birth_date')::date<le.cutoff_date-interval '21 years' then raise exception 'Invalid birth date';end if;
 insert into public.players(league_id,team_id,display_name,jersey,birth_date,guardian_consent) values(l,t.id,p->>'display_name',p->>'jersey',(p->>'birth_date')::date,coalesce((p->>'guardian_consent')::boolean,false)) returning players.id into id;
 elsif action='submit_scoresheet' then
 select * into g from public.games where games.id=(p->>'game_id')::uuid and league_id=l;
 if g.id is null or (r not in ('admin','scorekeeper') and not exists(select 1 from public.teams where teams.id in (g.home_team_id,g.away_team_id) and coach_id=actor)) or r is null then raise exception 'Scoresheet access denied' using errcode='42501';end if;
 if not exists(select 1 from public.fixtures f join public.schedule_versions sv on sv.id=f.version_id where f.game_id=g.id and sv.status='published') then raise exception 'Game must be on the published schedule';end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='scoresheets' and o.name=p->>'storage_path' and split_part(o.name,'/',1)=l::text and split_part(o.name,'/',2)=actor::text) then raise exception 'Private scoresheet upload is required';end if;
 if p->>'source' not in ('meta','manual') then raise exception 'Invalid extraction provenance';end if;
 insert into public.scoresheets(league_id,game_id,sha256,storage_path,extraction,source,submitted_by) values(l,g.id,p->>'sha256',p->>'storage_path',p->'extraction',p->>'source',actor) returning scoresheets.id into id;
 else
 if r is null or (r<>'admin' and not(r='scorekeeper' and action in ('confirm_result','reject_scoresheet'))) then raise exception 'Administrator required' using errcode='42501';end if;
 case action
 when 'configure_public' then update public.leagues set is_public=(p->>'enabled')::boolean where leagues.id=l;
 when 'invite_member' then
 if p->>'role' not in ('coach','scorekeeper','referee') then raise exception 'Invalid member role';end if;
 select users.id into tid from auth.users where lower(email)=lower(p->>'email');
 if tid is null then raise exception 'This user must first create an account';end if;
 insert into public.memberships values(l,tid,p->>'role') on conflict(league_id,user_id) do update set role=excluded.role where memberships.role<>'admin';
 when 'approve_team' then
 select * into t from public.teams where teams.id=(p->>'team_id')::uuid and league_id=l and status='pending';if t.id is null then raise exception 'Pending team not found';end if;
 select divisions.id into div_id from public.divisions where league_id=l and tier=coalesce((p->>'tier')::int,t.recommended_division);
 if div_id is null then raise exception 'Invalid division';end if;
 update public.teams set status='approved',division_id=div_id where teams.id=t.id;
 when 'reject_team' then update public.teams set status='rejected' where teams.id=(p->>'team_id')::uuid and league_id=l and status='pending';
 when 'add_court' then insert into public.courts(league_id,name,venue) values(l,p->>'name',p->>'venue') returning courts.id into id;
 when 'add_availability' then insert into public.availability(league_id,court_id,starts_at,ends_at) values(l,(p->>'court_id')::uuid,(p->>'starts_at')::timestamptz,(p->>'ends_at')::timestamptz) returning availability.id into id;
 when 'verify_player' then
 select pl.*,d.max_age into t from public.players pl join public.teams te on te.id=pl.team_id join public.divisions d on d.id=te.division_id where pl.id=(p->>'player_id')::uuid and pl.league_id=l;
 if t.id is null then raise exception 'Player must be on an approved team';end if;
 update public.players set eligibility_status=case when t.guardian_consent and extract(year from age(le.cutoff_date,t.birth_date))<=t.max_age then 'verified' else 'ineligible' end where players.id=t.id;
 when 'draft_schedule' then
 if (p->>'base_revision')::int is distinct from le.revision or (p->>'data_revision')::int is distinct from le.data_revision then raise exception 'Stale league state. Refresh and regenerate.';end if;
 if jsonb_array_length(p->'fixtures')>3000 then raise exception 'Too many fixtures';end if;
 select coalesce(max(number),0)+1 into n from public.schedule_versions where league_id=l;
 insert into public.schedule_versions(league_id,number,base_revision,data_revision,explanation,created_by) values(l,n,le.revision,le.data_revision,left(p->>'explanation',4000),actor) returning schedule_versions.id into id;
 for item in select value from jsonb_array_elements(p->'fixtures') loop
 tid:=(item->>'game_id')::uuid;
 if not exists(select 1 from public.games where games.id=tid and league_id=l) then
 insert into public.games(id,league_id,home_team_id,away_team_id) values(tid,l,(item->>'home_team_id')::uuid,(item->>'away_team_id')::uuid);
 elsif not exists(select 1 from public.games where games.id=tid and league_id=l and home_team_id=(item->>'home_team_id')::uuid and away_team_id=(item->>'away_team_id')::uuid) then raise exception 'Game participants cannot change';end if;
 insert into public.fixtures(league_id,version_id,game_id,court_id,starts_at,ends_at) values(l,id,tid,(item->>'court_id')::uuid,(item->>'starts_at')::timestamptz,(item->>'ends_at')::timestamptz);
 end loop;
 perform private.validate_schedule(l,id);
 when 'reject_schedule' then update public.schedule_versions set status='rejected' where schedule_versions.id=(p->>'version_id')::uuid and league_id=l and status='draft';
 when 'publish_schedule' then
 select * into v from public.schedule_versions where schedule_versions.id=(p->>'version_id')::uuid and league_id=l and status='draft';
 if v.id is null then raise exception 'Draft schedule not found';end if;
 if v.base_revision<>le.revision or v.data_revision<>le.data_revision then raise exception 'Draft is stale. Regenerate before approval.';end if;
 perform private.validate_schedule(l,v.id);
 update public.schedule_versions set status='superseded' where league_id=l and status='published';
 update public.schedule_versions set status='published',approved_by=actor where schedule_versions.id=v.id;
 update public.leagues set revision=revision+1 where leagues.id=l;
 for t in select * from public.teams where league_id=l and status='approved' and exists(select 1 from public.fixtures f join public.games g on g.id=f.game_id where f.version_id=v.id and g.status<>'confirmed' and teams.id in (g.home_team_id,g.away_team_id)) loop
 insert into public.notifications(league_id,team_id,channel,destination,subject,body,idempotency_key)
 values(l,t.id,'email',t.coach_email,'Your Courtside schedule has been published',format('%s: schedule version %s has been approved. %s. Check the league schedule for your updated fixtures.',le.name,v.number,v.explanation),v.id::text||':'||t.id::text||':email') on conflict(idempotency_key) do nothing;
 if t.sms_consent and t.phone is not null then insert into public.notifications(league_id,team_id,channel,destination,subject,body,idempotency_key) values(l,t.id,'sms',t.phone,'Schedule updated',format('%s schedule v%s is approved. Check your coach portal. Reply STOP to opt out.',le.name,v.number),v.id::text||':'||t.id::text||':sms') on conflict(idempotency_key) do nothing;end if;
 end loop;
 when 'reject_scoresheet' then update public.scoresheets set status='rejected' where scoresheets.id=(p->>'sheet_id')::uuid and league_id=l and status='review';
 when 'confirm_result' then
 select * into v from public.scoresheets where scoresheets.id=(p->>'sheet_id')::uuid and league_id=l and status='review';if v.id is null then raise exception 'Scoresheet already reviewed or missing';end if;
 select * into g from public.games where games.id=v.game_id for update;
 if g.status='confirmed' and length(coalesce(p->>'correction_reason',''))<5 then raise exception 'A correction reason is required for an official result';end if;
 if not coalesce((p->>'reviewed')::boolean,false) then raise exception 'Human review confirmation required';end if;
 hs:=(p#>>'{extraction,homeScore}')::int;aws:=(p#>>'{extraction,awayScore}')::int;
 if hs is null or aws is null or hs not between 0 and 300 or aws not between 0 and 300 then raise exception 'Both valid final scores are required';end if;
 if (p#>>'{extraction,homeTeam}') is distinct from (select name from public.teams where teams.id=g.home_team_id) or (p#>>'{extraction,awayTeam}') is distinct from (select name from public.teams where teams.id=g.away_team_id) then raise exception 'Scoresheet team names do not match fixture';end if;
 if not exists(select 1 from public.fixtures f join public.schedule_versions sv on sv.id=f.version_id where f.game_id=g.id and sv.status='published' and f.starts_at<=now()) then raise exception 'Cannot confirm a game before its scheduled start';end if;
 delete from public.player_statistics where game_id=g.id;
 for stat in select value from jsonb_array_elements(coalesce(p#>'{extraction,players}','[]')) loop
 if stat->>'team' not in ('home','away') then raise exception 'Invalid player team';end if;
 insert into public.player_statistics(league_id,game_id,team_id,jersey,points,rebounds,assists) values(l,g.id,case when stat->>'team'='home' then g.home_team_id else g.away_team_id end,stat->>'jersey',(stat->>'points')::int,(stat->>'rebounds')::int,(stat->>'assists')::int);
 end loop;
 if coalesce((select sum(points) from public.player_statistics where game_id=g.id and team_id=g.home_team_id),0)>hs or coalesce((select sum(points) from public.player_statistics where game_id=g.id and team_id=g.away_team_id),0)>aws then raise exception 'Player points exceed final team score';end if;
 update public.games set status='confirmed',home_score=hs,away_score=aws,played_at=coalesce(played_at,(select f.starts_at from public.fixtures f join public.schedule_versions sv on sv.id=f.version_id where f.game_id=g.id and sv.status='published' limit 1)) where games.id=g.id;
 update public.scoresheets set status='superseded' where game_id=g.id and status='confirmed';
 update public.scoresheets set status='confirmed',extraction=p->'extraction' where scoresheets.id=v.id;
 perform private.recalculate(l);
 update public.division_proposals set status='stale' where league_id=l and status='pending';
 when 'propose_balance' then
 update public.division_proposals set status='stale' where league_id=l and status='pending';
 for t in select te.*,d.tier from public.teams te join public.divisions d on d.id=te.division_id where te.league_id=l and te.status='approved' loop
 select count(*),count(*) filter(where diff>0),count(*) filter(where diff<0),avg(diff) into played,wins,losses,margin from
 (select case when home_team_id=t.id then home_score-away_score else away_score-home_score end diff from public.games where league_id=l and status='confirmed' and t.id in (home_team_id,away_team_id) order by played_at desc,id desc limit 3) recent;
 target:=case when played=3 and wins=3 and margin>=15 then greatest(1,t.tier-1) when played=3 and losses=3 and margin<=-15 then least(3,t.tier+1) else t.tier end;
 if target<>t.tier then
 select divisions.id into div_id from public.divisions where league_id=l and tier=target;
 insert into public.division_proposals(league_id,team_id,from_division_id,to_division_id,reason,evidence,data_revision) values(l,t.id,t.division_id,div_id,format('Last 3 verified games: %s wins, %s losses, average margin %s. Recommend one tier %s; administrator review required.',wins,losses,round(margin,1),case when target<t.tier then 'up' else 'down' end),jsonb_build_object('games',played,'wins',wins,'losses',losses,'average_margin',margin,'rating',t.rating),le.data_revision);
 end if;
 end loop;
 when 'decide_proposal' then
 select * into v from public.division_proposals where division_proposals.id=(p->>'proposal_id')::uuid and league_id=l and status='pending';
 if v.id is null or v.data_revision<>le.data_revision then raise exception 'Proposal is missing or stale';end if;
 if (p->>'approve')::boolean then
 if exists(select 1 from public.players pl join public.divisions d on d.id=v.to_division_id where pl.team_id=v.team_id and (not pl.guardian_consent or pl.eligibility_status<>'verified' or extract(year from age(le.cutoff_date,pl.birth_date))>d.max_age)) then raise exception 'Resolve roster eligibility and guardian consent before moving division';end if;
 update public.teams set division_id=v.to_division_id where teams.id=v.team_id and division_id=v.from_division_id;
 update public.division_proposals set status='approved' where division_proposals.id=v.id;
 else update public.division_proposals set status='rejected' where division_proposals.id=v.id;end if;
 when 'claim_notifications' then
 id:=gen_random_uuid();
 return (with q as (
 update public.notifications set status='processing',attempts=attempts+1,lease_id=id,lease_until=now()+interval '2 minutes'
 where notifications.id in (select nn.id from public.notifications nn where nn.league_id=l and nn.attempts<5 and nn.created_at>now()-interval '23 hours' and ((nn.status in ('pending','failed') and nn.next_attempt_at<=now()) or(nn.status='processing' and nn.lease_until<now())) order by nn.created_at limit 20 for update skip locked)
 returning * ) select coalesce(jsonb_agg(to_jsonb(q)),'[]') from q);
 when 'finish_notification' then
 if p->>'status' not in ('accepted','failed','suppressed') then raise exception 'Invalid delivery state';end if;
 update public.notifications set status=p->>'status',provider_id=p->>'provider_id',last_error=left(p->>'error',300),next_attempt_at=now()+make_interval(secs=>least(3600,power(2,attempts)::int*30)),lease_until=null
 where notifications.id=(p->>'notification_id')::uuid and league_id=l and lease_id=(p->>'lease_id')::uuid and status='processing';
 else raise exception 'Unknown action';
 end case;
 end if;
 if action in ('register_team','approve_team','reject_team','add_court','add_availability','confirm_result','decide_proposal','add_player','verify_player') then update public.leagues set data_revision=data_revision+1 where leagues.id=l;end if;
 insert into public.audit_events(league_id,actor_id,action,detail) values(l,actor,action,jsonb_build_object('entity_id',coalesce(id::text,p->>'sheet_id',p->>'version_id',p->>'team_id',p->>'proposal_id'),'correction_reason',p->>'correction_reason'));
 return jsonb_build_object('id',id,'ok',true);
end $$;
revoke all on function private.command(uuid,text,jsonb) from public,anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;
create function public.league_command(p_league uuid,p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.command(p_league,p_action,p_payload) $$;
revoke all on function public.league_command(uuid,text,jsonb) from public,anon;
grant execute on function public.league_command(uuid,text,jsonb) to authenticated;

create function private.snapshot(l uuid,public_only boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r text; result jsonb; le public.leagues;
begin
 select * into le from public.leagues where id=l;
 r:=private.member_role(l);
 if le.id is null or (public_only and not le.is_public) or (not public_only and r is null) then raise exception 'League access denied' using errcode='42501';end if;
 result:=jsonb_build_object('league',jsonb_build_object('id',le.id,'name',le.name,'slug',le.slug,'season_name',le.season_name,'cutoff_date',le.cutoff_date,'revision',le.revision,'data_revision',le.data_revision,'is_demo',le.is_demo,'timezone',le.timezone),'role',case when public_only then 'public' else r end,
 'divisions',(select coalesce(jsonb_agg(to_jsonb(d) order by tier),'[]') from public.divisions d where league_id=l),
 'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'division_id',t.division_id,'recommended_division',t.recommended_division,'rating',t.rating,'initial_rating',t.initial_rating,'status',t.status)||case when not public_only and (r='admin' or t.coach_id=auth.uid()) then jsonb_build_object('coach_id',t.coach_id,'coach_email',t.coach_email,'phone',t.phone,'sms_consent',t.sms_consent,'assessment',t.assessment,'assessment_explanation',t.assessment_explanation) else '{}'::jsonb end order by t.name),'[]') from public.teams t where league_id=l and (not public_only or status='approved')),
 'courts',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.courts c where league_id=l),
 'games',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from public.games g where league_id=l and (not public_only or exists(select 1 from public.fixtures f join public.schedule_versions sv on sv.id=f.version_id where f.game_id=g.id and sv.status='published'))),
 'fixtures',(select coalesce(jsonb_agg(to_jsonb(f)||jsonb_build_object('home_team_id',g.home_team_id,'away_team_id',g.away_team_id) order by f.starts_at),'[]') from public.fixtures f join public.games g on g.id=f.game_id join public.schedule_versions sv on sv.id=f.version_id where f.league_id=l and (not public_only or sv.status='published')),
 'versions',(select coalesce(jsonb_agg(to_jsonb(sv) order by number desc),'[]') from public.schedule_versions sv where league_id=l and (not public_only or status='published')));
 if public_only then return result||jsonb_build_object('availability','[]'::jsonb,'scoresheets','[]'::jsonb,'players','[]'::jsonb,'notifications','[]'::jsonb,'audit','[]'::jsonb,'proposals','[]'::jsonb);end if;
 return result||jsonb_build_object(
 'availability',(select coalesce(jsonb_agg(to_jsonb(a) order by starts_at),'[]') from public.availability a where league_id=l),
 'scoresheets',(select coalesce(jsonb_agg(to_jsonb(s) order by created_at desc),'[]') from public.scoresheets s where league_id=l and (r in ('admin','scorekeeper') or submitted_by=auth.uid())),
 'players',(select coalesce(jsonb_agg(to_jsonb(pl)),'[]') from public.players pl where league_id=l and (r='admin' or exists(select 1 from public.teams t where t.id=pl.team_id and t.coach_id=auth.uid()))),
 'notifications',(select coalesce(jsonb_agg(to_jsonb(n)-'destination'-'body'-'lease_id'-'lease_until' order by created_at desc),'[]') from public.notifications n where league_id=l and r='admin'),
 'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by created_at desc),'[]') from (select * from public.audit_events where league_id=l and r='admin' order by created_at desc limit 100) a),
 'proposals',(select coalesce(jsonb_agg(to_jsonb(dp) order by created_at desc),'[]') from public.division_proposals dp where league_id=l and r='admin'));
end $$;
revoke all on function private.snapshot(uuid,boolean) from public;
grant execute on function private.snapshot(uuid,boolean) to authenticated,anon;
create function public.league_snapshot(p_league uuid,p_public boolean default false) returns jsonb language sql security invoker set search_path='' as $$select private.snapshot(p_league,p_public)$$;
revoke all on function public.league_snapshot(uuid,boolean) from public;
grant execute on function public.league_snapshot(uuid,boolean) to anon,authenticated;
create function public.my_leagues() returns setof public.leagues language sql stable security invoker set search_path='' as $$ select * from public.leagues order by created_at desc $$;
revoke all on function public.my_leagues() from public,anon;
grant execute on function public.my_leagues() to authenticated;
create function public.public_leagues() returns table(id uuid,name text,slug text,is_demo boolean) language sql stable security definer set search_path='' as $$select id,name,slug,is_demo from public.leagues where is_public order by created_at$$;
revoke all on function public.public_leagues() from public;
grant execute on function public.public_leagues() to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('scoresheets','scoresheets',false,6291456,array['image/jpeg','image/png','image/webp']),('youth-documents','youth-documents',false,6291456,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
create policy scoresheet_insert on storage.objects for insert to authenticated with check(bucket_id='scoresheets' and split_part(name,'/',2)=(select auth.uid())::text and private.member_role((split_part(name,'/',1))::uuid) in ('admin','coach','scorekeeper'));
create policy scoresheet_read on storage.objects for select to authenticated using(bucket_id='scoresheets' and (private.member_role((split_part(name,'/',1))::uuid) in ('admin','scorekeeper') or (split_part(name,'/',2)=(select auth.uid())::text and private.member_role((split_part(name,'/',1))::uuid)='coach')));
create policy youth_insert on storage.objects for insert to authenticated with check(bucket_id='youth-documents' and split_part(name,'/',2)=(select auth.uid())::text and private.member_role((split_part(name,'/',1))::uuid) in ('admin','coach'));
create policy youth_read on storage.objects for select to authenticated using(bucket_id='youth-documents' and (private.member_role((split_part(name,'/',1))::uuid)='admin' or (split_part(name,'/',2)=(select auth.uid())::text and private.member_role((split_part(name,'/',1))::uuid)='coach')));
